import { View } from 'react-native';
import { router } from 'expo-router';
import { useThemeColor } from 'heroui-native';
import { Svg, Path } from '@/components/ui/primitives/Svg';
import { Text } from '@/components/JournalText';
import { Action, Section } from '@/components/JournalUI';
import { balanceHistory } from '@/lib/performance';
import { money, type Transaction } from '@/lib/journal';

const date = (time: number) =>
  new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function BalanceGraph({
  transactions,
  accountId,
  window,
}: {
  transactions: Transaction[];
  accountId: string;
  window?: { start: Date; end: Date };
}) {
  const [accent, border] = useThemeColor(['accent', 'border']);
  const { points, updates } = balanceHistory(transactions, accountId, window);
  const amounts = points.map((point) => point.amount);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const spread = max - min;
  const low = spread ? min - spread * 0.1 : min - Math.max(Math.abs(min) * 0.1, 1);
  const high = spread ? max + spread * 0.1 : max + Math.max(Math.abs(max) * 0.1, 1);
  const start = points[0].time;
  const end = points[points.length - 1].time;
  const path = points
    .map((point, index) => {
      const x = 8 + ((point.time - start) / Math.max(1, end - start)) * 304;
      const y = 152 - ((point.amount - low) / (high - low)) * 136;
      return `${index ? 'L' : 'M'}${x},${y}`;
    })
    .join(' ');
  return (
    <Section title="Balance history">
      <Text className="text-foreground">{money(points[points.length - 1].amount)} USD</Text>
      <View
        accessible
        accessibilityLabel={`Balance history from ${date(start)} to ${date(end)}. ${updates} recorded updates. Balance ${money(points[points.length - 1].amount)}.`}
      >
        <Svg width="100%" height={168} viewBox="0 0 320 168" style={{ width: '100%', height: 168 }}>
          <Path
            d="M8,16 L312,16 M8,84 L312,84 M8,152 L312,152"
            stroke={border}
            strokeWidth={1}
            fill="none"
          />
          <Path d={path} stroke={accent} strokeWidth={2.5} fill="none" />
        </Svg>
      </View>
      <View className="flex-row flex-wrap justify-between gap-2">
        <Text className="text-muted text-xs">Low {money(min)}</Text>
        <Text className="text-muted text-xs">High {money(max)}</Text>
      </View>
      <View className="flex-row flex-wrap justify-between gap-2">
        <Text className="text-muted text-xs">{date(start)}</Text>
        <Text className="text-muted text-xs">{date(end)}</Text>
      </View>
      <Text className="text-muted text-sm">
        Recorded balance updates only; trade profit and loss are not inferred.
      </Text>
      {!updates ? (
        <View className="gap-3">
          <Text className="text-muted">No balance updates in this period.</Text>
          <Action label="Manage balance" secondary onPress={() => router.push('/settings')} />
        </View>
      ) : null}
    </Section>
  );
}
