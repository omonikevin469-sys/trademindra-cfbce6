import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View, useWindowDimensions } from 'react-native';
import { Label, Select } from 'heroui-native';
import { instruments } from '@/constants/instruments';
import type { PipSetting } from '@/lib/terminus';
import { selection } from '@/lib/journal';
import { Action, Empty, Field } from '@/components/JournalUI';
import { Text } from '@/components/JournalText';
import { useReadingScale } from '@/lib/readingPreferences';

export function InstrumentPicker({
  value,
  onChange,
  overrides = [],
}: {
  value: string;
  onChange: (symbol: string) => void;
  overrides?: readonly PipSetting[];
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();
  const scale = useReadingScale();
  const options = [
    ...instruments.map((item) => ({ symbol: item.symbol, category: item.category })),
    ...overrides
      .filter((pip) => !instruments.some((item) => item.symbol === pip.instrument))
      .map((pip) => ({ symbol: pip.instrument, category: 'Broker instrument' })),
  ];
  const search = query.trim().toUpperCase();
  const filtered = options.filter(
    (item) => item.symbol.includes(search) || item.category.toUpperCase().includes(search),
  );
  return (
    <Select
      presentation="dialog"
      value={value ? { value, label: value } : undefined}
      isOpen={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
      onValueChange={(next) => {
        if (next && !Array.isArray(next) && next.value !== value) {
          selection();
          onChange(next.value);
        }
      }}
    >
      <View className="gap-2">
        <Label>
          <Label.Text style={{ fontSize: 16 * scale }}>Instrument</Label.Text>
        </Label>
        <Select.Trigger
          asChild={false}
          accessibilityLabel="Select instrument"
          className="border-field-border min-h-12 rounded-xl border px-4 py-3"
        >
          <Text className="text-foreground flex-1">{value || 'Select instrument'}</Text>
          <Select.TriggerIndicator />
        </Select.Trigger>
      </View>
      <Select.Portal>
        <Select.Overlay />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'center' }}
        >
          <Select.Content
            presentation="dialog"
            className="gap-4"
            style={{ maxHeight: height * 0.8 }}
          >
            <Select.ListLabel>Choose an instrument</Select.ListLabel>
            <Field
              label="Search instruments"
              value={query}
              onChange={setQuery}
              placeholder="Symbol or category"
            />
            <FlatList
              style={{ height: Math.max(120, height * 0.35) }}
              data={filtered}
              keyExtractor={(item) => item.symbol}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Select.Item value={item.symbol} label={item.symbol}>
                  <View className="flex-1 gap-1">
                    <Text className="text-foreground">{item.symbol}</Text>
                    <Text className="text-muted text-xs">{item.category}</Text>
                  </View>
                  <Select.ItemIndicator />
                </Select.Item>
              )}
              ListEmptyComponent={
                <Empty
                  text="No instruments match your search."
                  action="Clear search"
                  onPress={() => setQuery('')}
                />
              }
            />
            <Action
              label="Done"
              secondary
              onPress={() => {
                setOpen(false);
                setQuery('');
              }}
            />
          </Select.Content>
        </KeyboardAvoidingView>
      </Select.Portal>
    </Select>
  );
}
