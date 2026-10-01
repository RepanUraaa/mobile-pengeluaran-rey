// server.js

import express from 'express';
import cors from 'cors';
import { pool } from './db.js';

const app = express();

app.use(cors());
app.use(express.json());

const PENGELUARAN_SELECT = `
  SELECT p.id, p.judul, p.nominal, p.id_kategori, p.tanggal, p.catatan,
         k.nama AS kategori
  FROM pengeluaran p
  LEFT JOIN kategori k ON p.id_kategori = k.id`;

function sendError(res, status, message) {
  return res.status(status).json({ success: false, message, data: null });
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validatePengeluaran(body = {}) {
  const judul = typeof body.judul === 'string' ? body.judul.trim() : '';
  const nominal = typeof body.nominal === 'number'
    ? body.nominal
    : typeof body.nominal === 'string' && body.nominal.trim() !== ''
      ? Number(body.nominal)
      : NaN;

  if (!judul) return { error: 'Judul wajib diisi' };
  if (judul.length > 100) return { error: 'Judul maksimal 100 karakter' };
  if (!Number.isFinite(nominal) || nominal <= 0) {
    return { error: 'Nominal harus berupa angka positif' };
  }

  let id_kategori = null;
  if (body.id_kategori !== undefined && body.id_kategori !== null) {
    id_kategori = typeof body.id_kategori === 'number'
      ? body.id_kategori
      : typeof body.id_kategori === 'string' && body.id_kategori.trim() !== ''
        ? Number(body.id_kategori)
        : NaN;
    if (!Number.isInteger(id_kategori) || id_kategori <= 0) {
      return { error: 'Kategori tidak valid' };
    }
  }

  const catatan = body.catatan ?? null;
  if (catatan !== null && typeof catatan !== 'string') {
    return { error: 'Catatan harus berupa teks atau null' };
  }

  return { value: { judul, nominal, id_kategori, catatan } };
}

async function getKategori(id) {
  if (id === null) return null;
  const [rows] = await pool.query('SELECT id, nama FROM kategori WHERE id = ?', [id]);
  return rows[0] ?? undefined;
}

app.get('/pengeluaran', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `${PENGELUARAN_SELECT} ORDER BY p.id DESC`
    );

    res.json({ success: true, message: 'Daftar pengeluaran berhasil diambil', data: rows });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Gagal mengambil data pengeluaran');
  }
});

app.get('/pengeluaran/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return sendError(res, 400, 'ID pengeluaran tidak valid');

  try {
    const [rows] = await pool.query(
      `${PENGELUARAN_SELECT} WHERE p.id = ?`,
      [id]
    );

    if (rows.length === 0) return sendError(res, 404, 'Pengeluaran tidak ditemukan');

    res.json({ success: true, message: 'Detail pengeluaran berhasil diambil', data: rows[0] });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Gagal mengambil detail pengeluaran');
  }
});

app.get('/kategori', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, nama FROM kategori ORDER BY id ASC');
    res.json({ success: true, message: 'Daftar kategori berhasil diambil', data: rows });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Gagal mengambil data kategori');
  }
});

app.post('/pengeluaran', async (req, res) => {
  const validated = validatePengeluaran(req.body);
  if (validated.error) return sendError(res, 400, validated.error);

  try {
    const { judul, nominal, id_kategori, catatan } = validated.value;
    const kategori = await getKategori(id_kategori);
    if (id_kategori !== null && !kategori) return sendError(res, 400, 'Kategori tidak ditemukan');

    const [hasil] = await pool.query(
      `INSERT INTO pengeluaran
         (keterangan, jumlah, tipe, kategori, judul, nominal, id_kategori, catatan)
       VALUES (?, ?, 'pengeluaran', ?, ?, ?, ?, ?)`,
      [judul, nominal, kategori?.nama ?? '', judul, nominal, id_kategori, catatan]
    );
    const [rows] = await pool.query(`${PENGELUARAN_SELECT} WHERE p.id = ?`, [hasil.insertId]);

    res.status(201).json({ success: true, message: 'Pengeluaran berhasil ditambahkan', data: rows[0] });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Gagal menyimpan pengeluaran');
  }
});

app.put('/pengeluaran/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return sendError(res, 400, 'ID pengeluaran tidak valid');

  const validated = validatePengeluaran(req.body);
  if (validated.error) return sendError(res, 400, validated.error);

  try {
    const { judul, nominal, id_kategori, catatan } = validated.value;
    const kategori = await getKategori(id_kategori);
    if (id_kategori !== null && !kategori) return sendError(res, 400, 'Kategori tidak ditemukan');

    const [existing] = await pool.query('SELECT id FROM pengeluaran WHERE id = ?', [id]);
    if (existing.length === 0) return sendError(res, 404, 'Pengeluaran tidak ditemukan');

    await pool.query(
      `UPDATE pengeluaran
       SET keterangan = ?, jumlah = ?, tipe = 'pengeluaran', kategori = ?,
           judul = ?, nominal = ?, id_kategori = ?, catatan = ?
       WHERE id = ?`,
      [judul, nominal, kategori?.nama ?? '', judul, nominal, id_kategori, catatan, id]
    );
    const [rows] = await pool.query(`${PENGELUARAN_SELECT} WHERE p.id = ?`, [id]);

    res.json({ success: true, message: 'Pengeluaran berhasil diubah', data: rows[0] });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Gagal mengubah pengeluaran');
  }
});

app.delete('/pengeluaran/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return sendError(res, 400, 'ID pengeluaran tidak valid');

  try {
    const [hasil] = await pool.query(
      'DELETE FROM pengeluaran WHERE id = ?',
      [id]
    );

    if (hasil.affectedRows === 0) return sendError(res, 404, 'Pengeluaran tidak ditemukan');

    res.json({ success: true, message: 'Pengeluaran berhasil dihapus', data: null });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Gagal menghapus pengeluaran');
  }
});

// ==================================================
// 7. GET KATEGORI RINGKASAN
// Menampilkan jumlah transaksi dan total nominal
// berdasarkan kategori
// ==================================================

app.get('/kategori/ringkasan', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
          k.nama AS kategori,
          COUNT(p.id) AS jumlah_transaksi,
          COALESCE(SUM(p.nominal), 0) AS total
       FROM kategori k
       LEFT JOIN pengeluaran p
         ON p.id_kategori = k.id
       GROUP BY k.id, k.nama
       ORDER BY k.id DESC`
    );

    res.json({ success: true, message: 'Ringkasan kategori berhasil diambil', data: rows });
  } catch (error) {
    console.error(error);
    sendError(res, 500, 'Gagal mengambil ringkasan kategori');
  }
});

app.use((req, res) => sendError(res, 404, 'Endpoint tidak ditemukan'));

app.use((error, req, res, next) => {
  console.error(error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  const message = status === 400 ? 'Format JSON tidak valid' : 'Terjadi kesalahan pada server';
  sendError(res, status, message);
});


// ==================================================
// MENJALANKAN SERVER
// ==================================================

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});