import { API_BASE_URL } from '../config/api';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error('Tidak dapat terhubung ke server. Periksa API base URL dan koneksi jaringan.');
  }

  let body = null;
  if (response.status !== 204) {
    const text = await response.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
  }

  if (!response.ok) {
    const error = new Error(body?.pesan || body?.message || `Permintaan gagal (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return body;
}

export async function getExpenses() {
  const data = await request('/pengeluaran');
  return Array.isArray(data) ? data : [];
}

export async function searchExpenses(query) {
  try {
    const data = await request(`/pengeluaran/${encodeURIComponent(query)}`);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error.status === 404) return [];
    throw error;
  }
}

export function createExpense(expense) {
  return request('/pengeluaran', {
    method: 'POST',
    body: JSON.stringify(expense),
  });
}

export function updateExpense(id, expense) {
  return request(`/pengeluaran/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(expense),
  });
}

export function deleteExpense(id) {
  return request(`/pengeluaran/${encodeURIComponent(id)}`, { method: 'DELETE' });
}