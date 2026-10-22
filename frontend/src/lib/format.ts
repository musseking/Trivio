// Display convention: EUR. The current backend models contain no currency field.
const priceFormat = new Intl.NumberFormat('sr-Latn-RS', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2,
});
const numberFormat = new Intl.NumberFormat('sr-Latn-RS');
const dateFormat = new Intl.DateTimeFormat('sr-Latn-RS', {
  day: 'numeric', month: 'short', year: 'numeric',
});

export function formatPrice(value: number) { return priceFormat.format(value); }
export function formatMileage(value: number) { return `${numberFormat.format(value)} km`; }
export function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Datum nije dostupan' : dateFormat.format(date);
}
export function formatFuel(value: string) {
  const labels: Record<string, string> = {
    diesel: 'Dizel', dizel: 'Dizel', petrol: 'Benzin', gasoline: 'Benzin', benzin: 'Benzin',
    electric: 'Električni', hybrid: 'Hibrid', lpg: 'TNG',
  };
  return labels[value.toLowerCase()] ?? value;
}
