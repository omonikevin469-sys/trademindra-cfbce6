import { View } from 'react-native';
import { router } from 'expo-router';
import { useThemeColor } from 'heroui-native';
import { Text } from '@/components/JournalText';
import { Empty, Section } from '@/components/JournalUI';
import type { Trade } from '@/lib/journal';
import { tradeOutcome } from '@/lib/manualTrade';

export function WinLossGraph({ trades, accountId }: { trades: Trade[]; accountId: string }) {
  const [accent, danger] = useThemeColor(['accent', 'danger']);
  let wins = 0;
  let losses = 0;
  for (const trade of trades) {
    if (trade.accountId !== accountId) continue;
    const outcome = tradeOutcome(trade);
    if (outcome === 'Win') wins++;
    if (outcome === 'Loss') losses++;
  }
  const maximum = Math.max(wins, losses, 1);
  const bars = [
    { label: 'Wins', count: wins, color: accent },
    { label: 'Losses', count: losses, color: danger },
  ];

  return (
    <Section title="Wins and losses">
      <View
        accessible
        accessibilityLabel={`${wins} winning ${wins === 1 ? 'trade' : 'trades'} and ${losses} losing ${losses === 1 ? 'trade' : 'trades'}. Open and breakeven trades are excluded.`}
        className="gap-4"
      >
        {bars.map(({ label, count, color }) => (
          <View key={label} className="gap-2">
            <View className="flex-row items-baseline justify-between gap-3">
              <Text className="text-foreground">{label}</Text>
              <Text className="text-foreground" style={{ fontFamily: 'Inter_600SemiBold' }}>
                {count}
              </Text>
            </View>
            <View className="border-border h-7 border-b">
              <View
                style={{ width: `${(count / maximum) * 100}%`, height: 24, backgroundColor: color }}
              />
            </View>
          </View>
        ))}
      </View>
      {!wins && !losses ? (
        <Empty
          text="Winning and losing trades will appear here."
          action="Open journal"
          onPress={() => router.push('/journal')}
        />
      ) : null}
    </Section>
  );
}
