import { API_BASE_URL } from '../config/api';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error('Tidak dapat terhubung ke server. Periksa koneksi dan alamat API.');
  }

  let result;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok || result?.success === false) {
    const error = new Error(result?.message || `Permintaan gagal (${response.status})`);
    error.status = response.status;
    throw error;
  }
  if (result === null || result === undefined) {
    throw new Error('Respons server tidak sesuai format.');
  }

  if (Object.prototype.hasOwnProperty.call(result, 'data')) {
    return result.data;
  }

  return result;
}

export function getExpenses() {
  return request('/pengeluaran');
}

export function getExpenseById(id) {
  return request(`/pengeluaran/${encodeURIComponent(id)}`);
}

export function createExpense(expense) {
  return request('/pengeluaran', { method: 'POST', body: JSON.stringify(expense) });
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

export function getCategories() {
  return request('/kategori');
}
