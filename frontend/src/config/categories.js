export const CATEGORIES = [
  { id: 2, nama: 'Makanan' },
  { id: 3, nama: 'Transport' },
  { id: 1, nama: 'Pendidikan' },
  { id: 4, nama: 'Hiburan' },
];

export const FILTERS = ['Semua', ...CATEGORIES.map(category => category.nama)];

export function getCategoryId(name) {
  return CATEGORIES.find(category => category.nama === name)?.id ?? null;
}

export function getCategoryName(id) {
  return CATEGORIES.find(category => category.id === id)?.nama || '';
}