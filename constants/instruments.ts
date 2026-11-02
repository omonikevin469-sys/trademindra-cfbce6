import type { PipSetting } from '@/lib/terminus';

export type InstrumentCategory = 'Forex majors & crosses' | 'JPY pairs' | 'Metals' | 'Crypto';
export type Instrument = {
  symbol: string;
  category: InstrumentCategory;
  defaultPipSize: number;
};

// GR-ATC defaults supplied by Kevin Omondi. Broker overrides take precedence.
export const instruments: readonly Instrument[] = [
  ...[
    'EURUSD',
    'GBPUSD',
    'USDCHF',
    'USDCAD',
    'AUDUSD',
    'NZDUSD',
    'EURGBP',
    'EURCHF',
    'EURAUD',
    'EURCAD',
    'EURNZD',
    'GBPCHF',
    'GBPAUD',
    'GBPCAD',
    'GBPNZD',
    'AUDCAD',
    'AUDCHF',
    'AUDNZD',
  ].map(
    (symbol): Instrument => ({
      symbol,
      category: 'Forex majors & crosses',
      defaultPipSize: 0.0001,
    }),
  ),
  ...['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY', 'NZDJPY', 'CADJPY', 'CHFJPY'].map(
    (symbol): Instrument => ({
      symbol,
      category: 'JPY pairs',
      defaultPipSize: 0.01,
    }),
  ),
  { symbol: 'XAUUSD', category: 'Metals', defaultPipSize: 0.01 },
  { symbol: 'XAGUSD', category: 'Metals', defaultPipSize: 0.001 },
  { symbol: 'XPTUSD', category: 'Metals', defaultPipSize: 0.01 },
  { symbol: 'XPDUSD', category: 'Metals', defaultPipSize: 0.01 },
  ...[
    'BTCUSD',
    'ETHUSD',
    'SOLUSD',
    'XRPUSD',
    'BNBUSD',
    'ADAUSD',
    'DOGEUSD',
    'DOTUSD',
    'LINKUSD',
    'LTCUSD',
  ].map(
    (symbol): Instrument => ({
      symbol,
      category: 'Crypto',
      defaultPipSize: 1,
    }),
  ),
];

export function findInstrument(symbol: string): Instrument | undefined {
  return instruments.find((item) => item.symbol === symbol.trim().toUpperCase());
}

export function resolvePipSize(
  symbol: string,
  overrides: readonly PipSetting[] = [],
): number | undefined {
  const normalized = symbol.trim().toUpperCase();
  return (
    overrides.find((item) => item.instrument === normalized)?.size ??
    findInstrument(normalized)?.defaultPipSize
  );
}
