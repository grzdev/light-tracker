const SECONDS_PER_DAY = 24 * 60 * 60;

/**
 * Calculate availability from confirmed ON/OFF time.
 *
 * UNKNOWN time is excluded.
 *
 * Availability =
 * ON / (ON + OFF) * 100
 */
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

/**
 * Calculate coverage from observed time.
 *
 * ON, OFF and UNKNOWN are all considered observed.
 * Missing time is not observed.
 */
export function calculateCoveragePercent(
  observedSeconds,
  periodSeconds
) {
  const observed = Number(observedSeconds || 0);
  const period = Number(periodSeconds || 0);

  if (period <= 0) {
    return null;
  }

  const safeObservedSeconds = Math.min(
    Math.max(observed, 0),
    period
  );

  return Number(
    ((safeObservedSeconds / period) * 100).toFixed(2)
  );
}

/**
 * Calculate the duration represented by each event.
 *
 * Events are expected newest-first.
 *
 * The newest event runs until endTime.
 * Older events run until the next newer event.
 */
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

/**
 * Return the number of seconds in a summary period.
 *
 * today:
 *   elapsed time from start of the selected day until now
 *
 * yesterday:
 *   full 24-hour day
 *
 * week:
 *   seven full days
 *
 * month:
 *   elapsed time from start of the month until now
 */
export function getPeriodSeconds(
  period,
  start,
  end
) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (period === "today" || period === "month") {
    return Math.max(
      0,
      Math.floor(
        (endDate.getTime() - startDate.getTime()) / 1000
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

/**
 * Calculate daily coverage.
 *
 * ON + OFF + UNKNOWN = observed time.
 */
export function calculateDailyCoverage(summary) {
  const observedSeconds =
    Number(summary?.grid_on_seconds || 0) +
    Number(summary?.grid_off_seconds || 0) +
    Number(summary?.unknown_seconds || 0);

  return calculateCoveragePercent(
    observedSeconds,
    SECONDS_PER_DAY
  );
}

/**
 * Format a timestamp as Africa/Lagos ISO 8601.
 *
 * Example:
 * 2026-09-11T21:00:00Z
 * ->
 * 2026-09-11T22:00:00+01:00
 */
export function formatLagosTimestamp(date) {
  if (!date) {
    return null;
  }

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return (
    `${values.year}-${values.month}-${values.day}` +
    `T${values.hour}:${values.minute}:${values.second}` +
    "+01:00"
  );
}