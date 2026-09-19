import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateAvailabilityPercent,
  calculateCoveragePercent,
  calculateEventDurations,
  calculateDailyCoverage,
  formatLagosTimestamp,
} from "./metrics.js";

test("availability excludes UNKNOWN time", () => {
  const onSeconds = 18 * 60 * 60;
  const offSeconds = 4 * 60 * 60;
  const unknownSeconds = 2 * 60 * 60;

  const availability =
    calculateAvailabilityPercent(
      onSeconds,
      offSeconds
    );

  assert.equal(
    availability,
    81.82
  );

  assert.notEqual(
    availability,
    (onSeconds /
      (onSeconds +
        offSeconds +
        unknownSeconds)) *
      100
  );
});

test("availability returns null when there is no confirmed ON/OFF time", () => {
  assert.equal(
    calculateAvailabilityPercent(0, 0),
    null
  );
});

test("coverage excludes UNKNOWN time", () => {
  const confirmedSeconds =
    18 * 60 * 60 +
    4 * 60 * 60;

  const coverage =
    calculateCoveragePercent(
      confirmedSeconds,
      24 * 60 * 60
    );

  assert.equal(
    coverage,
    91.67
  );
});

test("coverage returns 87.5 percent for 21 confirmed hours", () => {
  const confirmedSeconds =
    21 * 60 * 60;

  const coverage =
    calculateCoveragePercent(
      confirmedSeconds,
      24 * 60 * 60
    );

  assert.equal(
    coverage,
    87.5
  );
});

test("coverage returns 0 when there is no confirmed ON/OFF time", () => {
  const coverage =
    calculateCoveragePercent(
      0,
      24 * 60 * 60
    );

  assert.equal(
    coverage,
    0
  );
});

test("coverage never exceeds 100 percent", () => {
  const coverage =
    calculateCoveragePercent(
      30 * 60 * 60,
      24 * 60 * 60
    );

  assert.equal(
    coverage,
    100
  );
});

test("coverage returns null for an invalid period", () => {
  assert.equal(
    calculateCoveragePercent(
      100,
      0
    ),
    null
  );
});

test("event durations use current event start and next transition", () => {
  const events = [
    {
      id: "event-unknown",
      state: "UNKNOWN",
      recorded_at:
        "2026-09-11T22:00:00+01:00",
    },
    {
      id: "event-off",
      state: "OFF",
      recorded_at:
        "2026-09-11T18:00:00+01:00",
    },
    {
      id: "event-on",
      state: "ON",
      recorded_at:
        "2026-09-11T00:00:00+01:00",
    },
  ];

  const endTime =
    new Date(
      "2026-09-11T23:59:59+01:00"
    );

  const result =
    calculateEventDurations(
      events,
      endTime
    );

  assert.equal(
    result[0].durationSeconds,
    7199
  );

  assert.equal(
    result[1].durationSeconds,
    4 * 60 * 60
  );

  assert.equal(
    result[2].durationSeconds,
    18 * 60 * 60
  );
});

test("event duration rounds fractional seconds correctly", () => {
  const events = [
    {
      id: "event-two",
      state: "UNKNOWN",
      recorded_at:
        "2026-09-11T22:00:00.500+01:00",
    },
    {
      id: "event-one",
      state: "OFF",
      recorded_at:
        "2026-09-11T18:00:00.000+01:00",
    },
  ];

  const result =
    calculateEventDurations(
      events,
      new Date(
        "2026-09-11T23:00:00.500+01:00"
      )
    );

  assert.equal(
    result[0].durationSeconds,
    3600
  );
});

test("daily coverage counts only ON and OFF as confirmed time", () => {
  const summary = {
    grid_on_seconds:
      18 * 60 * 60,

    grid_off_seconds:
      4 * 60 * 60,

    grid_unknown_seconds:
      2 * 60 * 60,
  };

  assert.equal(
    calculateDailyCoverage(summary),
    91.67
  );
});

test("daily coverage detects missing period", () => {
  const summary = {
    grid_on_seconds:
      12 * 60 * 60,

    grid_off_seconds:
      6 * 60 * 60,

    unknown_seconds: 6 * 60 * 60,
  };

  assert.equal(
    calculateDailyCoverage(summary),
    75
  );
});

test("daily coverage returns 0 when there is no confirmed ON/OFF time", () => {
  const summary = {
    grid_on_seconds: 0,
    grid_off_seconds: 0,
    unknown_seconds:
      24 * 60 * 60,
  };

  assert.equal(
    calculateDailyCoverage(summary),
    0
  );
});

test("formats timestamps in Africa/Lagos", () => {
  assert.equal(
    formatLagosTimestamp(
      "2026-09-11T21:00:00+00:00"
    ),
    "2026-09-11T22:00:00+01:00"
  );
});

test("returns null for invalid timestamps", () => {
  assert.equal(
    formatLagosTimestamp("not-a-date"),
    null
  );
});