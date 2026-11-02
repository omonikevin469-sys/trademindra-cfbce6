import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Text } from '@/components/JournalText';
import { Action, Field, Message, Section } from '@/components/JournalUI';
import { errorFeedback, useJournal, useCurrentTime, selection } from '@/lib/journal';
import { eatDateKey, validNewsTime } from '@/lib/terminus';
import TimePicker from '@/components/TimePicker';
export function TerminusSettings() {
  const state = useJournal();
  const now = useCurrentTime();
  const account = state.accounts.find((a) => a.id === state.accountId);
  const [instrument, setInstrument] = useState('');
  const [size, setSize] = useState('');
  const [time, setTime] = useState('');
  const [expected, setExpected] = useState('');
  const [error, setError] = useState('');
  const today = eatDateKey(now);
  const fail = (message: string) => {
    setError(message);
    errorFeedback();
  };
  if (!account) return null;
  const news = (account.newsEvents ?? []).filter((event) => event.date === today);
  return (
    <View className="gap-6">
      <Section title="Broker pip sizes">
        {(account.pipSettings ?? []).map((pip) => (
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            key={pip.instrument}
            className="border-border gap-1 border-b pb-3"
          >
            <Text className="text-foreground">
              {pip.instrument} · {pip.size}
            </Text>
          </Animated.View>
        ))}
        <Field label="Instrument" value={instrument} onChange={setInstrument} />
        <Field
          label="Price movement for one pip"
          value={size}
          onChange={setSize}
          keyboardType="decimal-pad"
        />
        <Text className="text-muted">
          Use your broker’s pip size. New values apply only to future trades.
        </Text>
        <Action
          label="Save pip size"
          secondary
          onPress={() => {
            if (
              !instrument.trim() ||
              !size.trim() ||
              !Number.isFinite(Number(size)) ||
              Number(size) <= 0
            )
              return fail('Enter an instrument and a positive pip size.');
            state.savePipSize(instrument, Number(size));
            setInstrument('');
            setSize('');
            setError('');
          }}
        />
      </Section>
      <Section title={`Daily news · ${today} EAT`}>
        {news.length ? (
          news.map((event) => (
            <Animated.View
              key={event.id}
              entering={FadeIn}
              exiting={FadeOut}
              className="border-border gap-1 border-b pb-3"
            >
              <Text className="text-foreground">{event.time} EAT</Text>
              <Text className="text-muted">{event.expected}</Text>
            </Animated.View>
          ))
        ) : (
          <Text className="text-muted">No news times saved for today. Add an event below.</Text>
        )}
        <TimePicker
          label="News time (EAT)"
          value={time}
          onChange={(v) => {
            if (v !== time) selection();
            setTime(v);
          }}
        />
        <Field label="Expected macro reaction" value={expected} onChange={setExpected} multiline />
        <Text className="text-muted">
          Trading locks 15 minutes before and after each saved event. Saved events cannot be removed
          to bypass a blackout.
        </Text>
        <Action
          label="Save today’s news"
          secondary
          onPress={() => {
            if (!validNewsTime(time.trim())) return fail('Choose the news time.');
            if (!expected.trim()) return fail('Enter the expected macro reaction.');
            if (news.some((event) => event.time === time.trim()))
              return fail('A news event is already saved at this time.');
            state.addNewsEvent({
              date: eatDateKey(Date.now()),
              time: time.trim(),
              expected: expected.trim(),
            });
            setTime('');
            setExpected('');
            setError('');
          }}
        />
      </Section>
      {error ? <Message text={error} /> : null}
    </View>
  );
}
