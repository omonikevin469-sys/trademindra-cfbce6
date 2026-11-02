import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/JournalText';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Action,
  Empty,
  Field,
  Message,
  Metric,
  Page,
  RiskWarning,
  Section,
} from '@/components/JournalUI';
import { errorFeedback, money, pnl, reflections, useJournal } from '@/lib/journal';
import { goBackOrReplace } from '@/lib/navigation';
import { eatDisplay } from '@/lib/terminus';
import { saveAllPending } from '@/lib/cloud';
export default function TradeDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useJournal();
  const trade = state.trades.find((t) => t.id === id);
  const [exit, setExit] = useState('');
  const [answers, setAnswers] = useState<string[]>(reflections.map(() => ''));
  const [outcome, setOutcome] = useState('');
  const [lesson, setLesson] = useState('');
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
  const close = async () => {
    if (!exit.trim() || !Number.isFinite(Number(exit)) || Number(exit) <= 0) {
      setError('Enter a valid exit price.');
      errorFeedback();
      return;
    }
    if (answers.some((a) => !a.trim())) {
      setError('Write an explanation for every reflection before closing.');
      errorFeedback();
      return;
    }
    setSaving(true);
    state.closeTrade(trade.id, Number(exit), answers, outcome, lesson);
    try {
      await saveAllPending();
      goBackOrReplace('/journal');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your trade could not be synced. Try again.');
      errorFeedback();
    } finally {
      setSaving(false);
    }
  };
  return (
    <Page
      footer={
        trade.exit === undefined ? (
          <View className="gap-3">
            {error ? <Message text={error} /> : null}
            <Action
              label={saving ? 'Closing…' : 'Close trade & save reflection'}
              onPress={() => {
                void close();
              }}
              disabled={saving}
            />
          </View>
        ) : undefined
      }
    >
      <View className="gap-2">
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <Text className="text-foreground text-3xl" style={{ fontFamily: 'Inter_700Bold' }}>
            {trade.instrument}
          </Text>
          <Text className="text-accent">
            {trade.exit === undefined ? 'Open' : money(pnl(trade))}
          </Text>
        </View>
        <Text className="text-muted">
          {trade.direction} · {trade.grade} · {trade.session}
        </Text>
        <Text className="text-muted text-xs">{eatDisplay(trade.date)} EAT</Text>
      </View>
      <Section title={trade.setup}>
        <Text className="text-muted leading-6">{trade.reason}</Text>
      </Section>
      <View className="border-border flex-row flex-wrap gap-3 border-y py-4">
        <Metric label="Entry" value={String(trade.entry)} />
        <Metric label="Stop" value={String(trade.stop)} />
        <Metric label="Target" value={String(trade.target)} />
      </View>
      {trade.plannedRisk !== undefined ? (
        <Section title="Planned risk">
          <Text className="text-foreground">{money(trade.plannedRisk)}</Text>
        </Section>
      ) : null}
      {trade.audit ? (
        <>
          {!trade.audit.results.includes('Risk within 2%') ? <RiskWarning saved /> : null}
          <Section title="Seven-point entry checklist">
            {[
              ['Instrument', trade.instrument],
              ['1D / 4H bias', `${trade.dailyBias} / ${trade.h4Bias}`],
              ['Extreme timeframe', `${trade.extreme} · ${trade.audit.timeframe}`],
              ['Cascade', `${trade.sweep}\n${trade.reason}\n${trade.m15}\n${trade.m1}`],
              ['Manual entry', trade.audit.manualEntry ? 'Yes' : 'No'],
              ['Math audits', `${trade.audit.results.length} of 5 passed`],
              ['Emotion', trade.audit.emotion],
            ].map(([label, value]) => (
              <View key={label} className="border-border gap-1 border-b pb-3">
                <Text className="text-muted">{label}</Text>
                <Text className="text-foreground">{value}</Text>
              </View>
            ))}
          </Section>
          <Section title="Manual math snapshot">
            {[
              ['Account balance', money(trade.audit.accountBalance)],
              ['Risk', `${trade.audit.riskPercent}% · ${money(trade.plannedRisk ?? 0)}`],
              ['Stop / target pips', `${trade.audit.stopPips} / ${trade.audit.targetPips}`],
              ['Broker pip size', String(trade.audit.pipSize)],
              ['Pip value per standard lot', `${money(trade.audit.pipValue)} / pip`],
              ['Units / standard lots', `${trade.audit.units} / ${trade.audit.lotsInput}`],
              ['Checked at', `${eatDisplay(trade.audit.checkedAt)} EAT`],
            ].map(([label, value]) => (
              <View key={label} className="gap-1">
                <Text className="text-muted">{label}</Text>
                <Text className="text-foreground">{value}</Text>
              </View>
            ))}
            {trade.audit.results.map((result) => (
              <Text key={result} className="text-foreground">
                {result} · Passed
              </Text>
            ))}
            {!trade.audit.results.includes('Risk within 2%') ? (
              <Text className="text-foreground">Risk within 2% · Not met</Text>
            ) : null}
          </Section>
          {trade.audit.newsEvents.length ? (
            <Section title="Manual news at entry">
              {trade.audit.newsEvents.map((event) => (
                <View key={event.id} className="gap-1">
                  <Text className="text-foreground">
                    {event.date} · {event.time} EAT
                  </Text>
                  <Text className="text-muted">{event.expected}</Text>
                </View>
              ))}
            </Section>
          ) : null}
        </>
      ) : (
        <Text className="text-muted">Legacy trade · no Terminus audit snapshot was recorded.</Text>
      )}
      <Section title="The cascade">
        {[
          ['Daily / 4H bias', `${trade.dailyBias} / ${trade.h4Bias}`],
          ['Extreme zone', trade.extreme],
          ['Dealing range', trade.zone],
          ['1H sweep', trade.sweep],
          ['15M confirmation', trade.m15],
          ['1M trigger', trade.m1],
          ['Position size', `${trade.lots} lots`],
          ['News filter', trade.news],
        ].map(([label, value]) => (
          <View key={label} className="border-border gap-1 border-b pb-3">
            <Text className="text-muted text-xs">{label}</Text>
            <Text className="text-foreground">{value}</Text>
          </View>
        ))}
      </Section>
      {trade.exit === undefined ? (
        <>
          <Section title="Close the trade">
            <Field
              label="Exit price"
              value={exit}
              onChange={setExit}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
          </Section>
          <Section title="Execution reflection">
            <Text className="text-foreground text-sm">
              Closing permanently locks this trade and its reflections. It cannot be edited or
              deleted.
            </Text>
            {reflections.map((label, index) => (
              <Field
                key={label}
                label={label}
                multiline
                value={answers[index]}
                onChange={(v) =>
                  setAnswers((a) => a.map((answer, i) => (i === index ? v : answer)))
                }
              />
            ))}
          </Section>
          <Field label="What happened" multiline value={outcome} onChange={setOutcome} />
          <Field label="Lesson" multiline value={lesson} onChange={setLesson} />
        </>
      ) : (
        <>
          <Section title="Closed trade · locked permanently">
            <Text className="text-foreground">
              Exit {trade.exit} ·{' '}
              {eatDisplay(trade.closedAt!, { year: 'numeric', month: 'short', day: 'numeric' })} EAT
            </Text>
          </Section>
          <Section title="Execution reflection">
            {reflections.map((label, index) => (
              <View key={label} className="gap-1">
                <Text className="text-foreground text-sm" style={{ fontFamily: 'Inter_500Medium' }}>
                  {label}
                </Text>
                <Text className="text-muted">{trade.reflections?.[index] ?? 'Not recorded'}</Text>
              </View>
            ))}
          </Section>
          {trade.outcome ? (
            <Section title="What happened">
              <Text className="text-muted">{trade.outcome}</Text>
            </Section>
          ) : null}
          {trade.lesson ? (
            <Section title="Lesson">
              <Text className="text-muted">{trade.lesson}</Text>
            </Section>
          ) : null}
          <Action label="Open Book" secondary onPress={() => goBackOrReplace('/journal')} />
        </>
      )}
    </Page>
  );
}
