import { View } from 'react-native';
import { Button, useThemeColor } from 'heroui-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Text } from '@/components/JournalText';
import { Options } from '@/components/JournalUI';
import { selection } from '@/lib/journal';
import { periods, periodLabel, shiftPeriod, type Period } from '@/lib/periods';
import { useReadingScale } from '@/lib/readingPreferences';
export function PeriodControl({
  period,
  anchor,
  onPeriodChange,
  onAnchorChange,
}: {
  period: Period;
  anchor: Date;
  onPeriodChange: (period: Period) => void;
  onAnchorChange: (anchor: Date) => void;
}) {
  const foreground = useThemeColor('foreground');
  const scale = useReadingScale();
  return (
    <View className="gap-3">
      <Options
        options={[...periods]}
        value={period}
        onChange={(value) => {
          const selectedPeriod = periods.find((option) => option === value);
          if (selectedPeriod) onPeriodChange(selectedPeriod);
        }}
      />
      <View className="flex-row items-center gap-2">
        <Button
          isIconOnly
          variant="secondary"
          size="sm"
          accessibilityLabel={`Previous ${period.toLowerCase()} period`}
          onPress={() => {
            selection();
            onAnchorChange(shiftPeriod(period, anchor, -1));
          }}
        >
          <ChevronLeft size={18} color={foreground} strokeWidth={1.7} />
        </Button>
        <Text
          className="text-foreground flex-1 text-center text-base"
          style={{ fontFamily: 'Inter_500Medium' }}
        >
          {periodLabel(period, anchor)}
        </Text>
        <Button
          isIconOnly
          variant="secondary"
          size="sm"
          accessibilityLabel={`Next ${period.toLowerCase()} period`}
          onPress={() => {
            selection();
            onAnchorChange(shiftPeriod(period, anchor, 1));
          }}
        >
          <ChevronRight size={18} color={foreground} strokeWidth={1.7} />
        </Button>
      </View>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto self-start px-0 py-2"
        onPress={() => {
          selection();
          onAnchorChange(new Date());
        }}
      >
        <Button.Label style={{ fontSize: 14 * scale, lineHeight: 20 * scale }}>
          Current period
        </Button.Label>
      </Button>
    </View>
  );
}
