import { useState } from 'react';
import { View } from 'react-native';
import { Action, Field } from '@/components/JournalUI';
import { useJournal } from '@/lib/journal';
export function BalanceControl() {
  const setCurrentBalance = useJournal((s) => s.setCurrentBalance);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  return (
    <View className="gap-3">
      <Field
        label="Current account balance (USD)"
        value={amount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        error={error}
        onChange={(value) => {
          setAmount(value);
          setError('');
          setSaved(false);
        }}
      />
      <Action
        label={saved ? 'Balance saved' : 'Save balance'}
        secondary
        onPress={() => {
          const value = amount.trim() ? Number(amount) : NaN;
          if (!setCurrentBalance(value)) {
            setError('Enter a balance of zero or more.');
            return;
          }
          setError('');
          setSaved(true);
        }}
      />
    </View>
  );
}
