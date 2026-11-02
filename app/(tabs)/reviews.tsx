import { useState } from 'react';
import { View, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '@/components/JournalText';
import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useLocalSearchParams } from 'expo-router';
import { Button } from 'heroui-native';
import { Action, Empty, Field, Heading, Options } from '@/components/JournalUI';
import { PeriodControl } from '@/components/PeriodControl';
import {
  completeReview,
  dateKey,
  reviewPrompts,
  selection,
  type Review,
  useJournal,
} from '@/lib/journal';
import { withinPeriod, type Period } from '@/lib/periods';
const empty = (day: string): Review => ({
  date: day,
  traded: '',
  happened: '',
  worked: '',
  change: '',
  lesson: '',
});
export default function Reviews() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const state = useJournal();
  const [period, setPeriod] = useState<Period>('Daily');
  const [anchor, setAnchor] = useState(() => new Date(`${date ?? dateKey()}T12:00:00`));
  const [selected, setSelected] = useState(() => date ?? dateKey());
  const [dirty, setDirty] = useState(false);
  const [previousDate, setPreviousDate] = useState(date);
  const [draft, setForm] = useState<Review>(
    () => state.reviews.find((review) => review.date === selected) ?? empty(selected),
  );
  const savedReview = state.reviews.find((review) => review.date === selected);
  const form = savedReview ?? (dirty ? draft : empty(selected));
  const ready = completeReview(form);
  if (date !== previousDate) {
    const key = date ?? dateKey();
    setPreviousDate(date);
    setSelected(key);
    setAnchor(new Date(`${key}T12:00:00`));
    setPeriod('Daily');
    setForm(state.reviews.find((review) => review.date === key) ?? empty(key));
    setDirty(false);
  }
  const update = (key: keyof Review, value: string) => {
    if (savedReview) return;
    setForm({ ...form, [key]: value });
    setDirty(true);
  };
  const selectDay = (key: string) => {
    setSelected(key);
    setForm(state.reviews.find((review) => review.date === key) ?? empty(key));
    setDirty(false);
  };
  const changeAnchor = (value: Date) => {
    setAnchor(value);
    if (period === 'Daily') selectDay(dateKey(value));
  };
  const reviews = state.reviews
    .filter((review) => withinPeriod(`${review.date}T12:00:00`, period, anchor))
    .sort((a, b) => b.date.localeCompare(a.date));
  const traded = reviews.filter((review) => review.traded === 'Yes').length;
  const save = () => {
    if (!ready || savedReview) return;
    if (state.saveReview({ ...form, date: selected })) setDirty(false);
  };
  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          keyboardShouldPersistTaps="handled"
          data={period === 'Daily' ? [] : reviews}
          keyExtractor={(review) => review.date}
          contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 24 }}
          ListHeaderComponent={
            <View className="mb-4 gap-6">
              <Heading title="Reviews" />
              <PeriodControl
                period={period}
                anchor={anchor}
                onPeriodChange={(value) => {
                  setPeriod(value);
                  if (value === 'Daily') selectDay(dateKey(anchor));
                }}
                onAnchorChange={changeAnchor}
              />
              {period === 'Daily' ? (
                <>
                  {savedReview ? (
                    <View className="gap-3">
                      <Text
                        className="text-foreground text-base"
                        style={{ fontFamily: 'Inter_600SemiBold' }}
                      >
                        Saved permanently
                      </Text>
                      <Text className="text-foreground text-base">
                        Did you trade? {form.traded || 'Not answered'}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text className="text-foreground text-sm">
                        Answer every question. Once saved, this review cannot be edited or deleted.
                      </Text>
                      <Options
                        label="Did you trade?"
                        options={['Yes', 'No']}
                        value={form.traded}
                        onChange={(value) => update('traded', value)}
                      />
                    </>
                  )}
                  {reviewPrompts.map(([key, label]) =>
                    savedReview ? (
                      <View key={key} className="gap-2">
                        <Text
                          className="text-foreground text-base"
                          style={{ fontFamily: 'Inter_600SemiBold' }}
                        >
                          {label}
                        </Text>
                        <Text className="text-foreground text-base">
                          {form[key] || 'Not answered'}
                        </Text>
                      </View>
                    ) : (
                      <Field
                        key={key}
                        label={label}
                        multiline
                        value={form[key]}
                        onChange={(value) => update(key, value)}
                      />
                    ),
                  )}
                </>
              ) : (
                <Text className="text-foreground text-base">
                  {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'} · {traded}{' '}
                  {traded === 1 ? 'trading day' : 'trading days'}
                </Text>
              )}
            </View>
          }
          renderItem={({ item: review }) => (
            <Animated.View entering={FadeIn} exiting={FadeOut}>
              <Button
                variant="ghost"
                className="border-border h-auto justify-start rounded-none border-b px-0 py-4"
                onPress={() => {
                  selection();
                  selectDay(review.date);
                  setAnchor(new Date(`${review.date}T12:00:00`));
                  setPeriod('Daily');
                }}
              >
                <View className="flex-1 gap-2">
                  <Text
                    className="text-foreground text-base"
                    style={{ fontFamily: 'Inter_600SemiBold' }}
                  >
                    {new Date(`${review.date}T12:00:00`).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                  <Text className="text-muted text-xs">
                    {review.traded === 'Yes' ? 'Trading day' : 'No-trade day'}
                  </Text>
                  <Text className="text-foreground text-sm" numberOfLines={3}>
                    {review.lesson || review.happened || 'Review recorded'}
                  </Text>
                </View>
              </Button>
            </Animated.View>
          )}
          ListEmptyComponent={
            period !== 'Daily' ? (
              <Empty
                text="No saved reviews in this period."
                action="Write a daily review"
                onPress={() => {
                  selectDay(dateKey(anchor));
                  setPeriod('Daily');
                }}
              />
            ) : undefined
          }
        />
        {period === 'Daily' && !savedReview ? (
          <View className="border-border bg-background pb-safe-or-4 border-t px-5 pt-3">
            <Action label="Save review" onPress={save} disabled={!ready} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
