import {
  fetchTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  fetchRatesFromCzk,
  convertToCzk,
} from './api.js';

// konstanty a klice localstorage
const STORAGE_THEME = 'theme';
const STORAGE_DRAFTS = 'transactionDrafts';
const STORAGE_CURRENCY = 'displayCurrency';
const STORAGE_TAB = 'activeTab';
const STORAGE_RATES = 'currencyRates';

const CURRENCIES = [
  { code: 'CZK', label: 'Kč – česká koruna', symbol: 'Kč' },
  { code: 'EUR', label: '€ – euro', symbol: '€' },
  { code: 'USD', label: '$ – americký dolar', symbol: '$' },
  { code: 'GBP', label: '£ – britská libra', symbol: '£' },
  { code: 'PLN', label: 'zł – polský zlotý', symbol: 'zł' },
  { code: 'CHF', label: 'CHF – švýcarský frank', symbol: 'CHF' },
  { code: 'HUF', label: 'Ft – maďarský forint', symbol: 'Ft' },
  { code: 'SEK', label: 'kr – švédská koruna', symbol: 'kr' },
];

const EXPENSE_CATEGORIES = ['Jídlo', 'Doprava', 'Zábava', 'Bydlení', 'Zdraví', 'Oblečení', 'Ostatní'];
const INCOME_CATEGORIES = ['Mzda', 'Freelance', 'Dárek', 'Prodej', 'Investice', 'Ostatní'];

const formTypes = { quick: 'expense', full: 'expense', edit: 'expense' };

const $ = (id) => document.getElementById(id);

// reference na prvky v dom
const els = {
  form: $('transaction-form'),
  quickForm: $('quick-form'),
  nameInput: $('name-input'),
  quickName: $('quick-name'),
  amountInput: $('amount-input'),
  amountError: $('amount-error'),
  quickAmount: $('quick-amount'),
  quickCategory: $('quick-category'),
  quickError: $('quick-error'),
  categorySelect: $('category-select'),
  balance: $('balance-amount'),
  balanceHint: $('balance-hint'),
  overviewIncome: $('overview-income'),
  overviewExpense: $('overview-expense'),
  overviewCount: $('overview-count'),
  list: $('transaction-list'),
  offlineStatus: $('offline-status'),
  appStatus: $('app-status'),
  menuToggle: $('menu-toggle'),
  headerMenu: $('header-menu'),
  menuBackdrop: $('menu-backdrop'),
  themeToggle: $('theme-toggle'),
  themeToggleLabel: $('theme-toggle-label'),
  currencySelect: $('currency-select'),
  chart: $('category-chart'),
  statsPeriod: $('stats-period'),
  statsType: $('stats-type'),
  statsChartType: $('stats-chart-type'),
  statsTotal: $('stats-total'),
  statsCount: $('stats-count'),
  statsAverage: $('stats-average'),
  statsLargest: $('stats-largest'),
  statsCategoryList: $('stats-category-list'),
  statsTransactionList: $('stats-transaction-list'),
  submitBtn: $('submit-btn'),
  quickSubmit: $('quick-submit'),
  currencySymbols: () => document.querySelectorAll('.js-currency-symbol'),
  typeToggleBtns: () => document.querySelectorAll('.type-toggle__btn'),
  tabButtons: document.querySelectorAll('.tabs__btn'),
  tabPanels: document.querySelectorAll('.tab-panel'),
  editSheet: $('edit-sheet'),
  editSheetBackdrop: $('edit-sheet-backdrop'),
  editForm: $('edit-form'),
  editName: $('edit-name'),
  editAmount: $('edit-amount'),
  editCategory: $('edit-category'),
  editError: $('edit-error'),
  editCancel: $('edit-cancel'),
  editSave: $('edit-save'),
  deleteDialog: $('delete-dialog'),
  deleteDialogBackdrop: $('delete-dialog-backdrop'),
  deleteDialogText: $('delete-dialog-text'),
  deleteCancel: $('delete-cancel'),
  deleteConfirm: $('delete-confirm'),
};

// stav aplikace data v pameti
let transactions = [];
let editingId = null;
let deletingId = null;
let displayCurrency = 'CZK';
let ratesFromCzk = { CZK: 1 };
let ratesSource = 'none';
let ratesDate = '';
let activeTab = 'overview';
let statsPeriod = 'all';
let statsType = 'expense';
let statsChartType = 'bar';
let scrollLockPadding = 0;

document.addEventListener('DOMContentLoaded', init);

// hodnota z localstorage nebo vychozi
function storageGet(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    setStatus('Prohlížeč blokuje localStorage – nastavení měny se neuloží.', 'warn');
    return false;
  }
}

function storageGetJson(key, fallback) {
  try {
    const raw = storageGet(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function storageSetJson(key, data) {
  return storageSet(key, JSON.stringify(data));
}

// nastaveni udalosti a start aplikace
function init() {
  buildCurrencySelect();
  setupTypeToggles();
  updateCategorySelect(els.categorySelect, formTypes.full);
  updateCategorySelect(els.quickCategory, formTypes.quick);
  updateCategorySelect(els.editCategory, formTypes.edit);

  loadSettings();
  loadRatesFromStorage();
  applyCurrencyUI();
  setupHeaderMenu();
  setupTxnModals();
  setupStatsControls();

  if (els.themeToggle) {
    els.themeToggle.addEventListener('click', toggleTheme);
    applyStoredTheme();
  }

  if (els.currencySelect) {
    els.currencySelect.addEventListener('change', onCurrencyChange);
  }

  if (els.form) els.form.addEventListener('submit', (e) => handleFormSubmit(e, 'full'));
  if (els.quickForm) els.quickForm.addEventListener('submit', (e) => handleFormSubmit(e, 'quick'));
  if (els.list) els.list.addEventListener('click', handleListClick);

  els.tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', updateConnectionUI);
  window.addEventListener('resize', () => {
    if (activeTab === 'stats') renderChart();
  });

  updateConnectionUI();
  bootstrap();
  registerServiceWorker();
}

function setupStatsControls() {
  els.statsPeriod?.addEventListener('change', () => {
    statsPeriod = els.statsPeriod.value;
    if (activeTab === 'stats') renderChart();
  });
  els.statsType?.addEventListener('change', () => {
    statsType = els.statsType.value;
    if (activeTab === 'stats') renderChart();
  });
  els.statsChartType?.addEventListener('change', () => {
    statsChartType = els.statsChartType.value;
    if (activeTab === 'stats') renderChart();
  });
}

function buildCurrencySelect() {
  if (!els.currencySelect) return;

  els.currencySelect.innerHTML = CURRENCIES.map(
    (c) => `<option value="${c.code}">${c.label}</option>`
  ).join('');
}

function setupHeaderMenu() {
  els.menuToggle?.addEventListener('click', () => {
    const open = els.headerMenu?.hidden;
    if (open) openHeaderMenu();
    else closeHeaderMenu();
  });

  els.menuBackdrop?.addEventListener('click', closeHeaderMenu);
}

// zamknuti scrollu pri otevrenem overlay
function syncBodyScrollLock() {
  const locked =
    (els.headerMenu && !els.headerMenu.hidden) ||
    (els.editSheet && !els.editSheet.hidden) ||
    (els.deleteDialog && !els.deleteDialog.hidden);

  if (locked) {
    if (!document.body.classList.contains('scroll-locked')) {
      scrollLockPadding = window.innerWidth - document.documentElement.clientWidth;
      document.body.classList.add('scroll-locked');
    }
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight =
      scrollLockPadding > 0 ? `${scrollLockPadding}px` : '';
    return;
  }

  document.body.classList.remove('scroll-locked');
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  scrollLockPadding = 0;
}

function closeTopOverlay() {
  if (els.deleteDialog && !els.deleteDialog.hidden) {
    closeDeleteDialog();
    return;
  }
  if (els.editSheet && !els.editSheet.hidden) {
    closeEditSheet();
    return;
  }
  if (els.headerMenu && !els.headerMenu.hidden) closeHeaderMenu();
}

function openHeaderMenu() {
  if (!els.headerMenu) return;
  els.headerMenu.hidden = false;
  els.menuBackdrop.hidden = false;
  els.menuToggle?.setAttribute('aria-expanded', 'true');
  els.menuToggle?.setAttribute('aria-label', 'Zavřít menu');
  syncBodyScrollLock();
}

function closeHeaderMenu() {
  if (!els.headerMenu) return;
  els.headerMenu.hidden = true;
  els.menuBackdrop.hidden = true;
  els.menuToggle?.setAttribute('aria-expanded', 'false');
  els.menuToggle?.setAttribute('aria-label', 'Otevřít menu');
  syncBodyScrollLock();
}

// modaly pro editaci a smazani transakce
function setupTxnModals() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTopOverlay();
  });

  els.editSheetBackdrop?.addEventListener('click', closeEditSheet);
  els.editCancel?.addEventListener('click', closeEditSheet);
  els.editForm?.addEventListener('submit', handleEditSubmit);

  els.deleteDialogBackdrop?.addEventListener('click', closeDeleteDialog);
  els.deleteCancel?.addEventListener('click', closeDeleteDialog);
  els.deleteConfirm?.addEventListener('click', confirmDelete);
}

function openEditSheet(id) {
  const item = transactions.find((t) => t.id === id);
  if (!item || !els.editSheet) return;

  editingId = id;
  const type = item.type || (item.amount >= 0 ? 'income' : 'expense');
  formTypes.edit = type;

  document.querySelectorAll('.type-toggle__btn[data-form-target="edit"]').forEach((b) => {
    b.classList.toggle('type-toggle__btn--active', b.dataset.type === type);
  });

  updateCategorySelect(els.editCategory, type, item.category);

  if (els.editName) els.editName.value = item.name || item.category;
  if (els.editAmount) {
    const displayVal = toDisplayAmount(Math.abs(item.amount));
    els.editAmount.value = String(Math.round(displayVal * 100) / 100);
  }
  if (els.editError) els.editError.textContent = '';

  els.editSheet.hidden = false;
  syncBodyScrollLock();
  els.editName?.focus();
}

function closeEditSheet() {
  if (!els.editSheet) return;
  editingId = null;
  els.editSheet.hidden = true;
  if (els.editError) els.editError.textContent = '';
  els.editForm?.reset();
  syncBodyScrollLock();
}

function openDeleteDialog(id) {
  const item = transactions.find((t) => t.id === id);
  if (!item || !els.deleteDialog) return;

  deletingId = id;
  const label = item.name || item.category;
  if (els.deleteDialogText) {
    els.deleteDialogText.textContent = `Opravdu smazat „${label}“? Tuto akci nelze vrátit zpět.`;
  }

  els.deleteDialog.hidden = false;
  syncBodyScrollLock();
  els.deleteCancel?.focus();
}

function closeDeleteDialog() {
  if (!els.deleteDialog) return;
  deletingId = null;
  els.deleteDialog.hidden = true;
  syncBodyScrollLock();
}

function setupTypeToggles() {
  els.typeToggleBtns().forEach((btn) => {
    btn.addEventListener('click', () => {
      const formKey = btn.dataset.formTarget;
      const type = btn.dataset.type;
      formTypes[formKey] = type;

      document
        .querySelectorAll(`.type-toggle__btn[data-form-target="${formKey}"]`)
        .forEach((b) => b.classList.toggle('type-toggle__btn--active', b === btn));

      const select =
        formKey === 'quick'
          ? els.quickCategory
          : formKey === 'edit'
            ? els.editCategory
            : els.categorySelect;
      const keepValue = select?.value || null;
      updateCategorySelect(select, type, keepValue);
    });
  });
}

function updateCategorySelect(selectEl, type, selectedValue = null) {
  if (!selectEl) return;
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const placeholder = type === 'income' ? 'Vyberte příjem' : 'Vyberte výdaj';
  let extra = '';
  if (selectedValue && !categories.includes(selectedValue)) {
    extra = `<option value="${escapeAttr(selectedValue)}">${escapeHtml(selectedValue)}</option>`;
  }
  selectEl.innerHTML =
    `<option value="">${placeholder}</option>` +
    extra +
    categories.map((c) => `<option value="${c}">${c}</option>`).join('');
  if (selectedValue) selectEl.value = selectedValue;
}

// ulozena mena a aktivni zalozka
function loadSettings() {
  const savedCurrency = storageGet(STORAGE_CURRENCY, 'CZK');
  if (CURRENCIES.some((c) => c.code === savedCurrency)) {
    displayCurrency = savedCurrency;
  }

  if (els.currencySelect) {
    els.currencySelect.value = displayCurrency;
  }

  const savedTab = storageGet(STORAGE_TAB, 'overview');
  if (['overview', 'add', 'stats', 'history'].includes(savedTab)) {
    activeTab = savedTab;
  }
  switchTab(activeTab, false);
}

function loadRatesFromStorage() {
  const cached = storageGetJson(STORAGE_RATES, null);
  if (cached?.rates && typeof cached.rates === 'object') {
    ratesFromCzk = { CZK: 1, ...cached.rates };
    ratesSource = cached.source || 'cache';
    ratesDate = cached.date || '';
  }
}

function saveRatesToStorage() {
  storageSetJson(STORAGE_RATES, {
    rates: ratesFromCzk,
    source: ratesSource,
    date: ratesDate,
    updatedAt: Date.now(),
  });
}

function hasValidDisplayRate() {
  if (displayCurrency === 'CZK') return true;
  const rate = ratesFromCzk[displayCurrency];
  return typeof rate === 'number' && rate > 0;
}

// mena pro zobrazeni podle dostupneho kurzu
function getEffectiveDisplayCurrency() {
  return hasValidDisplayRate() ? displayCurrency : 'CZK';
}

function onCurrencyChange() {
  displayCurrency = els.currencySelect.value;
  storageSet(STORAGE_CURRENCY, displayCurrency);
  applyCurrencyUI();
  render();
  fetchAndCacheRates();
}

function applyCurrencyUI() {
  const info = CURRENCIES.find((c) => c.code === displayCurrency) || CURRENCIES[0];
  const symbol = info.symbol;

  els.currencySymbols().forEach((el) => {
    el.textContent = symbol;
  });

  const placeholder = displayCurrency === 'CZK' ? '150' : '15';
  if (els.amountInput) els.amountInput.placeholder = placeholder;
  if (els.quickAmount) els.quickAmount.placeholder = placeholder;

  updateBalanceHint();
}

function updateBalanceHint() {
  if (!els.balanceHint) return;

  if (displayCurrency === 'CZK') {
    els.balanceHint.textContent = '';
    els.balanceHint.hidden = true;
    return;
  }

  els.balanceHint.hidden = false;

  if (!hasValidDisplayRate()) {
    els.balanceHint.textContent = 'Načítám kurz…';
    return;
  }

  const rate = ratesFromCzk[displayCurrency];
  const example = formatMoney(1000 * rate, false, displayCurrency);
  const sourceLabel =
    ratesSource === 'frankfurter'
      ? 'Aktuální kurz'
      : ratesSource === 'fallback'
        ? 'Orientační kurz'
        : 'Uložený kurz';

  let hint = `${sourceLabel} · 1 000 Kč ≈ ${example}`;
  if (ratesDate) {
    hint += ` (${ratesDate})`;
  }
  els.balanceHint.textContent = hint;
}

// kurzy men z api a cache
async function fetchAndCacheRates() {
  if (location.protocol === 'file:') return;

  try {
    const data = await fetchRatesFromCzk();
    ratesFromCzk = { CZK: 1, ...data.rates };
    ratesSource = data.source || 'api';
    ratesDate = data.date || '';
    saveRatesToStorage();
    updateBalanceHint();
    clearStatusIfType('warn');
    render();
  } catch {
    if (!hasValidDisplayRate() && displayCurrency !== 'CZK') {
      setStatus('Kurzy zatím v Kč. Spusťte server: npm start', 'warn');
    }
    updateBalanceHint();
    render();
  }
}

function switchTab(tabId, save = true) {
  activeTab = tabId;
  if (save) storageSet(STORAGE_TAB, tabId);

  els.tabButtons.forEach((btn) => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle('tabs__btn--active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  els.tabPanels.forEach((panel) => {
    const isActive = panel.dataset.panel === tabId;
    panel.classList.toggle('tab-panel--active', isActive);
    panel.hidden = !isActive;
  });

  if (tabId === 'stats') renderChart();
}

// prvotni nacteni transakci kurzu a draftu
async function bootstrap() {
  applyCurrencyUI();
  render();

  await loadTransactions();
  await fetchAndCacheRates();
  await syncDrafts();
}

function applyStoredTheme() {
  const theme = storageGet(STORAGE_THEME, 'light');
  document.documentElement.dataset.theme = theme;
  if (els.themeToggleLabel) {
    els.themeToggleLabel.textContent = theme === 'dark' ? 'Světlý režim' : 'Tmavý režim';
  }
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  storageSet(STORAGE_THEME, next);
  if (els.themeToggleLabel) {
    els.themeToggleLabel.textContent = next === 'dark' ? 'Světlý režim' : 'Tmavý režim';
  }
  if (activeTab === 'stats') renderChart();
}

function updateConnectionUI() {
  if (!els.offlineStatus) return;
  const online = navigator.onLine;
  els.offlineStatus.hidden = online;
  if (!online) {
    setStatus('Jste offline – nové transakce se uloží a odešlou po připojení.', 'warn');
  } else {
    clearStatusIfType('warn');
  }
}

async function onOnline() {
  updateConnectionUI();
  await fetchAndCacheRates();
  await syncDrafts();
}

function setStatus(message, type = 'error') {
  if (!els.appStatus) return;
  els.appStatus.textContent = message;
  els.appStatus.className = `app-status app-status--${type}`;
  els.appStatus.hidden = false;
}

function clearStatusIfType(type) {
  if (els.appStatus?.classList.contains(`app-status--${type}`)) {
    els.appStatus.hidden = true;
    els.appStatus.textContent = '';
  }
}

function setLoading(loading) {
  [els.submitBtn, els.quickSubmit].forEach((btn) => {
    if (!btn) return;
    btn.disabled = loading;
  });
  if (els.submitBtn) els.submitBtn.textContent = loading ? 'Ukládám…' : 'Přidat';
  if (els.quickSubmit) els.quickSubmit.textContent = loading ? 'Ukládám…' : 'Přidat';
}

// validace castky z formulare
function parseAmount(raw) {
  const trimmed = raw.trim().replace(/\s+/g, ' ').replace(',', '.');
  const match = trimmed.match(/^(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (value <= 0) return null;
  return { amount: value, currency: displayCurrency };
}

async function handleFormSubmit(event, mode) {
  event.preventDefault();

  const isQuick = mode === 'quick';
  const amountEl = isQuick ? els.quickAmount : els.amountInput;
  const categoryEl = isQuick ? els.quickCategory : els.categorySelect;
  const nameEl = isQuick ? els.quickName : els.nameInput;
  const errorEl = isQuick ? els.quickError : els.amountError;
  const type = formTypes[mode];

  errorEl.textContent = '';
  clearStatusIfType('error');

  const name = nameEl.value.trim();
  if (!name) {
    errorEl.textContent = 'Zadejte název položky.';
    return;
  }

  const parsed = parseAmount(amountEl.value);
  if (!parsed) {
    errorEl.textContent = 'Zadejte kladné číslo, např. 150 nebo 89.50';
    return;
  }

  const category = categoryEl.value;
  if (!category) {
    errorEl.textContent = 'Vyberte kategorii.';
    return;
  }

  setLoading(true);

  try {
    await addTransaction(parsed, category, name, type);
    if (isQuick) {
      els.quickForm.reset();
      nameEl.focus();
    } else {
      els.form.reset();
      formTypes.full = 'expense';
      document
        .querySelectorAll('.type-toggle__btn[data-form-target="full"]')
        .forEach((b) => b.classList.toggle('type-toggle__btn--active', b.dataset.type === 'expense'));
      updateCategorySelect(els.categorySelect, 'expense');
      switchTab('history');
    }
    clearStatusIfType('warn');
  } catch (err) {
    if (location.protocol === 'file:') {
      setStatus('Otevřete aplikaci přes server: npm start → http://localhost:3000', 'error');
    } else {
      errorEl.textContent = err.message || 'Uložení se nezdařilo.';
      setStatus('Backend neodpovídá. Spusťte: npm start', 'error');
    }
  } finally {
    setLoading(false);
  }
}

// nova transakce v kc pred odeslanim
async function addTransaction(parsed, category, name, type) {
  let amountCzk = parsed.amount;
  if (parsed.currency !== 'CZK') {
    amountCzk = await convertToCzk(parsed.amount, parsed.currency);
  }

  const payload = { name, type, amount: amountCzk, category };

  if (!navigator.onLine) {
    saveDraft(payload);
    setStatus(`Uloženo offline (${getDrafts().length} čeká na odeslání).`, 'warn');
    return;
  }

  const created = await createTransaction(payload);
  transactions.unshift(created);
  render();
}

// ulozeni transakce offline do fronty
function saveDraft(draft) {
  const drafts = getDrafts();
  drafts.push({ ...draft, createdAt: Date.now() });
  storageSet(STORAGE_DRAFTS, JSON.stringify(drafts));
}

function getDrafts() {
  return storageGetJson(STORAGE_DRAFTS, []);
}

async function syncDrafts() {
  if (!navigator.onLine) return;

  const drafts = getDrafts();
  if (!drafts.length) return;

  const remaining = [];
  let synced = 0;

  for (const draft of drafts) {
    try {
      const created = await createTransaction({
        name: draft.name || draft.category || 'Položka',
        type: draft.type || (draft.amount >= 0 ? 'income' : 'expense'),
        amount: Math.abs(draft.amount),
        category: draft.category,
      });
      transactions.unshift(created);
      synced++;
    } catch {
      remaining.push(draft);
    }
  }

  storageSet(STORAGE_DRAFTS, JSON.stringify(remaining));

  if (synced > 0) {
    render();
    setStatus(`Odesláno ${synced} offline transakcí.`, 'success');
    setTimeout(() => clearStatusIfType('success'), 3000);
  }
}

async function loadTransactions() {
  if (location.protocol === 'file:') {
    transactions = [];
    setStatus('Spusťte server (npm start) a otevřete http://localhost:3000', 'error');
    render();
    return;
  }

  try {
    transactions = await fetchTransactions();
    clearStatusIfType('error');
  } catch {
    transactions = [];
    setStatus('Nelze načíst transakce. Je spuštěný npm start?', 'error');
  }
  render();
}

// castka v zvolene mene pro ui
function toDisplayAmount(amountCzk) {
  const currency = getEffectiveDisplayCurrency();
  if (currency === 'CZK') return amountCzk;
  return amountCzk * ratesFromCzk[currency];
}

function getTransactionType(t) {
  if (t.type === 'income' || t.type === 'expense') return t.type;
  return Number(t.amount) >= 0 ? 'income' : 'expense';
}

// znamenko castky podle typu transakce
function getSignedAmount(t) {
  const abs = Math.abs(Number(t.amount));
  return getTransactionType(t) === 'income' ? abs : -abs;
}

// aktualizace vsech casti rozhrani
function render() {
  renderBalance();
  renderOverview();
  renderList();
  if (activeTab === 'stats') renderChart();
}

function renderBalance() {
  const total = transactions.reduce((sum, t) => sum + getSignedAmount(t), 0);
  els.balance.textContent = formatMoney(toDisplayAmount(total));
  els.balance.classList.toggle('balance__amount--negative', total < 0);
}

function renderOverview() {
  let income = 0;
  let expense = 0;

  for (const t of transactions) {
    const amt = Math.abs(Number(t.amount));
    if (getTransactionType(t) === 'income') income += amt;
    else expense += amt;
  }

  els.overviewIncome.textContent = formatMoney(toDisplayAmount(income));
  els.overviewExpense.textContent = formatMoney(toDisplayAmount(expense));
  els.overviewCount.textContent = String(transactions.length);
}

function renderList() {
  if (!transactions.length) {
    els.list.innerHTML =
      '<li class="transaction-list__empty">Zatím žádné transakce. Přidejte první v Přehledu nebo v záložce Přidat.</li>';
    return;
  }

  const sorted = [...transactions].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );

  els.list.innerHTML = sorted
    .map((t) => {
      const type = getTransactionType(t);
      const isIncome = type === 'income';
      const date = t.createdAt
        ? new Date(t.createdAt).toLocaleString('cs-CZ', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';
      const signedAmt = getSignedAmount(t);
      const displayAmt = toDisplayAmount(signedAmt);
      const storedHint =
        getEffectiveDisplayCurrency() !== 'CZK'
          ? formatMoney(signedAmt, false, 'CZK')
          : '';
      const dateAndStored = date && storedHint ? `${date} · ${storedHint}` : date || storedHint;

      const typeLabel = isIncome ? 'Příjem' : 'Výdaj';

      return `
        <li class="transaction-item" data-id="${escapeAttr(t.id)}">
          <div class="transaction-item__info">
            <div class="transaction-item__name">${escapeHtml(t.name || t.category)}</div>
            <div class="transaction-item__meta">${escapeHtml(t.category)}</div>
            <span class="transaction-item__badge transaction-item__badge--${type}">${typeLabel}</span>
            ${dateAndStored ? `<div class="transaction-item__meta">${dateAndStored}</div>` : ''}
          </div>
          <span class="transaction-item__amount transaction-item__amount--${isIncome ? 'income' : 'expense'}">
            ${formatMoney(displayAmt, true)}
          </span>
          <div class="transaction-item__actions">
            <button type="button" class="btn btn--small" data-action="edit">Upravit</button>
            <button type="button" class="btn btn--small btn--danger" data-action="delete">Smazat</button>
          </div>
        </li>
      `;
    })
    .join('');
}

// obsluha tlacitek v seznamu transakci
function handleListClick(event) {
  const btn = event.target.closest('[data-action]');
  if (!btn) return;

  const item = btn.closest('.transaction-item');
  if (!item) return;

  const id = item.dataset.id;
  if (btn.dataset.action === 'delete') openDeleteDialog(id);
  if (btn.dataset.action === 'edit') openEditSheet(id);
}

async function confirmDelete() {
  const id = deletingId;
  if (!id) return;

  if (els.deleteConfirm) {
    els.deleteConfirm.disabled = true;
    els.deleteConfirm.textContent = 'Mažu…';
  }

  try {
    await deleteTransaction(id);
    transactions = transactions.filter((t) => t.id !== id);
    closeDeleteDialog();
    render();
  } catch {
    setStatus('Smazání se nezdařilo.', 'error');
  } finally {
    if (els.deleteConfirm) {
      els.deleteConfirm.disabled = false;
      els.deleteConfirm.textContent = 'Smazat';
    }
  }
}

async function handleEditSubmit(event) {
  event.preventDefault();
  const id = editingId;
  if (!id) return;

  if (els.editError) els.editError.textContent = '';
  clearStatusIfType('error');

  const name = els.editName?.value.trim() ?? '';
  if (!name) {
    if (els.editError) els.editError.textContent = 'Zadejte název položky.';
    return;
  }

  const parsed = parseAmount(els.editAmount?.value ?? '');
  if (!parsed) {
    if (els.editError) els.editError.textContent = 'Zadejte kladné číslo, např. 150 nebo 89.50';
    return;
  }

  const category = els.editCategory?.value ?? '';
  if (!category) {
    if (els.editError) els.editError.textContent = 'Vyberte kategorii.';
    return;
  }

  const type = formTypes.edit;

  if (els.editSave) {
    els.editSave.disabled = true;
    els.editSave.textContent = 'Ukládám…';
  }

  try {
    let amountCzk = parsed.amount;
    if (displayCurrency !== 'CZK') {
      amountCzk = await convertToCzk(parsed.amount, displayCurrency);
    }

    const updated = await updateTransaction(id, {
      name,
      type,
      category,
      amount: amountCzk,
    });
    const index = transactions.findIndex((t) => t.id === id);
    transactions[index] = updated;
    closeEditSheet();
    render();
  } catch (err) {
    if (els.editError) els.editError.textContent = err.message || 'Úprava se nezdařila.';
    setStatus('Úprava se nezdařila.', 'error');
  } finally {
    if (els.editSave) {
      els.editSave.disabled = false;
      els.editSave.textContent = 'Uložit';
    }
  }
}

// transakce filtrovane podle obdobi statistik
function getStatsFilteredTransactions() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOf30Days = new Date(now);
  startOf30Days.setDate(startOf30Days.getDate() - 30);

  const minDate =
    statsPeriod === '30d'
      ? startOf30Days
      : statsPeriod === 'month'
        ? startOfMonth
        : statsPeriod === 'year'
          ? startOfYear
          : null;

  return transactions.filter((t) => {
    if (!minDate) return true;
    if (!t.createdAt) return false;
    return new Date(t.createdAt) >= minDate;
  });
}

function renderStatsLists(sortedCategories, relevantTransactions) {
  if (!els.statsCategoryList || !els.statsTransactionList) return;

  if (!sortedCategories.length) {
    els.statsCategoryList.innerHTML = '<li class="stats-list__empty">V tomto filtru nejsou data.</li>';
  } else {
    const total = sortedCategories.reduce((sum, item) => sum + item.value, 0);
    els.statsCategoryList.innerHTML = sortedCategories
      .slice(0, 6)
      .map((item) => {
        const share = total > 0 ? Math.round((item.value / total) * 100) : 0;
        return `
          <li class="stats-list__item">
            <span class="stats-list__label">${escapeHtml(item.category)} (${share} %)</span>
            <span class="stats-list__value">${formatMoney(item.value)}</span>
          </li>
        `;
      })
      .join('');
  }

  const topTx = [...relevantTransactions]
    .sort((a, b) => Math.abs(getSignedAmount(b)) - Math.abs(getSignedAmount(a)))
    .slice(0, 5);

  if (!topTx.length) {
    els.statsTransactionList.innerHTML = '<li class="stats-list__empty">V tomto filtru nejsou data.</li>';
  } else {
    els.statsTransactionList.innerHTML = topTx
      .map((t) => `
        <li class="stats-list__item">
          <span class="stats-list__label">${escapeHtml(t.name || t.category)}</span>
          <span class="stats-list__value">${formatMoney(toDisplayAmount(Math.abs(Number(t.amount))))}</span>
        </li>
      `)
      .join('');
  }
}

function renderStatsCards(total, count, largest) {
  if (!els.statsTotal || !els.statsCount || !els.statsAverage || !els.statsLargest) return;
  const average = count > 0 ? total / count : 0;
  els.statsTotal.textContent = formatMoney(total);
  els.statsCount.textContent = String(count);
  els.statsAverage.textContent = formatMoney(average);
  els.statsLargest.textContent = formatMoney(largest);
}

// vykresleni grafu statistik na canvas
function renderChart() {
  const canvas = els.chart;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const filtered = getStatsFilteredTransactions();
  const relevant =
    statsType === 'balance'
      ? filtered
      : filtered.filter((t) => getTransactionType(t) === statsType);
  const byCategory = {};

  for (const t of relevant) {
    const displayValue = Math.abs(toDisplayAmount(Number(t.amount)));
    byCategory[t.category] = (byCategory[t.category] || 0) + displayValue;
  }

  const sortedCategories = Object.entries(byCategory)
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value);
  const categories = sortedCategories.map((item) => item.category);
  const values = sortedCategories.map((item) => item.value);

  const statsTotal =
    statsType === 'balance'
      ? Math.abs(
          filtered.reduce((sum, t) => sum + toDisplayAmount(getSignedAmount(t)), 0)
        )
      : values.reduce((sum, v) => sum + v, 0);
  const largest = values.length ? Math.max(...values) : 0;
  renderStatsCards(statsTotal, relevant.length, largest);
  renderStatsLists(sortedCategories, relevant);

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || canvas.parentElement.clientWidth - 32;
  const cssHeight = 240;

  canvas.style.height = `${cssHeight}px`;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const muted = getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim();
  const text = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim();

  if (!categories.length) {
    ctx.fillStyle = muted || '#64748b';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Graf se zobrazí po přidání dat dle filtru.', cssWidth / 2, cssHeight / 2);
    return;
  }

  const max = Math.max(...values, 1);
  const padding = { left: 8, right: 8, bottom: 28, top: 12 };
  const chartW = cssWidth - padding.left - padding.right;
  const chartH = cssHeight - padding.top - padding.bottom;
  const barGap = 8;
  const barWidth = (chartW - barGap * (categories.length - 1)) / categories.length;
  const colors = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#ca8a04'];

  if (statsChartType === 'donut') {
    const centerX = cssWidth / 2;
    const centerY = cssHeight / 2;
    const radius = Math.min(chartW, chartH) / 2 - 8;
    const innerRadius = radius * 0.56;
    const total = values.reduce((sum, value) => sum + value, 0);
    let startAngle = -Math.PI / 2;

    values.forEach((value, i) => {
      const slice = total > 0 ? (value / total) * Math.PI * 2 : 0;
      const endAngle = startAngle + slice;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.fillStyle = colors[i % colors.length];
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();
      startAngle = endAngle;
    });

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.fillStyle = text || '#0f172a';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatMoney(values.reduce((sum, value) => sum + value, 0)), centerX, centerY);
  } else {
    categories.forEach((cat, i) => {
      const barH = (values[i] / max) * chartH;
      const x = padding.left + i * (barWidth + barGap);
      const y = padding.top + chartH - barH;

      ctx.fillStyle = colors[i % colors.length];
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, 4);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, barWidth, barH);
      }

      ctx.fillStyle = text || '#0f172a';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(cat.length > 10 ? `${cat.slice(0, 9)}…` : cat, x + barWidth / 2, cssHeight - 22);
    });
  }
}

function formatMoney(value, withSign = false, currency) {
  const code = currency || getEffectiveDisplayCurrency();
  const fraction = ['CZK', 'HUF'].includes(code) ? 0 : 2;

  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
    signDisplay: withSign ? 'exceptZero' : 'auto',
  }).format(value);
}

// bezpecny text v html sablonach
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

// service worker pro offline pwa
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
