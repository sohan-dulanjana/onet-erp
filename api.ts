const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

async function request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) },
    });
  } catch {
    throw new Error(`Cannot connect to ${BASE}. Check that NestJS is running and CORS allows http://localhost:5173.`);
  }
  const raw = await response.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new Error(message || data?.error || `Request failed (${response.status})`);
  }
  return data as T;
}

const json = (method: string, value?: unknown): RequestInit => ({ method, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
const enc = (id: string) => encodeURIComponent(id);
export const api = {
  baseUrl: BASE,
  request,
  health: () => request<any>('/api/health'),
  dashboardSummary: () => request<any>('/api/v1/dashboard/summary'),
  allLookups: () => request<any>('/api/v1/lookups'),
  list: (path: string, query = '') => request<any[]>(`/api/v1/${path}${query ? `?${query}` : ''}`),
  get: (path: string) => request<any>(`/api/v1/${path}`),
  post: (path: string, body: unknown) => request<any>(`/api/v1/${path}`, json('POST', body)),
  patch: (path: string, body: unknown) => request<any>(`/api/v1/${path}`, json('PATCH', body)),
  del: (path: string) => request<any>(`/api/v1/${path}`, json('DELETE')),
  lookup: (name: string) => request<any[]>(`/api/v1/lookups/${name}`),
  material: (id: string) => request<any>(`/api/v1/materials/${enc(id)}`),
  materialHistory: (id: string) => request<any[]>(`/api/v1/material-prices/history/${enc(id)}`),
  hardwarePrices: (id: string) => request<any[]>(`/api/v1/hardware-items/${enc(id)}/prices`),
  finishHistory: (code: string) => request<any[]>(`/api/v1/finish-rates/history/${enc(code)}`),
  quotation: (id: string) => request<any>(`/api/v1/quotations/${enc(id)}`),
  quotationAction: (id: string, action: 'issue' | 'accept' | 'reject') => request<any>(`/api/v1/quotations/${enc(id)}/${action}`, json('POST')),
  reviseQuotation: (id: string, body: unknown) => request<any>(`/api/v1/quotations/${enc(id)}/revisions`, json('POST', body)),
  createQuotation: (body: unknown) => request<any>('/api/v1/quotations', json('POST', body)),
  calculateV2: (body: unknown) => request<any>('/api/v1/costing/calculate-v2', json('POST', body)),
  invoicePdf: async (id: string) => {
    const response = await fetch(`${BASE}/api/v1/invoices/${enc(id)}/pdf`);
    if (!response.ok) { let message = `Invoice PDF request failed (${response.status})`; try { const data = await response.json(); message = data?.message || message; } catch { /* no JSON body */ } throw new Error(message); }
    return response.blob();
  },
  pdf: async (id: string) => {
    const response = await fetch(`${BASE}/api/v1/quotations/${enc(id)}/pdf`);
    if (!response.ok) {
      let message = `PDF request failed (${response.status})`;
      try { const data = await response.json(); message = data?.message || message; } catch { /* no JSON body */ }
      throw new Error(message);
    }
    return response.blob();
  },
};
