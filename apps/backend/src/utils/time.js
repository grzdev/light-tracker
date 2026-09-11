const LAGOS_TIME_ZONE = "Africa/Lagos";

export function getLagosDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LAGOS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getLagosDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LAGOS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+01:00`;
}

export function startOfLagosDay(date = new Date()) {
  const dateString = getLagosDateString(date);

  return new Date(`${dateString}T00:00:00+01:00`);
}

export function subtractDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() - days);
  return result;
}