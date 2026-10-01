export function formatRupiah(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'Rp 0';
  return `Rp ${new Intl.NumberFormat('id-ID').format(amount)}`;
}

export function formatDate(value) {
  if (!value) return 'Tanggal tidak tersedia';
  let date;
  if (value instanceof Date) {
    date = value;
  } else {
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    date = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(value);
  }
  if (Number.isNaN(date.getTime())) return 'Tanggal tidak tersedia';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}