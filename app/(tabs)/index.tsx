import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/JournalText';
import { useReadingScale } from '@/lib/readingPreferences';
import { router } from 'expo-router';
import { Button, useThemeColor } from 'heroui-native';
import { ArrowUpRight, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react-native';
import { BalanceControl } from '@/components/BalanceControl';
import { Action, Empty, Heading, Metric, Page, Section, TradeRow } from '@/components/JournalUI';
import {
  balance,
  circuitUntil,
  dateKey,
  money,
  selection,
  useCurrentTime,
  useJournal,
} from '@/lib/journal';
import { eatDateKey, eatDisplay, entryGate } from '@/lib/terminus';
export default function Desk() {
  const scale = useReadingScale();
  const state = useJournal();
  const now = useCurrentTime();
  const todayKey = eatDateKey(now);
  const [accent, muted] = useThemeColor(['accent', 'muted']);
  const [month, setMonth] = useState(() => new Date(`${eatDateKey(now).slice(0, 7)}-01T12:00:00`));
  const [day, setDay] = useState(todayKey);
  const account = state.accounts.find((a) => a.id === state.accountId);
  const trades = state.trades.filter((t) => t.accountId === state.accountId);
  const open = trades.filter((t) => t.exit === undefined);
  const today = trades.filter((t) => eatDateKey(t.date) === todayKey);
  const gate = entryGate(account, trades, now, circuitUntil(trades));
  const locked = circuitUntil(trades) > now;
  const first = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return (
    <Page>
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="flex-row flex-wrap items-baseline gap-2">
          <Text className="text-foreground text-base" style={{ fontFamily: 'Inter_700Bold' }}>
            TradeMindra
          </Text>
          <Text className="text-accent text-xs" style={{ fontFamily: 'Inter_600SemiBold' }}>
            ULTRA
          </Text>
        </View>
        <Button
          size="sm"
          variant="ghost"
          className="h-auto py-2"
          onPress={() => router.push('/strategy')}
        >
          <ShieldCheck color={accent} size={17} strokeWidth={1.7} />
          <Button.Label style={{ fontSize: 14 * scale, lineHeight: 20 * scale }}>
            GR-ATC
          </Button.Label>
        </Button>
      </View>
      <View className="gap-2">
        <Text className="text-muted text-sm">
          {eatDisplay(now, { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
        <Heading title={state.name ? `${state.name.split(' ')[0]}’s desk` : 'Your desk'} />
      </View>
      <View className="bg-surface gap-5 rounded-2xl p-5">
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <Text className="text-muted text-sm" numberOfLines={1}>
            {account?.name ?? 'Trading account'}
          </Text>
          <Text className="text-muted text-xs">USD</Text>
        </View>
        <Text className="text-foreground text-4xl" style={{ fontFamily: 'Inter_600SemiBold' }}>
          {money(balance(state.accountId, state.trades, state.transactions))}
        </Text>
        {account ? (
          <BalanceControl key={account.id} />
        ) : (
          <Action label="Add trading account" onPress={() => router.push('/settings')} />
        )}
        <View className="border-border flex-row flex-wrap gap-3 border-t pt-4">
          <Metric label="Trades today" value={`${today.length} / 2`} />
          <Metric label="Circuit" value={locked ? 'Locked' : 'Clear'} />
          <Metric label="EAT session" value={gate.session.open ? 'Open' : 'Closed'} />
        </View>
      </View>
      <Action
        label="Record a trade"
        disabled={!account || gate.locked}
        onPress={() => router.push('/new-trade')}
      />
      {gate.messages.map((message) => (
        <Text key={message.split(' in ')[0]} className="text-danger">
          {message}
        </Text>
      ))}
      <Action label="Daily news & pip sizes" secondary onPress={() => router.push('/settings')} />
      {!state.reviews.some((r) => r.date === todayKey) ? (
        <Button
          variant="ghost"
          className="h-auto justify-start p-0"
          onPress={() => router.push('/reviews')}
        >
          <View className="flex-1 gap-1">
            <Text className="text-foreground text-base" style={{ fontFamily: 'Inter_600SemiBold' }}>
              Today is still unwritten
            </Text>
            <Text className="text-muted text-sm">A no-trade day counts. Write your review.</Text>
          </View>
          <ArrowUpRight color={accent} size={20} strokeWidth={1.7} />
        </Button>
      ) : null}
      <Section
        title="Open trades"
        action={<Text className="text-muted text-sm">{open.length}</Text>}
      >
        {open.length ? (
          open.map((t) => <TradeRow key={t.id} trade={t} />)
        ) : (
          <Empty
            text="Your open trades will appear here."
            action={gate.locked ? 'Review trading settings' : 'Record a trade'}
            onPress={() => router.push(gate.locked ? '/settings' : '/new-trade')}
          />
        )}
      </Section>
      {trades.some((t) => t.exit !== undefined) ? (
        <Action
          secondary
          label="Read closed trades in Book"
          onPress={() => router.push('/journal')}
        />
      ) : null}
      <Section title="Trading calendar">
        <View className="bg-surface gap-3 rounded-2xl p-4">
          <View className="flex-row flex-wrap items-center justify-between gap-3">
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              accessibilityLabel="Previous month"
              onPress={() => {
                selection();
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
              }}
            >
              <ChevronLeft size={18} color={muted} strokeWidth={1.7} />
            </Button>
            <Text className="text-foreground" style={{ fontFamily: 'Inter_600SemiBold' }}>
              {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              accessibilityLabel="Next month"
              onPress={() => {
                selection();
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
              }}
            >
              <ChevronRight size={18} color={muted} strokeWidth={1.7} />
            </Button>
          </View>
          <View className="flex-row">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
              (weekday) => (
                <Text key={weekday} className="text-muted flex-1 text-center text-xs">
                  {weekday[0]}
                </Text>
              ),
            )}
          </View>
          {Array.from({ length: Math.ceil((first + count) / 7) }, (_, week) => (
            <View key={week} className="flex-row">
              {Array.from({ length: 7 }, (_day, i) => {
                const n = week * 7 + i - first + 1;
                const key = dateKey(new Date(month.getFullYear(), month.getMonth(), n));
                const hasTrade = trades.some((t) => eatDateKey(t.date) === key);
                return (
                  <View key={i} style={{ flex: 1 }}>
                    {n > 0 && n <= count ? (
                      <Button
                        variant={day === key ? 'primary' : 'ghost'}
                        className="h-auto min-h-10 min-w-0 rounded-lg px-0 py-2"
                        onPress={() => {
                          if (day !== key) selection();
                          setDay(key);
                        }}
                        accessibilityLabel={`${key}${hasTrade ? ', trades recorded' : ''}`}
                      >
                        <View className="items-center gap-0.5">
                          <Text
                            className={day === key ? 'text-accent-foreground' : 'text-foreground'}
                          >
                            {n}
                          </Text>
                          {hasTrade ? (
                            <View
                              className={
                                day === key
                                  ? 'bg-accent-foreground h-1 w-1 rounded-full'
                                  : 'bg-accent h-1 w-1 rounded-full'
                              }
                            />
                          ) : null}
                        </View>
                      </Button>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        <Text className="text-muted text-sm">
          {new Date(`${day}T12:00:00`).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
        {trades.filter((t) => eatDateKey(t.date) === day).length ? (
          trades
            .filter((t) => eatDateKey(t.date) === day)
            .map((t) => <TradeRow key={t.id} trade={t} />)
        ) : (
          <View className="gap-2">
            <Text className="text-muted text-sm">No trades recorded.</Text>
            <Button
              size="sm"
              variant="ghost"
              className="h-auto max-w-full self-start px-0 py-2"
              onPress={() => router.push({ pathname: '/reviews', params: { date: day } })}
            >
              <Button.Label style={{ fontSize: 14 * scale, lineHeight: 20 * scale }}>
                Review this day
              </Button.Label>
            </Button>
          </View>
        )}
      </Section>
    </Page>
  );
}
