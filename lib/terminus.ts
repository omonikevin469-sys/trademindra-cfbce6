import type { Account, Trade } from '@/lib/journal';
export type NewsEvent = { id: string; date: string; time: string; expected: string };
export type PipSetting = { instrument: string; size: number };
export const emotions = ['Calm', 'FOMO', 'Revenge', 'Tired'] as const;
// Historical input snapshots remain readable. New records never create audits.
export type TradeAudit = {
  version: 1;
  checkedAt: string;
  timeframe: '1H' | '15M';
  manualEntry: boolean;
  emotion: (typeof emotions)[number];
  accountBalance: number;
  riskPercent: number;
  stopPips: number;
  targetPips: number;
  pipSize: number;
  pipValue: number;
  units: number;
  lotsInput: string;
  newsEvents: NewsEvent[];
  results: string[];
  mathVerified?: boolean;
};
const offset = 3 * 3600000;
export const eatDateKey = (value: Date | number | string = Date.now()) =>
  new Date(new Date(value).getTime() + offset).toISOString().slice(0, 10);
export const eatDisplay = (value: Date | number | string, options?: Intl.DateTimeFormatOptions) =>
  new Date(value).toLocaleString('en-GB', { timeZone: 'Africa/Nairobi', ...options });
export function sessionGate(now: number) {
  const local = new Date(now + offset);
  const day = local.getUTCDay();
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  const open = day >= 1 && day <= 5 && minute >= 960 && minute < 1260;
  const next = new Date(local);
  next.setUTCHours(16, 0, 0, 0);
  if (next.getTime() - offset <= now) next.setUTCDate(next.getUTCDate() + 1);
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) next.setUTCDate(next.getUTCDate() + 1);
  return { open, nextOpen: next.getTime() - offset };
}
export const validNewsTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
export function entryGate(
  account: Account | undefined,
  _trades: Trade[],
  now: number,
  lossUntil: number,
) {
  const messages: string[] = [];
  const session = sessionGate(now);
  if (!session.open)
    messages.push(
      `Session opens in ${countdown(session.nextOpen - now)} · Mon–Fri, 16:00–21:00 EAT`,
    );
  const windows = (account?.newsEvents ?? [])
    .map((event) => {
      const time = new Date(`${event.date}T${event.time}:00+03:00`).getTime();
      return { start: time - 900000, end: time + 900000 };
    })
    .sort((a, b) => a.start - b.start);
  let blackoutEnd = 0;
  for (const window of windows) {
    if (
      (now >= window.start && now < window.end) ||
      (blackoutEnd > now && window.start <= blackoutEnd)
    )
      blackoutEnd = Math.max(blackoutEnd, window.end);
  }
  if (blackoutEnd > now) messages.push(`News blackout ends in ${countdown(blackoutEnd - now)}`);
  if (lossUntil > now) messages.push(`Two-loss break ends in ${countdown(lossUntil - now)}`);
  return { locked: messages.length > 0, messages, session };
}
export function countdown(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
export function isTradeAudit(value: unknown): value is TradeAudit {
  if (!isRecord(value)) return false;
  return (
    value.version === 1 &&
    typeof value.checkedAt === 'string' &&
    ['1H', '15M'].includes(String(value.timeframe)) &&
    typeof value.manualEntry === 'boolean' &&
    emotions.some((emotion) => emotion === value.emotion) &&
    typeof value.lotsInput === 'string' &&
    [
      'accountBalance',
      'riskPercent',
      'stopPips',
      'targetPips',
      'pipSize',
      'pipValue',
      'units',
    ].every((key) => typeof value[key] === 'number' && Number.isFinite(value[key])) &&
    Array.isArray(value.results) &&
    value.results.every((item) => typeof item === 'string') &&
    (value.mathVerified === undefined || typeof value.mathVerified === 'boolean') &&
    Array.isArray(value.newsEvents) &&
    value.newsEvents.every(isNewsEvent)
  );
}
export function isNewsEvent(value: unknown): value is NewsEvent {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
    typeof value.time === 'string' &&
    validNewsTime(value.time) &&
    typeof value.expected === 'string' &&
    Boolean(value.expected.trim())
  );
}
export function isPipSetting(value: unknown): value is PipSetting {
  return (
    isRecord(value) &&
    typeof value.instrument === 'string' &&
    Boolean(value.instrument.trim()) &&
    typeof value.size === 'number' &&
    Number.isFinite(value.size) &&
    value.size > 0
  );
}
