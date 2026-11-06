export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DEFAULT_TIMEZONE = 'Africa/Monrovia';

export function localDate(instant = new Date(), timezone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function wallTimeToDate(date, time, timezone = DEFAULT_TIMEZONE) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) throw new Error('Enter a valid date and time');
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error('Invalid calendar date');
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wall;
  for (let i = 0; i < 4; i++) {
    const parts = formatter.formatToParts(new Date(instant));
    const get = (type) => Number(parts.find((part) => part.type === type).value);
    const actualWall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    const correction = wall - actualWall;
    if (!correction) return new Date(instant);
    instant += correction;
  }
  throw new Error('This local time does not exist in the selected time zone');
}

export function scheduleOccurrence(schedule, date) {
  const normalize = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value || date).slice(0, 10);
  const from = normalize(schedule.valid_from);
  const until = normalize(schedule.valid_until);
  if (date < from || date > until || DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()] !== schedule.day_of_week) throw new Error('Date is outside this confirmed schedule');
  const start = wallTimeToDate(date, schedule.start_time.slice(0, 5), schedule.timezone || DEFAULT_TIMEZONE);
  const end = wallTimeToDate(date, schedule.end_time.slice(0, 5), schedule.timezone || DEFAULT_TIMEZONE);
  if (end <= start) throw new Error('End time must be after start time');
  return { start, end };
}

export function nextOccurrence(schedule, now = new Date()) {
  const timezone = schedule.timezone || DEFAULT_TIMEZONE;
  let date = localDate(now, timezone);
  const from = schedule.valid_from instanceof Date ? schedule.valid_from.toISOString().slice(0,10) : String(schedule.valid_from || date).slice(0, 10);
  if (date < from) date = from;
  for (let i = 0; i < 8; i++) {
    try { const result = scheduleOccurrence(schedule, date); if (result.end > now) return { ...result, date }; } catch { /* Not an occurrence. */ }
    date = new Date(new Date(`${date}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
  }
  return null;
}
