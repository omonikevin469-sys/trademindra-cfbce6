import { View } from 'react-native';
import { Label, Select } from 'heroui-native';
import { Text } from '@/components/JournalText';
import { selection } from '@/lib/journal';
export function JournalSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | '';
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <Select
      value={value ? { value, label: value } : undefined}
      onValueChange={(next) => {
        if (next && !Array.isArray(next) && next.value !== value) {
          const option = options.find((item) => item === next.value);
          if (option !== undefined) {
            selection();
            onChange(option);
          }
        }
      }}
    >
      <View className="gap-2">
        <Label>{label}</Label>
        <Select.Trigger
          asChild={false}
          accessibilityLabel={label}
          className="border-field-border min-h-12 rounded-xl border px-4 py-3"
        >
          <Text className="text-foreground flex-1">{value || 'Select'}</Text>
          <Select.TriggerIndicator />
        </Select.Trigger>
      </View>
      <Select.Portal>
        <Select.Overlay />
        <Select.Content presentation="popover" width="trigger">
          {options.map((option) => (
            <Select.Item key={option} value={option} label={option} />
          ))}
        </Select.Content>
      </Select.Portal>
    </Select>
  );
}
