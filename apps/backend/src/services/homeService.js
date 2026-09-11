import { supabase } from "../lib/supabase.js";

export async function getHome(homeId) {
  const { data, error } = await supabase
    .from("homes")
    .select("*")
    .eq("id", homeId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function getSensors(homeId) {
  const { data, error } = await supabase
    .from("sensors")
    .select("*")
    .eq("home_id", homeId)
    .eq("is_active", true);

  if (error) throw error;

  return data ?? [];
}

export async function getLatestObservation(homeId) {
  const { data, error } = await supabase
    .from("raw_observations")
    .select("*")
    .eq("home_id", homeId)
    .order("polled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function getLatestEvent(homeId) {
  const { data, error } = await supabase
    .from("grid_events")
    .select("*")
    .eq("home_id", homeId)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function getEvents(homeId, from, to, limit = 100) {
  let query = supabase
    .from("grid_events")
    .select("*")
    .eq("home_id", homeId)
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (from) {
    query = query.gte("recorded_at", from);
  }

  if (to) {
    query = query.lte("recorded_at", to);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data ?? [];
}

export async function getDailySummary(homeId, date) {
  const { data, error } = await supabase
    .from("daily_summaries")
    .select("*")
    .eq("home_id", homeId)
    .eq("date", date)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function getSummariesBetween(homeId, fromDate, toDate) {
  const { data, error } = await supabase
    .from("daily_summaries")
    .select("*")
    .eq("home_id", homeId)
    .gte("date", fromDate)
    .lte("date", toDate)
    .order("date", { ascending: true });

  if (error) throw error;

  return data ?? [];
}