import { View } from 'react-native';
import { Text } from '@/components/JournalText';
import { useThemeColor } from 'heroui-native';
import type { TimePickerProps } from '@/components/TimePicker';
export default function TimePicker({ value, onChange, label }: TimePickerProps) {
  const [background, foreground, border] = useThemeColor([
    'field',
    'field-foreground',
    'field-border',
  ]);
  return (
    <View className="gap-2">
      <Text className="text-foreground">{label}</Text>
      <input
        aria-label={label}
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          minHeight: 48,
          width: '100%',
          boxSizing: 'border-box',
          border: `1px solid ${border}`,
          borderRadius: 12,
          padding: 12,
          fontFamily: 'Inter, sans-serif',
          fontSize: 16,
          background,
          color: foreground,
        }}
      />
    </View>
  );
}
