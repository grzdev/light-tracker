import { supabase } from "./lib/supabase.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const HOME_ID = "home_abc123";

const GRID_SENSOR_ID = "sensor_grid_001";
const BACKUP_SENSOR_ID = "sensor_backup_001";

const DEMO_DATE = "2026-09-11";

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

  // --------------------------------------------------
  // GRID EVENTS
  //
  // 00:00 -> ON
  // 18:00 -> OFF
  // 22:00 -> UNKNOWN
  // --------------------------------------------------

  const { error: eventError } = await supabase
    .from("grid_events")
    .insert([
      {
        home_id: HOME_ID,
        state: "ON",
        reason_code: "GRID_SENSOR_ON_BACKUP_SENSOR_ON",
        confidence: "HIGH",
        recorded_at: `${DEMO_DATE}T00:00:00+01:00`,
        previous_state: null,
        duration_in_previous_state_ms: null,
      },
      {
        home_id: HOME_ID,
        state: "OFF",
        reason_code: "GRID_SENSOR_OFF_BACKUP_SENSOR_ON",
        confidence: "HIGH",
        recorded_at: `${DEMO_DATE}T18:00:00+01:00`,
        previous_state: "ON",
        duration_in_previous_state_ms:
          18 * 60 * 60 * 1000,
      },
      {
        home_id: HOME_ID,
        state: "UNKNOWN",
        reason_code: "BOTH_SENSORS_OFF",
        confidence: "LOW",
        recorded_at: `${DEMO_DATE}T22:00:00+01:00`,
        previous_state: "OFF",
        duration_in_previous_state_ms:
          4 * 60 * 60 * 1000,
      },
    ]);

  if (eventError) {
    throw eventError;
  }

  // --------------------------------------------------
  // DAILY SUMMARY
  // --------------------------------------------------

  const { error: summaryError } = await supabase
    .from("daily_summaries")
    .upsert(
      {
        home_id: HOME_ID,
        date: DEMO_DATE,

        grid_on_seconds: 18 * 60 * 60,
        grid_off_seconds: 4 * 60 * 60,
        unknown_seconds: 2 * 60 * 60,

        outage_count: 1,

        longest_outage_seconds: 4 * 60 * 60,

        availability_percent: 81.82,

        coverage_percent: 100,
      },
      {
        onConflict: "home_id,date",
      }
    );

  if (summaryError) {
    throw summaryError;
  }

  // --------------------------------------------------
  // CURRENT OBSERVATION
  //
  // Both sensors online = ON
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

  console.log("");
  console.log("Seed completed successfully.");
  console.log(`Home: ${HOME_ID}`);
  console.log("");
  console.log("Sample data:");
  console.log("ON:       18 hours");
  console.log("OFF:       4 hours");
  console.log("UNKNOWN:   2 hours");
  console.log("Availability: 81.82%");
  console.log("Coverage:     100%");
  console.log("");
}

seed().catch((error) => {
  console.error("Seed failed:");
  console.error(error);
  process.exit(1);
});