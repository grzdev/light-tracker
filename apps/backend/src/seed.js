import { supabase } from "./lib/supabase.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const HOME_ID = "home_abc123";

const GRID_SENSOR_ID = "sensor_grid_001";
const BACKUP_SENSOR_ID = "sensor_backup_001";

const SAMPLE_DAYS = [
  {
    date: "2026-09-12",

    events: [
      {
        state: "UNKNOWN",
        reasonCode: "BOTH_SENSORS_OFF",
        confidence: "LOW",
        time: "00:00:00",
        previousState: null,
        previousDurationMs: null,
      },
    ],

    gridOnSeconds: 0,
    gridOffSeconds: 0,
    unknownSeconds: 24 * 60 * 60,

    outageCount: 0,
    longestOutageSeconds: 0,
    availabilityPercent: null,
    coveragePercent: 0,
  },

  {
    date: "2026-09-13",

    events: [
      {
        state: "ON",
        reasonCode: "GRID_SENSOR_ON_BACKUP_SENSOR_ON",
        confidence: "HIGH",
        time: "00:00:00",
        previousState: null,
        previousDurationMs: null,
      },
      {
        state: "OFF",
        reasonCode: "GRID_SENSOR_OFF_BACKUP_SENSOR_ON",
        confidence: "HIGH",
        time: "12:00:00",
        previousState: "ON",
        previousDurationMs: 12 * 60 * 60 * 1000,
      },
      {
        state: "UNKNOWN",
        reasonCode: "BOTH_SENSORS_OFF",
        confidence: "LOW",
        time: "21:00:00",
        previousState: "OFF",
        previousDurationMs: 9 * 60 * 60 * 1000,
      },
    ],

    gridOnSeconds: 12 * 60 * 60,
    gridOffSeconds: 9 * 60 * 60,
    unknownSeconds: 3 * 60 * 60,

    outageCount: 1,
    longestOutageSeconds: 9 * 60 * 60,
    availabilityPercent: 57.14,
    coveragePercent: 87.5,
  },

  {
    date: "2026-09-14",

    events: [
      {
        state: "ON",
        reasonCode: "GRID_SENSOR_ON_BACKUP_SENSOR_ON",
        confidence: "HIGH",
        time: "00:00:00",
        previousState: null,
        previousDurationMs: null,
      },
      {
        state: "OFF",
        reasonCode: "GRID_SENSOR_OFF_BACKUP_SENSOR_ON",
        confidence: "HIGH",
        time: "18:00:00",
        previousState: "ON",
        previousDurationMs: 18 * 60 * 60 * 1000,
      },
      {
        state: "UNKNOWN",
        reasonCode: "BOTH_SENSORS_OFF",
        confidence: "LOW",
        time: "22:00:00",
        previousState: "OFF",
        previousDurationMs: 4 * 60 * 60 * 1000,
      },
    ],

    gridOnSeconds: 18 * 60 * 60,
    gridOffSeconds: 4 * 60 * 60,
    unknownSeconds: 2 * 60 * 60,

    outageCount: 1,
    longestOutageSeconds: 4 * 60 * 60,
    availabilityPercent: 81.82,
    coveragePercent: 91.67,
  },
];

async function seed() {
  console.log("Starting Light Tracker seed...");

  // --------------------------------------------------
  // USER
  // --------------------------------------------------

  const { error: userError } = await supabase
    .from("users")
    .upsert(
      {
        id: USER_ID,
        email: "demo@lighttracker.local",
      },
      {
        onConflict: "id",
      }
    );

  if (userError) {
    throw userError;
  }

  // --------------------------------------------------
  // HOME
  // --------------------------------------------------

  const { error: homeError } = await supabase
    .from("homes")
    .upsert(
      {
        id: HOME_ID,
        user_id: USER_ID,
        name: "Demo Home",
        area: "Lekki",
        city: "Lagos",
        timezone: "Africa/Lagos",
      },
      {
        onConflict: "id",
      }
    );

  if (homeError) {
    throw homeError;
  }

  // --------------------------------------------------
  // SENSORS
  // --------------------------------------------------

  const { error: sensorError } = await supabase
    .from("sensors")
    .upsert(
      [
        {
          id: GRID_SENSOR_ID,
          home_id: HOME_ID,
          role: "GRID",
          device_id: "demo-grid-device",
          device_name: "Demo Grid Sensor",
          is_active: true,
        },
        {
          id: BACKUP_SENSOR_ID,
          home_id: HOME_ID,
          role: "BACKUP",
          device_id: "demo-backup-device",
          device_name: "Demo Backup Sensor",
          is_active: true,
        },
      ],
      {
        onConflict: "home_id,role",
      }
    );

  if (sensorError) {
    throw sensorError;
  }

  // --------------------------------------------------
  // CLEAR DEMO DATA
  // --------------------------------------------------

  const { error: eventDeleteError } = await supabase
    .from("grid_events")
    .delete()
    .eq("home_id", HOME_ID);

  if (eventDeleteError) {
    throw eventDeleteError;
  }

  const { error: observationDeleteError } = await supabase
    .from("raw_observations")
    .delete()
    .eq("home_id", HOME_ID);

  if (observationDeleteError) {
    throw observationDeleteError;
  }

  const { error: summaryDeleteError } = await supabase
    .from("daily_summaries")
    .delete()
    .eq("home_id", HOME_ID);

  if (summaryDeleteError) {
    throw summaryDeleteError;
  }

  // --------------------------------------------------
  // GRID EVENTS
  // --------------------------------------------------

  const eventRows = SAMPLE_DAYS.flatMap((day) =>
    day.events.map((event) => ({
      home_id: HOME_ID,
      state: event.state,
      reason_code: event.reasonCode,
      confidence: event.confidence,
      recorded_at: `${day.date}T${event.time}+01:00`,
      previous_state: event.previousState,
      duration_in_previous_state_ms:
        event.previousDurationMs,
    }))
  );

  const { error: eventError } = await supabase
    .from("grid_events")
    .insert(eventRows);

  if (eventError) {
    throw eventError;
  }

  // --------------------------------------------------
  // DAILY SUMMARIES
  //
  // Coverage:
  // (ON + OFF) / elapsed time
  //
  // UNKNOWN is excluded from confirmed coverage.
  // --------------------------------------------------

  const summaryRows = SAMPLE_DAYS.map((day) => ({
    home_id: HOME_ID,
    date: day.date,

    grid_on_seconds: day.gridOnSeconds,
    grid_off_seconds: day.gridOffSeconds,
    unknown_seconds: day.unknownSeconds,

    outage_count: day.outageCount,

    longest_outage_seconds:
      day.longestOutageSeconds,

    availability_percent:
      day.availabilityPercent,

    coverage_percent:
      day.coveragePercent,
  }));

  const { error: summaryError } = await supabase
    .from("daily_summaries")
    .insert(summaryRows);

  if (summaryError) {
    throw summaryError;
  }

  // --------------------------------------------------
  // CURRENT OBSERVATION
  //
  // Both sensors online = ON.
  //
  // This is separate from the historical sample days.
  // --------------------------------------------------

  const { error: observationError } = await supabase
    .from("raw_observations")
    .insert({
      home_id: HOME_ID,

      sensor_a_online: true,
      sensor_b_online: true,

      raw_response_a: {
        deviceId: "demo-grid-device",
        online: true,
      },

      raw_response_b: {
        deviceId: "demo-backup-device",
        online: true,
      },

      polled_at: new Date().toISOString(),
    });

  if (observationError) {
    throw observationError;
  }

  // --------------------------------------------------
  // OUTPUT
  // --------------------------------------------------

  console.log("");
  console.log("Seed completed successfully.");
  console.log(`Home: ${HOME_ID}`);
  console.log("");

  console.log("Sample days:");

  for (const day of SAMPLE_DAYS) {
    const onHours =
      day.gridOnSeconds / 3600;

    const offHours =
      day.gridOffSeconds / 3600;

    const unknownHours =
      day.unknownSeconds / 3600;

    console.log("");
    console.log(`Date: ${day.date}`);
    console.log(`ON:       ${onHours} hours`);
    console.log(`OFF:      ${offHours} hours`);
    console.log(`UNKNOWN:  ${unknownHours} hours`);
    console.log(
      `Availability: ${
        day.availabilityPercent === null
          ? "null"
          : `${day.availabilityPercent}%`
      }`
    );
    console.log(
      `Coverage:     ${day.coveragePercent}%`
    );
  }

  console.log("");
}

seed().catch((error) => {
  console.error("Seed failed:");
  console.error(error);
  process.exit(1);
});