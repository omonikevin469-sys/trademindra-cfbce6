import { useState } from 'react';
import { View } from 'react-native';
import { Slider, Switch } from 'heroui-native';
import { router } from 'expo-router';
import { Text } from '@/components/JournalText';
import { Action, Field, Message, Page, Section } from '@/components/JournalUI';
import { InstrumentPicker } from '@/components/InstrumentPicker';
import { JournalSelect } from '@/components/JournalSelect';
import { circuitUntil, errorFeedback, selection, useCurrentTime, useJournal } from '@/lib/journal';
import { emotions, entryGate } from '@/lib/terminus';
import {
  manualTradeFailure,
  outcomes,
  type ManualTradeDraft,
  type Outcome,
} from '@/lib/manualTrade';
import { goBackOrReplace } from '@/lib/navigation';
const initial: ManualTradeDraft = {
  recordType: 'manual',
  instrument: '',
  direction: 'Long',
  dailyBias: '',
  h4Bias: '',
  extreme: '',
  timeframe: '',
  sweep: '',
  reason: '',
  m15: '',
  m1: '',
  entry: '',
  stop: '',
  target: '',
  riskPercent: '',
  rr: '',
  lots: '',
  emotion: 'Calm',
  manualEntry: false,
  result: 'Open',
};
export default function NewTrade() {
  const state = useJournal();
  const now = useCurrentTime();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = <K extends keyof ManualTradeDraft>(key: K, value: ManualTradeDraft[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  const account = state.accounts.find((a) => a.id === state.accountId);
  const trades = state.trades.filter((trade) => trade.accountId === state.accountId);
  const gate = entryGate(account, trades, now, circuitUntil(trades));
  const save = () => {
    if (saving) return;
    const failure = state.addTrade(draft);
    if (failure) {
      setError(failure);
      errorFeedback();
      return;
    }
    setSaving(true);
    router.replace('/journal');
  };
  const field = (
    key:
      | 'sweep'
      | 'reason'
      | 'm15'
      | 'm1'
      | 'entry'
      | 'stop'
      | 'target'
      | 'riskPercent'
      | 'rr'
      | 'lots',
    label: string,
    numeric = false,
  ) => (
    <Field
      label={label}
      value={draft[key]}
      onChange={(value) => update(key, value)}
      keyboardType={numeric ? 'decimal-pad' : undefined}
      multiline={key === 'reason'}
    />
  );
  const select = (
    key: 'direction' | 'dailyBias' | 'h4Bias' | 'extreme' | 'timeframe',
    label: string,
    options: string[],
  ) => (
    <JournalSelect
      label={label}
      value={draft[key]}
      options={options}
      onChange={(value) => update(key, value)}
    />
  );
  if (!account)
    return (
      <Page>
        <Section title="Start with an account">
          <Action label="Open Settings" onPress={() => router.replace('/settings')} />
        </Section>
      </Page>
    );
  return (
    <Page
      footer={
        <View className="gap-3">
          {error ? <Message text={error} /> : null}
          <Action
            label={saving ? 'Saving…' : 'Save trade'}
            onPress={save}
            disabled={saving || gate.locked || Boolean(manualTradeFailure(draft))}
          />
          <Action label="Cancel" secondary onPress={() => goBackOrReplace('/')} disabled={saving} />
        </View>
      }
    >
      <Section title="Record a trade">
        <Text className="text-muted">{account.name}</Text>
      </Section>
      {gate.messages.map((message) => (
        <Text key={message.split(' in ')[0]} className="text-danger">
          {message}
        </Text>
      ))}
      <Section title="Instrument and direction">
        <InstrumentPicker
          value={draft.instrument}
          onChange={(value) => update('instrument', value)}
          overrides={account.pipSettings}
        />
        {select('direction', 'Direction', ['Long', 'Short'])}
      </Section>
      <Section title="Bias and extreme">
        {select('dailyBias', '1D bias', ['Bullish', 'Bearish', 'Ranging'])}
        {select('h4Bias', '4H bias', ['Bullish', 'Bearish', 'Ranging'])}
        {select('extreme', 'Extreme zone', ['Premium', 'Discount'])}
        {select('timeframe', 'Zone timeframe', ['1H', '15M'])}
      </Section>
      <Section title="Cascade">
        {field('sweep', '1H liquidity sweep level')}
        {field('reason', 'Structural reason')}
        {field('m15', '15M confirmation')}
        {field('m1', '1M trigger')}
      </Section>
      <Section title="Manual trade values">
        {field('entry', 'Entry price', true)}
        {field('stop', 'Stop loss price', true)}
        {field('target', 'Take profit price', true)}
        {field('riskPercent', 'Risk %', true)}
        {field('rr', 'R:R ratio')}
        {field('lots', 'Lot size', true)}
      </Section>
      <Section title="Emotion">
        <Text className="text-foreground">{draft.emotion}</Text>
        <Slider
          accessibilityLabel="Emotion: Calm, FOMO, Revenge, Tired"
          value={emotions.findIndex((emotion) => emotion === draft.emotion)}
          minValue={0}
          maxValue={3}
          step={1}
          onChange={(value) => {
            const index = Array.isArray(value) ? value[0] : value;
            if (emotions[index] !== draft.emotion) {
              selection();
              update('emotion', emotions[index]);
            }
          }}
        >
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
        <View className="flex-row items-center gap-3">
          <Text className="text-foreground flex-1">Did I enter manually?</Text>
          <Switch
            accessibilityLabel="Did I enter manually?"
            isSelected={draft.manualEntry}
            onSelectedChange={(value) => {
              selection();
              update('manualEntry', value);
            }}
          />
        </View>
        <JournalSelect<Outcome>
          label="Outcome"
          value={draft.result}
          options={outcomes}
          onChange={(value) => update('result', value)}
        />
      </Section>
    </Page>
  );
}
