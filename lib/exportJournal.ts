import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { snapshot, useCloud } from '@/lib/cloud';
import { isSampleAccount } from '@/lib/journal';
export function journalExportData(journal = snapshot(), conflicts = useCloud.getState().conflicts) {
  const sampleIds = new Set(
    journal.accounts
      .filter((a) => isSampleAccount(a.id, journal.transactions, journal.trades))
      .map((a) => a.id),
  );
  for (const transaction of journal.transactions)
    if (transaction.note === 'Practice initial deposit' && transaction.amount === 10000)
      sampleIds.add(transaction.accountId);
  for (const entry of conflicts) {
    const payload = entry.payload;
    if (
      entry.kind === 'transaction' &&
      payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      payload.note === 'Practice initial deposit' &&
      payload.amount === 10000 &&
      typeof payload.accountId === 'string'
    )
      sampleIds.add(payload.accountId);
  }
  const accounts = journal.accounts.filter((a) => !sampleIds.has(a.id));
  const syncConflicts = conflicts.filter((entry) => {
    if (entry.kind === 'account') return !sampleIds.has(entry.id);
    const payload = entry.payload;
    return !(
      payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      typeof payload.accountId === 'string' &&
      sampleIds.has(payload.accountId)
    );
  });
  return {
    ...journal,
    accounts,
    transactions: journal.transactions.filter((t) => !sampleIds.has(t.accountId)),
    trades: journal.trades.filter((t) => !sampleIds.has(t.accountId)),
    accountId: sampleIds.has(journal.accountId) ? (accounts[0]?.id ?? '') : journal.accountId,
    syncConflicts,
  };
}
export async function exportJournal() {
  const content = JSON.stringify(
    {
      format: 'TradeMindra Ultra',
      version: 1,
      exportedAt: new Date().toISOString(),
      ...journalExportData(),
    },
    null,
    2,
  );
  const name = `trademindra-journal-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('File sharing is unavailable on this phone.');
  const file = new File(Paths.cache, name);
  file.create();
  await file.write(content);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Save journal JSON',
  });
}
