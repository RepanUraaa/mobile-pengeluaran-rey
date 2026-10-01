const rupiahFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatRupiah(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `Rp ${rupiahFormatter.format(amount)}` : 'Rp 0';
}

export function formatTanggal(value) {
  if (!value) return '-';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date);
}
