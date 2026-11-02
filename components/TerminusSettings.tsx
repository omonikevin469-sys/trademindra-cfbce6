import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Text } from '@/components/JournalText';
import { Action, Empty, Field, Message, Section } from '@/components/JournalUI';
import { errorFeedback, useJournal, useCurrentTime, selection } from '@/lib/journal';
import { eatDateKey, validNewsTime } from '@/lib/terminus';
import TimePicker from '@/components/TimePicker';
import { findInstrument } from '@/constants/instruments';
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
  const defaultSize = findInstrument(instrument)?.defaultPipSize;
  const fail = (message: string) => {
    setError(message);
    errorFeedback();
  };
  if (!account) return null;
  const news = (account.newsEvents ?? []).filter((event) => event.date === today);
  return (
    <View className="gap-6">
      <Section title="Broker pip-size overrides">
        <Text className="text-muted">
          GR-ATC defaults apply automatically. Override only when your broker uses a different pip
          size. Changes apply to future trades in this account.
        </Text>
        {!account.pipSettings?.length ? (
          <Empty
            text="No broker overrides. Directory defaults are active."
            action="Use Gold’s symbol"
            onPress={() => {
              setInstrument('XAUUSD');
              selection();
            }}
          />
        ) : null}
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
            {findInstrument(pip.instrument) ? (
              <Action
                label={`Use default for ${pip.instrument}`}
                secondary
                onPress={() => state.resetPipSize(pip.instrument)}
              />
            ) : null}
          </Animated.View>
        ))}
        <Field label="Instrument" value={instrument} onChange={setInstrument} />
        <Field
          label="Price movement for one pip"
          value={size}
          onChange={setSize}
          keyboardType="decimal-pad"
        />
        {defaultSize !== undefined ? (
          <Text className="text-muted">GR-ATC default: {defaultSize}</Text>
        ) : null}
        <Action
          label="Save broker override"
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
          Saved news events are recorded with your trades and do not block entry.
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
