import { useState } from 'react';
import { Field } from '@/components/JournalUI';
import { Text } from '@/components/JournalText';
import { profitLossFailure } from '@/lib/manualTrade';
import { errorFeedback } from '@/lib/journal';

export function ProfitLossField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [error, setError] = useState<string>();
  return (
    <>
      <Field
        label="Profit/loss (USD)"
        value={value}
        onChange={(text) => {
          setError(undefined);
          onChange(text);
        }}
        keyboardType="numbers-and-punctuation"
        error={error}
        onBlur={() => {
          const failure = profitLossFailure(value);
          setError(failure);
          if (failure) errorFeedback();
        }}
      />
      <Text className="text-muted text-sm">
        Positive for profit, negative for loss, 0 for no change.
      </Text>
    </>
  );
}
