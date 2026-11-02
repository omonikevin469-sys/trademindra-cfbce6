import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/JournalText';
import { router } from 'expo-router';
import { useThemeColor } from 'heroui-native';
import Svg, { Line, Path } from 'react-native-svg';
import { Empty, Heading, Metric, Page, Section } from '@/components/JournalUI';
import { PeriodControl } from '@/components/PeriodControl';
import { withinPeriod, type Period } from '@/lib/periods';
import { money, pnl, useJournal } from '@/lib/journal';
import { auditFailure, emotions } from '@/lib/terminus';
export default function Analytics() {
  const state = useJournal();
  const [range, setRange] = useState<Period>('Monthly');
  const [anchor, setAnchor] = useState(() => new Date());
  const [accent, border] = useThemeColor(['accent', 'border']);
  const closed = state.trades
    .filter(
      (trade) =>
        trade.accountId === state.accountId &&
        trade.exit !== undefined &&
        trade.closedAt &&
        withinPeriod(trade.closedAt, range, anchor),
    )
    .sort((a, b) => (a.closedAt ?? '').localeCompare(b.closedAt ?? ''));
  const wins = closed.filter((t) => pnl(t) > 0);
  const net = closed.reduce((s, t) => s + pnl(t), 0);
  const gain = wins.reduce((s, t) => s + pnl(t), 0);
  const loss = -closed.filter((t) => pnl(t) < 0).reduce((s, t) => s + pnl(t), 0);
  const openingBalance =
    state.transactions
      .filter(
        (transaction) =>
          transaction.accountId === state.accountId &&
          new Date(transaction.date).getTime() <= new Date(closed[0]?.closedAt ?? anchor).getTime(),
      )
      .reduce((sum, transaction) => sum + transaction.amount, 0) +
    state.trades
      .filter(
        (trade) =>
          trade.accountId === state.accountId &&
          trade.exit !== undefined &&
          trade.closedAt &&
          new Date(trade.closedAt).getTime() < new Date(closed[0]?.closedAt ?? anchor).getTime(),
      )
      .reduce((sum, trade) => sum + pnl(trade), 0);
  const values = [openingBalance];
  closed.forEach((t) => values.push(values[values.length - 1] + pnl(t)));
  const min = Math.min(...values),
    max = Math.max(...values);
  const spread = max - min || 1;
  const path = values
    .map(
      (v, i) =>
        `${i === 0 ? 'M' : 'L'} ${10 + (i * 280) / Math.max(1, values.length - 1)} ${145 - ((v - min) * 125) / spread}`,
    )
    .join(' ');
  const checks = closed.map((t) => [
    t.aligned === 'Yes',
    t.extreme !== 'Equilibrium',
    t.news !== 'Blackout',
    t.checklist === 'Yes',
    Boolean(t.sweep && t.m15 && t.m1),
  ]);
  const compliance = checks.length
    ? Math.round((checks.flat().filter(Boolean).length / (checks.length * 5)) * 100)
    : 0;
  const audited = closed.filter((trade) => trade.audit);
  const pct = (items: typeof closed) =>
    items.length
      ? `${Math.round((items.filter((t) => pnl(t) > 0).length / items.length) * 100)}%`
      : 'Not recorded';
  const adherence = audited.length
    ? `${Math.round((audited.filter((t) => !auditFailure(t) && t.audit?.results.includes('Risk within 2%')).length / audited.length) * 100)}%`
    : 'Not recorded';
  const emotionTotals = emotions.map((emotion) => ({
    emotion,
    trades: audited.filter((trade) => trade.audit?.emotion === emotion),
  }));
  const emotionScale = Math.max(
    1,
    ...emotionTotals.map(({ trades }) => Math.abs(trades.reduce((sum, t) => sum + pnl(t), 0))),
  );
  return (
    <Page>
      <Heading title="Analytics" />
      <PeriodControl
        period={range}
        anchor={anchor}
        onPeriodChange={setRange}
        onAnchorChange={setAnchor}
      />
      {!closed.length ? (
        <Empty
          text="No trades closed in this period."
          action="Open Book"
          onPress={() => router.push('/journal')}
        />
      ) : (
        <>
          <View className="border-border flex-row flex-wrap gap-3 border-y py-5">
            <Metric label="Net P&L" value={money(net)} />
            <Metric
              label="Win rate"
              value={`${Math.round((wins.length / closed.length) * 100)}%`}
            />
          </View>
          <View className="flex-row flex-wrap gap-3">
            <Metric label="Closed trades" value={String(closed.length)} />
            <Metric
              label="Profit factor"
              value={loss ? (gain / loss).toFixed(2) : gain ? 'No losses' : '—'}
            />
          </View>
          <Section title="Period performance curve">
            <View className="bg-surface gap-4 rounded-2xl p-4">
              <Text
                className="text-foreground text-2xl"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                {money(values[values.length - 1])}
              </Text>
              <Svg width="100%" height={170} viewBox="0 0 300 170">
                <Line x1={10} y1={145} x2={290} y2={145} stroke={border} />
                <Line x1={10} y1={82} x2={290} y2={82} stroke={border} strokeDasharray="3 5" />
                <Path d={path} stroke={accent} strokeWidth={2.5} fill="none" />
              </Svg>
              <View className="flex-row justify-between">
                <Text className="text-muted text-xs">
                  {new Date(closed[0].closedAt!).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
                <Text className="text-muted text-xs">
                  {new Date(closed[closed.length - 1].closedAt!).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
            </View>
            <Text className="text-muted text-xs">
              Trade-only curve from the balance before the first close in this period. Later
              deposits and withdrawals are excluded.
            </Text>
          </Section>
          <Section title="Terminus accuracy">
            <Metric label="Terminus adherence" value={adherence} />
            <Metric
              label="Extreme accuracy · win rate at premium / discount"
              value={pct(
                audited.filter((t) => t.extreme === 'Premium' || t.extreme === 'Discount'),
              )}
            />
            <Metric
              label="1H timeframe win rate"
              value={pct(audited.filter((t) => t.audit?.timeframe === '1H'))}
            />
            <Metric
              label="15M timeframe win rate"
              value={pct(audited.filter((t) => t.audit?.timeframe === '15M'))}
            />
            <Text className="text-muted">
              Based on {audited.length} audited {audited.length === 1 ? 'trade' : 'trades'}. Legacy
              trades are excluded from these scores.
            </Text>
          </Section>
          <Section title="Emotion vs. P&L">
            {emotionTotals.map(({ emotion, trades }) => {
              const total = trades.reduce((sum, trade) => sum + pnl(trade), 0);
              return (
                <View key={emotion} className="gap-2">
                  <View className="flex-row flex-wrap justify-between gap-2">
                    <Text className="text-foreground">
                      {emotion} · {trades.length}
                    </Text>
                    <Text className="text-foreground">
                      {trades.length ? money(total) : 'Not recorded'}
                    </Text>
                  </View>
                  {trades.length ? (
                    <View className="flex-row">
                      <View className="border-border flex-1 items-end border-r">
                        {total < 0 ? (
                          <View
                            className="bg-danger h-3"
                            style={{ width: `${(Math.abs(total) / emotionScale) * 100}%` }}
                          />
                        ) : null}
                      </View>
                      <View className="flex-1">
                        {total > 0 ? (
                          <View
                            className="bg-accent h-3"
                            style={{ width: `${(total / emotionScale) * 100}%` }}
                          />
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Section>
          <Section title="Ultra Journal Checker">
            <View className="flex-row flex-wrap items-baseline justify-between gap-3">
              <Text className="text-muted">Recorded rule compliance</Text>
              <Text className="text-accent text-2xl" style={{ fontFamily: 'Inter_600SemiBold' }}>
                {compliance}%
              </Text>
            </View>
            <Text className="text-muted text-sm">
              {closed.filter((t) => t.reflections?.every(Boolean)).length} of {closed.length} closed
              trades have complete reflections.
            </Text>
          </Section>
          <Section title="Rule sensitivity scan">
            {[
              'HTF alignment',
              'Extreme zone',
              'News filter',
              'Pre-entry checklist',
              'Cascade confirmation',
            ].map((label, i) => {
              const violations = checks.filter((c) => !c[i]).length;
              return (
                <View
                  key={label}
                  className="border-border flex-row justify-between gap-3 border-b py-3"
                >
                  <Text className="text-foreground flex-1 text-sm">{label}</Text>
                  <Text className={violations ? 'text-danger text-sm' : 'text-accent text-sm'}>
                    {violations ? `${violations} ${violations === 1 ? 'flag' : 'flags'}` : 'Clear'}
                  </Text>
                </View>
              );
            })}
          </Section>
          <Section title="By instrument">
            {[...new Set(closed.map((t) => t.instrument))].map((symbol) => (
              <View
                key={symbol}
                className="border-border flex-row flex-wrap justify-between gap-3 border-b py-3"
              >
                <Text className="text-foreground">{symbol}</Text>
                <Text className="text-accent">
                  {money(
                    closed.filter((t) => t.instrument === symbol).reduce((s, t) => s + pnl(t), 0),
                  )}
                </Text>
              </View>
            ))}
          </Section>
        </>
      )}
    </Page>
  );
}
