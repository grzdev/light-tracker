import express from "express";

import {
  getHome,
  getSensors,
  getLatestObservation,
  getLatestEvent,
  getEvents,
  getSummariesBetween,
} from "../services/homeService.js";

import {
  calculateAvailabilityPercent,
  calculateCoveragePercent,
  calculateEventDurations,
  getPeriodSeconds,
  calculateDailyCoverage,
  formatLagosTimestamp,
} from "../utils/metrics.js";

import {
  getLagosDateString,
  getLagosDateTime,
  startOfLagosDay,
  subtractDays,
} from "../utils/time.js";

const router = express.Router();

const LAGOS_TIME_ZONE = "Africa/Lagos";
const DEFAULT_STALE_THRESHOLD_SECONDS = 180;

/**
 * Standard internal error response.
 */
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

    const [
      sensors,
      latestObservation,
      latestEvent,
    ] = await Promise.all([
      getSensors(homeId),
      getLatestObservation(homeId),
      getLatestEvent(homeId),
    ]);

    const gridSensor = sensors.find(
      (sensor) => sensor.role === "GRID"
    );

    const backupSensor = sensors.find(
      (sensor) => sensor.role === "BACKUP"
    );

    const now = new Date();

    const staleThresholdSeconds = Number(
      process.env.STALE_SENSOR_THRESHOLD_SECONDS ||
        DEFAULT_STALE_THRESHOLD_SECONDS
    );

    const latestObservationTime =
      latestObservation?.polled_at
        ? new Date(latestObservation.polled_at)
        : null;

    const secondsSinceObservation =
      latestObservationTime
        ? Math.max(
            0,
            Math.floor(
              (now.getTime() -
                latestObservationTime.getTime()) /
                1000
            )
          )
        : null;

    const observationIsStale =
      secondsSinceObservation === null ||
      secondsSinceObservation >
        staleThresholdSeconds;

    /**
     * No event means there is no confirmed state.
     */
    if (!latestEvent) {
      return res.json({
        homeId,
        state: "UNKNOWN",
        confidence: "LOW",
        reasonCode: observationIsStale
          ? "SENSOR_DATA_STALE"
          : "BOTH_SENSORS_OFFLINE",
        since: latestObservationTime
          ? getLagosDateTime(latestObservationTime)
          : null,
        durationSeconds: 0,
        lastUpdated: latestObservationTime
          ? getLagosDateTime(latestObservationTime)
          : null,
        sensors: {
          grid: {
            id: gridSensor?.id ?? null,
            online: latestObservation
              ? latestObservation.sensor_a_online
              : false,
            lastSeen: latestObservationTime
              ? getLagosDateTime(latestObservationTime)
              : null,
          },
          backup: {
            id: backupSensor?.id ?? null,
            online: latestObservation
              ? latestObservation.sensor_b_online
              : false,
            lastSeen: latestObservationTime
              ? getLagosDateTime(latestObservationTime)
              : null,
          },
        },
      });
    }

    const currentStateStarted = new Date(
      latestEvent.recorded_at
    );

    /**
     * If sensor data is stale, the current state
     * becomes UNKNOWN regardless of the last event.
     *
     * Historical events remain unchanged.
     */
    const currentState = observationIsStale
      ? "UNKNOWN"
      : latestEvent.state;

    const currentConfidence = observationIsStale
      ? "LOW"
      : latestEvent.confidence;

    const currentReasonCode = observationIsStale
      ? "SENSOR_DATA_STALE"
      : latestEvent.reason_code;

    const durationSeconds = observationIsStale
      ? latestObservationTime
        ? Math.max(
            0,
            Math.floor(
              (now.getTime() -
                latestObservationTime.getTime()) /
                1000
            )
          )
        : 0
      : Math.max(
          0,
          Math.floor(
            (now.getTime() -
              currentStateStarted.getTime()) /
              1000
          )
        );

    const since = observationIsStale
      ? latestObservationTime
        ? getLagosDateTime(latestObservationTime)
        : null
      : getLagosDateTime(currentStateStarted);

    const lastUpdated = latestObservationTime
      ? getLagosDateTime(latestObservationTime)
      : getLagosDateTime(
          new Date(latestEvent.recorded_at)
        );

    return res.json({
      homeId,
      state: currentState,
      confidence: currentConfidence,
      reasonCode: currentReasonCode,
      since,
      durationSeconds,
      lastUpdated,
      sensors: {
        grid: {
          id: gridSensor?.id ?? null,
          online: latestObservation
            ? latestObservation.sensor_a_online
            : false,
          lastSeen: latestObservationTime
            ? getLagosDateTime(latestObservationTime)
            : null,
        },
        backup: {
          id: backupSensor?.id ?? null,
          online: latestObservation
            ? latestObservation.sensor_b_online
            : false,
          lastSeen: latestObservationTime
            ? getLagosDateTime(latestObservationTime)
            : null,
        },
      },
    });
  } catch (error) {
    return internalError(
      res,
      error,
      "Current status error"
    );
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

    const requestedLimit = Number(
      req.query.limit ?? 100
    );

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

    /**
     * The contract expects durations in seconds.
     *
     * The API's date range is inclusive. When the caller
     * explicitly requests 23:59:59, treat the end as the
     * final second of that day rather than cutting the
     * duration one second short.
     */
    let durationEnd = to < now ? to : now;

    const toIsEndOfSecond =
      to.getMilliseconds() === 0;

    if (toIsEndOfSecond) {
      durationEnd = new Date(
        durationEnd.getTime() + 1000
      );
    }

    const eventsWithDurations =
      calculateEventDurations(
        events,
        durationEnd
      );

    return res.json({
      homeId,
      from: formatLagosTimestamp(from),
      to: formatLagosTimestamp(to),
      events: eventsWithDurations.map(
        (event) => ({
          id: event.id,
          state: event.state,
          reasonCode: event.reason_code,
          confidence: event.confidence,
          recordedAt: formatLagosTimestamp(
            event.recorded_at
          ),
          durationSeconds:
            event.durationSeconds,
        })
      ),
    });
  } catch (error) {
    return internalError(
      res,
      error,
      "Events error"
    );
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

    if (
      ![
        "today",
        "yesterday",
        "week",
        "month",
      ].includes(period)
    ) {
      return res.status(400).json({
        error: "INVALID_DATE_RANGE",
        message:
          "period must be today, yesterday, week, or month",
        statusCode: 400,
      });
    }

    const today = new Date();

    const todayString =
      getLagosDateString(today);

    let fromDate;
    let toDate;

    if (period === "today") {
      const requestedDate =
        req.query.date || todayString;

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          requestedDate
        )
      ) {
        return res.status(400).json({
          error: "INVALID_DATE_RANGE",
          message:
            "date must use YYYY-MM-DD format",
          statusCode: 400,
        });
      }

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

      fromDate =
        getLagosDateString(start);

      toDate = todayString;
    }

    if (period === "month") {
      const start = new Date(
        `${todayString.slice(0, 7)}-01T00:00:00+01:00`
      );

      fromDate =
        getLagosDateString(start);

      toDate = todayString;
    }

    const summaries =
      await getSummariesBetween(
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

    const gridOnSeconds =
      summaries.reduce(
        (total, item) =>
          total +
          Number(
            item.grid_on_seconds ?? 0
          ),
        0
      );

    const gridOffSeconds =
      summaries.reduce(
        (total, item) =>
          total +
          Number(
            item.grid_off_seconds ?? 0
          ),
        0
      );

    const unknownSeconds =
      summaries.reduce(
        (total, item) =>
          total +
          Number(
            item.unknown_seconds ?? 0
          ),
        0
      );

    const outageCount =
      summaries.reduce(
        (total, item) =>
          total +
          Number(
            item.outage_count ?? 0
          ),
        0
      );

    const longestOutageSeconds =
      Math.max(
        0,
        ...summaries.map((item) =>
          Number(
            item.longest_outage_seconds ?? 0
          )
        )
      );

    const avgOutageDurationSeconds =
      outageCount > 0
        ? Math.round(
            gridOffSeconds / outageCount
          )
        : 0;

    /**
     * Availability excludes UNKNOWN.
     *
     * ON / (ON + OFF)
     */
    const availabilityPercent =
      calculateAvailabilityPercent(
        gridOnSeconds,
        gridOffSeconds
      );

    /**
     * Calculate the period boundaries in actual
     * timestamps for coverage.
     */
    let periodStart;
    let periodEnd;

    if (period === "today") {
      periodStart = new Date(
        `${fromDate}T00:00:00+01:00`
      );

      periodEnd =
        fromDate === todayString
          ? today
          : new Date(
              `${fromDate}T23:59:59+01:00`
            );

      /**
       * A historical day is a complete 24-hour period.
       */
      if (fromDate !== todayString) {
        periodEnd = new Date(
          `${fromDate}T00:00:00+01:00`
        );

        periodEnd.setTime(
          periodEnd.getTime() +
            24 * 60 * 60 * 1000
        );
      }
    } else if (period === "yesterday") {
      periodStart = new Date(
        `${fromDate}T00:00:00+01:00`
      );

      periodEnd = new Date(
        periodStart.getTime() +
          24 * 60 * 60 * 1000
      );
    } else if (period === "week") {
      periodStart = new Date(
        `${fromDate}T00:00:00+01:00`
      );

      periodEnd =
        toDate === todayString
          ? today
          : new Date(
              `${toDate}T23:59:59+01:00`
            );
    } else {
      periodStart = new Date(
        `${fromDate}T00:00:00+01:00`
      );

      periodEnd =
        toDate === todayString
          ? today
          : new Date(
              `${toDate}T23:59:59+01:00`
            );
    }

    const periodSeconds =
      period === "today" &&
      fromDate !== todayString
        ? 24 * 60 * 60
        : getPeriodSeconds(
            period,
            periodStart,
            periodEnd
          );

    const observedSeconds =
      gridOnSeconds +
      gridOffSeconds +
      unknownSeconds;

    const coveragePercent =
      calculateCoveragePercent(
        observedSeconds,
        periodSeconds
      );

    /**
     * Hourly breakdown is required for today.
     */
    const hourlyBreakdown = [];

    if (period === "today") {
      const events = await getEvents(
        homeId,
        `${fromDate}T00:00:00+01:00`,
        `${toDate}T23:59:59+01:00`,
        1000
      );

      /**
       * Events are returned newest-first.
       *
       * For each hour, find the most recent event
       * that had already occurred by that hour.
       */
      for (let hour = 0; hour < 24; hour++) {
        const eventForHour = events
          .filter((event) => {
            const eventDate =
              new Date(event.recorded_at);

            const eventHour = Number(
              new Intl.DateTimeFormat(
                "en-US",
                {
                  timeZone:
                    LAGOS_TIME_ZONE,
                  hour: "numeric",
                  hourCycle: "h23",
                }
              ).format(eventDate)
            );

            const eventDateString =
              getLagosDateString(eventDate);

            return (
              eventDateString === fromDate &&
              eventHour <= hour
            );
          })
          .sort(
            (a, b) =>
              new Date(b.recorded_at) -
              new Date(a.recorded_at)
          )[0];

        /**
         * If no event happened today before this hour,
         * look for the most recent event before today.
         *
         * This allows a state that began yesterday
         * to correctly carry into today's hours.
         */
        const previousEvent =
          !eventForHour
            ? events
                .filter(
                  (event) =>
                    new Date(
                      event.recorded_at
                    ) <
                    new Date(
                      `${fromDate}T00:00:00+01:00`
                    )
                )
                .sort(
                  (a, b) =>
                    new Date(b.recorded_at) -
                    new Date(a.recorded_at)
                )[0]
            : null;

        const selectedEvent =
          eventForHour || previousEvent;

        if (!selectedEvent) {
          continue;
        }

        hourlyBreakdown.push({
          hour,
          state: selectedEvent.state,
          availabilityPercent:
            selectedEvent.state === "ON"
              ? 100
              : selectedEvent.state ===
                "UNKNOWN"
              ? null
              : 0,
        });
      }
    }

    return res.json({
      homeId,
      period,
      date:
        period === "today"
          ? fromDate
          : null,
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
    return internalError(
      res,
      error,
      "Summary error"
    );
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

    const [
      sensors,
      latestObservation,
    ] = await Promise.all([
      getSensors(homeId),
      getLatestObservation(homeId),
    ]);

    const staleThresholdSeconds = Number(
      process.env.STALE_SENSOR_THRESHOLD_SECONDS ||
        DEFAULT_STALE_THRESHOLD_SECONDS
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

        lastSeenAt =
          latestObservation.polled_at;
      }

      const lastSeenDate = lastSeenAt
        ? new Date(lastSeenAt)
        : null;

      const secondsSinceLastSeen =
        lastSeenDate
          ? Math.max(
              0,
              Math.floor(
                (now.getTime() -
                  lastSeenDate.getTime()) /
                  1000
              )
            )
          : null;

      const isStale =
        secondsSinceLastSeen === null ||
        secondsSinceLastSeen >
          staleThresholdSeconds;

      return {
        id: sensor.id,
        role: sensor.role,
        deviceId: sensor.device_id,
        online,
        lastSeenAt: lastSeenDate
          ? getLagosDateTime(lastSeenDate)
          : null,
        staleSince:
          isStale && lastSeenDate
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

    const today =
      startOfLagosDay(new Date());

    const start = subtractDays(
      today,
      6
    );

    const fromDate =
      getLagosDateString(start);

    const toDate =
      getLagosDateString(today);

    const summaries =
      await getSummariesBetween(
        homeId,
        fromDate,
        toDate
      );

    const summaryMap = new Map(
      summaries.map((summary) => [
        String(summary.date),
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

      const summary =
        summaryMap.get(dateString);

      const gridOnSeconds = Number(
        summary?.grid_on_seconds ?? 0
      );

      const gridOffSeconds = Number(
        summary?.grid_off_seconds ?? 0
      );

      const unknownSeconds = Number(
        summary?.unknown_seconds ?? 0
      );

      const availabilityPercent =
        calculateAvailabilityPercent(
          gridOnSeconds,
          gridOffSeconds
        );

      const coveragePercent =
        summary
          ? calculateDailyCoverage(summary)
          : 0;

      days.push({
        date: dateString,

        gridOnHours: Number(
          (
            gridOnSeconds / 3600
          ).toFixed(2)
        ),

        gridOffHours: Number(
          (
            gridOffSeconds / 3600
          ).toFixed(2)
        ),

        unknownHours: Number(
          (
            unknownSeconds / 3600
          ).toFixed(2)
        ),

        availabilityPercent,

        coveragePercent,
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