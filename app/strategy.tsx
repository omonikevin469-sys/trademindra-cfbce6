import { View } from 'react-native';
import { Text } from '@/components/JournalText';
import { ShieldCheck } from 'lucide-react-native';
import { useThemeColor } from 'heroui-native';
import { Page, Section, Action } from '@/components/JournalUI';
import { goBackOrReplace } from '@/lib/navigation';
import { circuitLocked, useJournal } from '@/lib/journal';
const rules = [
  [
    'Higher-timeframe mandate',
    'Daily and 4H must agree. Bullish bias permits discount-only longs. Bearish bias permits premium-only shorts. Never trade equilibrium or the middle of the range.',
  ],
  [
    'The cascade',
    '1D bias → 4H confirmation → 1H liquidity sweep at an extreme → 15M rejection or engulfing + CHoCH → 1M CHoCH + BOS entry. Never skip a step.',
  ],
  [
    'Session & instruments',
    'XAUUSD is primary; EURJPY is secondary. Other instruments require a saved broker pip size. The entry window is 4:00–9:00 PM EAT, Monday–Friday. Stop looking for new entries at 9:00 PM.',
  ],
  [
    'Risk guideline',
    'Aim to risk no more than 2% of equity. You can record a trade above this guideline; its risk check is marked as not met. Place the stop beyond the sweep wick and never move it. Target opposing liquidity with a minimum 1:2 risk-to-reward ratio. Round position size down.',
  ],
  [
    'News filter',
    'No entry within 15 minutes before or after each manually saved news event. Record its EAT time and expected macro reaction in Settings.',
  ],
  [
    'Circuit breaker',
    'Maximum two trades per day. After two consecutive losses, take 24 hours off. No revenge trades, no FOMO, no boredom entries.',
  ],
  [
    'Review the execution',
    'Complete the journal before entering. After closing, explain every reflection item. A day without a trade is still worth reviewing.',
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
