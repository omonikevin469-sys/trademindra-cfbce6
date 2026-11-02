import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/JournalText';
import { Action, Field } from '@/components/JournalUI';
import { errorFeedback } from '@/lib/journal';
import {
  defaultFontSize,
  minimumFontSize,
  maximumFontSize,
  validFontSize,
  useReadingPreferences,
} from '@/lib/readingPreferences';
export function FontControl() {
  const { fontSize, setFontSize, saveError } = useReadingPreferences();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
  const apply = () => {
    const text = (draft ?? String(fontSize)).trim();
    const size = Number(text);
    if (!/^\d+$/.test(text) || !validFontSize(size)) {
      setError(`Enter a whole number from ${minimumFontSize} to ${maximumFontSize}.`);
      errorFeedback();
      return;
    }
    setFontSize(size);
    setDraft(null);
    setError('');
  };
  return (
    <View className="gap-3">
      <Field
        label={`Size (${minimumFontSize}–${maximumFontSize})`}
        value={draft ?? String(fontSize)}
        keyboardType="number-pad"
        onChange={(value) => {
          setDraft(value);
          setError('');
        }}
        error={error}
      />
      <Action label="Apply" onPress={apply} />
      <Action
        label="Reset to 16"
        secondary
        onPress={() => {
          setFontSize(defaultFontSize);
          setDraft(null);
          setError('');
        }}
      />
      <Text className="text-foreground text-base">Font preview</Text>
      {saveError ? (
        <Text className="text-danger">Your font choice couldn’t be saved. Tap Apply to retry.</Text>
      ) : null}
    </View>
  );
}
