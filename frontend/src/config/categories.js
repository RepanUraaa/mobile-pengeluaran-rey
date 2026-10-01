export const ALL_CATEGORIES_FILTER = 'all';

export function getCategoryName(expense, categories) {
  if (expense.kategori) return expense.kategori;
  if (expense.id_kategori == null) return 'Tanpa kategori';
  return categories.find(category => String(category.id) === String(expense.id_kategori))?.nama ?? 'Tanpa kategori';
}
