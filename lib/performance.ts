import type { Trade, Transaction } from '@/lib/journal';
import { tradeOutcome } from '@/lib/manualTrade';

export function winRates(trades: Trade[], group: (trade: Trade) => string, labels: string[]) {
  const groups = [...new Set([...labels, ...trades.map(group)])];
  return groups.map((label) => {
    const records = trades.filter((trade) => group(trade) === label);
    const wins = records.filter((trade) => tradeOutcome(trade) === 'Win').length;
    const losses = records.filter((trade) => tradeOutcome(trade) === 'Loss').length;
    return {
      label,
      wins,
      losses,
      total: records.length,
      rate: wins + losses ? (wins / (wins + losses)) * 100 : null,
    };
  });
}
export const recordedSession = (trade: Trade) => trade.session?.trim() || 'Not recorded';
export const extremeTimeframe = (trade: Trade) =>
  (trade.timeframe ?? trade.audit?.timeframe)?.trim() || 'Not recorded';
export type BalancePoint = { time: number; amount: number };
export function accountMovements(transactions: Transaction[], trades: Trade[], accountId: string) {
  return [
    ...transactions
      .filter((transaction) => transaction.accountId === accountId)
      .map(({ date, amount }) => ({ date, amount })),
    ...trades.flatMap((trade) => {
      if (
        trade.accountId !== accountId ||
        !trade.closedAt ||
        tradeOutcome(trade) === 'Open' ||
        trade.realizedPnl === undefined ||
        !Number.isFinite(trade.realizedPnl)
      )
        return [];
      return [{ date: trade.closedAt, amount: trade.realizedPnl }];
    }),
  ].sort((a, b) => a.date.localeCompare(b.date));
}
export function accountBalance(transactions: Transaction[], trades: Trade[], accountId: string) {
  return accountMovements(transactions, trades, accountId).reduce(
    (sum, record) => sum + record.amount,
    0,
  );
}
export function balanceHistory(
  transactions: Transaction[],
  accountId: string,
  window?: { start: Date; end: Date },
  now = Date.now(),
  trades: Trade[] = [],
) {
  const records = accountMovements(transactions, trades, accountId);
  const start =
    window?.start.getTime() ?? (records.length ? Date.parse(records[0].date) : now - 86400000);
  const end = window ? window.end.getTime() - 1 : Math.max(now, start + 1);
  let amount = records
    .filter((transaction) => Date.parse(transaction.date) < start)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const points: BalancePoint[] = [{ time: start, amount }];
  let updates = 0;
  for (const record of records) {
    const time = Date.parse(record.date);
    if (time < start || time > end) continue;
    // Plot recorded cash movements and explicit realized P&L as a continuous line.
    amount += record.amount;
    points.push({ time, amount });
    updates++;
  }
  points.push({ time: end, amount });
  return { points, updates };
}
