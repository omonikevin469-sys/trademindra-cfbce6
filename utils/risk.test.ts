import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  auditFailure,
  entryGate,
  exceedsRiskLimit,
  submissionFailure,
  type TradeDraft,
} from '@/lib/terminus';
import type { Account, Trade } from '@/lib/journal';
import { findInstrument, instruments, resolvePipSize } from '@/constants/instruments';
function draft(riskPercent = 3): TradeDraft {
  const lots = riskPercent / 10;
  return {
    instrument: 'EURUSD',
    direction: 'Long',
    session: 'New York',
    grade: 'A+',
    dailyBias: 'Bullish',
    h4Bias: 'Bullish',
    aligned: 'Yes',
    extreme: 'Discount',
    zone: 'Lower end of daily dealing range',
    sweep: 'Previous low swept',
    m15: 'Bullish rejection and CHoCH',
    m1: 'CHoCH and BOS confirmed',
    entry: 1.1,
    stop: 1.09,
    target: 1.12,
    lots,
    jpyPerUsd: 1,
    plannedRisk: riskPercent * 100,
    news: 'Quiet',
    circuit: 'Clear',
    checklist: 'Yes',
    setup: 'Discount liquidity sweep',
    reason: 'Aligned daily and 4H bullish structure',
    audit: {
      version: 1,
      checkedAt: '2026-11-02T14:00:00Z',
      timeframe: '1H',
      manualEntry: true,
      emotion: 'Calm',
      accountBalance: 10000,
      riskPercent,
      stopPips: 100,
      targetPips: 200,
      pipSize: 0.0001,
      pipValue: 10,
      units: lots * 100000,
      lotsInput: String(lots),
      newsEvents: [],
      results: [],
    },
  };
}
void test('master directory contains all 39 distinct supplied instruments and pip sizes', () => {
  assert.equal(instruments.length, 39);
  assert.equal(new Set(instruments.map((item) => item.symbol)).size, 39);
  for (const instrument of instruments) {
    const expected =
      instrument.category === 'Forex majors & crosses'
        ? 0.0001
        : instrument.category === 'Crypto'
          ? 1
          : instrument.symbol === 'XAGUSD'
            ? 0.001
            : 0.01;
    assert.equal(instrument.defaultPipSize, expected, instrument.symbol);
  }
  assert.equal(findInstrument(' xauusd ')?.defaultPipSize, 0.01);
  assert.equal(resolvePipSize('UNKNOWN'), undefined);
});
void test('account broker override takes precedence without altering directory defaults', () => {
  const first: Account = {
    id: 'first',
    name: 'First',
    pipSettings: [{ instrument: 'BTCUSD', size: 0.01 }],
  };
  const second: Account = { id: 'second', name: 'Second' };
  assert.equal(resolvePipSize(' btcusd ', first.pipSettings), 0.01);
  assert.equal(resolvePipSize('BTCUSD', second.pipSettings), 1);
  assert.equal(findInstrument('BTCUSD')?.defaultPipSize, 1);
  assert.equal(resolvePipSize('CUSTOM', [{ instrument: 'CUSTOM', size: 0.1 }]), 0.1);
  assert.equal(resolvePipSize('BTCUSD', []), 1);
});
void test('math audit verifies prices across every directory instrument', () => {
  for (const instrument of instruments) {
    const trade = draft(2);
    assert.ok(trade.audit);
    const entry = 100;
    const configured: TradeDraft = {
      ...trade,
      instrument: instrument.symbol,
      entry,
      stop: entry - 100 * instrument.defaultPipSize,
      target: entry + 200 * instrument.defaultPipSize,
      audit: { ...trade.audit, pipSize: instrument.defaultPipSize },
    };
    // Crypto needs an entry above its 100-pip stop distance.
    configured.entry += 1000;
    configured.stop += 1000;
    configured.target += 1000;
    assert.equal(auditFailure(configured), undefined, instrument.symbol);
    assert.match(
      auditFailure({ ...configured, stop: configured.stop - instrument.defaultPipSize }) ?? '',
      /Stop-loss pips do not match/,
      instrument.symbol,
    );
    assert.match(
      auditFailure({ ...configured, target: configured.target + instrument.defaultPipSize }) ?? '',
      /Take-profit pips do not match/,
      instrument.symbol,
    );
  }
});
void test('Gold 502 pips verifies a 5.02 movement and broker changes do not rewrite its audit', () => {
  const base = draft(2);
  assert.ok(base.audit);
  const trade: TradeDraft = {
    ...base,
    instrument: 'XAUUSD',
    entry: 2500,
    stop: 2494.98,
    target: 2510.04,
    audit: {
      ...base.audit,
      stopPips: 502,
      targetPips: 1004,
      pipSize: resolvePipSize('XAUUSD')!,
      pipValue: 200 / (502 * base.lots),
    },
  };
  assert.equal(auditFailure(trade), undefined);
  const overrides = [{ instrument: 'XAUUSD', size: 0.1 }];
  assert.equal(resolvePipSize('XAUUSD', overrides), 0.1);
  assert.equal(trade.audit?.pipSize, 0.01);
  assert.equal(auditFailure(trade), undefined);
});
void test('broker-specific pip sizes are used in the manual math audit', () => {
  const trade = draft(2);
  assert.ok(trade.audit);
  const size = resolvePipSize('BTCUSD', [{ instrument: 'BTCUSD', size: 0.01 }])!;
  const crypto = {
    ...trade,
    instrument: 'BTCUSD',
    entry: 70000,
    stop: 69999,
    target: 70002,
    audit: { ...trade.audit, pipSize: size },
  };
  assert.equal(auditFailure(crypto), undefined);
  assert.match(
    auditFailure({ ...crypto, audit: { ...crypto.audit, pipSize: 1 } }) ?? '',
    /Stop-loss pips do not match/,
  );
});
void test('declared risk above 2% blocks submission and strict compliance', () => {
  const trade = draft();
  assert.equal(submissionFailure(trade, 10000), 'Risk exceeds the 2% guideline.');
  assert.equal(auditFailure(trade), 'Risk exceeds the 2% guideline.');
  assert.equal(exceedsRiskLimit(trade, 10000), true);
});
void test('exactly 2% stays compliant and can be submitted', () => {
  const trade = draft(2);
  assert.equal(auditFailure(trade), undefined);
  assert.equal(submissionFailure(trade, 10000), undefined);
  assert.equal(exceedsRiskLimit(trade, 10000), false);
});
void test('current equity risk cap and positive balance remain mandatory', () => {
  assert.equal(exceedsRiskLimit(draft(2), 5000), true);
  for (const equity of [5000, 0, -100]) {
    assert.match(submissionFailure(draft(2), equity) ?? '', /current account balance/);
  }
  const base = draft(2);
  assert.ok(base.audit);
  assert.match(submissionFailure({ ...base, plannedRisk: 201 }, 10000) ?? '', /2%/);
  assert.match(
    submissionFailure({ ...base, audit: { ...base.audit, riskPercent: 2.01 } }, 10000) ?? '',
    /2%/,
  );
});
void test('skipping math verification retains stop direction, lot format and reward requirements', () => {
  const trade = draft(2);
  assert.ok(trade.audit);
  for (const invalid of [
    { ...trade, stop: 1.11 },
    { ...trade, target: 1.08 },
    { ...trade, direction: 'Short', dailyBias: 'Bearish', h4Bias: 'Bearish', extreme: 'Premium' },
  ]) {
    assert.match(submissionFailure(invalid, 10000) ?? '', /opposite sides/);
  }
  assert.match(
    submissionFailure(
      { ...trade, lots: 0.12345, audit: { ...trade.audit, lotsInput: '0.12345' } },
      10000,
    ) ?? '',
    /two decimal places/,
  );
  assert.match(
    submissionFailure({ ...trade, audit: { ...trade.audit, targetPips: 150 } }, 10000) ?? '',
    /at least twice/,
  );
});
void test('session, daily limit, loss break and saved news blackout lock entry', () => {
  const account: Account = { id: 'account', name: 'Test account' };
  const now = Date.parse('2026-11-02T14:00:00Z');
  assert.equal(entryGate(account, [], now, 0).locked, false);
  assert.equal(entryGate(account, [], Date.parse('2026-11-02T10:00:00Z'), 0).locked, true);
  assert.equal(entryGate(account, [], now, now + 1000).locked, true);
  assert.equal(
    entryGate(
      {
        ...account,
        newsEvents: [{ id: 'news', date: '2026-11-02', time: '17:00', expected: 'Macro release' }],
      },
      [],
      now,
      0,
    ).locked,
    true,
  );
  const trade: Trade = {
    ...draft(),
    id: 'first',
    accountId: account.id,
    date: new Date(now).toISOString(),
  };
  assert.equal(entryGate(account, [trade], now, 0).locked, false);
  assert.equal(entryGate(account, [trade, { ...trade, id: 'second' }], now, 0).locked, true);
});
void test('strategy and risk requirements remain mandatory when math verification is skipped', () => {
  const base = draft(2);
  assert.ok(base.audit);
  const cases: TradeDraft[] = [
    draft(3),
    { ...base, h4Bias: 'Bearish' },
    { ...base, dailyBias: 'Ranging', h4Bias: 'Ranging' },
    { ...base, aligned: 'No' },
    { ...base, extreme: 'Premium' },
    ...(['zone', 'sweep', 'm15', 'm1', 'setup', 'reason'] as const).map((field) => ({
      ...base,
      [field]: '',
    })),
    { ...base, news: 'Blackout' },
    { ...base, news: '' },
    { ...base, checklist: 'No' },
    { ...base, checklist: '' },
    { ...base, audit: { ...base.audit, manualEntry: false } },
    { ...base, audit: undefined },
    { ...base, target: 1.115, audit: { ...base.audit, targetPips: 150 } },
  ];
  for (const trade of cases) {
    assert.ok(submissionFailure(trade, 10000), 'Every nonmath requirement must block submission');
    assert.ok(auditFailure(trade), 'Strict adherence must still flag the deviation');
  }
});
void test('submission still requires a clear circuit breaker and complete numeric inputs', () => {
  const base = draft(2);
  assert.ok(base.audit);
  for (const circuit of ['Locked', '']) {
    assert.match(submissionFailure({ ...base, circuit }, 10000) ?? '', /circuit breaker/);
  }
  assert.match(submissionFailure({ ...base, instrument: '' }, 10000) ?? '', /instrument/);
  for (const value of [0, -1, NaN, Infinity]) {
    for (const field of ['entry', 'stop', 'target', 'lots', 'plannedRisk'] as const) {
      assert.match(submissionFailure({ ...base, [field]: value }, 10000) ?? '', /positive number/);
    }
    for (const field of [
      'accountBalance',
      'riskPercent',
      'stopPips',
      'targetPips',
      'pipSize',
      'pipValue',
      'units',
    ] as const) {
      assert.match(
        submissionFailure({ ...base, audit: { ...base.audit, [field]: value } }, 10000) ?? '',
        /positive number/,
      );
    }
  }
});
void test('submission accepts inconsistent trader calculations unchanged within mandatory policy limits', () => {
  const base = draft(2);
  assert.ok(base.audit);
  const cases: TradeDraft[] = [
    { ...base, plannedRisk: 125 },
    { ...base, stop: 1.08 },
    { ...base, target: 1.13 },
    { ...base, audit: { ...base.audit, stopPips: 37, targetPips: 83 } },
    { ...base, lots: 0.12, audit: { ...base.audit, lotsInput: '0.12', units: 987 } },
    { ...base, audit: { ...base.audit, pipValue: 100 } },
  ];
  for (const trade of cases) {
    const original = structuredClone(trade);
    assert.equal(submissionFailure(trade, 10000), undefined);
    assert.deepEqual(trade, original, 'Validation must not recalculate entered values');
    assert.ok(auditFailure(trade), 'Strict analytics remains separate from submission');
  }
});
void test('each extreme timeframe is accepted and missing confirmations have specific errors', () => {
  const base = draft(2);
  assert.ok(base.audit);
  for (const timeframe of ['1H', '15M'] as const) {
    const trade: TradeDraft & { audit: NonNullable<TradeDraft['audit']> } = {
      ...base,
      audit: { ...base.audit, timeframe },
    };
    assert.equal(submissionFailure(trade, 10000), undefined);
    assert.equal(
      submissionFailure({ ...trade, audit: { ...trade.audit, manualEntry: false } }, 10000),
      'Confirm “Did I enter manually?” in the Manual entry section.',
    );
  }
  assert.equal(
    submissionFailure({ ...base, audit: undefined }, 10000),
    'Select the timeframe that defines the extreme.',
  );
});
void test('BabyPips disagreement never blocks submission when other requirements pass', () => {
  const base = draft(2);
  assert.ok(base.audit);
  const trade: TradeDraft = {
    ...base,
    plannedRisk: 125,
    stop: 1.08,
    target: 1.15,
    lots: 0.12,
    audit: {
      ...base.audit,
      stopPips: 37,
      targetPips: 83,
      units: 987,
      lotsInput: '0.12',
    },
  };
  const original = structuredClone(trade);
  assert.match(auditFailure(trade) ?? '', /Manual risk figures disagree/);
  assert.equal(submissionFailure(trade, 10000), undefined);
  assert.deepEqual(trade, original);
});
void test('saved news blackout includes its start, excludes its end and merges overlapping windows', () => {
  const now = Date.parse('2026-11-02T14:00:00Z');
  const account: Account = {
    id: 'account',
    name: 'Test account',
    newsEvents: [
      { id: 'first', date: '2026-11-02', time: '17:00', expected: 'Macro release' },
      { id: 'second', date: '2026-11-02', time: '17:20', expected: 'Press conference' },
    ],
  };
  assert.equal(entryGate(account, [], now - 900001, 0).locked, false);
  assert.equal(entryGate(account, [], now - 900000, 0).locked, true);
  assert.match(entryGate(account, [], now, 0).messages.join(' '), /0h 35m 0s/);
  assert.equal(entryGate(account, [], now + 2100000, 0).locked, false);
});
