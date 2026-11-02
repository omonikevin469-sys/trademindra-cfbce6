import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import * as Haptics from 'expo-haptics';
import { resolvePipSize } from '@/constants/instruments';
import {
  submissionFailure,
  entryGate,
  type NewsEvent,
  type PipSetting,
  type TradeAudit,
} from '@/lib/terminus';
export type Account = {
  id: string;
  name: string;
  confirmedAt?: string;
  pipSettings?: PipSetting[];
  newsEvents?: NewsEvent[];
};
export type Transaction = {
  id: string;
  accountId: string;
  amount: number;
  note: string;
  date: string;
};
export type Trade = {
  id: string;
  accountId: string;
  date: string;
  instrument: string;
  direction: string;
  session: string;
  grade: string;
  dailyBias: string;
  h4Bias: string;
  aligned: string;
  extreme: string;
  zone: string;
  sweep: string;
  m15: string;
  m1: string;
  entry: number;
  stop: number;
  target: number;
  lots: number;
  jpyPerUsd: number;
  plannedRisk?: number;
  audit?: TradeAudit;
  news: string;
  circuit: string;
  checklist: string;
  setup: string;
  reason: string;
  exit?: number;
  closedAt?: string;
  reflections?: string[];
  outcome?: string;
  lesson?: string;
};
export type Review = {
  date: string;
  traded: string;
  happened: string;
  worked: string;
  change: string;
  lesson: string;
};
export const reviewPrompts = [
  ['happened', 'What happened'],
  ['worked', 'What worked'],
  ['change', 'What will change'],
  ['lesson', 'Lesson'],
] as const;
export function completeReview(review: Review) {
  return (
    Boolean(review.date.trim()) &&
    ['Yes', 'No'].includes(review.traded) &&
    reviewPrompts.every(([key]) => review[key].trim().length > 0)
  );
}
export const reflections = [
  'HTF alignment held throughout',
  'Stayed at the extreme, without mid-range FOMO',
  'Entered after a real 1H liquidity sweep',
  '15M rejection and CHoCH were valid',
  '1M CHoCH + BOS was clean',
  'Risk stayed within 2%; stop never moved',
  'Managed the trade without fear or greed',
  'Respected the news blackout',
  'No revenge, FOMO, or boredom entry',
];
export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const money = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
export const pnl = (trade: Trade) =>
  trade.exit === undefined
    ? 0
    : trade.audit
      ? ((trade.exit - trade.entry) / trade.audit.pipSize) *
        (trade.direction === 'Long' ? 1 : -1) *
        trade.audit.pipValue *
        trade.lots
      : (trade.exit - trade.entry) *
        (trade.direction === 'Long' ? 1 : -1) *
        trade.lots *
        (trade.instrument.toUpperCase() === 'XAUUSD' ? 100 : 100000 / trade.jpyPerUsd);
export const isSampleAccount = (accountId: string, transactions: Transaction[], trades: Trade[]) =>
  transactions.some(
    (t) => t.accountId === accountId && t.note === 'Practice initial deposit' && t.amount === 10000,
  ) &&
  trades.some(
    (t) =>
      t.accountId === accountId &&
      t.reason ===
        'Daily and 4H bullish; discount sweep confirmed on 15M, followed by clean 1M structure.' &&
      t.lesson === 'Wait for confirmation.',
  );
export const balance = (accountId: string, trades: Trade[], txs: Transaction[]) =>
  txs.filter((t) => t.accountId === accountId).reduce((s, t) => s + t.amount, 0) +
  trades.filter((t) => t.accountId === accountId).reduce((s, t) => s + pnl(t), 0);
export const success = () => {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};
export const selection = () => {
  void Haptics.selectionAsync();
};
export const errorFeedback = () => {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
};
export function useCurrentTime() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  return now;
}
export function circuitUntil(trades: Trade[]) {
  const closed = trades
    .filter((t) => t.closedAt)
    .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));
  for (let i = 0; i < closed.length - 1; i++)
    if (pnl(closed[i]) < 0 && pnl(closed[i + 1]) < 0)
      return new Date(closed[i].closedAt!).getTime() + 86400000;
  return 0;
}
export function circuitLocked(trades: Trade[], now = Date.now()) {
  return circuitUntil(trades) > now;
}
interface JournalState {
  accounts: Account[];
  transactions: Transaction[];
  trades: Trade[];
  reviews: Review[];
  accountId: string;
  name: string;
  ownerId: string;
  hydrated: boolean;
  storageError: boolean;
  saveError: boolean;
  setHydrated: (error?: boolean) => void;
  selectAccount: (id: string) => void;
  setName: (name: string) => void;
  addAccount: (name: string, deposit: number) => void;
  transact: (amount: number, note: string) => void;
  setCurrentBalance: (amount: number) => boolean;
  savePipSize: (instrument: string, size: number) => void;
  resetPipSize: (instrument: string) => void;
  addNewsEvent: (event: Omit<NewsEvent, 'id'>) => void;
  addTrade: (trade: Omit<Trade, 'id' | 'date' | 'accountId'>) => string | undefined;
  closeTrade: (
    id: string,
    exit: number,
    explanations: string[],
    outcome: string,
    lesson: string,
  ) => void;
  saveReview: (review: Review) => boolean;
}
export const useJournal = create<JournalState>()(
  persist(
    (set, get) => ({
      accounts: [],
      transactions: [],
      trades: [],
      reviews: [],
      accountId: '',
      name: '',
      ownerId: '',
      hydrated: false,
      storageError: false,
      saveError: false,
      setHydrated: (error = false) => set({ hydrated: true, storageError: error }),
      selectAccount: (accountId) => {
        if (get().accountId !== accountId) {
          set({ accountId });
          selection();
        }
      },
      setName: (name) => set({ name }),
      addAccount: (name, deposit) => {
        const id = uid();
        set((s) => ({
          accounts: [...s.accounts, { id, name }],
          accountId: id,
          transactions: [
            ...s.transactions,
            {
              id: uid(),
              accountId: id,
              amount: deposit,
              note: 'Initial deposit',
              date: new Date().toISOString(),
            },
          ],
        }));
        success();
      },
      transact: (amount, note) => {
        set((s) => ({
          transactions: [
            { id: uid(), accountId: s.accountId, amount, note, date: new Date().toISOString() },
            ...s.transactions,
          ],
        }));
        success();
      },
      setCurrentBalance: (amount) => {
        const current = get();
        if (
          !current.accounts.some((a) => a.id === current.accountId) ||
          !Number.isFinite(amount) ||
          amount < 0
        ) {
          errorFeedback();
          return false;
        }
        const adjustment =
          amount - balance(current.accountId, current.trades, current.transactions);
        const date = new Date().toISOString();
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === s.accountId ? { ...a, confirmedAt: date } : a)),
          transactions:
            adjustment === 0
              ? s.transactions
              : [
                  {
                    id: uid(),
                    accountId: s.accountId,
                    amount: adjustment,
                    note: 'Manual balance adjustment',
                    date,
                  },
                  ...s.transactions,
                ],
        }));
        success();
        return true;
      },
      savePipSize: (instrument, size) => {
        const symbol = instrument.trim().toUpperCase();
        if (!symbol || !Number.isFinite(size) || size <= 0) return;
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.id === s.accountId
              ? {
                  ...a,
                  pipSettings: [
                    ...(a.pipSettings ?? []).filter((p) => p.instrument !== symbol),
                    { instrument: symbol, size },
                  ],
                }
              : a,
          ),
        }));
        success();
      },
      resetPipSize: (instrument) => {
        const symbol = instrument.trim().toUpperCase();
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.id === s.accountId
              ? {
                  ...a,
                  pipSettings: (a.pipSettings ?? []).filter((pip) => pip.instrument !== symbol),
                }
              : a,
          ),
        }));
        success();
      },
      addNewsEvent: (event) => {
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.id === s.accountId
              ? { ...a, newsEvents: [...(a.newsEvents ?? []), { ...event, id: uid() }] }
              : a,
          ),
        }));
        success();
      },
      addTrade: (trade) => {
        const current = get();
        const account = current.accounts.find((a) => a.id === current.accountId);
        if (!account) return 'Create a trading account first.';
        const trades = current.trades.filter((t) => t.accountId === current.accountId);
        const gate = entryGate(account, trades, Date.now(), circuitUntil(trades));
        if (gate.locked) return gate.messages.join('\n');
        const equity = balance(current.accountId, current.trades, current.transactions);
        const failure = submissionFailure(trade, equity);
        if (failure) return failure;
        const pipSize = resolvePipSize(trade.instrument, account.pipSettings);
        if (!pipSize || pipSize !== trade.audit?.pipSize)
          return 'The instrument’s pip size changed. Check the current pip size before saving.';
        const date = new Date().toISOString();
        set((s) => ({
          trades: [
            {
              ...trade,
              audit: {
                ...trade.audit!,
                checkedAt: date,
                newsEvents: (account.newsEvents ?? []).map((event) => ({ ...event })),
                results: [],
                mathVerified: false,
              },
              id: uid(),
              date,
              accountId: s.accountId,
            },
            ...s.trades,
          ],
        }));
        success();
        return undefined;
      },
      closeTrade: (id, exit, explanations, outcome, lesson) => {
        set((s) => ({
          trades: s.trades.map((t) =>
            t.id === id && !t.closedAt
              ? {
                  ...t,
                  exit,
                  closedAt: new Date().toISOString(),
                  reflections: explanations,
                  outcome,
                  lesson,
                }
              : t,
          ),
        }));
        success();
      },
      saveReview: (review) => {
        if (!completeReview(review) || get().reviews.some((r) => r.date === review.date)) {
          errorFeedback();
          return false;
        }
        const saved = { ...review };
        reviewPrompts.forEach(([key]) => {
          saved[key] = saved[key].trim();
        });
        set((s) => ({ reviews: [saved, ...s.reviews] }));
        success();
        return true;
      },
    }),
    {
      name: 'trademindra-journal-v1',
      storage: createJSONStorage(() => ({
        getItem: (key) => AsyncStorage.getItem(key),
        removeItem: (key) => AsyncStorage.removeItem(key),
        setItem: async (key, value) => {
          const current = useJournal.getState();
          if (!current.hydrated || current.storageError) return;
          try {
            await AsyncStorage.setItem(key, value);
            if (useJournal.getState().saveError) useJournal.setState({ saveError: false });
          } catch {
            if (!useJournal.getState().saveError) {
              useJournal.setState({ saveError: true });
              errorFeedback();
            }
          }
        },
      })),
      partialize: (s) => ({
        accounts: s.accounts,
        transactions: s.transactions,
        trades: s.trades,
        reviews: s.reviews,
        accountId: s.accountId,
        name: s.name,
        ownerId: s.ownerId,
      }),
      onRehydrateStorage: () => (_state, error) => {
        useJournal.getState().setHydrated(Boolean(error));
        if (error) errorFeedback();
      },
    },
  ),
);
