import { useMemo } from 'react';
import { SectionList, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import { Text } from '@/components/JournalText';
import { Action, Empty, Heading, TradeRow } from '@/components/JournalUI';
import { dateKey, money, pnl, useJournal, type Trade } from '@/lib/journal';
export default function Book() {
  const state = useJournal();
  const sections = useMemo(() => {
    const grouped = new Map<string, Trade[]>();
    state.trades
      .filter((trade) => trade.accountId === state.accountId && trade.exit !== undefined)
      .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))
      .forEach((trade) => {
        const key = trade.closedAt ? dateKey(new Date(trade.closedAt)) : 'unknown';
        const data = grouped.get(key) ?? [];
        data.push(trade);
        grouped.set(key, data);
      });
    return [...grouped].map(([key, data]) => ({ key, data }));
  }, [state.trades, state.accountId]);
  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <SectionList
        sections={sections}
        keyExtractor={(trade) => trade.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 30 }}
        ListHeaderComponent={
          <View className="mb-5 gap-4">
            <Heading title="Book" />
            <Text className="text-foreground text-base">
              {state.accounts.find((account) => account.id === state.accountId)?.name ??
                'Closed trades'}
            </Text>
            <Text className="text-muted text-sm">
              Closed trades are permanently saved, newest first.
            </Text>
            <Action secondary label="Open trades" onPress={() => router.push('/')} />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View className="bg-background mt-6 gap-1 pb-2">
            <Text className="text-foreground text-lg" style={{ fontFamily: 'Inter_600SemiBold' }}>
              {section.key === 'unknown'
                ? 'Close date not recorded'
                : new Date(`${section.key}T12:00:00`).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
            </Text>
            <Text className="text-muted text-sm">
              {section.data.length} {section.data.length === 1 ? 'trade' : 'trades'} ·{' '}
              {money(section.data.reduce((total, trade) => total + pnl(trade), 0))}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
            <TradeRow trade={item} />
          </Animated.View>
        )}
        ListEmptyComponent={
          <Empty
            text="Your closed trades will appear here, arranged by close day."
            action="Open trades"
            onPress={() => router.push('/')}
          />
        }
      />
    </SafeAreaView>
  );
}
