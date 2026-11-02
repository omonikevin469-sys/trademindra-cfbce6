import { useEffect, useMemo, type ReactNode } from 'react';
import { AppState, View } from 'react-native';
import { Text } from '@/components/JournalText';
import { router, usePathname } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { bilt } from '@/lib/bilt';
import { connectCloud, disconnectCloud, flushCloud, useCloud } from '@/lib/cloud';
import { errorFeedback, isSampleAccount, useJournal } from '@/lib/journal';
import { Action, Message, Page } from '@/components/JournalUI';
import { EmailAccount } from '@/components/EmailAccount';
export function CloudGate({ children }: { children: ReactNode }) {
  const {
    session: cloudSession,
    booting,
    ready,
    recovery,
    error: cloudError,
    syncing,
    pendingCount,
    legacy,
    conflicts,
  } = useCloud();
  const journal = useJournal();
  const { hydrated, ownerId, storageError, saveError } = journal;
  const sampleSelected = isSampleAccount(journal.accountId, journal.transactions, journal.trades);
  const path = usePathname();
  const syncContext = useMemo(() => ({ path, ready }), [path, ready]);
  useEffect(() => {
    let alive = true;
    let authChanged = false;
    const {
      data: { subscription },
    } = bilt.auth.onAuthStateChange((event, session) => {
      authChanged = true;
      if (alive)
        useCloud.setState({
          session,
          booting: false,
          ...(event === 'PASSWORD_RECOVERY' ? { recovery: true } : {}),
        });
    });
    void bilt.auth
      .getSession()
      .then(({ data, error }) => {
        if (!alive || authChanged) return;
        useCloud.setState({
          session: data.session,
          booting: false,
          ...(error ? { error: error.message } : {}),
        });
        if (error) errorFeedback();
      })
      .catch((error: unknown) => {
        if (alive && !authChanged) {
          useCloud.setState({
            booting: false,
            error: error instanceof Error ? error.message : 'Your account could not be opened.',
          });
          errorFeedback();
        }
      });
    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);
  const user = cloudSession?.user.email_confirmed_at ? cloudSession.user.id : '';
  useEffect(() => {
    if (!hydrated || booting || recovery || storageError) return;
    if (user) void connectCloud(user);
    else disconnectCloud();
  }, [user, hydrated, booting, recovery, storageError]);
  useEffect(() => {
    if (!syncContext.ready) return undefined;
    const sync = () => {
      if (AppState.currentState === 'active' || AppState.currentState === null)
        void flushCloud().catch(() => undefined);
    };
    sync();
    const timer = setInterval(sync, 15000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushCloud().catch(() => undefined);
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [syncContext]);
  if (storageError)
    return (
      <Page>
        <Text className="text-foreground">Your journal couldn’t be opened.</Text>
        <Action
          label="Try again"
          onPress={() => {
            useJournal.setState({ hydrated: false, storageError: false });
            void useJournal.persist.rehydrate();
          }}
        />
      </Page>
    );
  if (booting || !hydrated || (user && (!ready || ownerId !== user) && !cloudError && !recovery))
    return (
      <View className="bg-background pt-safe-offset-8 flex-1 gap-6 p-6">
        <Skeleton className="h-10 w-2/3 rounded-lg" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
      </View>
    );
  if (!user || recovery) return <EmailAccount />;
  if (!ready || ownerId !== user)
    return (
      <Page>
        <Text className="text-foreground text-xl">Your journal could not be opened</Text>
        <Message text={cloudError} />
        <Action
          label="Try again"
          onPress={() => {
            void connectCloud(user);
          }}
        />
      </Page>
    );
  return (
    <View className="bg-background flex-1">
      {saveError ? (
        <View className="pt-safe-or-2 gap-2 px-4 pb-2">
          <Text className="text-foreground text-sm">
            Your journal couldn’t be saved on this phone.
          </Text>
          <Action
            label="Retry save"
            secondary
            onPress={() => useJournal.setState({ saveError: false })}
          />
        </View>
      ) : null}
      {cloudError || (syncing && pendingCount > 0) ? (
        <View className="pt-safe-or-2 gap-2 px-4 pb-2">
          <Text className="text-foreground text-sm">
            {cloudError ? `Not synced: ${cloudError}` : 'Saving journal…'}
          </Text>
          {cloudError ? (
            <Action
              secondary
              label="Retry sync"
              onPress={() => {
                void flushCloud().catch(() => undefined);
              }}
            />
          ) : null}
        </View>
      ) : null}
      {legacy && path !== '/settings' ? (
        <View className="pt-safe-or-2 gap-2 px-4 pb-2">
          <Text className="text-foreground text-sm">
            A previous journal is saved on this phone.
          </Text>
          <Action
            secondary
            label="Review device journal"
            onPress={() => router.push('/settings')}
          />
        </View>
      ) : conflicts.length && path !== '/sync-conflicts' ? (
        <View className="pt-safe-or-2 px-4 pb-2">
          <Action
            secondary
            label="Review sync changes"
            onPress={() => router.push('/sync-conflicts')}
          />
        </View>
      ) : null}
      {sampleSelected ? (
        <View className="pt-safe-or-2 px-4 pb-2">
          <Text className="text-foreground text-sm">
            Sample history selected — these trades are examples, not your trading results.
          </Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}
