import { useState } from 'react';
import { View } from 'react-native';
import { Slider, Switch } from 'heroui-native';
import { Text } from '@/components/JournalText';
import { router } from 'expo-router';
import {
  Action,
  Field,
  Message,
  Options,
  Page,
  RiskWarning,
  Section,
} from '@/components/JournalUI';
import {
  balance,
  circuitUntil,
  errorFeedback,
  money,
  selection,
  useCurrentTime,
  useJournal,
} from '@/lib/journal';
import { emotions, entryGate, type TradeAudit } from '@/lib/terminus';
import { goBackOrReplace } from '@/lib/navigation';
import { BalanceControl } from '@/components/BalanceControl';
import { InstrumentPicker } from '@/components/InstrumentPicker';
import { resolvePipSize } from '@/constants/instruments';
const initial = {
  instrument: '',
  direction: 'Long',
  session: 'New York',
  grade: 'A+',
  dailyBias: '',
  h4Bias: '',
  aligned: '',
  extreme: '',
  zone: '',
  sweep: '',
  m15: '',
  m1: '',
  entry: '',
  stop: '',
  target: '',
  lots: '',
  plannedRisk: '',
  accountBalance: '',
  riskPercent: '',
  stopPips: '',
  targetPips: '',
  pipValue: '',
  units: '',
  news: '',
  circuit: '',
  checklist: '',
  setup: '',
  reason: '',
  timeframe: '',
};
export default function NewTrade() {
  const state = useJournal();
  const now = useCurrentTime();
  const [draft, setDraft] = useState(initial);
  const [manualEntry, setManualEntry] = useState(false);
  const [emotionIndex, setEmotionIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const update = (key: keyof typeof initial, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const account = state.accounts.find((a) => a.id === state.accountId);
  const accountTrades = state.trades.filter((t) => t.accountId === state.accountId);
  const gate = entryGate(account, accountTrades, now, circuitUntil(accountTrades));
  const equity = balance(state.accountId, state.trades, state.transactions);
  const symbol = draft.instrument.trim().toUpperCase();
  const pipSize = resolvePipSize(symbol, account?.pipSettings);
  const pipOverride = account?.pipSettings?.some((p) => p.instrument === symbol);
  const overLimit = Number(draft.riskPercent) > 2;
  const fail = (text: string) => {
    setError(text);
    errorFeedback();
  };
  const save = () => {
    if (saving) return;
    if (emotionIndex === null) return fail('Select your entry emotion.');
    const timeframe = draft.timeframe;
    if (timeframe !== '1H' && timeframe !== '15M')
      return fail('Select the timeframe that defines the extreme.');
    if (!pipSize) return fail('Select an instrument with a pip size.');
    const numeric = [
      'entry',
      'stop',
      'target',
      'lots',
      'plannedRisk',
      'accountBalance',
      'riskPercent',
      'stopPips',
      'targetPips',
      'pipValue',
      'units',
    ] as const;
    if (
      numeric.some(
        (key) =>
          !draft[key].trim() || !Number.isFinite(Number(draft[key])) || Number(draft[key]) <= 0,
      )
    )
      return fail('Fill every trade value field with a positive number.');
    const audit: TradeAudit = {
      version: 1,
      checkedAt: new Date(now).toISOString(),
      timeframe,
      manualEntry,
      emotion: emotions[emotionIndex],
      accountBalance: Number(draft.accountBalance),
      riskPercent: Number(draft.riskPercent),
      stopPips: Number(draft.stopPips),
      targetPips: Number(draft.targetPips),
      pipSize,
      pipValue: Number(draft.pipValue),
      units: Number(draft.units),
      lotsInput: draft.lots.trim(),
      newsEvents: [],
      results: [],
    };
    const failure = state.addTrade({
      instrument: symbol,
      direction: draft.direction,
      session: draft.session,
      grade: draft.grade,
      dailyBias: draft.dailyBias,
      h4Bias: draft.h4Bias,
      aligned: draft.aligned,
      extreme: draft.extreme,
      zone: draft.zone.trim(),
      sweep: draft.sweep.trim(),
      m15: draft.m15.trim(),
      m1: draft.m1.trim(),
      entry: Number(draft.entry),
      stop: Number(draft.stop),
      target: Number(draft.target),
      lots: Number(draft.lots),
      jpyPerUsd: 1,
      plannedRisk: Number(draft.plannedRisk),
      news: draft.news,
      circuit: draft.circuit,
      checklist: draft.checklist,
      setup: draft.setup.trim(),
      reason: draft.reason.trim(),
      audit,
    });
    if (failure) return fail(failure);
    setSaving(true);
    goBackOrReplace('/');
  };
  const field = (key: keyof typeof initial, label: string, numeric = false, multiline = false) => (
    <Field
      label={label}
      value={draft[key]}
      onChange={(v) => update(key, v)}
      keyboardType={numeric ? 'decimal-pad' : undefined}
      multiline={multiline}
    />
  );
  const options = (key: keyof typeof initial, label: string, values: string[]) => (
    <Options label={label} options={values} value={draft[key]} onChange={(v) => update(key, v)} />
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
          {overLimit ? (
            <Text className="text-danger text-sm">Risk must be within 2% to save.</Text>
          ) : null}
          <Action
            label={saving ? 'Saving…' : 'Save to journal'}
            onPress={save}
            disabled={saving || gate.locked}
          />
          <Action label="Cancel" secondary onPress={() => goBackOrReplace('/')} disabled={saving} />
        </View>
      }
    >
      <Section title="GR-ATC Journal">
        <Text className="text-muted">
          {account.name} · {money(equity)}
        </Text>
      </Section>
      {gate.messages.map((message) => (
        <Text key={message.split(' in ')[0]} className="text-danger">
          {message}
        </Text>
      ))}
      <BalanceControl key={state.accountId} />
      <Section title="1. Instrument & direction">
        <InstrumentPicker
          value={symbol}
          onChange={(value) => update('instrument', value)}
          overrides={account.pipSettings}
        />
        <Field
          label={pipOverride ? 'Pip size · broker override' : 'Pip size · GR-ATC default'}
          value={pipSize === undefined ? '' : String(pipSize)}
          placeholder="Select an instrument"
          readOnly
        />
        {options('direction', 'Direction', ['Long', 'Short'])}
        {options('session', 'Session · 16:00–21:00 EAT', ['London', 'New York', 'Other'])}
        {options('grade', 'Setup grade', ['A+', 'A++'])}
      </Section>
      <Section title="2. Higher-timeframe mandate">
        {options('dailyBias', 'Daily (1D) bias', ['Bullish', 'Bearish', 'Ranging'])}
        {options('h4Bias', '4H bias', ['Bullish', 'Bearish', 'Ranging'])}
        {options('aligned', 'HTF aligned?', ['Yes', 'No'])}
      </Section>
      <Section title="3. The extreme">
        {options('extreme', 'Extreme zone', ['Discount', 'Premium'])}
        {options('timeframe', 'Defined on which timeframe?', ['1H', '15M'])}
        {field('zone', 'Dealing range / zone notes')}
      </Section>
      <Section title="4. Cascade confirmation">
        {field('sweep', '1H sweep level')}
        {field('reason', 'Structural reason', false, true)}
        {field('m15', '15M confirmation')}
        {field('m1', '1M trigger')}
        {field('setup', 'Setup name')}
      </Section>
      <Section title="5. Manual entry">
        <View className="flex-row items-center gap-3">
          <Text className="text-foreground flex-1">Did I enter manually?</Text>
          <Switch
            accessibilityLabel="Did I enter manually?"
            isSelected={manualEntry}
            onSelectedChange={(value) => {
              selection();
              setManualEntry(value);
            }}
          />
        </View>
      </Section>
      <Section title="6. Trade values">
        <Text className="text-muted">
          Enter your trade values. They are saved without checking the calculations. Pip value is
          USD per pip for one standard lot.
        </Text>
        <Text className="text-foreground">Pip size: {pipSize ?? 'Select an instrument'}</Text>
        <Action label="Manage pip sizes" secondary onPress={() => router.push('/settings')} />
        {field('accountBalance', 'Account balance (USD)', true)}
        {field('riskPercent', 'Risk (%)', true)}
        {field('plannedRisk', 'Risk amount (USD)', true)}
        {overLimit ? <RiskWarning /> : null}
        {field('stopPips', 'Stop loss (pips)', true)}
        {field('entry', 'Entry price', true)}
        {field('stop', 'Stop-loss price', true)}
        {field('targetPips', 'Take profit (pips)', true)}
        {field('target', 'Take-profit price', true)}
        {field('pipValue', 'Pip value (USD per pip per standard lot)', true)}
        {field('units', 'Units', true)}
        {field('lots', 'Standard lots', true)}
      </Section>
      <Section title="7. Entry emotion">
        <Text className="text-foreground">
          {emotionIndex === null ? 'Select your emotion' : emotions[emotionIndex]}
        </Text>
        <Slider
          accessibilityLabel="Entry emotion: Calm, FOMO, Revenge, Tired"
          value={emotionIndex ?? 0}
          minValue={0}
          maxValue={3}
          step={1}
          onChange={(value) => {
            const index = Array.isArray(value) ? value[0] : value;
            if (index !== emotionIndex) {
              selection();
              setEmotionIndex(index);
            }
          }}
        >
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
        <Options
          options={[...emotions]}
          value={emotionIndex === null ? '' : emotions[emotionIndex]}
          onChange={(value) => setEmotionIndex(emotions.findIndex((emotion) => emotion === value))}
        />
      </Section>
      <Section title="Macro & checklist">
        <Text className="text-muted">
          All entry requirements are mandatory. Your entered calculations are not verified.
        </Text>
        {options('news', 'News filter', ['Quiet', 'Aligned', 'Blackout'])}
        {options('circuit', 'Circuit breaker', ['Clear', 'Locked'])}
        {options('checklist', 'All pre-entry checks complete?', ['Yes', 'No'])}
      </Section>
    </Page>
  );
}
