import { View } from 'react-native';
import { Text } from '@/components/JournalText';
import { Section } from '@/components/JournalUI';
import { winRates } from '@/lib/performance';

export function WinRateBreakdown({
  title,
  rows,
}: {
  title: string;
  rows: ReturnType<typeof winRates>;
}) {
  return (
    <Section title={title}>
      {rows.map((row) => (
        <View key={row.label} className="border-border gap-1 border-b py-3">
          <View className="flex-row flex-wrap justify-between gap-2">
            <Text className="text-foreground" style={{ flexShrink: 1 }}>
              {row.label}
            </Text>
            <Text className="text-foreground" style={{ fontFamily: 'Inter_600SemiBold' }}>
              {row.rate === null ? '—' : `${row.rate.toFixed(1)}%`}
            </Text>
          </View>
          <Text className="text-muted text-sm">
            {row.wins} {row.wins === 1 ? 'win' : 'wins'} · {row.losses}{' '}
            {row.losses === 1 ? 'loss' : 'losses'} · {row.total}{' '}
            {row.total === 1 ? 'trade' : 'trades'}
          </Text>
        </View>
      ))}
    </Section>
  );
}
