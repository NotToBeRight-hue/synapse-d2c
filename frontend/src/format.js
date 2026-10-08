export const amount = value => Number.isFinite(value) ? new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value) : 'Not available';
const inrFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const money = value => Number.isFinite(value) ? inrFormatter.format(value) : 'Not available';
export const percent = value => Number.isFinite(value) ? amount(value) + '%' : 'Not defined';
export const horizon = row => row.stock_units === 0 ? 0 : row.daily_velocity > 0 ? row.stock_units / row.daily_velocity : null;


/** Display only: round up at 12 hours; inventory constraints retain the exact horizon. */
export const stockDays = value => {
  if (!Number.isFinite(value) || value < 0) return 'Not available';
  const days = Math.floor(value + 0.5);
  return `${amount(days)} ${days === 1 ? 'day' : 'days'}`;
};
