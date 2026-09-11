import express from "express";

import {
  getHome,
  getSensors,
  getLatestObservation,
  getLatestEvent,
  getEvents,
  getDailySummary,
  getSummariesBetween,
} from "../services/homeService.js";

import {
  getLagosDateString,
  getLagosDateTime,
  startOfLagosDay,
  subtractDays,
} from "../utils/time.js";

const router = express.Router();

function internalError(res, error, label) {
  console.error(`${label}:`, error);

  return res.status(500).json({
    error: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
    statusCode: 500,
  });
}

/**
 * GET /homes/:homeId/current-status
 */
router.get("/:homeId/current-status", async (req, res) => {
  try {
    const { homeId } = req.params;

    const home = await getHome(homeId);

    if (!home) {
      return res.status(404).json({
        error: "HOME_NOT_FOUND",
        message: `No home found with ID ${homeId}`,
        statusCode: 404,
      });
    }

    const [sensors, latestObservation, latestEvent] =
      await Promise.all([
        getSensors(homeId),
        getLatestObservation(homeId),
        getLatestEvent(homeId),
      ]);

    if (!latestEvent) {
      return res.json({
        homeId,
        state: "UNKNOWN",
        confidence: "LOW",
        reasonCode: "BOTH_SENSORS_OFFLINE",
        since: null,
        durationSeconds: 0,
        lastUpdated: null,
        sensors: {
          grid: {
            id: sensors.find((s) => s.role === "GRID")?.id ?? null,
            online: false,
            lastSeen: null,
          },
          backup: {
            id: sensors.find((s) => s.role === "BACKUP")?.id ?? null,
            online: false,
            lastSeen: null,
          },
        },
      });
    }

    const gridSensor = sensors.find((s) => s.role === "GRID");
    const backupSensor = sensors.find((s) => s.role === "BACKUP");

    const currentStateStarted = new Date(latestEvent.recorded_at);
    const now = new Date();

    const durationSeconds = Math.max(
      0,
      Math.floor((now - currentStateStarted) / 1000)
    );

    const lastUpdated = latestObservation?.polled_at
      ? getLagosDateTime(new Date(latestObservation.polled_at))
      : getLagosDateTime(new Date(latestEvent.recorded_at));

    return res.json({
      homeId,
      state: latestEvent.state,
      confidence: latestEvent.confidence,
      reasonCode: latestEvent.reason_code,
      since: getLagosDateTime(currentStateStarted),
      durationSeconds,
      lastUpdated,
      sensors: {
        grid: {
          id: gridSensor?.id ?? null,
          online: latestObservation
            ? latestObservation.sensor_a_online
            : false,
          lastSeen: latestObservation?.polled_at
            ? getLagosDateTime(
                new Date(latestObservation.polled_at)
              )
            : null,
        },
        backup: {
          id: backupSensor?.id ?? null,
          online: latestObservation
            ? latestObservation.sensor_b_online
            : false,
          lastSeen: latestObservation?.polled_at
            ? getLagosDateTime(
                new Date(latestObservation.polled_at)
              )
            : null,
        },
      },
    });
  } catch (error) {
    return internalError(res, error, "Current status error");
  }
});

/**
 * GET /homes/:homeId/events
 */
router.get("/:homeId/events", async (req, res) => {
  try {
    const { homeId } = req.params;

    const home = await getHome(homeId);

    if (!home) {
      return res.status(404).json({
        error: "HOME_NOT_FOUND",
        message: `No home found with ID ${homeId}`,
        statusCode: 404,
      });
    }

    const now = new Date();

    const from = req.query.from
      ? new Date(req.query.from)
      : startOfLagosDay(now);

    const to = req.query.to
      ? new Date(req.query.to)
      : now;

    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      from > to
    ) {
      return res.status(400).json({
        error: "INVALID_DATE_RANGE",
        message: "The supplied date range is invalid",
        statusCode: 400,
      });
    }

    const requestedLimit = Number(req.query.limit ?? 100);

    const limit =
      Number.isInteger(requestedLimit) &&
      requestedLimit > 0 &&
      requestedLimit <= 1000
        ? requestedLimit
        : 100;

    const events = await getEvents(
      homeId,
      from.toISOString(),
      to.toISOString(),
      limit
    );

    return res.json({
      homeId,
      from: getLagosDateTime(from),
      to: getLagosDateTime(to),
      events: events.map((event) => ({
        id: event.id,
        state: event.state,
        reasonCode: event.reason_code,
        confidence: event.confidence,
        recordedAt: getLagosDateTime(
          new Date(event.recorded_at)
        ),
        durationSeconds:
          event.duration_in_previous_state_ms === null
            ? null
            : Math.floor(
                event.duration_in_previous_state_ms / 1000
              ),
      })),
    });
  } catch (error) {
    return internalError(res, error, "Events error");
  }
});

/**
 * GET /homes/:homeId/summary
 */
router.get("/:homeId/summary", async (req, res) => {
  try {
    const { homeId } = req.params;

    const home = await getHome(homeId);

    if (!home) {
      return res.status(404).json({
        error: "HOME_NOT_FOUND",
        message: `No home found with ID ${homeId}`,
        statusCode: 404,
      });
    }

    const period = req.query.period || "today";

    if (!["today", "yesterday", "week", "month"].includes(period)) {
      return res.status(400).json({
        error: "INVALID_DATE_RANGE",
        message:
          "period must be today, yesterday, week, or month",
        statusCode: 400,
      });
    }

    const today = new Date();
    const todayString = getLagosDateString(today);

    let fromDate;
    let toDate;

    if (period === "today") {
      const requestedDate = req.query.date || todayString;

      fromDate = requestedDate;
      toDate = requestedDate;
    }

    if (period === "yesterday") {
      const yesterday = subtractDays(
        startOfLagosDay(today),
        1
      );

      const yesterdayString =
        getLagosDateString(yesterday);

      fromDate = yesterdayString;
      toDate = yesterdayString;
    }

    if (period === "week") {
      const start = subtractDays(
        startOfLagosDay(today),
        6
      );

      fromDate = getLagosDateString(start);
      toDate = todayString;
    }

    if (period === "month") {
      const start = new Date(
        `${todayString.slice(0, 7)}-01T00:00:00+01:00`
      );

      fromDate = getLagosDateString(start);
      toDate = todayString;
    }

    const summaries = await getSummariesBetween(
      homeId,
      fromDate,
      toDate
    );

    if (summaries.length === 0) {
      return res.status(404).json({
        error: "SUMMARY_NOT_FOUND",
        message: `No summary found for ${fromDate}`,
        statusCode: 404,
      });
    }

    const gridOnSeconds = summaries.reduce(
      (total, item) => total + Number(item.grid_on_seconds),
      0
    );

    const gridOffSeconds = summaries.reduce(
      (total, item) => total + Number(item.grid_off_seconds),
      0
    );

    const unknownSeconds = summaries.reduce(
      (total, item) => total + Number(item.unknown_seconds),
      0
    );

    const outageCount = summaries.reduce(
      (total, item) => total + Number(item.outage_count),
      0
    );

    const longestOutageSeconds = Math.max(
      ...summaries.map((item) =>
        Number(item.longest_outage_seconds ?? 0)
      )
    );

    const avgOutageDurationSeconds =
      outageCount > 0
        ? Math.round(gridOffSeconds / outageCount)
        : 0;

    const totalObserved =
      gridOnSeconds +
      gridOffSeconds +
      unknownSeconds;

    const availabilityPercent =
      totalObserved > 0
        ? Number(
            ((gridOnSeconds / totalObserved) * 100).toFixed(1)
          )
        : 0;

    const coveragePercent =
      summaries.length > 0
        ? Number(
            (
              summaries.reduce(
                (total, item) =>
                  total + Number(item.coverage_percent ?? 0),
                0
              ) / summaries.length
            ).toFixed(1)
          )
        : 0;

    const hourlyBreakdown = [];

    if (period === "today") {
      const events = await getEvents(
        homeId,
        `${fromDate}T00:00:00+01:00`,
        `${toDate}T23:59:59+01:00`,
        1000
      );

      for (let hour = 0; hour < 24; hour++) {
        const eventForHour = events
          .filter((event) => {
            const eventDate = new Date(event.recorded_at);

            const hourString = new Intl.DateTimeFormat(
              "en-US",
              {
                timeZone: "Africa/Lagos",
                hour: "numeric",
                hourCycle: "h23",
              }
            ).format(eventDate);

            return Number(hourString) <= hour;
          })
          .sort(
            (a, b) =>
              new Date(b.recorded_at) -
              new Date(a.recorded_at)
          )[0];

        if (!eventForHour) {
          continue;
        }

        hourlyBreakdown.push({
          hour,
          state: eventForHour.state,
          availabilityPercent:
            eventForHour.state === "ON"
              ? 100
              : eventForHour.state === "UNKNOWN"
                ? null
                : 0,
        });
      }
    }

    return res.json({
      homeId,
      period,
      date: period === "today" ? fromDate : null,
      gridOnSeconds,
      gridOffSeconds,
      unknownSeconds,
      outageCount,
      longestOutageSeconds,
      avgOutageDurationSeconds,
      availabilityPercent,
      coveragePercent,
      hourlyBreakdown,
    });
  } catch (error) {
    return internalError(res, error, "Summary error");
  }
});

/**
 * GET /homes/:homeId/device-health
 */
router.get("/:homeId/device-health", async (req, res) => {
  try {
    const { homeId } = req.params;

    const home = await getHome(homeId);

    if (!home) {
      return res.status(404).json({
        error: "HOME_NOT_FOUND",
        message: `No home found with ID ${homeId}`,
        statusCode: 404,
      });
    }

    const sensors = await getSensors(homeId);
    const latestObservation =
      await getLatestObservation(homeId);

    const staleThresholdSeconds = Number(
      process.env.STALE_SENSOR_THRESHOLD_SECONDS || 180
    );

    const now = new Date();

    const result = sensors.map((sensor) => {
      let online = false;
      let lastSeenAt = null;

      if (latestObservation) {
        online =
          sensor.role === "GRID"
            ? latestObservation.sensor_a_online
            : latestObservation.sensor_b_online;

        lastSeenAt = latestObservation.polled_at;
      }

      const lastSeenDate = lastSeenAt
        ? new Date(lastSeenAt)
        : null;

      const secondsSinceLastSeen = lastSeenDate
        ? Math.floor(
            (now - lastSeenDate) / 1000
          )
        : null;

      const isStale =
        secondsSinceLastSeen === null ||
        secondsSinceLastSeen > staleThresholdSeconds;

      return {
        id: sensor.id,
        role: sensor.role,
        deviceId: sensor.device_id,
        online,
        lastSeenAt: lastSeenDate
          ? getLagosDateTime(lastSeenDate)
          : null,
        staleSince: isStale && lastSeenDate
          ? getLagosDateTime(lastSeenDate)
          : null,
        isStale,
        staleThresholdSeconds,
      };
    });

    return res.json({
      homeId,
      sensors: result,
    });
  } catch (error) {
    return internalError(
      res,
      error,
      "Device health error"
    );
  }
});

/**
 * GET /homes/:homeId/weekly-chart
 */
router.get("/:homeId/weekly-chart", async (req, res) => {
  try {
    const { homeId } = req.params;

    const home = await getHome(homeId);

    if (!home) {
      return res.status(404).json({
        error: "HOME_NOT_FOUND",
        message: `No home found with ID ${homeId}`,
        statusCode: 404,
      });
    }

    const today = startOfLagosDay(new Date());

    const start = subtractDays(today, 6);

    const fromDate = getLagosDateString(start);
    const toDate = getLagosDateString(today);

    const summaries = await getSummariesBetween(
      homeId,
      fromDate,
      toDate
    );

    const summaryMap = new Map(
      summaries.map((summary) => [
        summary.date,
        summary,
      ])
    );

    const days = [];

    for (let i = 0; i < 7; i++) {
      const date = subtractDays(
        today,
        6 - i
      );

      const dateString =
        getLagosDateString(date);

      const summary = summaryMap.get(dateString);

      days.push({
        date: dateString,
        gridOnHours: summary
          ? Number(
              (
                Number(summary.grid_on_seconds) / 3600
              ).toFixed(2)
            )
          : 0,
        gridOffHours: summary
          ? Number(
              (
                Number(summary.grid_off_seconds) / 3600
              ).toFixed(2)
            )
          : 0,
        unknownHours: summary
          ? Number(
              (
                Number(summary.unknown_seconds) / 3600
              ).toFixed(2)
            )
          : 0,
        availabilityPercent: summary
          ? Number(summary.availability_percent ?? 0)
          : 0,
        coveragePercent: summary
          ? Number(summary.coverage_percent ?? 0)
          : 0,
      });
    }

    return res.json({
      homeId,
      days,
    });
  } catch (error) {
    return internalError(
      res,
      error,
      "Weekly chart error"
    );
  }
});

export default router;