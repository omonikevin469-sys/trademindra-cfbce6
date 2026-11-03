import { View } from 'react-native';
import { Text } from '@/components/JournalText';
import { ShieldCheck } from 'lucide-react-native';
import { useThemeColor } from 'heroui-native';
import { Page, Section, Action } from '@/components/JournalUI';
import { goBackOrReplace } from '@/lib/navigation';
import { circuitLocked, useJournal } from '@/lib/journal';
const rules = [
  [
    'Trade recording',
    'Record your own prices, risk %, R:R ratio, lot size and outcome. Values are kept exactly as entered. No risk cap, math verification, strategy scoring or daily trade cap.',
  ],
  [
    'Session',
    'The recording window is 4:00–9:00 PM EAT, Monday–Friday. Outside this window, new trade recording is locked.',
  ],
  [
    'Manual news',
    'New trade recording is locked from 15 minutes before until 15 minutes after each manually saved news time. Set news times in EAT in Settings.',
  ],
  [
    'Circuit breaker',
    'Logging two consecutive losses locks new trade recording for 24 hours from the second loss. Outcomes are recorded by the trader.',
  ],
  [
    'Manual values',
    'Biases, premium or discount, timeframe and cascade notes are journal entries, not entry rules. Any risk % or R:R ratio can be recorded.',
  ],
  [
    'Outcomes',
    'Choose Win, Loss, Breakeven or Open. An open trade can have its outcome recorded later. Completed records remain permanently saved.',
  ],
  [
    'Account balance',
    'Update your balance manually in Settings or on the Desk. Trade prices and outcomes do not calculate account profit or loss.',
  ],
];
export default function Strategy() {
  const state = useJournal();
  const accent = useThemeColor('accent');
  const locked = circuitLocked(state.trades.filter((t) => t.accountId === state.accountId));
  return (
    <Page>
      <View className="gap-4">
        <ShieldCheck color={accent} size={34} strokeWidth={1.7} />
        <Text className="text-foreground text-3xl" style={{ fontFamily: 'Inter_700Bold' }}>
          Absolute Terminus Cascade
        </Text>
        <Text className="text-muted text-sm">GOLD REIGN · Kevin Omondi</Text>
        <View className="bg-surface rounded-xl p-4">
          <Text className={locked ? 'text-danger' : 'text-accent'}>
            {locked ? 'Circuit locked — take 24 hours off' : 'Circuit clear'}
          </Text>
        </View>
      </View>
      {rules.map(([title, body]) => (
        <Section key={title} title={title}>
          <Text className="text-muted text-base leading-6">{body}</Text>
        </Section>
      ))}
      <Action label="Return to desk" secondary onPress={() => goBackOrReplace('/')} />
      <Text className="text-muted text-xs">
        A discipline framework, not financial advice. Trading carries risk.
      </Text>
    </Page>
  );
}
