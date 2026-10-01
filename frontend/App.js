import { useEffect, useRef, useState } from 'react';
import {
	ActivityIndicator,
	FlatList,
	Keyboard,
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
import { ALL_CATEGORIES_FILTER, getCategoryName } from './src/config/categories';
import {
	createExpense,
	deleteExpense,
	getCategories,
	getExpenses,
	updateExpense,
} from './src/services/pengeluaran';
import { formatRupiah, formatTanggal } from './src/utils/format';

const COLORS = {
	background: '#F7F8FA',
	surface: '#FFFFFF',
	ink: '#18212F',
	muted: '#7D8795',
	line: '#D8DEE6',
	green: '#087F75',
	greenSoft: '#D9F4F0',
	lime: '#D9F06A',
	red: '#E34F58',
	redSoft: '#FCEBED',
};

const EMPTY_FORM = { judul: '', nominal: '', id_kategori: null, catatan: '' };

function ActionButton({ label, onPress, variant = 'primary', disabled = false, loading = false, buttonStyle }) {
	return (
		<Pressable
			accessibilityRole="button"
			disabled={disabled || loading}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				styles[`button_${variant}`],
				buttonStyle,
				pressed && !disabled && !loading && styles.buttonPressed,
				(disabled || loading) && styles.buttonDisabled,
			]}
		>
			{loading ? <ActivityIndicator color={variant === 'primary' ? COLORS.lime : COLORS.green} /> : null}
			<Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{label}</Text>
		</Pressable>
	);
}

function ScreenHeader({ title, onBack }) {
	return (
		<View style={styles.screenHeader}>
			<Pressable accessibilityRole="button" accessibilityLabel="Kembali" onPress={onBack} hitSlop={10} style={styles.backButton}>
				<Text style={styles.backText}>‹</Text>
			</Pressable>
			<Text style={styles.screenHeaderTitle}>{title}</Text>
		</View>
	);
}

function Notice({ title, description, actionLabel, onAction, tone = 'neutral', icon = '▧', actionButtonStyle }) {
	return (
		<View style={styles.noticeWrap}>
			<Text style={[styles.noticeIcon, tone === 'error' && styles.noticeIconError]}>{icon}</Text>
			<Text style={styles.noticeTitle}>{title}</Text>
			<Text style={styles.noticeDescription}>{description}</Text>
			{actionLabel ? <ActionButton label={actionLabel} onPress={onAction} buttonStyle={actionButtonStyle} /> : null}
		</View>
	);
}

function getCategoryIcon(categoryName) {
	return {
		makanan: '🍴',
		transport: '🚌',
		pendidikan: '📘',
		hiburan: '🎮',
	}[categoryName.toLocaleLowerCase('id-ID')] ?? '•';
}

function ExpenseRow({ expense, categories, onPress }) {
	const categoryName = getCategoryName(expense, categories);
	const categoryIcon = getCategoryIcon(categoryName);

	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			style={({ pressed }) => [styles.expenseRow, pressed && styles.expenseRowPressed]}
		>
			<View style={styles.categoryIconWrap}>
				<Text style={styles.categoryIcon}>{categoryIcon}</Text>
			</View>
			<View style={styles.rowMain}>
				<Text numberOfLines={1} style={styles.expenseTitle}>{expense.judul}</Text>
				<Text style={styles.expenseAmount}>{formatRupiah(expense.nominal)}</Text>
				<Text style={styles.categoryBadge}>{categoryName}</Text>
			</View>
			<View style={styles.rowTrailing}>
				<Text style={styles.expenseDate}>{formatTanggal(expense.tanggal)}</Text>
				<Text style={styles.rowChevron}>›</Text>
			</View>
		</Pressable>
	);
}

export default function App() {
	const searchInputRef = useRef(null);
	const [expenses, setExpenses] = useState([]);
	const [categories, setCategories] = useState([]);
	const [screen, setScreen] = useState('list');
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState('');
	const [actionError, setActionError] = useState('');
	const [search, setSearch] = useState('');
	const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORIES_FILTER);
	const [selectedExpense, setSelectedExpense] = useState(null);
	const [formMode, setFormMode] = useState('create');
	const [form, setForm] = useState(EMPTY_FORM);
	const [formErrors, setFormErrors] = useState({});
	const [submitting, setSubmitting] = useState(false);
	const [deleteConfirmationVisible, setDeleteConfirmationVisible] = useState(false);
	const [deleting, setDeleting] = useState(false);

	async function loadData(showLoading = true) {
		if (showLoading) setLoading(true);
		setLoadError('');
		try {
			const categoryRequest = getCategories().catch(() => null);
			const [expenseData, categoryData] = await Promise.all([getExpenses(), categoryRequest]);
			setExpenses(expenseData);
			if (categoryData !== null) setCategories(categoryData);
			return true;
		} catch (error) {
			if (showLoading) setLoadError(error.message);
			else setActionError(`Data berubah di server, tetapi daftar gagal diperbarui: ${error.message}`);
			return false;
		} finally {
			if (showLoading) setLoading(false);
		}
	}

	useEffect(() => {
		loadData();
	}, []);

	const filteredExpenses = expenses.filter(expense => {
		const selectedCategory = categories.find(item => String(item.id) === String(categoryFilter));
		const matchesCategory = categoryFilter === ALL_CATEGORIES_FILTER
			|| String(expense.id_kategori) === String(categoryFilter)
			|| (selectedCategory && getCategoryName(expense, categories) === selectedCategory.nama);
		const query = search.trim().toLocaleLowerCase('id-ID');
		const matchesSearch = !query || String(expense.judul ?? '').toLocaleLowerCase('id-ID').includes(query);
		return matchesCategory && matchesSearch;
	});

	function startCreate() {
		setActionError('');
		setFormMode('create');
		setSelectedExpense(null);
		setForm(EMPTY_FORM);
		setFormErrors({});
		setScreen('form');
	}

	function startEdit() {
		if (!selectedExpense) return;
		setActionError('');
		setFormMode('edit');
		setForm({
			judul: selectedExpense.judul ?? '',
			nominal: String(selectedExpense.nominal ?? ''),
			id_kategori: selectedExpense.id_kategori ?? null,
			catatan: selectedExpense.catatan ?? '',
		});
		setFormErrors({});
		setScreen('form');
	}

	function openDetail(expense) {
		const expenseId = Number(expense?.id);
		if (!Number.isInteger(expenseId) || expenseId <= 0) {
			setActionError('ID pengeluaran tidak valid');
			return;
		}

		setActionError('');
		setSelectedExpense({
			...expense,
			id_kategori: expense.id_kategori ?? categories.find(category => category.nama === expense.kategori)?.id ?? null,
		});
		setScreen('detail');
	}

	function updateForm(field, value) {
		setForm(current => ({ ...current, [field]: value }));
		setFormErrors(current => ({ ...current, [field]: '' }));
		setActionError('');
	}

	async function submitForm() {
		if (submitting) return;
		Keyboard.dismiss();
		const errors = {};
		const judul = form.judul.trim();
		const nominal = Number(form.nominal);
		if (!judul) errors.judul = 'Judul wajib diisi';
		if (!form.nominal.trim() || !Number.isFinite(nominal) || nominal <= 0) {
			errors.nominal = 'Nominal harus berupa angka positif';
		}
		setFormErrors(errors);
		if (Object.keys(errors).length > 0) return;

		const payload = {
			judul,
			nominal,
			id_kategori: form.id_kategori == null ? null : Number(form.id_kategori),
			catatan: form.catatan.trim() || null,
		};

		setSubmitting(true);
		setActionError('');
		try {
			const saved = formMode === 'edit'
				? await updateExpense(selectedExpense.id, payload)
				: await createExpense(payload);
			setExpenses(current => [saved, ...current.filter(item => String(item.id) !== String(saved.id))]);
			setSearch('');
			setCategoryFilter(ALL_CATEGORIES_FILTER);
			setScreen('list');
			await loadData(false);
		} catch (error) {
			setActionError(error.message);
		} finally {
			setSubmitting(false);
		}
	}

	async function confirmDelete() {
		if (!selectedExpense || deleting) return;
		setDeleting(true);
		setActionError('');
		try {
			await deleteExpense(selectedExpense.id);
			setExpenses(current => current.filter(item => String(item.id) !== String(selectedExpense.id)));
			setDeleteConfirmationVisible(false);
			setSelectedExpense(null);
			setScreen('list');
			await loadData(false);
		} catch (error) {
			if (error.status === 404) {
				setDeleteConfirmationVisible(false);
				setSelectedExpense(null);
				setScreen('list');
				setActionError('Pengeluaran sudah tidak tersedia. Daftar telah diperbarui.');
				await loadData(false);
				return;
			}
			setActionError(error.message);
		} finally {
			setDeleting(false);
		}
	}

	const selectedCategoryName = form.id_kategori == null
		? 'Pilih kategori'
		: categories.find(item => String(item.id) === String(form.id_kategori))?.nama ?? 'Pilih kategori';

	if (loading) {
		return (
			<SafeAreaView style={styles.safeArea}>
				<StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
				<View style={styles.centerState}>
					<ActivityIndicator size="large" color={COLORS.green} />
					<Text style={styles.loadingText}>Memuat pengeluaran...</Text>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.safeArea}>
			<StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

			{screen === 'list' ? (
				<View style={styles.page}>
					<View style={styles.listHeader}>
						<Text style={styles.pageTitle}>Pengeluaran</Text>
						<View style={styles.headerActions}>
							<Pressable accessibilityRole="button" accessibilityLabel="Fokus pencarian" onPress={() => searchInputRef.current?.focus()} style={styles.headerAction}>
								<Text style={styles.headerActionText}>⌕</Text>
							</Pressable>
							<Pressable accessibilityRole="button" accessibilityLabel="Muat ulang" onPress={() => loadData()} style={styles.headerAction}>
								<Text style={styles.headerActionText}>↻</Text>
							</Pressable>
							<Pressable accessibilityRole="button" accessibilityLabel="Tambah pengeluaran" onPress={startCreate} style={styles.addButton}>
								<Text style={styles.addButtonSymbol}>+</Text>
							</Pressable>
						</View>
					</View>

					<View style={styles.searchBox}>
						<Text style={styles.searchMark}>⌕</Text>
						<TextInput
							ref={searchInputRef}
							value={search}
							onChangeText={setSearch}
							placeholder="Cari pengeluaran..."
							placeholderTextColor={COLORS.muted}
							accessibilityLabel="Cari pengeluaran"
							returnKeyType="search"
							style={styles.searchInput}
						/>
						{search ? <Pressable onPress={() => setSearch('')} hitSlop={8}><Text style={styles.clearSearch}>×</Text></Pressable> : null}
					</View>

					<View style={styles.filterBar}>
						<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterList}>
							<FilterChip
								label="Semua"
								selected={categoryFilter === ALL_CATEGORIES_FILTER}
								onPress={() => setCategoryFilter(ALL_CATEGORIES_FILTER)}
							/>
							{categories.map(category => (
								<FilterChip
									key={category.id}
									label={category.nama}
									selected={String(categoryFilter) === String(category.id)}
									onPress={() => setCategoryFilter(String(category.id))}
								/>
							))}
						</ScrollView>
					</View>

					{actionError ? <Text accessibilityRole="alert" style={styles.inlineError}>{actionError}</Text> : null}

					{loadError ? (
						<View style={styles.listState}>
							<Notice
								title="Gagal memuat data"
								description="Terjadi kesalahan saat mengambil data."
								actionLabel="Coba lagi"
								onAction={() => loadData()}
								tone="error"
								icon="!"
							/>
						</View>
					) : expenses.length === 0 ? (
						<View style={styles.listState}>
							<Notice
								title="Belum ada pengeluaran"
								description="Mulai dengan menambahkan pengeluaran baru."
								actionLabel="Tambah"
								onAction={startCreate}
							/>
						</View>
					) : filteredExpenses.length === 0 ? (
						<View style={styles.listState}>
							<Notice
								title="Data tidak ditemukan"
								description="Coba kata kunci lain yang lebih spesifik."
								actionLabel="Kembali"
								onAction={() => {
									setSearch('');
									setCategoryFilter(ALL_CATEGORIES_FILTER);
								}}
								actionButtonStyle={styles.noticeReturnButton}
								icon="⌕"
							/>
						</View>
					) : (
						<FlatList
							data={filteredExpenses}
							keyExtractor={item => String(item.id)}
							renderItem={({ item }) => (
								<ExpenseRow expense={item} categories={categories} onPress={() => openDetail(item)} />
							)}
							contentContainerStyle={styles.expenseList}
							keyboardShouldPersistTaps="handled"
							showsVerticalScrollIndicator={false}
						/>
					)}

					<View style={styles.bottomNavigation} accessibilityRole="tablist">
						<NavigationItem label="Beranda" icon="⌂" selected />
						<NavigationItem label="Kategori" icon="▦" />
						<NavigationItem label="Profil" icon="○" />
					</View>
				</View>
			) : null}

			{screen === 'form' ? (
				<KeyboardAvoidingView
					style={styles.page}
					behavior={Platform.OS === 'ios' ? 'padding' : undefined}
					keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
				>
					<ScreenHeader title={formMode === 'edit' ? 'Ubah Pengeluaran' : 'Tambah Pengeluaran'} onBack={() => setScreen(formMode === 'edit' ? 'detail' : 'list')} />
					<ScrollView
						contentContainerStyle={styles.formContent}
						keyboardShouldPersistTaps="handled"
						showsVerticalScrollIndicator={false}
					>
						{actionError ? <Text accessibilityRole="alert" style={styles.inlineError}>{actionError}</Text> : null}

						<Text style={styles.fieldLabel}>Judul <Text style={styles.required}>*</Text></Text>
						<TextInput
							value={form.judul}
							onChangeText={value => updateForm('judul', value)}
							placeholder="Masukkan judul pengeluaran"
							placeholderTextColor={COLORS.muted}
							accessibilityLabel="Judul"
							returnKeyType="next"
							maxLength={100}
							style={[styles.input, formErrors.judul && styles.inputError]}
						/>
						{formErrors.judul ? <Text style={styles.fieldError}>{formErrors.judul}</Text> : null}

						<Text style={styles.fieldLabel}>Nominal <Text style={styles.required}>*</Text></Text>
						<View style={[styles.amountInputWrap, formErrors.nominal && styles.inputError]}>
							<TextInput
								value={form.nominal}
								onChangeText={value => updateForm('nominal', value)}
								placeholder="Masukkan nominal (contoh: 20000)"
								placeholderTextColor={COLORS.muted}
								accessibilityLabel="Nominal"
								keyboardType="decimal-pad"
								returnKeyType="done"
								style={styles.amountInput}
							/>
						</View>
						{formErrors.nominal ? <Text style={styles.fieldError}>{formErrors.nominal}</Text> : null}

						<Text style={styles.fieldLabel}>Kategori</Text>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={`Kategori: ${selectedCategoryName}`}
							onPress={() => setScreen('categories')}
							style={styles.pickerTrigger}
						>
							<Text style={[styles.pickerValue, form.id_kategori == null && styles.mutedValue]}>{selectedCategoryName}</Text>
							<Text style={styles.pickerChevron}>⌄</Text>
						</Pressable>

						<Text style={styles.fieldLabel}>Catatan <Text style={styles.optional}>(opsional)</Text></Text>
						<TextInput
							value={form.catatan}
							onChangeText={value => updateForm('catatan', value)}
							placeholder="Tulis catatan..."
							placeholderTextColor={COLORS.muted}
							accessibilityLabel="Catatan"
							multiline
							textAlignVertical="top"
							style={[styles.input, styles.noteInput]}
						/>

						<View style={styles.formButtonWrap}>
							<ActionButton
								label="Simpan"
								onPress={submitForm}
								disabled={submitting}
							/>
						</View>
					</ScrollView>
				</KeyboardAvoidingView>
			) : null}

			{screen === 'categories' ? (
				<View style={styles.page}>
					<ScreenHeader title="Pilih Kategori" onBack={() => setScreen('form')} />
					<ScrollView style={styles.categoryPageOptions}>
						<CategoryOption label="Tanpa kategori" selected={form.id_kategori == null} onPress={() => updateForm('id_kategori', null)} />
						{categories.map(category => (
							<CategoryOption
								key={category.id}
								label={category.nama}
								selected={String(form.id_kategori) === String(category.id)}
								onPress={() => updateForm('id_kategori', category.id)}
							/>
						))}
					</ScrollView>
					<ActionButton label="Pilih" onPress={() => setScreen('form')} />
				</View>
			) : null}

			{screen === 'detail' ? (
				<View style={styles.page}>
					<ScreenHeader title="Detail Pengeluaran" onBack={() => setScreen('list')} />
					{selectedExpense ? (
						<ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
							{actionError ? <Text accessibilityRole="alert" style={styles.inlineError}>{actionError}</Text> : null}
							<View style={styles.detailCard}>
								<View style={styles.detailSummary}>
									<View style={styles.categoryIconWrap}>
										<Text style={styles.categoryIcon}>{getCategoryIcon(getCategoryName(selectedExpense, categories))}</Text>
									</View>
									<View style={styles.detailSummaryText}>
										<Text style={styles.detailTitle}>{selectedExpense.judul}</Text>
										<Text style={styles.detailAmount}>{formatRupiah(selectedExpense.nominal)}</Text>
									</View>
								</View>
								<Text style={styles.detailCategoryBadge}>{getCategoryName(selectedExpense, categories)}</Text>
								<View style={styles.detailFields}>
								<DetailField label="Kategori" value={getCategoryName(selectedExpense, categories)} />
								<DetailField label="Tanggal" value={formatTanggal(selectedExpense.tanggal)} />
								<DetailField label="Catatan" value={selectedExpense.catatan?.trim() || '-'} last />
								</View>
							</View>
							<View style={styles.detailActions}>
								<ActionButton label="Ubah" onPress={startEdit} variant="secondary" />
								<ActionButton label="Hapus" onPress={() => setDeleteConfirmationVisible(true)} variant="danger" />
							</View>
						</ScrollView>
					) : null}
				</View>
			) : null}

			<Modal
				transparent
				visible={deleteConfirmationVisible}
				animationType="fade"
				onRequestClose={() => !deleting && setDeleteConfirmationVisible(false)}
			>
				<View style={styles.modalOverlay}>
					<Pressable
						style={StyleSheet.absoluteFill}
						disabled={deleting}
						onPress={() => setDeleteConfirmationVisible(false)}
					/>
					<View style={styles.confirmCard}>
						<Text style={styles.confirmIcon}>!</Text>
						<Text style={styles.modalTitle}>Hapus pengeluaran ini?</Text>
						<Text style={styles.confirmDescription}>Data yang dihapus tidak dapat dikembalikan.</Text>
						{actionError ? <Text accessibilityRole="alert" style={styles.inlineError}>{actionError}</Text> : null}
						<View style={styles.confirmActions}>
							<ActionButton
								label="Batal"
								variant="secondary"
								disabled={deleting}
								onPress={() => setDeleteConfirmationVisible(false)}
							/>
							<ActionButton label="Hapus" variant="danger" loading={deleting} disabled={deleting} onPress={confirmDelete} />
						</View>
					</View>
				</View>
			</Modal>

			<Modal transparent visible={submitting} animationType="fade">
				<View style={styles.savingOverlay}>
					<View style={styles.savingCard}>
						<ActivityIndicator color={COLORS.green} />
						<Text style={styles.savingText}>Menyimpan...</Text>
					</View>
				</View>
			</Modal>
		</SafeAreaView>
	);
}

function FilterChip({ label, selected, onPress }) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected }}
			onPress={onPress}
			style={[styles.filterChip, selected && styles.filterChipSelected]}
		>
			<Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text>
		</Pressable>
	);
}

function CategoryOption({ label, selected, onPress }) {
	return (
		<Pressable accessibilityRole="button" onPress={onPress} style={styles.categoryOption}>
			<Text style={styles.categoryOptionText}>{label}</Text>
			<View style={[styles.radio, selected && styles.radioSelected]}>
				{selected ? <View style={styles.radioDot} /> : null}
			</View>
		</Pressable>
	);
}

function NavigationItem({ label, icon, selected = false }) {
	return (
		<View style={styles.navigationItem} accessibilityRole="tab" accessibilityState={{ selected }}>
			<Text style={[styles.navigationIcon, selected && styles.navigationLabelSelected]}>{icon}</Text>
			<Text style={[styles.navigationLabel, selected && styles.navigationLabelSelected]}>{label}</Text>
		</View>
	);
}

function DetailField({ label, value, last = false }) {
	return (
		<View style={[styles.detailField, last && styles.detailFieldLast]}>
			<Text style={styles.detailLabel}>{label}</Text>
			<Text style={styles.detailValue}>{value}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	safeArea: { flex: 1, backgroundColor: COLORS.background },
	page: { flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 0 },
	listHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
	pageTitle: { color: COLORS.ink, fontSize: 21, fontWeight: '700' },
	headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
	headerAction: { width: 28, height: 38, alignItems: 'center', justifyContent: 'center' },
	headerActionText: { color: COLORS.ink, fontSize: 23, lineHeight: 28 },
	addButton: { width: 38, height: 38, borderRadius: 20, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },
	addButtonSymbol: { color: COLORS.surface, fontSize: 24, lineHeight: 28, fontWeight: '400' },
	searchBox: { height: 44, borderWidth: 1, borderColor: COLORS.line, borderRadius: 9, backgroundColor: COLORS.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11 },
	searchMark: { color: COLORS.muted, fontSize: 20, marginRight: 7, lineHeight: 24 },
	searchInput: { flex: 1, height: 42, fontSize: 14, color: COLORS.ink, paddingVertical: 6 },
	clearSearch: { color: COLORS.muted, fontSize: 22, paddingHorizontal: 3 },
	filterBar: { height: 54, flexShrink: 0 },
	filterScroll: { height: 54, flexGrow: 0 },
	filterList: { height: 54, flexDirection: 'row', alignItems: 'center', gap: 7 },
	filterChip: { width: 110, height: 34, flexShrink: 0, borderRadius: 17, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line },
	filterChipSelected: { backgroundColor: COLORS.green, borderColor: COLORS.green },
	filterChipText: { fontSize: 12, lineHeight: 16, color: COLORS.ink, fontWeight: '500' },
	filterChipTextSelected: { color: COLORS.surface },
	expenseList: { paddingTop: 1, paddingBottom: 12, gap: 10 },
	expenseRow: { minHeight: 81, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.surface, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.line },
	expenseRowPressed: { opacity: 0.76 },
	categoryIconWrap: { width: 43, height: 43, borderRadius: 22, backgroundColor: '#EAF4FA', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
	categoryIcon: { fontSize: 19 },
	rowMain: { flex: 1, minWidth: 0, paddingRight: 5 },
	expenseTitle: { color: COLORS.ink, fontSize: 14, fontWeight: '700', marginBottom: 2 },
	expenseAmount: { color: COLORS.ink, fontSize: 14, fontWeight: '700', marginBottom: 3 },
	categoryBadge: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 5, backgroundColor: COLORS.greenSoft, color: COLORS.green, fontSize: 10, fontWeight: '600', paddingHorizontal: 6, paddingVertical: 2 },
	rowTrailing: { flexDirection: 'row', alignItems: 'center', gap: 7 },
	expenseDate: { color: COLORS.muted, fontSize: 10 },
	rowChevron: { color: COLORS.muted, fontSize: 20, lineHeight: 22 },
	bottomNavigation: { height: 62, borderTopWidth: 1, borderTopColor: '#E9EDF2', backgroundColor: COLORS.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginHorizontal: -16, paddingHorizontal: 22 },
	navigationItem: { flex: 1, height: 58, alignItems: 'center', justifyContent: 'center', gap: 2 },
	navigationIcon: { color: COLORS.muted, fontSize: 18, lineHeight: 21 },
	navigationLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '500' },
	navigationLabelSelected: { color: COLORS.green, fontWeight: '700' },
	button: { minHeight: 42, flex: 1, paddingHorizontal: 15, borderRadius: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
	noticeReturnButton: { flex: 0, height: 42, alignSelf: 'center' },
	button_primary: { backgroundColor: COLORS.green },
	button_secondary: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line },
	button_danger: { backgroundColor: COLORS.red },
	buttonPressed: { opacity: 0.78 },
	buttonDisabled: { opacity: 0.62 },
	buttonText: { fontSize: 14, fontWeight: '600' },
	buttonText_primary: { color: COLORS.surface },
	buttonText_secondary: { color: COLORS.ink },
	buttonText_danger: { color: COLORS.surface },
	noticeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 35 },
	noticeIcon: { color: '#99A8B7', fontSize: 42, lineHeight: 54, marginBottom: 12 },
	noticeIconError: { color: COLORS.red, fontSize: 43, fontWeight: '700' },
	noticeTitle: { color: COLORS.ink, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 5 },
	noticeDescription: { color: COLORS.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginBottom: 15 },
	listState: { flex: 1 },
	inlineError: { color: COLORS.red, backgroundColor: COLORS.redSoft, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, marginBottom: 8, fontSize: 12, lineHeight: 17 },
	screenHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
	backButton: { width: 24, height: 40, justifyContent: 'center', marginRight: 2 },
	backText: { color: COLORS.ink, fontSize: 31, lineHeight: 34, fontWeight: '400' },
	screenHeaderTitle: { color: COLORS.ink, fontSize: 18, fontWeight: '700' },
	formContent: { paddingBottom: 20 },
	fieldLabel: { color: COLORS.ink, fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 6 },
	required: { color: COLORS.red },
	optional: { color: COLORS.muted, fontWeight: '400' },
	input: { minHeight: 44, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, backgroundColor: COLORS.surface, color: COLORS.ink, paddingHorizontal: 11, paddingVertical: 9, fontSize: 13 },
	inputError: { borderColor: COLORS.red, borderWidth: 1 },
	fieldError: { color: COLORS.red, fontSize: 10, marginTop: 4 },
	amountInputWrap: { minHeight: 44, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, backgroundColor: COLORS.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11 },
	amountInput: { flex: 1, minHeight: 42, color: COLORS.ink, fontSize: 13, paddingVertical: 7 },
	pickerTrigger: { minHeight: 44, borderWidth: 1, borderColor: COLORS.line, borderRadius: 8, backgroundColor: COLORS.surface, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	pickerValue: { color: COLORS.ink, fontSize: 13 },
	mutedValue: { color: COLORS.muted },
	pickerChevron: { color: COLORS.muted, fontSize: 19 },
	noteInput: { minHeight: 64, paddingTop: 10 },
	formButtonWrap: { marginTop: 18 },
	categoryPageOptions: { flex: 1, marginTop: 4 },
	categoryOption: { minHeight: 44, borderBottomWidth: 1, borderBottomColor: COLORS.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 1 },
	categoryOptionText: { color: COLORS.ink, fontSize: 13 },
	radio: { width: 19, height: 19, borderWidth: 1.5, borderColor: '#CBD3DC', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
	radioSelected: { borderColor: COLORS.green },
	radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.green },
	centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
	loadingText: { color: COLORS.muted, fontSize: 13, marginTop: 12 },
	detailContent: { paddingBottom: 22 },
	detailCard: { padding: 12, borderRadius: 10, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line },
	detailSummary: { flexDirection: 'row', alignItems: 'center' },
	detailSummaryText: { flex: 1 },
	detailTitle: { color: COLORS.ink, fontSize: 15, fontWeight: '700', marginBottom: 1 },
	detailAmount: { color: COLORS.ink, fontSize: 17, fontWeight: '700' },
	detailCategoryBadge: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 9, backgroundColor: COLORS.greenSoft, color: COLORS.green, fontSize: 11, fontWeight: '600', paddingHorizontal: 9, paddingVertical: 4, marginTop: 10, marginBottom: 9 },
	detailFields: { borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 7 },
	detailField: { minHeight: 29, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
	detailFieldLast: { marginBottom: 1 },
	detailLabel: { color: COLORS.muted, fontSize: 12 },
	detailValue: { color: COLORS.ink, fontSize: 12, flexShrink: 1, textAlign: 'right' },
	detailActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
	modalOverlay: { flex: 1, backgroundColor: 'rgba(24, 33, 47, 0.38)', justifyContent: 'center', alignItems: 'center', padding: 22 },
	confirmCard: { width: '100%', backgroundColor: COLORS.surface, borderRadius: 12, padding: 20, alignItems: 'center' },
	confirmIcon: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: COLORS.redSoft, color: COLORS.red, textAlign: 'center', textAlignVertical: 'center', fontSize: 31, fontWeight: '700', marginBottom: 12 },
	modalTitle: { color: COLORS.ink, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
	confirmDescription: { color: COLORS.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginBottom: 16 },
	confirmActions: { width: '100%', flexDirection: 'row', gap: 9 },
	savingOverlay: { flex: 1, backgroundColor: 'rgba(24, 33, 47, 0.28)', justifyContent: 'center', alignItems: 'center', padding: 22 },
	savingCard: { minWidth: 106, minHeight: 78, borderRadius: 7, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
	savingText: { color: COLORS.muted, fontSize: 10 },
});