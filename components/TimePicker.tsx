import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { Action } from '@/components/JournalUI';
import { Text } from '@/components/JournalText';
export type TimePickerProps = { value: string; onChange: (time: string) => void; label: string };
export default function TimePicker({ value, onChange, label }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [today] = useState(() => new Date());
  const [hour, minute] = value ? value.split(':').map(Number) : [18, 30];
  const date = new Date(today);
  date.setHours(hour, minute, 0, 0);
  return (
    <View className="gap-2">
      <Text className="text-foreground">{label}</Text>
      <Action label={value || 'Choose time'} secondary onPress={() => setOpen(true)} />
      {open ? (
        <DateTimePicker
          mode="time"
          value={date}
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selected) => {
            if (Platform.OS !== 'ios') setOpen(false);
            if (event.type === 'set' && selected)
              onChange(
                `${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`,
              );
          }}
        />
      ) : null}
      {open && Platform.OS === 'ios' ? (
        <Action
          label="Done"
          secondary
          onPress={() => {
            if (!value) onChange('18:30');
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}
