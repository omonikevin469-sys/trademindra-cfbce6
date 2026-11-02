import type { Account, Trade } from '@/lib/journal';

export type NewsEvent = { id: string; date: string; time: string; expected: string };
export type PipSetting = { instrument: string; size: number };
export const emotions = ['Calm', 'FOMO', 'Revenge', 'Tired'] as const;
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
export const auditLabels = [
  'Risk within 2%',
  'Lots use at most 2 decimals',
  'Stop pips match prices',
  'Target pips match prices',
  'Target is at least 2× stop',
];
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
  trades: Trade[],
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
  if (trades.filter((trade) => eatDateKey(trade.date) === eatDateKey(now)).length >= 2)
    messages.push('The two-trade EAT daily limit has been reached.');
  return { locked: messages.length > 0, messages, session };
}
export function countdown(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`;
}
export type TradeDraft = Omit<Trade, 'id' | 'date' | 'accountId'>;
export function exceedsDeclaredRiskLimit(
  trade: Pick<TradeDraft, 'plannedRisk' | 'audit'>,
  currentBalance?: number,
): boolean {
  const audit = trade.audit;
  if (!audit) return false;
  return (
    audit.riskPercent > 2 ||
    (trade.plannedRisk ?? 0) > audit.accountBalance * 0.02 + 0.000001 ||
    (currentBalance !== undefined && (trade.plannedRisk ?? 0) > currentBalance * 0.02 + 0.000001)
  );
}
export function exceedsRiskLimit(
  trade: Pick<TradeDraft, 'plannedRisk' | 'lots' | 'audit'>,
  currentBalance?: number,
): boolean {
  const audit = trade.audit;
  if (!audit) return false;
  return (
    exceedsDeclaredRiskLimit(trade, currentBalance) ||
    audit.stopPips * audit.pipValue * trade.lots > audit.accountBalance * 0.02 + 0.000001
  );
}
export function submissionFailure(trade: TradeDraft, currentBalance: number): string | undefined {
  const failure = auditFailure(trade, { allowMathOverride: true });
  if (failure) return failure;
  if (currentBalance <= 0 || exceedsDeclaredRiskLimit(trade, currentBalance))
    return 'Planned risk exceeds 2% of your current account balance. Update the manual balance if it has changed.';
  return undefined;
}
export function auditFailure(
  trade: TradeDraft,
  options: { allowMathOverride?: boolean } = {},
): string | undefined {
  const audit = trade.audit;
  if (!trade.instrument.trim()) return 'Enter the instrument.';
  if (trade.circuit !== 'Clear') return 'Clear the circuit breaker before recording a trade.';
  if (
    trade.dailyBias !== trade.h4Bias ||
    !['Bullish', 'Bearish'].includes(trade.dailyBias) ||
    trade.aligned !== 'Yes'
  )
    return 'Daily and 4H bias must agree before entry.';
  if (
    (trade.direction === 'Long' &&
      (trade.dailyBias !== 'Bullish' || trade.extreme !== 'Discount')) ||
    (trade.direction === 'Short' && (trade.dailyBias !== 'Bearish' || trade.extreme !== 'Premium'))
  )
    return 'Longs need bullish discount; shorts need bearish premium.';
  if (
    [trade.zone, trade.sweep, trade.m15, trade.m1, trade.setup, trade.reason].some((v) => !v.trim())
  )
    return 'Complete every cascade and narrative field.';
  if (!['Quiet', 'Aligned'].includes(trade.news) || trade.checklist !== 'Yes')
    return 'Complete the pre-entry checks.';
  if (
    !audit ||
    !['1H', '15M'].includes(audit.timeframe) ||
    !audit.manualEntry ||
    !emotions.includes(audit.emotion)
  )
    return 'Select the extreme timeframe, confirm manual entry, and record your emotion.';
  if (
    [
      trade.entry,
      trade.stop,
      trade.target,
      trade.lots,
      trade.plannedRisk ?? 0,
      audit.accountBalance,
      audit.riskPercent,
      audit.stopPips,
      audit.targetPips,
      audit.pipSize,
      audit.pipValue,
      audit.units,
    ].some((n) => !Number.isFinite(n) || n <= 0)
  )
    return 'Fill every trade value field with a positive number.';
  const overRiskLimit = options.allowMathOverride
    ? exceedsDeclaredRiskLimit(trade)
    : exceedsRiskLimit(trade);
  if (overRiskLimit) return 'Risk exceeds the 2% guideline.';
  if (!/^\d+(\.\d{1,2})?$/.test(audit.lotsInput))
    return 'Standard lots must use at most two decimal places.';
  if (
    (trade.direction === 'Long' && (trade.stop >= trade.entry || trade.target <= trade.entry)) ||
    (trade.direction === 'Short' && (trade.stop <= trade.entry || trade.target >= trade.entry))
  )
    return 'Stop and target must sit on opposite sides of entry in the trade direction.';
  if (audit.targetPips < audit.stopPips * 2)
    return 'Take-profit pips must be at least twice stop-loss pips.';
  if (options.allowMathOverride) return undefined;
  const risk = trade.plannedRisk!;
  const positionRisk = audit.stopPips * audit.pipValue * trade.lots;
  if (
    Math.abs(risk - positionRisk) > 0.010001 ||
    Math.abs(risk - (audit.accountBalance * audit.riskPercent) / 100) > 0.010001
  )
    return 'Manual risk figures disagree. Check the risk amount, risk %, stop pips, pip value, and lots against BabyPips.';
  if (Number(audit.lotsInput) !== trade.lots)
    return 'Standard lots must use at most two decimal places.';
  const matches = (pips: number, distance: number) =>
    Math.abs(pips - distance / audit.pipSize) <= Math.max(0.000001, pips * 1e-8);
  if (!matches(audit.stopPips, Math.abs(trade.entry - trade.stop)))
    return 'Stop-loss pips do not match the entry and stop prices using the selected pip size.';
  if (!matches(audit.targetPips, Math.abs(trade.target - trade.entry)))
    return 'Take-profit pips do not match the entry and target prices using the selected pip size.';
  return undefined;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
export function isTradeAudit(value: unknown): value is TradeAudit {
  if (!isRecord(value)) return false;
  const a = value;
  return (
    a.version === 1 &&
    typeof a.checkedAt === 'string' &&
    ['1H', '15M'].includes(String(a.timeframe)) &&
    typeof a.manualEntry === 'boolean' &&
    emotions.some((emotion) => emotion === a.emotion) &&
    typeof a.lotsInput === 'string' &&
    [
      'accountBalance',
      'riskPercent',
      'stopPips',
      'targetPips',
      'pipSize',
      'pipValue',
      'units',
    ].every((key) => typeof a[key] === 'number' && Number.isFinite(a[key]) && a[key] > 0) &&
    Array.isArray(a.results) &&
    a.results.every((v) => typeof v === 'string') &&
    (a.mathVerified === undefined || typeof a.mathVerified === 'boolean') &&
    Array.isArray(a.newsEvents) &&
    a.newsEvents.every(isNewsEvent)
  );
}
export function isNewsEvent(value: unknown): value is NewsEvent {
  if (!isRecord(value)) return false;
  return (
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
  if (!isRecord(value)) return false;
  return (
    typeof value.instrument === 'string' &&
    Boolean(value.instrument.trim()) &&
    typeof value.size === 'number' &&
    Number.isFinite(value.size) &&
    value.size > 0
  );
}
