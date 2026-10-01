import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { API_BASE_URL } from './src/config/api';
import { CATEGORIES, FILTERS, getCategoryId, getCategoryName } from './src/config/categories';
import {
  createExpense,
  deleteExpense,
  getExpenses,
  searchExpenses,
  updateExpense,
} from './src/services/pengeluaran';
import { formatDate, formatRupiah } from './src/utils/format';

const colors = {
  background: '#F7F8F5',
  surface: '#FFFFFF',
  ink: '#202923',
  muted: '#778078',
  line: '#E4E8E2',
  accent: '#356B55',
  accentSoft: '#E7F0E9',
  danger: '#B8473E',
  dangerSoft: '#FBEDEA',
};

const emptyForm = { judul: '', nominal: '', kategori: null, catatan: '' };

function AppButton({ title, onPress, secondary = false, danger = false, disabled = false, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        danger && styles.dangerButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && styles.secondaryButtonText,
          danger && styles.dangerButtonText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function ExpenseCard({ item, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.expenseCard, pressed && styles.cardPressed]}
    >
      <View style={styles.cardCopy}>
        <Text numberOfLines={1} style={styles.expenseTitle}>{item.judul?.toUpperCase()}</Text>
        <Text style={styles.expenseCategory}>{item.kategori || 'Tanpa kategori'}</Text>
        <Text style={styles.expenseDate}>{formatDate(item.tanggal)}</Text>
      </View>
      <Text style={styles.expenseAmount}>{formatRupiah(item.nominal)}</Text>
    </Pressable>
  );
}

function EmptyState({ title, description, action, onAction }) {
  return (
    <View style={styles.stateContent}>
      <View style={styles.stateMark}><Text style={styles.stateMarkText}>—</Text></View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateDescription}>{description}</Text>
      {action ? <AppButton title={action} onPress={onAction} style={styles.stateAction} /> : null}
    </View>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [screen, setScreen] = useState('list');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchText, setSearchText] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('Semua');
  const [selectedItem, setSelectedItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formMode, setFormMode] = useState('add');
  const [formErrors, setFormErrors] = useState({});
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [pendingCategory, setPendingCategory] = useState(null);
  const [deleteConfirmationVisible, setDeleteConfirmationVisible] = useState(false);
  const mutationLock = useRef(false);
  const refreshLock = useRef(false);

  async function loadList({ showSpinner = true, search = '' } = {}) {
    if (showSpinner) setLoading(true);
    setErrorMessage('');
    try {
      const data = search ? await searchExpenses(search) : await getExpenses();
      setItems(data);
      setScreen('list');
    } catch (error) {
      setErrorMessage(error.message);
      setScreen('loadError');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadList();
  }, []);

  async function refresh() {
    if (refreshLock.current) return;
    refreshLock.current = true;
    setRefreshing(true);
    setErrorMessage('');
    try {
      const data = await getExpenses();
      setItems(data);
      setScreen('list');
    } catch (error) {
      setErrorMessage(error.message);
      setScreen('loadError');
    } finally {
      refreshLock.current = false;
      setRefreshing(false);
    }
  }

  async function submitSearch() {
    const query = searchText.trim();
    setActiveSearch(query);
    setLoading(true);
    await loadList({ showSpinner: false, search: query });
  }

  function startAdd() {
    setFormMode('add');
    setForm(emptyForm);
    setFormErrors({});
    setScreen('form');
  }

  function startEdit(item) {
    setSelectedItem(item);
    setFormMode('edit');
    setForm({
      judul: item.judul || '',
      nominal: String(item.nominal ?? ''),
      kategori: getCategoryId(item.kategori),
      catatan: item.catatan || '',
    });
    setFormErrors({});
    setScreen('form');
  }

  function updateForm(field, value) {
    setForm(current => ({ ...current, [field]: value }));
    setFormErrors(current => ({ ...current, [field]: '' }));
  }

  async function saveExpense() {
    if (mutationLock.current) return;
    const errors = {};
    if (!form.judul.trim()) errors.judul = 'Judul wajib diisi';
    if (!/^\d+$/.test(form.nominal.trim()) || Number(form.nominal) <= 0) {
      errors.nominal = 'Nominal harus berupa angka positif';
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    mutationLock.current = true;
    setSaving(true);
    setFormErrors({});
    const payload = {
      judul: form.judul.trim(),
      nominal: Number(form.nominal),
      id_kategori: form.kategori,
      catatan: form.catatan.trim() || null,
    };
    try {
      if (formMode === 'edit') {
        await updateExpense(selectedItem.id, payload);
      } else {
        await createExpense(payload);
      }
      setActiveSearch('');
      setSearchText('');
      setSelectedFilter('Semua');
      await loadList();
    } catch (error) {
      setFormErrors({ api: error.message });
    } finally {
      mutationLock.current = false;
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!selectedItem || mutationLock.current) return;
    mutationLock.current = true;
    setSaving(true);
    setDeleteConfirmationVisible(false);
    try {
      await deleteExpense(selectedItem.id);
      setSelectedItem(null);
      setActiveSearch('');
      setSearchText('');
      setSelectedFilter('Semua');
      await loadList();
    } catch (error) {
      setErrorMessage(error.message);
      setScreen('loadError');
    } finally {
      mutationLock.current = false;
      setSaving(false);
    }
  }

  function openCategoryPicker() {
    setPendingCategory(form.kategori);
    setCategoryPickerVisible(true);
  }

  function applyCategory() {
    updateForm('kategori', pendingCategory);
    setCategoryPickerVisible(false);
  }

  const visibleItems = items.filter(item => {
    const matchesSearch = !activeSearch || item.judul?.toLowerCase().includes(activeSearch.toLowerCase());
    const matchesCategory = selectedFilter === 'Semua' || (item.kategori || '') === selectedFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {screen === 'list' && (
        <View style={styles.screen}>
          <View style={styles.listHeader}>
            <Text style={styles.pageTitle}>Pengeluaran</Text>
            <View style={styles.headerActions}>
              <Pressable accessibilityLabel="Refresh" accessibilityRole="button" disabled={refreshing} onPress={refresh} style={styles.iconButton}>
                {refreshing ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.refreshGlyph}>↻</Text>}
              </Pressable>
              <Pressable accessibilityLabel="Tambah pengeluaran" accessibilityRole="button" onPress={startAdd} style={styles.addIconButton}>
                <Text style={styles.addGlyph}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchGlyph}>⌕</Text>
            <TextInput
              accessibilityLabel="Cari pengeluaran"
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={submitSearch}
              returnKeyType="search"
              placeholder="Cari pengeluaran..."
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
            />
          </View>

          <ScrollView
            horizontal
            style={styles.filterScroll}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTERS.map(filter => (
              <Pressable
                key={filter}
                accessibilityRole="button"
                onPress={() => setSelectedFilter(filter)}
                style={[styles.filterPill, selectedFilter === filter && styles.filterPillActive]}
              >
                <Text style={[styles.filterText, selectedFilter === filter && styles.filterTextActive]}>{filter}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {loading ? (
            <View style={styles.inlineLoading}><ActivityIndicator color={colors.accent} /><Text style={styles.loadingText}>Memuat data...</Text></View>
          ) : items.length === 0 && !activeSearch ? (
            <EmptyState
              title="Belum ada pengeluaran"
              description="Mulai dengan menambahkan pengeluaran baru."
              action="Tambah"
              onAction={startAdd}
            />
          ) : visibleItems.length === 0 && activeSearch ? (
            <EmptyState
              title="Data tidak ditemukan"
              description="Coba kata kunci lain yang lebih spesifik."
              action="Kembali"
              onAction={() => { setSearchText(''); setActiveSearch(''); loadList(); }}
            />
          ) : visibleItems.length === 0 ? (
            <EmptyState title="Tidak ada pengeluaran" description="Belum ada data pada kategori ini." />
          ) : (
            <ScrollView contentContainerStyle={styles.expenseList} keyboardShouldPersistTaps="handled">
              {visibleItems.map(item => (
                <ExpenseCard key={String(item.id)} item={item} onPress={() => { setSelectedItem(item); setScreen('detail'); }} />
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {screen === 'form' && (
        <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.subHeader}>
            <Pressable accessibilityLabel="Kembali" onPress={() => setScreen(formMode === 'edit' ? 'detail' : 'list')} style={styles.backButton}>
              <Text style={styles.backGlyph}>‹</Text>
            </Pressable>
            <Text style={styles.subHeaderTitle}>{formMode === 'edit' ? 'Ubah pengeluaran' : 'Tambah pengeluaran'}</Text>
            <View style={styles.headerSpacer} />
          </View>
          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Judul <Text style={styles.required}>*</Text></Text>
            <TextInput
              value={form.judul}
              onChangeText={value => updateForm('judul', value)}
              placeholder="Masukkan judul pengeluaran"
              placeholderTextColor={colors.muted}
              style={[styles.input, formErrors.judul && styles.inputError]}
              maxLength={100}
            />
            {formErrors.judul ? <Text style={styles.fieldError}>{formErrors.judul}</Text> : null}

            <Text style={styles.fieldLabel}>Nominal <Text style={styles.required}>*</Text></Text>
            <TextInput
              value={form.nominal}
              onChangeText={value => updateForm('nominal', value)}
              placeholder="Masukkan nominal (contoh: 20000)"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              style={[styles.input, formErrors.nominal && styles.inputError]}
            />
            {formErrors.nominal ? <Text style={styles.fieldError}>{formErrors.nominal}</Text> : null}

            <Text style={styles.fieldLabel}>Kategori</Text>
            <Pressable accessibilityRole="button" onPress={openCategoryPicker} style={styles.selectInput}>
              <Text style={[styles.selectText, form.kategori === null && styles.placeholderText]}>
                {getCategoryName(form.kategori) || 'Pilih kategori'}
              </Text>
              <Text style={styles.selectChevron}>⌄</Text>
            </Pressable>

            <Text style={styles.fieldLabel}>Catatan (opsional)</Text>
            <TextInput
              value={form.catatan}
              onChangeText={value => updateForm('catatan', value)}
              placeholder="Tulis catatan..."
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.noteInput, formErrors.catatan && styles.inputError]}
            />
            {formErrors.catatan ? <Text style={styles.fieldError}>{formErrors.catatan}</Text> : null}
            {formErrors.api ? <Text style={styles.formApiError}>{formErrors.api}</Text> : null}
            <AppButton title={saving ? 'Menyimpan...' : 'Simpan'} onPress={saveExpense} disabled={saving} style={styles.saveButton} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {screen === 'detail' && selectedItem && (
        <View style={styles.screen}>
          <View style={styles.subHeader}>
            <Pressable accessibilityLabel="Kembali" onPress={() => setScreen('list')} style={styles.backButton}>
              <Text style={styles.backGlyph}>‹</Text>
            </Pressable>
            <Text style={styles.subHeaderTitle}>Detail pengeluaran</Text>
            <View style={styles.headerSpacer} />
          </View>
          <ScrollView contentContainerStyle={styles.detailContent}>
            <View style={styles.detailHero}>
              <Text style={styles.detailTitle}>{selectedItem.judul?.toUpperCase()}</Text>
              <Text style={styles.detailAmount}>{formatRupiah(selectedItem.nominal)}</Text>
              <Text style={styles.detailCategory}>{selectedItem.kategori || 'Tanpa kategori'}</Text>
            </View>
            <View style={styles.detailRows}>
              <DetailRow label="Tanggal" value={formatDate(selectedItem.tanggal)} />
              <DetailRow label="Kategori" value={selectedItem.kategori || 'Tanpa kategori'} />
              {selectedItem.catatan ? <DetailRow label="Catatan" value={selectedItem.catatan} /> : null}
            </View>
            <AppButton title="Ubah" onPress={() => startEdit(selectedItem)} style={styles.detailAction} />
            <AppButton title="Hapus" onPress={() => setDeleteConfirmationVisible(true)} secondary danger style={styles.detailAction} />
          </ScrollView>
        </View>
      )}

      {screen === 'empty' && (
        <EmptyState title="Belum ada pengeluaran" description="Mulai dengan menambahkan pengeluaran baru." action="Tambah" onAction={startAdd} />
      )}

      {screen === 'loadError' && (
        <View style={styles.screen}>
          <View style={styles.subHeader}><View style={styles.headerSpacer} /><Text style={styles.subHeaderTitle}>Pengeluaran</Text><View style={styles.headerSpacer} /></View>
          <EmptyState
            title="Gagal memuat data"
            description={`Terjadi kesalahan saat mengambil data.\nSilakan coba lagi.${errorMessage ? `\n\n${errorMessage}` : ''}`}
            action="Coba lagi"
            onAction={() => loadList()}
          />
        </View>
      )}

      <Modal visible={categoryPickerVisible} transparent animationType="slide" onRequestClose={() => setCategoryPickerVisible(false)}>
        <View style={styles.modalScrim}>
          <View style={styles.pickerSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.pickerTitle}>Pilih kategori</Text>
            {[{ id: null, nama: 'Tanpa kategori' }, ...CATEGORIES].map(category => {
              const active = pendingCategory === category.id;
              return (
                <Pressable key={category.nama} onPress={() => setPendingCategory(category.id)} style={styles.categoryOption}>
                  <Text style={styles.categoryOptionText}>{category.nama}</Text>
                  <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                    {active ? <View style={styles.radioInner} /> : null}
                  </View>
                </Pressable>
              );
            })}
            <AppButton title="Pilih" onPress={applyCategory} style={styles.pickerButton} />
          </View>
        </View>
      </Modal>

      <Modal visible={deleteConfirmationVisible} transparent animationType="fade" onRequestClose={() => setDeleteConfirmationVisible(false)}>
        <View style={styles.modalScrim}>
          <View style={styles.confirmDialog}>
            <Text style={styles.confirmTitle}>Hapus pengeluaran ini?</Text>
            <Text style={styles.confirmDescription}>Data yang dihapus tidak dapat dikembalikan.</Text>
            <View style={styles.confirmActions}>
              <AppButton title="Batal" onPress={() => setDeleteConfirmationVisible(false)} secondary style={styles.confirmButton} />
              <AppButton title={saving ? 'Menghapus...' : 'Hapus'} onPress={confirmDelete} danger disabled={saving} style={styles.confirmButton} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, paddingHorizontal: 22 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 18 },
  pageTitle: { color: colors.ink, fontSize: 29, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.surface },
  refreshGlyph: { fontSize: 27, color: colors.accent, lineHeight: 31 },
  addIconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.accent },
  addGlyph: { color: colors.surface, fontSize: 29, lineHeight: 33 },
  searchBox: { height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.surface },
  searchGlyph: { color: colors.muted, fontSize: 23, marginRight: 9 },
  searchInput: { flex: 1, color: colors.ink, fontSize: 15, paddingVertical: 0 },
  filterScroll: { height: 80, flexGrow: 0, flexShrink: 0 },
  filterRow: { height: 80, alignItems: 'center', gap: 8 },
  filterPill: { flexGrow: 0, flexShrink: 0, height: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 24, backgroundColor: '#ECEFEB' },
  filterPillActive: { backgroundColor: colors.accent },
  filterText: { color: '#59635C', fontSize: 13, fontWeight: '500' },
  filterTextActive: { color: colors.surface },
  expenseList: { gap: 11, paddingBottom: 24 },
  expenseCard: { minHeight: 102, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 15, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.surface },
  cardPressed: { backgroundColor: '#F0F4EF' },
  cardCopy: { flex: 1, gap: 5 },
  expenseTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  expenseCategory: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  expenseDate: { color: colors.muted, fontSize: 12 },
  expenseAmount: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  button: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.accent },
  buttonText: { color: colors.surface, fontSize: 15, fontWeight: '700' },
  secondaryButton: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  secondaryButtonText: { color: colors.ink },
  dangerButton: { backgroundColor: colors.dangerSoft },
  dangerButtonText: { color: colors.danger },
  disabledButton: { opacity: 0.55 },
  pressedButton: { opacity: 0.82 },
  stateContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 50 },
  stateMark: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 17, borderRadius: 26, backgroundColor: colors.accentSoft },
  stateMarkText: { color: colors.accent, fontSize: 25, fontWeight: '600' },
  stateTitle: { color: colors.ink, fontSize: 19, fontWeight: '700', textAlign: 'center' },
  stateDescription: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  stateAction: { minWidth: 150, marginTop: 22 },
  inlineLoading: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { color: colors.muted, fontSize: 14 },
  subHeader: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 42, justifyContent: 'center' },
  backGlyph: { color: colors.ink, fontSize: 36, lineHeight: 40 },
  subHeaderTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  headerSpacer: { width: 40 },
  formContent: { paddingTop: 12, paddingBottom: 30 },
  fieldLabel: { marginTop: 17, marginBottom: 8, color: colors.ink, fontSize: 14, fontWeight: '600' },
  required: { color: colors.danger },
  input: { minHeight: 50, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.surface, color: colors.ink, fontSize: 15 },
  inputError: { borderColor: colors.danger },
  fieldError: { color: colors.danger, fontSize: 12, marginTop: 6 },
  fieldHint: { color: colors.muted, fontSize: 12, marginTop: 7 },
  selectInput: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.surface },
  selectText: { color: colors.ink, fontSize: 15 },
  placeholderText: { color: colors.muted },
  selectChevron: { color: colors.muted, fontSize: 19 },
  noteInput: { minHeight: 96 },
  formApiError: { color: colors.danger, fontSize: 13, marginTop: 14 },
  saveButton: { marginTop: 22 },
  detailContent: { paddingTop: 22, paddingBottom: 30 },
  detailHero: { alignItems: 'center', paddingVertical: 28, borderRadius: 16, backgroundColor: colors.accentSoft },
  detailTitle: { color: colors.ink, fontSize: 19, fontWeight: '700', textAlign: 'center' },
  detailAmount: { color: colors.accent, fontSize: 28, fontWeight: '700', marginTop: 14 },
  detailCategory: { color: colors.muted, fontSize: 14, marginTop: 8 },
  detailRows: { marginTop: 23, paddingHorizontal: 2 },
  detailRow: { minHeight: 53, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  detailLabel: { color: colors.muted, fontSize: 14 },
  detailValue: { flexShrink: 1, color: colors.ink, fontSize: 14, fontWeight: '500', textAlign: 'right' },
  detailAction: { marginTop: 13 },
  modalScrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20, 30, 24, 0.38)' },
  pickerSheet: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 28, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: colors.background },
  sheetHandle: { width: 38, height: 4, alignSelf: 'center', marginBottom: 20, borderRadius: 3, backgroundColor: '#C7CEC8' },
  pickerTitle: { color: colors.ink, fontSize: 19, fontWeight: '700', marginBottom: 12 },
  categoryOption: { minHeight: 51, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line },
  categoryOptionText: { color: colors.ink, fontSize: 15 },
  radioOuter: { width: 21, height: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#A8B0A9', borderRadius: 11 },
  radioOuterActive: { borderColor: colors.accent },
  radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.accent },
  pickerButton: { marginTop: 20 },
  confirmDialog: { marginHorizontal: 22, marginBottom: 'auto', marginTop: 'auto', padding: 22, borderRadius: 16, backgroundColor: colors.surface },
  confirmTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  confirmDescription: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 9 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  confirmButton: { flex: 1 },
});