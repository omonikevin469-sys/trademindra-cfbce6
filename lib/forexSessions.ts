export const forexSessions = [
  { name: 'London', timeZone: 'Europe/London' },
  { name: 'New York', timeZone: 'America/New_York' },
] as const;
export type ForexTimeZone = (typeof forexSessions)[number]['timeZone'];

const formatters = new Map<ForexTimeZone, Intl.DateTimeFormat>();
function localDate(now: number, timeZone: ForexTimeZone) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  // A UTC date carrying the city's wall-clock fields, not an actual instant.
  return new Date(
    Date.UTC(
      value('year'),
      value('month') - 1,
      value('day'),
      value('hour'),
      value('minute'),
      value('second'),
    ),
  );
}
function localHourInstant(day: Date, hour: number, timeZone: ForexTimeZone) {
  const wallTime = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour);
  let instant = wallTime;
  // Re-read the offset at the target date, including after a weekend DST change.
  for (let i = 0; i < 3; i++) {
    instant += wallTime - localDate(instant, timeZone).getTime();
  }
  return instant;
}
export function forexSessionStatus(now: number, timeZone: ForexTimeZone) {
  const local = localDate(now, timeZone);
  const weekday = local.getUTCDay();
  const hour = local.getUTCHours();
  const open = weekday > 0 && weekday < 6 && hour >= 8 && hour < 17;
  let nextChange: number;
  if (open) {
    nextChange = localHourInstant(local, 17, timeZone);
  } else {
    const nextDay = new Date(local);
    if (weekday === 0 || weekday === 6 || hour >= 17) {
      do {
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      } while (nextDay.getUTCDay() === 0 || nextDay.getUTCDay() === 6);
    }
    nextChange = localHourInstant(nextDay, 8, timeZone);
  }
  return {
    open,
    nextChange,
    localTime: `${String(hour).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}:${String(local.getUTCSeconds()).padStart(2, '0')}`,
    countdown: sessionCountdown(nextChange - now),
  };
}
export function sessionCountdown(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
