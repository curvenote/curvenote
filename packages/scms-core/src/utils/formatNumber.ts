import numeral from 'numeral';

export function formatNumber(number: number) {
  return numeral(number).format();
}

export function formatAsPercent(number: number) {
  return numeral(number / 100).format('0.0%');
}

export function formatCurrency(number: number) {
  return numeral(number).format(Number.isInteger(number) ? '$0,0' : '$0,0.00');
}

export function formatSize(number: string | number) {
  return numeral(number).format('0.0 b');
}

export function toCardinal(num: number): string {
  if (num === 1) return '1st';
  if (num === 2) return '2nd';
  if (num === 3) return '3rd';
  return `${num}th`;
}
