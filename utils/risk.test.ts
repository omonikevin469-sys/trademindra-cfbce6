import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entryGate, sessionGate, eatDateKey, tradeTimestamp } from '@/lib/terminus';
import { forexSessionStatus, sessionCountdown } from '@/lib/forexSessions';
import {
  closeRecordedTrade,
  parseProfitLoss,
  isManualTrade,
  lossBreakUntil,
  manualFields,
  manualTradeFailure,
  rawTradeExport,
  recordManualTrade,
  tradeOutcome,
  type ManualTradeDraft,
  type Outcome,
} from '@/lib/manualTrade';
import type { Account, Trade, Transaction } from '@/lib/journal';
import {
  accountBalance,
  balanceHistory,
  winRates,
  extremeTimeframe,
  recordedSession,
} from '@/lib/performance';
import { instruments, resolvePipSize } from '@/constants/instruments';
void test('forex sessions preserve local openings and New York closes at 21:00 EAT', () => {
  for (const [zone, opening, closing] of [
    ['Europe/London', '2026-11-03T08:00:00Z', '2026-11-03T17:00:00Z'],
    ['America/New_York', '2026-11-03T13:00:00Z', '2026-11-03T18:00:00Z'],
  ] as const) {
    const start = Date.parse(opening);
    const end = Date.parse(closing);
    assert.equal(forexSessionStatus(start - 1000, zone).open, false);
    assert.equal(forexSessionStatus(start - 1000, zone).countdown, '00:00:01');
    assert.equal(forexSessionStatus(start, zone).open, true);
    assert.equal(forexSessionStatus(start, zone).nextChange, end);
    assert.equal(forexSessionStatus(start, zone).localTime, '08:00:00');
    assert.equal(forexSessionStatus(start, zone).countdown, sessionCountdown(end - start));
    assert.equal(forexSessionStatus(end - 1000, zone).open, true);
    assert.equal(forexSessionStatus(end, zone).open, false);
    assert.equal(forexSessionStatus(end, zone).nextChange, start + 86400000);
  }
});
void test('forex weekend countdown follows spring and autumn DST transitions', () => {
  for (const [zone, fridayClose, mondayOpen] of [
    ['Europe/London', '2026-03-27T17:00:00Z', '2026-03-30T07:00:00Z'],
    ['Europe/London', '2026-10-23T16:00:00Z', '2026-10-26T08:00:00Z'],
    ['America/New_York', '2026-03-06T18:00:00Z', '2026-03-09T12:00:00Z'],
    ['America/New_York', '2026-10-30T18:00:00Z', '2026-11-02T13:00:00Z'],
  ] as const) {
    const close = Date.parse(fridayClose);
    const nextOpen = Date.parse(mondayOpen);
    for (const timestamp of [close, close + 86400000, nextOpen - 1000]) {
      const status = forexSessionStatus(timestamp, zone);
      assert.equal(status.open, false);
      assert.equal(status.nextChange, nextOpen);
    }
    assert.equal(forexSessionStatus(nextOpen, zone).open, true);
    assert.equal(
      forexSessionStatus(nextOpen, zone).countdown,
      zone === 'Europe/London' ? '09:00:00' : mondayOpen.includes('T12:') ? '06:00:00' : '05:00:00',
    );
  }
});
void test('London and New York independently track mismatched DST weeks', () => {
  const time = Date.parse('2026-03-16T12:00:00Z');
  assert.equal(forexSessionStatus(time, 'Europe/London').localTime, '12:00:00');
  assert.equal(forexSessionStatus(time, 'America/New_York').localTime, '08:00:00');
  assert.equal(forexSessionStatus(time, 'America/New_York').open, true);
  const summer = Date.parse('2026-07-14T07:00:00Z');
  assert.equal(forexSessionStatus(summer, 'Europe/London').open, true);
  assert.equal(forexSessionStatus(summer, 'America/New_York').open, false);
});
void test('session countdown uses elapsed wall time and supports weekend durations', () => {
  assert.equal(sessionCountdown(1000), '00:00:01');
  assert.equal(sessionCountdown(1), '00:00:01');
  assert.equal(sessionCountdown(0), '00:00:00');
  assert.equal(sessionCountdown(63 * 3600000), '63:00:00');
  const time = Date.parse('2026-11-03T13:00:00Z');
  const first = forexSessionStatus(time, 'America/New_York');
  assert.equal(forexSessionStatus(time + 125000, 'America/New_York').countdown, '04:57:55');
  assert.equal(first.countdown, '05:00:00');
});
const account: Account = { id: 'kevin', name: 'Trading account' };
const now = Date.parse('2026-11-03T14:00:00Z');
function draft(): ManualTradeDraft {
  return {
    recordType: 'manual',
    instrument: 'XAUUSD',
    session: 'New York',
    direction: 'Long',
    dailyBias: 'Bullish',
    h4Bias: 'Bearish',
    extreme: 'Premium',
    timeframe: '15M',
    sweep: 'Previous high',
    reason: 'Trader-entered structure, even with opposing biases',
    m15: 'Rejection',
    m1: 'BOS',
    entry: '02500.000',
    stop: '2600',
    target: '2499',
    riskPercent: '50',
    rr: '1:0.5',
    lots: '0.123456',
    emotion: 'Revenge',
    manualEntry: false,
    result: 'Open',
    realizedPnl: '',
  };
}
function record(result: Outcome, date = now, id = 'trade'): Trade {
  const saved = recordManualTrade(
    {
      ...draft(),
      result,
      realizedPnl: result === 'Loss' ? '-75.50' : result === 'Win' ? '125.25' : '0',
    },
    account,
    [],
    date,
    id,
  );
  assert.ok(saved.trade, saved.error);
  return saved.trade;
}
void test('50% risk and 1:0.5 R:R save through the production recording path', () => {
  const saved = recordManualTrade(draft(), account, [], now, 'high-risk');
  assert.ok(saved.trade);
  for (const [key] of manualFields) assert.equal(saved.trade[key], draft()[key]);
  assert.equal(saved.trade.manualEntry, false);
  assert.equal(saved.trade.audit, undefined);
  assert.equal(saved.trade.closedAt, undefined);
});
void test('risk inputs have no upper or lower cap and are never recalculated', () => {
  for (const riskPercent of ['1', '5', '30', '50', '100', '-10', '0', ' 0050.00 ', 'bad numbers']) {
    const saved = recordManualTrade({ ...draft(), riskPercent }, account, [], now, riskPercent);
    assert.ok(saved.trade);
    assert.equal(saved.trade.riskPercent, riskPercent);
  }
});
void test('every mandatory field is presence-only, with no numeric or strategy validation', () => {
  for (const [key] of manualFields) assert.ok(manualTradeFailure({ ...draft(), [key]: ' ' }), key);
  assert.equal(
    manualTradeFailure({
      ...draft(),
      entry: '-1',
      stop: 'oops',
      target: '0',
      rr: 'anything',
      lots: '-99',
    }),
    undefined,
  );
});
void test('both extreme timeframes save without a manual-entry confirmation requirement', () => {
  for (const timeframe of ['1H', '15M'])
    assert.ok(recordManualTrade({ ...draft(), timeframe }, account, [], now, timeframe).trade);
});
void test('raw JSON round-trip preserves whitespace, zeros, decimal text and R:R, without audits', () => {
  const trade = record('Win');
  const exported = JSON.parse(JSON.stringify(rawTradeExport(trade)));
  assert.equal(exported.entry, '02500.000');
  assert.equal(exported.rr, '1:0.5');
  assert.equal(exported.riskPercent, '50');
  assert.equal(exported.manualEntry, false);
  assert.equal(exported.audit, undefined);
  assert.equal(exported.pipSize, undefined);
});
void test('raw records satisfy cloud payload shape without numerical validation', () => {
  assert.ok(isManualTrade(record('Loss')));
  assert.ok(isManualTrade({ ...record('Open'), entry: 'not a number', lots: '-1' }));
  assert.equal(isManualTrade({ ...record('Open'), entry: 2500 }), false);
});
void test('each creation-time outcome is kept exactly; completed outcomes have close times', () => {
  for (const outcome of ['Win', 'Loss', 'Breakeven', 'Open'] as const) {
    const trade = record(outcome);
    assert.equal(tradeOutcome(trade), outcome);
    assert.equal(trade.closedAt, outcome === 'Open' ? undefined : new Date(now).toISOString());
  }
});
void test('daily trade count no longer limits recording', () => {
  const trades = Array.from({ length: 10 }, (_, i) => record('Win', now - i * 1000, String(i)));
  assert.equal(entryGate(account, trades, now, lossBreakUntil(trades)).locked, false);
  assert.ok(recordManualTrade(draft(), account, trades, now, 'eleventh').trade);
});
void test('weekday session allows 13:00 EAT and closes at 21:00 EAT', () => {
  assert.equal(sessionGate(Date.parse('2026-11-03T05:00:00Z')).open, false);
  assert.equal(sessionGate(Date.parse('2026-11-03T09:59:59Z')).open, false);
  assert.ok(
    recordManualTrade(draft(), account, [], Date.parse('2026-11-03T09:59:59Z'), 'before-open')
      .error,
  );
  assert.equal(sessionGate(Date.parse('2026-11-03T10:00:00Z')).open, true);
  assert.ok(
    recordManualTrade(draft(), account, [], Date.parse('2026-11-03T10:00:00Z'), 'afternoon').trade,
  );
  assert.equal(
    sessionGate(Date.parse('2026-11-03T09:59:59Z')).nextOpen,
    Date.parse('2026-11-03T10:00:00Z'),
  );
  assert.equal(
    sessionGate(Date.parse('2026-11-06T18:00:00Z')).nextOpen,
    Date.parse('2026-11-09T10:00:00Z'),
  );
  assert.equal(sessionGate(Date.parse('2026-11-03T17:59:59Z')).open, true);
  assert.equal(sessionGate(Date.parse('2026-11-03T18:00:00Z')).open, false);
  assert.equal(sessionGate(Date.parse('2026-11-07T14:00:00Z')).open, false);
  assert.ok(
    recordManualTrade(draft(), account, [], Date.parse('2026-11-07T14:00:00Z'), 'weekend').error,
  );
});
void test('manual news blocks exactly 15 minutes before and until 15 minutes after', () => {
  const newsAccount = {
    ...account,
    newsEvents: [{ id: 'news', date: '2026-11-03', time: '17:00', expected: 'Jobs release' }],
  };
  const gate = (time: string) => entryGate(newsAccount, [], Date.parse(`2026-11-03T${time}Z`), 0);
  assert.equal(gate('13:44:59').locked, false);
  assert.equal(gate('13:45:00').locked, true);
  assert.equal(gate('14:14:59').locked, true);
  assert.equal(gate('14:15:00').locked, false);
  assert.match(
    recordManualTrade(draft(), newsAccount, [], now, 'news').error ?? '',
    /News blackout/,
  );
});
void test('overlapping news windows stay locked until the final window ends', () => {
  const newsAccount = {
    ...account,
    newsEvents: [
      { id: 'a', date: '2026-11-03', time: '17:00', expected: 'First release' },
      { id: 'b', date: '2026-11-03', time: '17:20', expected: 'Second release' },
    ],
  };
  assert.equal(entryGate(newsAccount, [], Date.parse('2026-11-03T14:34:59Z'), 0).locked, true);
  assert.equal(entryGate(newsAccount, [], Date.parse('2026-11-03T14:35:00Z'), 0).locked, false);
});
void test('two logged losses lock for 24 hours from the second, then expire', () => {
  const trades = [record('Loss', now - 60000, 'first'), record('Loss', now, 'second')];
  const until = lossBreakUntil(trades);
  assert.equal(until, now + 86400000);
  assert.equal(entryGate(account, trades, until - 1, until).locked, true);
  assert.equal(entryGate(account, trades, until, until).locked, false);
  assert.match(
    recordManualTrade(draft(), account, trades, now, 'third').error ?? '',
    /Two-loss break/,
  );
});
void test('wins and breakevens interrupt losses; open records do not count as losses', () => {
  for (const result of ['Win', 'Breakeven'] as const) {
    assert.equal(
      lossBreakUntil([
        record('Loss', now - 60000),
        record(result, now - 30000),
        record('Loss', now),
      ]),
      0,
    );
  }
  assert.equal(lossBreakUntil([record('Loss'), record('Open')]), 0);
});
void test('loss timer uses explicitly logged outcomes, not inconsistent prices', () => {
  const first = { ...record('Win', now - 1000), result: 'Loss' as const };
  const second = { ...record('Win'), result: 'Loss' as const };
  assert.equal(lossBreakUntil([first, second]), now + 86400000);
});
void test('historical export keeps trader inputs but strips calculated audit objects', () => {
  const legacy: Trade = {
    ...record('Win'),
    recordType: undefined,
    entry: 2500,
    lots: 0.1,
    audit: {
      version: 1,
      checkedAt: '',
      timeframe: '1H',
      manualEntry: true,
      emotion: 'Calm',
      accountBalance: 1000,
      riskPercent: 3,
      stopPips: 100,
      targetPips: 200,
      pipSize: 0.01,
      pipValue: 10,
      units: 10000,
      lotsInput: '0.10',
      results: ['Risk within 2%'],
      newsEvents: [],
    },
  };
  const exported = rawTradeExport(legacy);
  assert.equal('audit' in exported, false);
  assert.equal(exported.riskPercent, 3);
  assert.equal(exported.entry, 2500);
});
void test('session capture exports unchanged and old manual trades remain readable', () => {
  const trade = record('Win');
  assert.equal(rawTradeExport(trade).session, 'New York');
  assert.ok(isManualTrade({ ...trade, session: undefined }));
  assert.equal(recordedSession({ ...trade, session: undefined }), 'Not recorded');
});
void test('New York closes at 21:00 EAT in summer and winter', () => {
  for (const date of ['2026-07-14', '2026-11-03']) {
    const closing = Date.parse(`${date}T18:00:00Z`);
    assert.equal(forexSessionStatus(closing - 1000, 'America/New_York').open, true);
    assert.equal(forexSessionStatus(closing - 1000, 'America/New_York').countdown, '00:00:01');
    assert.equal(forexSessionStatus(closing, 'America/New_York').open, false);
  }
});
void test('session and timeframe win rates exclude open and breakeven outcomes', () => {
  const trades = [
    record('Win'),
    record('Loss'),
    record('Breakeven'),
    record('Open'),
    { ...record('Win'), session: 'London', timeframe: '1H' },
  ];
  const sessions = winRates(trades, recordedSession, ['London', 'New York']);
  assert.equal(sessions.find((row) => row.label === 'New York')?.rate, 50);
  assert.equal(sessions.find((row) => row.label === 'New York')?.total, 4);
  assert.equal(sessions.find((row) => row.label === 'London')?.rate, 100);
  const timeframes = winRates(trades, extremeTimeframe, ['1H', '15M']);
  assert.equal(timeframes.find((row) => row.label === '15M')?.rate, 50);
  assert.equal(timeframes.find((row) => row.label === '1H')?.rate, 100);
  assert.equal(winRates([], recordedSession, ['London'])[0].rate, null);
  assert.equal(winRates([record('Open')], recordedSession, ['New York'])[0].rate, null);
  assert.equal(extremeTimeframe({ ...record('Win'), timeframe: undefined }), 'Not recorded');
});
void test('balance history is account scoped, ordered and keeps opening balance across periods', () => {
  const transactions: Transaction[] = [
    { id: 'b', accountId: 'other', date: '2026-11-03T12:00:00Z', amount: 9999, note: '' },
    { id: 'c', accountId: 'kevin', date: '2026-11-03T12:00:00Z', amount: -100, note: '' },
    { id: 'a', accountId: 'kevin', date: '2026-10-31T12:00:00Z', amount: 1000, note: '' },
    { id: 'd', accountId: 'kevin', date: '2026-12-01T00:00:00Z', amount: 500, note: '' },
  ];
  const window = { start: new Date('2026-11-01T00:00:00Z'), end: new Date('2026-12-01T00:00:00Z') };
  const history = balanceHistory(transactions, 'kevin', window, now);
  assert.equal(history.points[0].amount, 1000);
  assert.equal(history.points.at(-1)?.amount, 900);
  assert.equal(history.updates, 1);
  assert.equal(balanceHistory(transactions, 'other', window, now).points.at(-1)?.amount, 9999);
  const empty = balanceHistory(transactions, 'empty', window, now);
  assert.equal(empty.points.length, 2);
  assert.ok(empty.points.every((point) => point.amount === 0));
  const quiet = balanceHistory(
    transactions,
    'kevin',
    { start: new Date('2026-11-04T00:00:00Z'), end: new Date('2026-11-05T00:00:00Z') },
    now,
  );
  assert.equal(quiet.updates, 0);
  assert.ok(quiet.points.every((point) => point.amount === 900));
});
void test('performance breakdowns stay separate for each sub-account', () => {
  const trades = [record('Win'), { ...record('Loss'), accountId: 'other' }];
  for (const [id, rate] of [
    ['kevin', 100],
    ['other', 0],
  ] as const) {
    const rows = winRates(
      trades.filter((trade) => trade.accountId === id),
      recordedSession,
      ['New York'],
    );
    assert.equal(rows[0].rate, rate);
  }
});
void test('manual P&L requires a finite signed amount only for closed trades', () => {
  for (const text of ['', ' ', 'oops', 'NaN', 'Infinity', '0x10', '1,000', '--10']) {
    assert.equal(parseProfitLoss(text), undefined);
    assert.ok(
      recordManualTrade(
        { ...draft(), result: 'Win', realizedPnl: text },
        account,
        [],
        now,
        'invalid',
      ).error,
    );
  }
  for (const [text, amount] of [
    ['125.25', 125.25],
    [' -75.50 ', -75.5],
    ['0', 0],
    ['+.25', 0.25],
  ] as const) {
    assert.equal(parseProfitLoss(text), amount);
    const saved = recordManualTrade(
      { ...draft(), result: 'Win', realizedPnl: text },
      account,
      [],
      now,
      text,
    );
    assert.equal(saved.trade?.realizedPnl, amount);
    assert.equal(saved.trade?.result, 'Win');
  }
  assert.equal(record('Open').realizedPnl, undefined);
});
void test('closing records manual P&L and exact close timestamp once, even after trading hours', () => {
  const opened = record('Open');
  const closeTime = Date.parse('2026-11-03T19:23:45Z');
  const closed = closeRecordedTrade(opened, 'Loss', '-45.67', closeTime);
  assert.ok(closed.trade);
  assert.equal(closed.trade.date, opened.date);
  assert.equal(closed.trade.closedAt, '2026-11-03T19:23:45.000Z');
  assert.equal(closed.trade.realizedPnl, -45.67);
  assert.equal(opened.closedAt, undefined);
  assert.ok(closeRecordedTrade(closed.trade, 'Win', '100', closeTime + 1000).error);
  assert.ok(closeRecordedTrade(opened, 'Loss', '', closeTime).error);
});
void test('P&L round-trip keeps amounts and permits legacy trades without an amount', () => {
  for (const result of ['Win', 'Loss', 'Breakeven'] as const) {
    const trade = record(result);
    const exported = JSON.parse(JSON.stringify(rawTradeExport(trade)));
    assert.equal(exported.realizedPnl, trade.realizedPnl);
    assert.equal(exported.date, trade.date);
    assert.equal(exported.closedAt, trade.closedAt);
    assert.ok(isManualTrade(exported));
  }
  assert.ok(isManualTrade({ ...record('Loss'), realizedPnl: undefined }));
  assert.equal(isManualTrade({ ...record('Loss'), realizedPnl: '-10' }), false);
  assert.equal(isManualTrade({ ...record('Loss'), realizedPnl: Infinity }), false);
});
void test('balance and continuous line include P&L at close, scoped by account and period', () => {
  const transactions: Transaction[] = [
    {
      id: 'deposit',
      accountId: 'kevin',
      amount: 1000,
      note: 'Initial deposit',
      date: '2026-10-31T12:00:00Z',
    },
  ];
  const trades: Trade[] = [
    { ...record('Win', now, 'win'), closedAt: '2026-11-03T15:00:00Z', realizedPnl: 100 },
    { ...record('Loss', now, 'loss'), closedAt: '2026-11-04T15:00:00Z', realizedPnl: -40 },
    { ...record('Win', now, 'other'), accountId: 'other', realizedPnl: 9999 },
    { ...record('Win', now, 'legacy'), realizedPnl: undefined },
    { ...record('Open', now, 'open'), realizedPnl: 999 },
  ];
  assert.equal(accountBalance(transactions, trades, 'kevin'), 1060);
  assert.equal(accountBalance(transactions, trades, 'other'), 9999);
  const window = { start: new Date('2026-11-01T00:00:00Z'), end: new Date('2026-12-01T00:00:00Z') };
  const history = balanceHistory(transactions, 'kevin', window, now, trades);
  assert.deepEqual(
    history.points.map((point) => point.amount),
    [1000, 1100, 1060, 1060],
  );
  assert.equal(history.points[1].time, Date.parse('2026-11-03T15:00:00Z'));
  assert.equal(history.updates, 2);
  const later = balanceHistory(
    transactions,
    'kevin',
    { start: new Date('2026-11-05T00:00:00Z'), end: new Date('2026-11-06T00:00:00Z') },
    now,
    trades,
  );
  assert.ok(later.points.every((point) => point.amount === 1060));
  const adjustment = 1200 - accountBalance(transactions, trades, 'kevin');
  const adjusted = [
    ...transactions,
    {
      id: 'adjustment',
      accountId: 'kevin',
      amount: adjustment,
      note: 'Manual balance adjustment',
      date: '2026-11-05T12:00:00Z',
    },
  ];
  assert.equal(accountBalance(adjusted, trades, 'kevin'), 1200);
  assert.equal(balanceHistory(adjusted, 'kevin', window, now, trades).points.at(-1)?.amount, 1200);
});
void test('journal timestamps include EAT date, year and exact time across midnight', () => {
  assert.equal(eatDateKey('2026-11-03T22:23:45Z'), '2026-11-04');
  const display = tradeTimestamp('2026-11-03T22:23:45Z');
  assert.match(display, /4 Nov 2026/);
  assert.match(display, /01:23:45 EAT/);
});
void test('existing instrument directory and broker preferences remain available', () => {
  assert.equal(instruments.length, 39);
  assert.equal(resolvePipSize('XAUUSD'), 0.01);
  assert.equal(resolvePipSize('XAUUSD', [{ instrument: 'XAUUSD', size: 0.1 }]), 0.1);
});
