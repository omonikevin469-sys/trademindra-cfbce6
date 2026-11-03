import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/JournalText';
import { Action, Empty, Field, Message, Page, Section } from '@/components/JournalUI';
import { JournalSelect } from '@/components/JournalSelect';
import { errorFeedback, useJournal } from '@/lib/journal';
import { manualFields, tradeOutcome, type Outcome } from '@/lib/manualTrade';
import { goBackOrReplace } from '@/lib/navigation';
import { eatDisplay } from '@/lib/terminus';
import { saveAllPending } from '@/lib/cloud';
export default function TradeDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useJournal();
  const trade = state.trades.find((item) => item.id === id);
  const [result, setResult] = useState<Exclude<Outcome, 'Open'> | ''>('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  if (!trade)
    return (
      <Page>
        <Empty
          text="This trade could not be found."
          action="Open Book"
          onPress={() => router.replace('/journal')}
        />
      </Page>
    );
  const open = tradeOutcome(trade) === 'Open';
  const reflectionCounts = new Map<string, number>();
  const reflections = trade.reflections?.map((text) => {
    const occurrence = (reflectionCounts.get(text) ?? 0) + 1;
    reflectionCounts.set(text, occurrence);
    return { text, key: JSON.stringify([text, occurrence]) };
  });
  const close = async () => {
    if (!result || saving) return;
    setSaving(true);
    setError('');
    if (!trade.closedAt) state.setTradeOutcome(trade.id, result);
    try {
      await saveAllPending();
      goBackOrReplace('/journal');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your outcome could not be synced. Try again.');
      errorFeedback();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Page
      footer={
        open || error || saving ? (
          <View className="gap-3">
            {error ? <Message text={error} /> : null}
            <Action
              label={saving ? 'Saving…' : error ? 'Retry sync' : 'Save outcome'}
              disabled={!result || saving}
              onPress={() => {
                void close();
              }}
            />
          </View>
        ) : undefined
      }
    >
      <Section title={trade.instrument}>
        <Text className="text-foreground">
          {trade.direction} · {tradeOutcome(trade)}
        </Text>
        <Text className="text-muted">{eatDisplay(trade.date)} EAT</Text>
      </Section>
      <Section title="Recorded values">
        {manualFields
          .filter(([key]) => key !== 'instrument' && key !== 'result')
          .map(([key, label]) => {
            const value =
              trade[key] ??
              (key === 'timeframe'
                ? trade.audit?.timeframe
                : key === 'emotion'
                  ? trade.audit?.emotion
                  : key === 'riskPercent'
                    ? trade.audit?.riskPercent
                    : undefined);
            return (
              <Field
                key={key}
                label={label}
                value={value === undefined ? 'Not recorded' : String(value)}
                readOnly
                multiline={key === 'reason'}
              />
            );
          })}
        <Field
          label="Did I enter manually?"
          value={
            (trade.manualEntry ?? trade.audit?.manualEntry) === undefined
              ? 'Not recorded'
              : (trade.manualEntry ?? trade.audit?.manualEntry)
                ? 'Yes'
                : 'No'
          }
          readOnly
        />
      </Section>
      {open ? (
        <Section title="Record outcome">
          <JournalSelect<Exclude<Outcome, 'Open'>>
            label="Outcome"
            value={result}
            options={['Win', 'Loss', 'Breakeven']}
            onChange={setResult}
          />
        </Section>
      ) : (
        <Section title="Outcome">
          <Text className="text-foreground">{tradeOutcome(trade)}</Text>
          {trade.closedAt ? (
            <Text className="text-muted">{eatDisplay(trade.closedAt)} EAT</Text>
          ) : null}
        </Section>
      )}
      {trade.reflections?.length ? (
        <Section title="Saved reflections">
          {reflections?.map((reflection) => (
            <Text key={reflection.key} className="text-foreground">
              {reflection.text}
            </Text>
          ))}
        </Section>
      ) : null}
      {trade.outcome ? (
        <Section title="What happened">
          <Text className="text-foreground">{trade.outcome}</Text>
        </Section>
      ) : null}
      {trade.lesson ? (
        <Section title="Lesson">
          <Text className="text-foreground">{trade.lesson}</Text>
        </Section>
      ) : null}
      <Action label="Open Book" secondary onPress={() => goBackOrReplace('/journal')} />
    </Page>
  );
}
