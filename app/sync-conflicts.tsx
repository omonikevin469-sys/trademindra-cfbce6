import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Text } from '@/components/JournalText';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Action, Empty, Message, Section } from '@/components/JournalUI';
import { cloudVersion, resolveConflict, useCloud } from '@/lib/cloud';
import type { Json } from '@/lib/database.types';
import { errorFeedback, success, useJournal } from '@/lib/journal';
import { exportJournal } from '@/lib/exportJournal';
import { goBackOrReplace } from '@/lib/navigation';
type Conflict = ReturnType<typeof useCloud.getState>['conflicts'][number];
function Version({ title, value }: { title: string; value: Json | null }) {
  const fields =
    value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value) : [];
  return (
    <Section title={title}>
      {fields
        .filter(([key]) => key !== 'id' && key !== 'accountId')
        .map(([key, field]) => (
          <View key={key} className="gap-1">
            <Text className="text-muted text-xs">
              {key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
            </Text>
            <Text className="text-foreground text-sm">
              {Array.isArray(field)
                ? field
                    .map((item) =>
                      typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item),
                    )
                    .join('\n')
                : field !== null && typeof field === 'object'
                  ? JSON.stringify(field, null, 2)
                  : String(field ?? '—')}
            </Text>
          </View>
        ))}
      {!fields.length ? (
        <Text className="text-muted">Cloud version not confirmed. Sync to compare.</Text>
      ) : null}
    </Section>
  );
}
export default function SyncConflicts() {
  const { conflicts, syncing } = useCloud();
  useJournal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const perform = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
      success();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your choice could not be saved. Try again.');
      errorFeedback();
    } finally {
      setBusy(false);
    }
  };
  const renderItem = ({ item }: { item: Conflict }) => (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      className="border-border gap-6 border-b pb-8"
    >
      <Version title="Saved cloud version" value={cloudVersion(item)} />
      <Version title="Preserved phone version" value={item.payload} />
      <Action
        label="Keep cloud version"
        disabled={busy || syncing}
        onPress={() => {
          void perform(() => resolveConflict(item, 'cloud'));
        }}
      />
      <Action
        label="Use phone version"
        secondary
        disabled={busy || syncing}
        onPress={() => {
          void perform(() => resolveConflict(item, 'device'));
        }}
      />
    </Animated.View>
  );
  return (
    <View className="bg-background flex-1">
      <FlatList
        data={conflicts}
        keyExtractor={(r) => `${r.kind}:${r.id}`}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 22, gap: 24 }}
        ListHeaderComponent={
          <View className="gap-4">
            <Text className="text-foreground text-sm">
              Compare both copies before choosing. Saved reviews and closed cloud trades cannot be
              replaced. Export JSON to keep a copy of both versions.
            </Text>
            <Action
              secondary
              label={busy ? 'Please wait…' : 'Export both versions'}
              disabled={busy}
              onPress={() => {
                void perform(exportJournal);
              }}
            />
            {error ? <Message text={error} /> : null}
          </View>
        }
        ListEmptyComponent={
          <Empty
            text="No changes need review."
            action="Done"
            onPress={() => goBackOrReplace('/settings')}
          />
        }
      />
      {conflicts.length ? (
        <View className="border-border pb-safe-or-4 border-t px-5 pt-3">
          <Action secondary label="Done" onPress={() => goBackOrReplace('/settings')} />
        </View>
      ) : null}
    </View>
  );
}
