const REMOTE_API_ORIGIN = 'https://financni-api.bisko-daniel.workers.dev';

function resolveApiBase() {
  if (typeof window === 'undefined') return '/api';
  if (window.FINANCE_API_BASE) {
    return String(window.FINANCE_API_BASE).replace(/\/$/, '');
  }

  const { hostname, port } = window.location;

  if (hostname === 'financni-api.bisko-daniel.workers.dev') {
    return '/api';
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    if (port === '3000' || port === '8787') return '/api';
  }

  return `${REMOTE_API_ORIGIN}/api`;
}

const API_BASE = resolveApiBase();

function resolveApiKey() {
  if (typeof window !== 'undefined' && window.FINANCE_API_KEY) {
    return String(window.FINANCE_API_KEY);
  }
  return null;
}

const API_KEY = resolveApiKey();

async function parseApiError(response) {
  const text = await response.text().catch(() => '');
  try {
    const json = JSON.parse(text);
    return json.error || text || response.statusText;
  } catch {
    return text || response.statusText;
  }
}

async function apiRequest(path, options = {}) {
  if (!API_KEY) {
    throw new Error(
      'Chybí API klíč. Vytvořte web/config.js podle config.example.js a nastavte FINANCE_API_KEY.'
    );
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  if (response.status === 204) return null;
  return response.json();
}

export function fetchTransactions() {
  return apiRequest('/transactions');
}

export function createTransaction(data) {
  return apiRequest('/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateTransaction(id, data) {
  return apiRequest(`/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteTransaction(id) {
  return apiRequest(`/transactions/${id}`, { method: 'DELETE' });
}

export function fetchRatesFromCzk() {
  return apiRequest('/rates');
}

async function convertCurrency(amount, from, to) {
  const params = new URLSearchParams({
    amount: String(amount),
    from: from.toUpperCase(),
    to: to.toUpperCase(),
  });
  const data = await apiRequest(`/convert?${params}`);
  if (typeof data.result !== 'number') {
    throw new Error('Neplatná odpověď převodu.');
  }
  return data.result;
}

export function convertToCzk(amount, from) {
  return convertCurrency(amount, from, 'CZK');
}
