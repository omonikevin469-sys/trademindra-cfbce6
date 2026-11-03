import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, Tables, TablesInsert } from '@biltme/backend';
import { create } from 'zustand';
import { isNewsEvent, isPipSetting, isTradeAudit } from '@/lib/terminus';
import { isManualTrade } from '@/lib/manualTrade';
import { bilt } from '@/lib/bilt';
import type { Json } from '@/lib/database.types';
import {
  completeReview,
  errorFeedback,
  isSampleAccount,
  useJournal,
  type Account,
  type Transaction,
  type Trade,
  type Review,
} from '@/lib/journal';
type Entry = TablesInsert<'journal_entries'> & { base_updated_at?: string | null };
type Snapshot = Pick<
  ReturnType<typeof useJournal.getState>,
  'accounts' | 'transactions' | 'trades' | 'reviews' | 'name' | 'accountId'
>;
export const useCloud = create<{
  session: Session | null;
  booting: boolean;
  ready: boolean;
  syncing: boolean;
  error: string;
  recovery: boolean;
  legacy: boolean;
  pendingCount: number;
  lastSynced: string | null;
  conflicts: Entry[];
}>(() => ({
  session: null,
  booting: true,
  ready: false,
  syncing: false,
  error: '',
  recovery: false,
  legacy: false,
  pendingCount: 0,
  lastSynced: null,
  conflicts: [],
}));
const empty: Snapshot = {
  accounts: [],
  transactions: [],
  trades: [],
  reviews: [],
  name: '',
  accountId: '',
};
let stop: (() => void) | undefined;
let activeUser = '';
let applying = false;
let pending: Entry[] = [];
let running: Promise<void> | null = null;
let persistence: Promise<void> = Promise.resolve();
let generation = 0;
const versions = new Map<string, string>();
const remotePayloads = new Map<string, Json>();
const queueKey = (id: string) => `trademindra-pending-${id}`;
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isJson(value: unknown): value is Json {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    (Array.isArray(value) && value.every(isJson)) ||
    (isObject(value) && Object.values(value).every((v) => v === undefined || isJson(v)))
  );
}
function isAccount(value: unknown): value is Account {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    (value.confirmedAt === undefined || typeof value.confirmedAt === 'string') &&
    (value.pipSettings === undefined ||
      (Array.isArray(value.pipSettings) && value.pipSettings.every(isPipSetting))) &&
    (value.newsEvents === undefined ||
      (Array.isArray(value.newsEvents) && value.newsEvents.every(isNewsEvent)))
  );
}
function isTransaction(value: unknown): value is Transaction {
  return (
    isObject(value) &&
    ['id', 'accountId', 'note', 'date'].every((key) => typeof value[key] === 'string') &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount)
  );
}
export function isTrade(value: unknown): value is Trade {
  if (isObject(value) && value.recordType === 'manual') return isManualTrade(value);
  return (
    isObject(value) &&
    [
      'id',
      'accountId',
      'date',
      'instrument',
      'direction',
      'session',
      'grade',
      'dailyBias',
      'h4Bias',
      'aligned',
      'extreme',
      'zone',
      'sweep',
      'm15',
      'm1',
      'news',
      'circuit',
      'checklist',
      'setup',
      'reason',
    ].every((key) => typeof value[key] === 'string') &&
    ['entry', 'stop', 'target', 'lots', 'jpyPerUsd'].every(
      (key) => typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] > 0,
    ) &&
    Boolean(String(value.instrument).trim()) &&
    (value.audit === undefined || isTradeAudit(value.audit)) &&
    ['Long', 'Short'].includes(String(value.direction)) &&
    ['closedAt', 'outcome', 'lesson'].every(
      (key) => value[key] === undefined || typeof value[key] === 'string',
    ) &&
    (value.plannedRisk === undefined ||
      (typeof value.plannedRisk === 'number' &&
        Number.isFinite(value.plannedRisk) &&
        value.plannedRisk > 0)) &&
    (value.exit === undefined ||
      (typeof value.exit === 'number' && Number.isFinite(value.exit) && value.exit > 0)) &&
    (value.result === undefined ||
      value.result === 'Win' ||
      value.result === 'Loss' ||
      value.result === 'Breakeven' ||
      value.result === 'Open') &&
    value.recordType === undefined &&
    (value.reflections === undefined ||
      (Array.isArray(value.reflections) &&
        value.reflections.every((v: unknown) => typeof v === 'string')))
  );
}
function isReview(value: unknown): value is Review {
  return (
    isObject(value) &&
    ['date', 'traded', 'happened', 'worked', 'change', 'lesson'].every(
      (key) => typeof value[key] === 'string',
    )
  );
}
function isProfile(value: unknown): value is { name: string } {
  return isObject(value) && typeof value.name === 'string';
}
function isEntry(value: unknown): value is Entry {
  return (
    isObject(value) &&
    typeof value.user_id === 'string' &&
    typeof value.id === 'string' &&
    typeof value.kind === 'string' &&
    ['account', 'transaction', 'trade', 'review', 'profile'].includes(value.kind) &&
    isJson(value.payload) &&
    (value.updated_at === undefined || typeof value.updated_at === 'string')
  );
}
function isSnapshot(value: unknown): value is Snapshot {
  return (
    isObject(value) &&
    typeof value.name === 'string' &&
    typeof value.accountId === 'string' &&
    Array.isArray(value.accounts) &&
    value.accounts.every(isAccount) &&
    Array.isArray(value.transactions) &&
    value.transactions.every(isTransaction) &&
    Array.isArray(value.trades) &&
    value.trades.every(isTrade) &&
    Array.isArray(value.reviews) &&
    value.reviews.every(isReview)
  );
}
function requireValue<T>(value: unknown, valid: (value: unknown) => value is T, label: string): T {
  if (!valid(value)) throw new Error(`Invalid ${label} in journal data.`);
  return value;
}
export const snapshot = (): Snapshot => {
  const { accounts, transactions, trades, reviews, name, accountId } = useJournal.getState();
  return { accounts, transactions, trades, reviews, name, accountId };
};
function entries(s: Snapshot, user: string): Entry[] {
  const row = (
    kind: Entry['kind'],
    id: string,
    value: Account | Transaction | Trade | Review | { name: string },
  ): Entry => ({
    user_id: user,
    kind,
    id,
    payload: requireValue(JSON.parse(JSON.stringify(value)), isJson, 'payload'),
  });
  return [
    ...s.accounts.map((v) => row('account', v.id, v)),
    ...s.transactions.map((v) => row('transaction', v.id, v)),
    ...s.trades.map((v) => row('trade', v.id, v)),
    ...s.reviews.map((v) => row('review', v.date, v)),
    row('profile', 'main', { name: s.name }),
  ];
}
function apply(rows: (Entry | Tables<'journal_entries'>)[]) {
  const s: Snapshot = { ...empty, accounts: [], transactions: [], trades: [], reviews: [] };
  for (const r of rows)
    switch (r.kind) {
      case 'account':
        s.accounts.push(requireValue(r.payload, isAccount, 'account'));
        break;
      case 'transaction':
        s.transactions.push(requireValue(r.payload, isTransaction, 'transaction'));
        break;
      case 'trade':
        s.trades.push(requireValue(r.payload, isTrade, 'trade'));
        break;
      case 'review':
        s.reviews.push(requireValue(r.payload, isReview, 'review'));
        break;
      case 'profile':
        s.name = requireValue(r.payload, isProfile, 'profile').name;
        break;
    }
  s.trades.sort((a, b) => b.date.localeCompare(a.date));
  s.transactions.sort((a, b) => b.date.localeCompare(a.date));
  s.reviews.sort((a, b) => b.date.localeCompare(a.date));
  const selected = useJournal.getState().accountId;
  s.accountId = s.accounts.some((a) => a.id === selected)
    ? selected
    : (s.accounts.find((a) => !isSampleAccount(a.id, s.transactions, s.trades))?.id ??
      s.accounts[0]?.id ??
      '');
  applying = true;
  useJournal.setState({ ...s, ownerId: activeUser });
  applying = false;
}
const identity = (r: Entry) => `${r.kind}:${r.id}`;
function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key] ?? null)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
function persistPending() {
  const user = activeUser;
  if (!user) return persistence;
  const value = JSON.stringify({
    snapshot: snapshot(),
    pending,
    conflicts: useCloud.getState().conflicts,
    versions: Object.fromEntries(versions),
  });
  useCloud.setState({ pendingCount: pending.length });
  persistence = persistence
    .catch(() => undefined)
    .then(() => AsyncStorage.setItem(queueKey(user), value));
  return persistence;
}
function enqueue(rows: Entry[]) {
  for (const row of rows) {
    const previous = pending.find((p) => identity(p) === identity(row));
    const queued = {
      ...row,
      base_updated_at: previous ? previous.base_updated_at : (versions.get(identity(row)) ?? null),
    };
    pending = [...pending.filter((p) => identity(p) !== identity(row)), queued];
  }
  void persistPending().catch(() => undefined);
}
export async function refreshCloud() {
  const user = activeUser;
  const cycle = generation;
  if (!user) return;
  const rows: Tables<'journal_entries'>[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await bilt
      .from('journal_entries')
      .select()
      .eq('user_id', user)
      .order('kind')
      .order('id')
      .range(offset, offset + 499);
    if (activeUser !== user || cycle !== generation) return;
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 500) break;
  }
  const merged = new Map<string, Entry>(rows.map((r) => [identity(r), r]));
  remotePayloads.clear();
  for (const row of rows) {
    versions.set(identity(row), row.updated_at);
    remotePayloads.set(identity(row), row.payload);
  }
  if (useJournal.getState().ownerId === user) {
    const missing = entries(snapshot(), user).filter((r) => !merged.has(identity(r)));
    enqueue(
      missing.filter(
        (r) =>
          !pending.some((p) => identity(p) === identity(r)) &&
          !useCloud.getState().conflicts.some((p) => identity(p) === identity(r)),
      ),
    );
  }
  for (const p of pending) {
    const remote = merged.get(identity(p));
    if (
      remote?.kind === 'review' ||
      (remote?.kind === 'trade' && requireValue(remote.payload, isTrade, 'trade').closedAt)
    )
      continue;
    merged.set(identity(p), p);
  }
  apply([...merged.values()]);
  await persistPending();
}
export function flushCloud(): Promise<void> {
  if (running) return running;
  const user = activeUser;
  const cycle = generation;
  const current = () => activeUser === user && generation === cycle;
  if (!user) return Promise.reject(new Error('Sign in before saving your journal.'));
  running = (async () => {
    useCloud.setState({ syncing: true });
    await persistPending();
    do {
      while (pending.length && current()) {
        const row = pending[0];
        const read = () =>
          bilt
            .from('journal_entries')
            .select()
            .eq('user_id', user)
            .eq('kind', row.kind)
            .eq('id', row.id)
            .maybeSingle();
        let { data: existing, error: readError } = await read();
        if (!current()) return;
        if (readError) throw new Error(readError.message);
        let acknowledgedVersion = existing?.updated_at;
        if (
          !existing &&
          row.kind === 'review' &&
          !completeReview(requireValue(row.payload, isReview, 'review'))
        ) {
          useCloud.setState((s) => ({
            conflicts: [...s.conflicts.filter((p) => identity(p) !== identity(row)), row],
          }));
          if (pending[0] === row) pending = pending.slice(1);
          await persistPending();
          continue;
        }
        if (!existing) {
          const { data: inserted, error } = await bilt
            .from('journal_entries')
            .upsert(
              { user_id: user, kind: row.kind, id: row.id, payload: row.payload },
              { onConflict: 'user_id,kind,id', ignoreDuplicates: true },
            )
            .select()
            .maybeSingle();
          if (!current()) return;
          if (error) throw new Error(error.message);
          if (inserted) acknowledgedVersion = inserted.updated_at;
          if (!inserted) {
            const result = await read();
            if (!current()) return;
            if (result.error) throw new Error(result.error.message);
            existing = result.data;
            acknowledgedVersion = existing?.updated_at;
            if (!existing) throw new Error('Your journal save was not confirmed. Please retry.');
          }
        }
        if (
          existing &&
          (existing.kind === 'review' ||
            (existing.kind === 'trade' &&
              requireValue(existing.payload, isTrade, 'trade').closedAt)) &&
          canonical(row.payload) !== canonical(existing.payload)
        ) {
          useCloud.setState((s) => ({
            conflicts: [...s.conflicts.filter((p) => identity(p) !== identity(row)), row],
          }));
          if (pending[0] === row) pending = pending.slice(1);
          await persistPending();
          continue;
        }
        if (
          existing &&
          canonical(row.payload) !== canonical(existing.payload) &&
          !(existing.kind === 'trade' && requireValue(existing.payload, isTrade, 'trade').closedAt)
        ) {
          if (row.base_updated_at !== existing.updated_at) {
            useCloud.setState((s) => ({
              conflicts: [...s.conflicts.filter((p) => identity(p) !== identity(row)), row],
            }));
            versions.set(identity(row), existing.updated_at);
            if (pending[0] === row) pending = pending.slice(1);
            await persistPending();
            continue;
          }
          let query = bilt
            .from('journal_entries')
            .update({ payload: row.payload, updated_at: new Date().toISOString() })
            .eq('user_id', user)
            .eq('kind', row.kind)
            .eq('id', row.id)
            .eq('updated_at', existing.updated_at);
          if (row.kind === 'trade') query = query.is('payload->>closedAt', null);
          const { data: saved, error } = await query.select().maybeSingle();
          if (!current()) return;
          if (error) throw new Error(error.message);
          if (saved) acknowledgedVersion = saved.updated_at;
          if (!saved) {
            const result = await read();
            if (!current()) return;
            if (result.error) throw new Error(result.error.message);
            if (result.data && result.data.updated_at !== existing.updated_at) continue;
            if (
              !(
                result.data?.kind === 'trade' &&
                requireValue(result.data.payload, isTrade, 'trade').closedAt
              )
            )
              throw new Error('Your journal save was not confirmed. Please retry.');
          }
        }
        if (!current()) return;
        if (acknowledgedVersion) {
          versions.set(identity(row), acknowledgedVersion);
          pending = pending.map((p) =>
            p !== row && identity(p) === identity(row) && p.base_updated_at === row.base_updated_at
              ? { ...p, base_updated_at: acknowledgedVersion }
              : p,
          );
        }
        if (pending[0] === row) pending = pending.slice(1);
        await persistPending();
      }
      if (!current()) return;
      await refreshCloud();
      if (!current()) return;
    } while (pending.length);
    useCloud.setState({ error: '', lastSynced: new Date().toISOString() });
  })()
    .catch((error: unknown) => {
      if (current()) {
        const message =
          error instanceof Error ? error.message : 'Your journal could not be synced. Try again.';
        if (useCloud.getState().error !== message) errorFeedback();
        useCloud.setState({ error: message });
      }
      throw error;
    })
    .finally(() => {
      running = null;
      if (current()) {
        useCloud.setState({ syncing: false });
        if (pending.length && !useCloud.getState().error) void flushCloud().catch(() => undefined);
      }
    });
  return running;
}
export function disconnectCloud() {
  generation++;
  stop?.();
  stop = undefined;
  activeUser = '';
  pending = [];
  versions.clear();
  remotePayloads.clear();
  if (useJournal.getState().ownerId) {
    applying = true;
    useJournal.setState({ ...empty, ownerId: '' });
    applying = false;
  }
  useCloud.setState({
    ready: false,
    syncing: false,
    pendingCount: 0,
    lastSynced: null,
    conflicts: [],
  });
}
export async function connectCloud(user: string) {
  const cycle = ++generation;
  const current = () => cycle === generation && useCloud.getState().session?.user.id === user;
  stop?.();
  stop = undefined;
  activeUser = '';
  useCloud.setState({ ready: false, syncing: false, error: '', lastSynced: null, pendingCount: 0 });
  try {
    if (running) await running.catch(() => undefined);
    await persistence.catch(() => undefined);
    if (!current()) return;
    const local = useJournal.getState();
    const localSnapshot = local.ownerId === user ? snapshot() : null;
    if (!local.ownerId && local.accounts.length)
      await AsyncStorage.setItem('trademindra-legacy-backup', JSON.stringify(snapshot()));
    const legacy = await AsyncStorage.getItem('trademindra-legacy-backup');
    const cached = await AsyncStorage.getItem(queueKey(user));
    if (!current()) return;
    let savedSnapshot: Snapshot | null = null;
    const stored: unknown = cached ? JSON.parse(cached) : [];
    const queue = isObject(stored) ? stored.pending : stored;
    pending = requireValue(
      queue,
      (v): v is Entry[] => Array.isArray(v) && v.every(isEntry),
      'pending queue',
    );
    if (pending.some((r) => r.user_id !== user))
      throw new Error('This saved journal belongs to a different account.');
    if (isObject(stored))
      savedSnapshot = requireValue(stored.snapshot, isSnapshot, 'saved journal');
    activeUser = user;
    versions.clear();
    remotePayloads.clear();
    if (isObject(stored) && isObject(stored.versions))
      for (const [key, version] of Object.entries(stored.versions))
        if (typeof version === 'string') versions.set(key, version);
    const conflicts =
      isObject(stored) && stored.conflicts !== undefined
        ? requireValue(
            stored.conflicts,
            (v): v is Entry[] =>
              Array.isArray(v) && v.every(isEntry) && v.every((r) => r.user_id === user),
            'saved conflicts',
          )
        : [];
    useCloud.setState({ conflicts });
    const restored = savedSnapshot ?? localSnapshot;
    const records = new Map<string, Entry>(
      restored ? entries(restored, user).map((r) => [identity(r), r]) : [],
    );
    if (localSnapshot)
      for (const r of entries(localSnapshot, user)) {
        const cachedRow = records.get(identity(r));
        if (!cachedRow) records.set(identity(r), r);
        else if (
          canonical(cachedRow.payload) !== canonical(r.payload) &&
          !pending.some((p) => identity(p) === identity(r))
        )
          useCloud.setState((s) => ({
            conflicts: [...s.conflicts.filter((p) => identity(p) !== identity(r)), r],
          }));
      }
    for (const r of pending) records.set(identity(r), r);
    applying = true;
    const preferred =
      restored && !isSampleAccount(restored.accountId, restored.transactions, restored.trades)
        ? restored.accountId
        : '';
    useJournal.setState({ ...empty, ownerId: user, accountId: preferred });
    applying = false;
    apply([...records.values()]);
    stop = useJournal.subscribe((s, previous) => {
      if (applying || !current() || activeUser !== user) return;
      const old = new Map(
        entries(previous, user).map((r) => [identity(r), JSON.stringify(r.payload)]),
      );
      const changed = entries(s, user).filter(
        (r) => old.get(identity(r)) !== JSON.stringify(r.payload),
      );
      if (!changed.length) {
        void persistPending().catch(() => undefined);
        return;
      }
      enqueue(changed);
      void flushCloud().catch(() => undefined);
    });
    useCloud.setState({ legacy: Boolean(legacy) });
    if (restored || pending.length) useCloud.setState({ ready: true });
    await flushCloud();
    if (current()) useCloud.setState({ ready: true });
  } catch (error) {
    if (!current()) return;
    const message = error instanceof Error ? error.message : 'Your journal could not be opened.';
    if (useCloud.getState().error !== message) errorFeedback();
    useCloud.setState({ error: message });
  }
}
export async function importDeviceJournal() {
  const value = await AsyncStorage.getItem('trademindra-legacy-backup');
  if (!value || !activeUser) return;
  const legacy = requireValue(JSON.parse(value), isSnapshot, 'device backup');
  const present = new Set(entries(snapshot(), activeUser).map(identity));
  enqueue(entries(legacy, activeUser).filter((r) => !present.has(identity(r))));
  await saveAllPending();
  await AsyncStorage.removeItem('trademindra-legacy-backup');
  useCloud.setState({ legacy: false });
}
export async function saveAllPending() {
  do {
    await flushCloud();
  } while (pending.length);
}
export function cloudVersion(row: Entry): Json | null {
  return remotePayloads.get(identity(row)) ?? null;
}
export async function resolveConflict(row: Entry, choice: 'cloud' | 'device') {
  const user = activeUser;
  const cycle = generation;
  if (!user || row.user_id !== user)
    throw new Error('Sign in to the account that owns this journal.');
  await saveAllPending();
  if (user !== activeUser || cycle !== generation)
    throw new Error('Your account changed. Open the journal again.');
  if (choice === 'cloud' && !remotePayloads.has(identity(row)))
    throw new Error('No cloud copy was found. Keep your phone version or export it first.');
  if (choice === 'device' || row.kind === 'account') {
    const { data, error } = await bilt
      .from('journal_entries')
      .select()
      .eq('user_id', user)
      .eq('kind', row.kind)
      .eq('id', row.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (user !== activeUser || cycle !== generation)
      throw new Error('Your account changed. Open the journal again.');
    if (row.kind === 'review' && !completeReview(requireValue(row.payload, isReview, 'review')))
      throw new Error(
        'This older review has unanswered questions. Export it to keep a copy, then write a complete review.',
      );
    if (data?.kind === 'review')
      throw new Error('This review is already saved. Its saved version cannot be replaced.');
    if (data?.kind === 'trade' && requireValue(data.payload, isTrade, 'trade').closedAt)
      throw new Error('This trade is already closed. Its saved version cannot be replaced.');
    if (data) versions.set(identity(row), data.updated_at);
    else versions.delete(identity(row));
    const resolved = { ...row };
    if (row.kind === 'account' && data) {
      const device = requireValue(row.payload, isAccount, 'account');
      const cloud = requireValue(data.payload, isAccount, 'account');
      const news = [
        ...new Map(
          [...(device.newsEvents ?? []), ...(cloud.newsEvents ?? [])].map((event) => [
            event.id,
            event,
          ]),
        ).values(),
      ];
      const chosen = choice === 'cloud' ? cloud : device;
      resolved.payload = requireValue(
        JSON.parse(JSON.stringify(news.length ? { ...chosen, newsEvents: news } : chosen)),
        isJson,
        'account',
      );
    }
    enqueue([resolved]);
    await saveAllPending();
    if (user !== activeUser || cycle !== generation) return;
    if (canonical(cloudVersion(row)) !== canonical(resolved.payload))
      throw new Error('The cloud version changed again. Review both versions before choosing.');
  }
  useCloud.setState((s) => ({
    conflicts: s.conflicts.filter((p) => identity(p) !== identity(row)),
  }));
  await persistPending();
}
export async function signOut() {
  await saveAllPending();
  const { error } = await bilt.auth.signOut();
  if (error) throw new Error(error.message);
}
