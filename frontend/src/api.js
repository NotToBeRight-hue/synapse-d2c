/** Runtime validation is the trust boundary between FastAPI and React. */
export class ApiError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const number = value => typeof value === 'number' && Number.isFinite(value);
const positiveId = value => Number.isSafeInteger(value) && value > 0;
const nullableNumber = value => value === null || number(value);
const text = value => typeof value === 'string';
const fail = () => { throw new ApiError('The server returned an unexpected response. Refresh and retry.'); };
function requireValue(condition) { if (!condition) fail(); }
export function validateSnapshot(data) {
  requireValue(object(data) && positiveId(data.snapshot_id) && number(data.budget) && data.budget > 0 && Array.isArray(data.campaigns));
  requireValue(['mock', 'uploaded'].includes(data.data_mode));
  data.campaigns.forEach(row => {
    requireValue(object(row) && text(row.sku) && ['meta', 'google'].includes(row.channel));
    ['spend', 'revenue', 'margin', 'stock_units', 'daily_velocity'].forEach(key => requireValue(number(row[key]) && row[key] >= 0));
    requireValue(row.margin <= 1);
  });
  return data;
}
export function validateSimulation(data, expectedSnapshotId = null) {
  requireValue(object(data) && positiveId(data.snapshot_id) && number(data.budget) && data.budget > 0 && object(data.profit_lift));
  if (expectedSnapshotId !== null && data.snapshot_id !== expectedSnapshotId) {
    throw new ApiError('Simulation source changed. Refresh the dashboard and retry.', 409);
  }
  ['baseline', 'optimized'].forEach(key => {
    const result = data[key];
    requireValue(object(result) && Array.isArray(result.allocations));
    ['total_spend', 'unspent_budget', 'net_profit'].forEach(field => requireValue(number(result[field])));
    requireValue(result.total_spend >= 0 && result.unspent_budget >= 0 && result.total_spend <= data.budget + 1e-6);
    result.allocations.forEach(row => {
      requireValue(object(row) && text(row.sku) && ['meta', 'google'].includes(row.channel) && typeof row.inventory_protected === 'boolean');
      ['allocated_spend', 'predicted_revenue', 'predicted_contribution'].forEach(field => requireValue(number(row[field])));
      requireValue(row.allocated_spend >= 0 && row.predicted_revenue >= 0);
      requireValue(!row.inventory_protected || row.allocated_spend === 0);
      requireValue(nullableNumber(row.stockout_horizon_days));
    });
  });
  requireValue(typeof data.optimized.converged === 'boolean' && text(data.optimized.solver));
  requireValue(number(data.optimized.solve_time_ms) && data.optimized.solve_time_ms >= 0);
  requireValue(number(data.profit_lift.absolute) && nullableNumber(data.profit_lift.percent) && nullableNumber(data.profit_lift.multiple));
  requireValue(object(data.recommendation) && text(data.recommendation.text) && ['gemini', 'local-fallback'].includes(data.recommendation.provider));
  return data;
}
export function validateHistory(data) {
  requireValue(Array.isArray(data));
  data.forEach(row => requireValue(object(row) && number(row.id) && number(row.snapshot_id)
    && text(row.created_at) && number(row.net_contribution_profit) && number(row.baseline_profit) && nullableNumber(row.lift_multiplier)));
  return data;
}
export function validateBrands(data) {
  requireValue(Array.isArray(data));
  data.forEach(row => requireValue(object(row) && Number.isInteger(row.id) && text(row.name)));
  return data;
}
export function validateSession(data) {
  requireValue(object(data) && object(data.brand));
  validateBrands([data.brand]);
  requireValue(number(data.simulation_limit_per_hour) && number(data.ai_limit_per_day));
  return data;
}
export async function api(path, { session, method = 'GET', body, signal } = {}) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 25000);
  try {
    const response = await fetch((import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000') + '/api' + path, {
      method, signal: controller.signal, cache: 'no-store',
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(session ? { Authorization: 'Bearer ' + session.token, 'X-Brand-ID': String(session.brand.id) } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let data;
    try { data = await response.json(); } catch { throw new ApiError('Server response was not JSON.', response.status); }
    if (!response.ok) {
      const detail = object(data) ? data.detail : null;
      const message = Array.isArray(detail) ? detail.filter(e => object(e) && text(e.msg))
        .map(e => (Array.isArray(e.loc) ? e.loc.join('.') + ': ' : '') + e.msg).join('; ') || 'Request failed.'
        : (text(detail) ? detail : 'Request failed.');
      throw new ApiError(message, response.status);
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new ApiError('Request timed out or was cancelled. Check the connection and retry.');
    if (error instanceof ApiError) throw error;
    throw new ApiError('Cannot reach the API. Check that the backend is running.');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}

