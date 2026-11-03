import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/components/JournalText';
import { Empty, Heading, Metric, Page, Section } from '@/components/JournalUI';
import { PeriodControl } from '@/components/PeriodControl';
import { withinPeriod, periodWindow, type Period } from '@/lib/periods';
import { BalanceGraph } from '@/components/BalanceGraph';
import { WinRateBreakdown } from '@/components/WinRateBreakdown';
import { winRates, recordedSession, extremeTimeframe } from '@/lib/performance';
import { useJournal } from '@/lib/journal';
import { emotions } from '@/lib/terminus';
import { outcomes, tradeOutcome } from '@/lib/manualTrade';
export default function Analytics() {
  const state = useJournal();
  const [range, setRange] = useState<Period>('Monthly');
  const [anchor, setAnchor] = useState(() => new Date());
  const trades = state.trades.filter(
    (trade) => trade.accountId === state.accountId && withinPeriod(trade.date, range, anchor),
  );
  return (
    <Page>
      <Heading title="Analytics" />
      <Text className="text-foreground">
        {state.accounts.find((account) => account.id === state.accountId)?.name ??
          'Trading account'}
      </Text>
      <PeriodControl
        period={range}
        anchor={anchor}
        onPeriodChange={setRange}
        onAnchorChange={setAnchor}
      />
      <BalanceGraph
        accountId={state.accountId}
        transactions={state.transactions}
        window={periodWindow(range, anchor)}
      />
      <WinRateBreakdown
        title="Win rate by session"
        rows={winRates(trades, recordedSession, ['London', 'New York'])}
      />
      <WinRateBreakdown
        title="Win rate by extreme timeframe"
        rows={winRates(trades, extremeTimeframe, ['1H', '15M'])}
      />
      <Text className="text-muted text-sm">
        Win rates use wins ÷ (wins + losses). Open and breakeven trades are excluded.
      </Text>
      {!trades.length ? (
        <Empty
          text="No trades recorded in this period."
          action="Record a trade"
          onPress={() => router.push('/new-trade')}
        />
      ) : (
        <>
          <Section title="Recorded outcomes">
            <View className="flex-row flex-wrap gap-4">
              {outcomes.map((outcome) => (
                <Metric
                  key={outcome}
                  label={outcome}
                  value={String(trades.filter((trade) => tradeOutcome(trade) === outcome).length)}
                />
              ))}
            </View>
          </Section>
          <Section title="Entry emotions">
            {emotions.map((emotion) => (
              <View
                key={emotion}
                className="border-border flex-row justify-between gap-3 border-b py-3"
              >
                <Text className="text-foreground">{emotion}</Text>
                <Text className="text-foreground">
                  {
                    trades.filter((trade) => (trade.emotion ?? trade.audit?.emotion) === emotion)
                      .length
                  }
                </Text>
              </View>
            ))}
          </Section>
          <Section title="By instrument">
            {[...new Set(trades.map((trade) => trade.instrument))].map((instrument) => (
              <View
                key={instrument}
                className="border-border flex-row justify-between gap-3 border-b py-3"
              >
                <Text className="text-foreground flex-1">{instrument}</Text>
                <Text className="text-foreground">
                  {trades.filter((trade) => trade.instrument === instrument).length}
                </Text>
              </View>
            ))}
          </Section>
        </>
      )}
    </Page>
  );
}
