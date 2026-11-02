import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditFailure, entryGate, exceedsRiskLimit, type TradeDraft } from '@/lib/terminus';
import type { Account, Trade } from '@/lib/journal';
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
void test('session, news, daily limit and loss break still lock entry', () => {
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
  assert.equal(entryGate(account, [trade, { ...trade, id: 'second' }], now, 0).locked, true);
});
