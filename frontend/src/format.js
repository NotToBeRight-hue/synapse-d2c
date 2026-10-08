export const amount = value => Number.isFinite(value) ? new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value) : 'Not available';
export const percent = value => Number.isFinite(value) ? amount(value) + '%' : 'Not defined';
export const horizon = row => row.stock_units === 0 ? 0 : row.daily_velocity > 0 ? row.stock_units / row.daily_velocity : null;

