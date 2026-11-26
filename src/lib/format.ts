export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function fmt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
export function monthKey(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}`;
}
export function parseKey(key: string): { year: number; month0: number } {
  const [y, m] = key.split('-').map(Number);
  return { year: y, month0: m - 1 };
}
export function shiftKey(key: string, delta: number): string {
  const { year, month0 } = parseKey(key);
  const total = year * 12 + month0 + delta;
  return monthKey(Math.floor(total / 12), ((total % 12) + 12) % 12);
}
export function currentKey(): string {
  const d = new Date();
  return monthKey(d.getFullYear(), d.getMonth());
}
export function parseAmount(text: string): number {
  const n = Number(text.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
