import type { Account, Trade } from '@/lib/journal';
import { entryGate } from '@/lib/terminus';

export const outcomes = ['Win', 'Loss', 'Breakeven', 'Open'] as const;
export type Outcome = (typeof outcomes)[number];
export const manualFields = [
  ['instrument', 'Instrument'],
  ['direction', 'Direction'],
  ['session', 'Trading session'],
  ['dailyBias', '1D bias'],
  ['h4Bias', '4H bias'],
  ['extreme', 'Extreme zone'],
  ['timeframe', 'Zone timeframe'],
  ['sweep', '1H liquidity sweep level'],
  ['reason', 'Structural reason'],
  ['m15', '15M confirmation'],
  ['m1', '1M trigger'],
  ['entry', 'Entry price'],
  ['stop', 'Stop loss price'],
  ['target', 'Take profit price'],
  ['riskPercent', 'Risk %'],
  ['rr', 'R:R ratio'],
  ['lots', 'Lot size'],
  ['emotion', 'Emotion'],
  ['result', 'Outcome'],
] as const;
export type ManualTradeDraft = {
  recordType: 'manual';
  instrument: string;
  direction: string;
  session: string;
  dailyBias: string;
  h4Bias: string;
  extreme: string;
  timeframe: string;
  sweep: string;
  reason: string;
  m15: string;
  m1: string;
  entry: string;
  stop: string;
  target: string;
  riskPercent: string;
  rr: string;
  lots: string;
  emotion: string;
  manualEntry: boolean;
  result: Outcome;
  realizedPnl: string;
};
export function parseProfitLoss(value: string): number | undefined {
  const text = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return undefined;
  const amount = Number(text);
  return Number.isFinite(amount) ? amount : undefined;
}
export function profitLossFailure(value: string) {
  return parseProfitLoss(value) === undefined
    ? 'Enter the profit or loss amount in USD. Use a minus sign for a loss.'
    : undefined;
}
export function manualTradeFailure(trade: ManualTradeDraft) {
  const missing = manualFields.find(([key]) => !trade[key].trim());
  if (missing) return `Complete ${missing[1].toLowerCase()}.`;
  return trade.result === 'Open' ? undefined : profitLossFailure(trade.realizedPnl);
}
export function closeRecordedTrade(
  trade: Trade,
  result: Exclude<Outcome, 'Open'>,
  amount: string,
  now: number,
): { trade: Trade; error?: never } | { error: string; trade?: never } {
  if (trade.closedAt || tradeOutcome(trade) !== 'Open')
    return { error: 'This trade is already closed.' };
  const error = profitLossFailure(amount);
  if (error) return { error };
  return {
    trade: {
      ...trade,
      result,
      realizedPnl: parseProfitLoss(amount),
      closedAt: new Date(now).toISOString(),
    },
  };
}
export function tradeOutcome(trade: Trade): Outcome {
  if (trade.result) return trade.result;
  if (trade.recordType === 'manual') return 'Open';
  if (trade.exit === undefined) return 'Open';
  // Read historical outcomes without calculating money, pip values or position risk.
  if (trade.exit === trade.entry) return 'Breakeven';
  return trade.exit > Number(trade.entry) === (trade.direction === 'Long') ? 'Win' : 'Loss';
}
export function lossBreakUntil(trades: Trade[]) {
  const completed = trades
    .filter((trade) => tradeOutcome(trade) !== 'Open')
    .sort((a, b) => (b.closedAt ?? b.date).localeCompare(a.closedAt ?? a.date));
  for (let i = 0; i < completed.length - 1; i++) {
    if (tradeOutcome(completed[i]) === 'Loss' && tradeOutcome(completed[i + 1]) === 'Loss')
      return new Date(completed[i].closedAt ?? completed[i].date).getTime() + 86400000;
  }
  return 0;
}
export function recordManualTrade(
  draft: ManualTradeDraft,
  account: Account,
  trades: Trade[],
  now: number,
  id: string,
): { trade: Trade; error?: never } | { error: string; trade?: never } {
  const gate = entryGate(account, trades, now, lossBreakUntil(trades));
  if (gate.locked) return { error: gate.messages.join('\n') };
  const error = manualTradeFailure(draft);
  if (error) return { error };
  const date = new Date(now).toISOString();
  const { realizedPnl, ...values } = draft;
  return {
    trade: {
      ...values,
      id,
      accountId: account.id,
      date,
      ...(draft.result !== 'Open'
        ? { closedAt: date, realizedPnl: parseProfitLoss(realizedPnl) }
        : {}),
    },
  };
}
export function rawTradeExport(trade: Trade) {
  if (trade.recordType === 'manual') {
    return Object.fromEntries([
      ['recordType', trade.recordType],
      ['id', trade.id],
      ['accountId', trade.accountId],
      ['date', trade.date],
      ...manualFields.map(([key]) => [key, trade[key]]),
      ['manualEntry', trade.manualEntry],
      ...(trade.closedAt ? [['closedAt', trade.closedAt]] : []),
      ...(trade.realizedPnl !== undefined ? [['realizedPnl', trade.realizedPnl]] : []),
    ]);
  }
  const { audit, ...raw } = trade;
  // Retain historical trader inputs, but never export a generated audit object.
  return {
    ...raw,
    ...(audit
      ? {
          timeframe: audit.timeframe,
          manualEntry: audit.manualEntry,
          emotion: audit.emotion,
          riskPercent: audit.riskPercent,
          stopPips: audit.stopPips,
          targetPips: audit.targetPips,
          pipValue: audit.pipValue,
          units: audit.units,
          accountBalance: audit.accountBalance,
          lotsInput: audit.lotsInput,
        }
      : {}),
  };
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
export function isManualTrade(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const record = value;
  return (
    record.recordType === 'manual' &&
    [
      'id',
      'accountId',
      'date',
      ...manualFields.filter(([key]) => key !== 'session').map(([key]) => key),
    ].every((key) => typeof record[key] === 'string') &&
    (record.session === undefined || typeof record.session === 'string') &&
    typeof record.manualEntry === 'boolean' &&
    outcomes.some((outcome) => outcome === record.result) &&
    record.audit === undefined &&
    (record.closedAt === undefined || typeof record.closedAt === 'string') &&
    (record.realizedPnl === undefined ||
      (typeof record.realizedPnl === 'number' && Number.isFinite(record.realizedPnl)))
  );
}
