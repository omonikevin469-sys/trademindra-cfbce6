import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entryGate, sessionGate } from '@/lib/terminus';
import {
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
import type { Account, Trade } from '@/lib/journal';
import { instruments, resolvePipSize } from '@/constants/instruments';
const account: Account = { id: 'kevin', name: 'Trading account' };
const now = Date.parse('2026-11-03T14:00:00Z');
function draft(): ManualTradeDraft {
  return {
    recordType: 'manual',
    instrument: 'XAUUSD',
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
  };
}
function record(result: Outcome, date = now, id = 'trade'): Trade {
  const saved = recordManualTrade({ ...draft(), result }, account, [], date, id);
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
void test('weekday session allows 08:00 EAT and closes at 21:00 EAT', () => {
  assert.equal(sessionGate(Date.parse('2026-11-03T04:59:59Z')).open, false);
  assert.equal(sessionGate(Date.parse('2026-11-03T05:00:00Z')).open, true);
  assert.ok(
    recordManualTrade(draft(), account, [], Date.parse('2026-11-03T05:00:00Z'), 'morning').trade,
  );
  assert.equal(
    sessionGate(Date.parse('2026-11-03T04:59:59Z')).nextOpen,
    Date.parse('2026-11-03T05:00:00Z'),
  );
  assert.equal(
    sessionGate(Date.parse('2026-11-06T18:00:00Z')).nextOpen,
    Date.parse('2026-11-09T05:00:00Z'),
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
void test('existing instrument directory and broker preferences remain available', () => {
  assert.equal(instruments.length, 39);
  assert.equal(resolvePipSize('XAUUSD'), 0.01);
  assert.equal(resolvePipSize('XAUUSD', [{ instrument: 'XAUUSD', size: 0.1 }]), 0.1);
});
