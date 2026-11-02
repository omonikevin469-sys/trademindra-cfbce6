export const periods = ['Daily', 'Weekly', 'Monthly', 'Yearly'] as const;
export type Period = (typeof periods)[number];
export function periodWindow(period: Period, anchor: Date) {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  if (period === 'Weekly') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (period === 'Monthly') start.setDate(1);
  if (period === 'Yearly') start.setMonth(0, 1);
  const end = new Date(start);
  if (period === 'Daily') end.setDate(end.getDate() + 1);
  if (period === 'Weekly') end.setDate(end.getDate() + 7);
  if (period === 'Monthly') end.setMonth(end.getMonth() + 1);
  if (period === 'Yearly') end.setFullYear(end.getFullYear() + 1);
  return { start, end };
}
export function shiftPeriod(period: Period, anchor: Date, direction: number) {
  const date = periodWindow(period, anchor).start;
  if (period === 'Daily') date.setDate(date.getDate() + direction);
  if (period === 'Weekly') date.setDate(date.getDate() + direction * 7);
  if (period === 'Monthly') date.setMonth(date.getMonth() + direction);
  if (period === 'Yearly') date.setFullYear(date.getFullYear() + direction);
  return date;
}
export function withinPeriod(value: string, period: Period, anchor: Date) {
  const { start, end } = periodWindow(period, anchor);
  const time = new Date(value).getTime();
  return time >= start.getTime() && time < end.getTime();
}
export function periodLabel(period: Period, anchor: Date) {
  const { start, end } = periodWindow(period, anchor);
  if (period === 'Yearly') return String(start.getFullYear());
  if (period === 'Monthly')
    return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  if (period === 'Daily')
    return start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const last = new Date(end);
  last.setDate(last.getDate() - 1);
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
