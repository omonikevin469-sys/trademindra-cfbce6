import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/JournalText';
import { FontControl } from '@/components/FontControl';
import { useReadingScale } from '@/lib/readingPreferences';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Button, useThemeColor } from 'heroui-native';
import { Check, ChevronRight, ShieldCheck } from 'lucide-react-native';
import { Action, Field, Heading, Message, Options, Page, Section } from '@/components/JournalUI';
import { balance, errorFeedback, isSampleAccount, money, success, useJournal } from '@/lib/journal';
import { flushCloud, importDeviceJournal, signOut, useCloud } from '@/lib/cloud';
import { exportJournal } from '@/lib/exportJournal';
import { TerminusSettings } from '@/components/TerminusSettings';
export default function Settings() {
  const state = useJournal();
  const scale = useReadingScale();
  const cloud = useCloud();
  const accent = useThemeColor('accent');
  const sampleIds = new Set(
    state.accounts
      .filter((a) => isSampleAccount(a.id, state.transactions, state.trades))
      .map((a) => a.id),
  );
  const realTradeCount = state.trades.filter((t) => !sampleIds.has(t.accountId)).length;
  const [busy, setBusy] = useState(false);
  const [nameDraft, setName] = useState(state.name);
  const [nameDirty, setNameDirty] = useState(false);
  const name = nameDirty ? nameDraft : state.name;
  const [accountName, setAccountName] = useState('');
  const [deposit, setDeposit] = useState(state.accounts.length === 0 ? '1116.65' : '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [type, setType] = useState('Deposit');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const fail = (text: string) => {
    setError(text);
    errorFeedback();
  };
  const perform = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
      success();
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page>
      <Heading title="Settings" />
      <Section title="Font size">
        <FontControl />
      </Section>
      <Section title="Profile">
        <Field
          label="Trader name"
          value={name}
          onChange={(v) => {
            setName(v);
            setNameDirty(true);
            setSaved(false);
          }}
          placeholder="Your name"
        />
        <Action
          label={saved ? 'Name saved' : 'Save name'}
          secondary
          onPress={() => {
            state.setName(name.trim());
            setNameDirty(false);
            success();
            setSaved(true);
          }}
        />
      </Section>
      <Section title="Accounts">
        {state.accounts.length ? (
          state.accounts.map((a) => (
            <Animated.View key={a.id} entering={FadeIn} exiting={FadeOut}>
              <Button
                variant="ghost"
                className="border-border h-auto justify-start rounded-none border-b px-0 py-3"
                onPress={() => state.selectAccount(a.id)}
              >
                <View className="flex-1 gap-1">
                  <Text className="text-foreground" style={{ fontFamily: 'Inter_600SemiBold' }}>
                    {a.name}
                    {isSampleAccount(a.id, state.transactions, state.trades)
                      ? ' · Sample history'
                      : ''}
                  </Text>
                  <Text className="text-muted text-sm">
                    {money(balance(a.id, state.trades, state.transactions))}
                  </Text>
                </View>
                {state.accountId === a.id ? (
                  <Check color={accent} size={20} strokeWidth={1.7} />
                ) : null}
              </Button>
            </Animated.View>
          ))
        ) : (
          <Text className="text-muted">Add your first trading account below.</Text>
        )}
        <Field
          label="Account name"
          value={accountName}
          onChange={setAccountName}
          placeholder="e.g. Personal gold"
        />
        <Field
          label="Initial deposit (USD)"
          value={deposit}
          onChange={setDeposit}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
        <Action
          label="Create account"
          onPress={() => {
            if (!accountName.trim()) return fail('Enter an account name.');
            if (!deposit.trim() || !Number.isFinite(Number(deposit)) || Number(deposit) < 0)
              return fail('Enter a deposit of zero or more.');
            state.addAccount(accountName.trim(), Number(deposit));
            setAccountName('');
            setDeposit('');
            setError('');
          }}
        />
        {error ? <Message text={error} /> : null}
      </Section>
      {state.accountId ? (
        <Section title="Deposits & withdrawals">
          <Options options={['Deposit', 'Withdraw']} value={type} onChange={setType} />
          <Field
            label="Amount (USD)"
            value={amount}
            onChange={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
          <Field label="Note (optional)" value={note} onChange={setNote} />
          <Action
            label={`Record ${type.toLowerCase()}`}
            secondary
            onPress={() => {
              const n = Number(amount);
              if (!Number.isFinite(n) || n <= 0) return fail('Enter an amount greater than zero.');
              if (
                type === 'Withdraw' &&
                n > balance(state.accountId, state.trades, state.transactions)
              )
                return fail('The withdrawal exceeds your account balance.');
              state.transact(type === 'Deposit' ? n : -n, note.trim() || type);
              setAmount('');
              setNote('');
              setError('');
            }}
          />
          {state.transactions
            .filter((t) => t.accountId === state.accountId)
            .slice(0, 8)
            .map((t) => (
              <Animated.View
                key={t.id}
                entering={FadeIn}
                exiting={FadeOut}
                className="border-border flex-row justify-between gap-4 border-b py-3"
              >
                <View className="flex-1 gap-1">
                  <Text className="text-foreground text-sm">{t.note}</Text>
                  <Text className="text-muted text-xs">
                    {new Date(t.date).toLocaleDateString()}
                  </Text>
                </View>
                <Text className={t.amount >= 0 ? 'text-accent' : 'text-danger'}>
                  {money(t.amount)}
                </Text>
              </Animated.View>
            ))}
        </Section>
      ) : null}
      <TerminusSettings key={state.accountId} />
      <Section title="GR-ATC">
        <Button
          variant="ghost"
          onPress={() => router.push('/strategy')}
          className="h-auto justify-start px-0 py-3"
        >
          <ShieldCheck size={20} color={accent} strokeWidth={1.7} />
          <Button.Label className="flex-1" style={{ fontSize: 16 * scale, lineHeight: 24 * scale }}>
            Read the Absolute Law
          </Button.Label>
          <ChevronRight size={18} color={accent} strokeWidth={1.7} />
        </Button>
      </Section>
      <Section title="Main account">
        <Text className="text-foreground">{cloud.session?.user.email}</Text>
        <Text className="text-foreground text-sm">
          Verified email ·{' '}
          {cloud.syncing
            ? 'Saving…'
            : cloud.error
              ? 'Sync needs attention'
              : cloud.conflicts.length
                ? 'Changes need review'
                : 'Cloud journal connected'}
        </Text>
        <Text className="text-foreground text-sm">
          {cloud.pendingCount > 0
            ? `${cloud.pendingCount} ${cloud.pendingCount === 1 ? 'change' : 'changes'} waiting to sync`
            : cloud.lastSynced
              ? `Last synced ${new Date(cloud.lastSynced).toLocaleTimeString()}`
              : 'Waiting for sync confirmation'}
        </Text>
        <Text className="text-foreground text-sm">
          {realTradeCount} {realTradeCount === 1 ? 'trade' : 'trades'} · No journal count limit
        </Text>
        <Action
          label={busy ? 'Please wait…' : 'Sync now'}
          secondary
          disabled={busy || cloud.syncing}
          onPress={() => {
            void perform(flushCloud);
          }}
        />
        <Action
          label="Sign out"
          secondary
          disabled={busy || cloud.syncing}
          onPress={() => {
            void perform(signOut);
          }}
        />
      </Section>
      {cloud.conflicts.length ? (
        <Section title="Changes need review">
          <Text className="text-foreground text-sm">
            Another version was saved. Your phone’s copy is preserved until you choose which to
            keep.
          </Text>
          <Action
            label="Review sync changes"
            secondary
            onPress={() => router.push('/sync-conflicts')}
          />
        </Section>
      ) : null}
      {cloud.legacy ? (
        <Section title="Journal from this phone">
          <Text className="text-foreground text-sm">
            Import your existing device journal into this verified account. Matching entries are
            kept, and closed cloud trades are never replaced.
          </Text>
          <Action
            label={busy ? 'Importing…' : 'Import device journal'}
            disabled={busy}
            onPress={() => {
              void perform(importDeviceJournal);
            }}
          />
        </Section>
      ) : null}
      <Section title="Export journal">
        <Action
          label={busy ? 'Please wait…' : 'Export JSON file'}
          secondary
          disabled={busy}
          onPress={() => {
            void perform(exportJournal);
          }}
        />
        <Text className="text-foreground text-sm">
          Exports your accounts, trades, cash flows and daily reviews. Practice history is excluded.
        </Text>
      </Section>
      {error ? <Message text={error} /> : null}
      <Text className="text-foreground" style={{ fontFamily: 'Inter_600SemiBold' }}>
        The Terminus does not move. Neither do I.
      </Text>
    </Page>
  );
}
