import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditFailure, entryGate, exceedsRiskLimit, type TradeDraft } from '@/lib/terminus';
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
void test('above 2% is allowed for entry but still fails strict compliance', () => {
  const trade = draft();
  assert.equal(auditFailure(trade, { allowRiskOverride: true }), undefined);
  assert.equal(auditFailure(trade), 'Risk exceeds the 2% guideline.');
  assert.equal(exceedsRiskLimit(trade, 10000), true);
});
void test('exactly 2% stays compliant', () => {
  const trade = draft(2);
  assert.equal(auditFailure(trade), undefined);
  assert.equal(exceedsRiskLimit(trade, 10000), false);
});
void test('current equity breaches are detected even when recorded risk is within 2%', () => {
  assert.equal(exceedsRiskLimit(draft(2), 5000), true);
  assert.equal(auditFailure(draft(2), { allowRiskOverride: true }), undefined);
});
void test('risk override does not bypass inconsistent manual math', () => {
  const trade = { ...draft(), plannedRisk: 400 };
  assert.match(
    auditFailure(trade, { allowRiskOverride: true }) ?? '',
    /Manual risk figures disagree/,
  );
});
void test('risk override does not bypass positive inputs, bias, stop direction or reward checks', () => {
  assert.match(
    auditFailure({ ...draft(), lots: 0 }, { allowRiskOverride: true }) ?? '',
    /positive number/,
  );
  assert.match(
    auditFailure({ ...draft(), h4Bias: 'Bearish' }, { allowRiskOverride: true }) ?? '',
    /Daily and 4H bias/,
  );
  assert.match(
    auditFailure({ ...draft(), stop: 1.11 }, { allowRiskOverride: true }) ?? '',
    /opposite sides/,
  );
  const trade = draft();
  assert.ok(trade.audit);
  assert.match(
    auditFailure(
      { ...trade, target: 1.115, audit: { ...trade.audit, targetPips: 150 } },
      { allowRiskOverride: true },
    ) ?? '',
    /at least twice/,
  );
});
void test('only session, daily limit and loss break lock entry; saved news does not', () => {
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
    false,
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
void test('submission allows strategy deviations while strict analytics still rejects each one', () => {
  const base = draft(2);
  assert.ok(base.audit);
  const cases: TradeDraft[] = [
    draft(3),
    { ...base, h4Bias: 'Bearish' },
    { ...base, dailyBias: 'Ranging', h4Bias: 'Ranging' },
    { ...base, aligned: 'No' },
    { ...base, extreme: 'Premium' },
    { ...base, zone: '', sweep: '', m15: '', m1: '', setup: '', reason: '' },
    { ...base, news: 'Blackout' },
    { ...base, checklist: 'No' },
    { ...base, audit: { ...base.audit, manualEntry: false } },
    { ...base, target: 1.115, audit: { ...base.audit, targetPips: 150 } },
  ];
  for (const trade of cases) {
    assert.equal(
      auditFailure(trade, { allowRiskOverride: true, allowStrategyOverride: true }),
      undefined,
    );
    assert.ok(auditFailure(trade), 'Strict adherence must still flag the deviation');
  }
});
void test('submission still requires a clear manual circuit breaker and valid math', () => {
  const options = { allowRiskOverride: true, allowStrategyOverride: true };
  const base = draft();
  assert.ok(base.audit);
  for (const circuit of ['Locked', '']) {
    assert.match(auditFailure({ ...base, circuit }, options) ?? '', /circuit breaker/);
  }
  assert.match(auditFailure({ ...base, instrument: '' }, options) ?? '', /instrument/);
  assert.match(auditFailure({ ...base, lots: 0 }, options) ?? '', /positive number/);
  assert.match(
    auditFailure({ ...base, plannedRisk: 400 }, options) ?? '',
    /Manual risk figures disagree/,
  );
  assert.match(auditFailure({ ...base, stop: 1.11 }, options) ?? '', /opposite sides/);
  assert.match(
    auditFailure({ ...base, target: 1.115 }, options) ?? '',
    /Take-profit pips do not match/,
  );
});
