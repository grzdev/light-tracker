const SECONDS_PER_DAY = 24 * 60 * 60;

export function calculateAvailabilityPercent(
  gridOnSeconds,
  gridOffSeconds
) {
  const onSeconds = Number(gridOnSeconds || 0);
  const offSeconds = Number(gridOffSeconds || 0);

  const confirmedSeconds = onSeconds + offSeconds;

  if (confirmedSeconds <= 0) {
    return null;
  }

  return Number(
    ((onSeconds / confirmedSeconds) * 100).toFixed(2)
  );
}

export function calculateCoveragePercent(
  confirmedSeconds,
  periodSeconds
) {
  const confirmed = Number(confirmedSeconds || 0);
  const period = Number(periodSeconds || 0);

  if (period <= 0) {
    return null;
  }

  const safeConfirmedSeconds = Math.min(
    Math.max(confirmed, 0),
    period
  );

  return Number(
    ((safeConfirmedSeconds / period) * 100).toFixed(2)
  );
}

export function calculateEventDurations(
  events,
  endTime = new Date()
) {
  if (!events?.length) {
    return [];
  }

  return events.map((event, index) => {
    const start = new Date(event.recorded_at);

    const end =
      index > 0
        ? new Date(events[index - 1].recorded_at)
        : new Date(endTime);

    const durationSeconds = Math.max(
      0,
      Math.round(
        (end.getTime() - start.getTime()) / 1000
      )
    );

    return {
      ...event,
      durationSeconds,
    };
  });
}

export function getPeriodSeconds(
  period,
  start,
  end
) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (
    period === "today" ||
    period === "month"
  ) {
    return Math.max(
      0,
      Math.floor(
        (endDate.getTime() - startDate.getTime()) /
          1000
      )
    );
  }

  if (period === "yesterday") {
    return SECONDS_PER_DAY;
  }

  if (period === "week") {
    return SECONDS_PER_DAY * 7;
  }

  return 0;
}
export function calculateDailyCoverage(summary) {
  const confirmedSeconds =
    Number(summary?.grid_on_seconds || 0) +
    Number(summary?.grid_off_seconds || 0);

  return calculateCoveragePercent(
    confirmedSeconds,
    SECONDS_PER_DAY
  );
}

export function formatLagosTimestamp(date) {
  if (!date) {
    return null;
  }

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }
  ).formatToParts(value);

  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ])
  );

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+01:00`;
}
