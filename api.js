/**
 * api.js
 * Satu-satunya file yang boleh melakukan fetch() ke luar.
 * app.js WAJIB memanggil API.xxx() saja — tidak pernah fetch/google.script.run langsung.
 *
 * Pola komunikasi: semua request adalah POST dengan body JSON { action, payload: { args } }.
 * 'args' adalah array argumen posisional — PERSIS seperti argumen yang dulu dikirim ke
 * google.script.run.namaFungsi(arg1, arg2, ...). Ini sengaja dipertahankan supaya seluruh
 * fungsi Api.gs yang sudah ada TIDAK PERLU diubah signature-nya sama sekali (sesuai RULE:
 * jangan mengubah fitur yang sudah ada).
 *
 * Kenapa POST untuk semuanya (termasuk yang sifatnya "read"):
 *  - payload bisa berisi data besar (foto menu/logo base64) tanpa batas panjang URL seperti GET.
 *  - satu pola request/response yang konsisten, gampang di-maintain & di-debug.
 *  - Apps Script Web App hanya perlu satu entry point (doPost) untuk semua action.
 */

const API = (() => {

  // ── Indikator loading global (dipindah ke sini dari app.js lama, karena ini
  //    bagian dari siklus hidup network call, bukan bagian dari UI/React) ──────
  let _activeReqs = 0;
  function _syncLoadingIcon() {
    const el = document.getElementById('globalLoadingIcon');
    if (el) el.style.display = _activeReqs > 0 ? 'inline-block' : 'none';
  }

  // ── Core request handler ──────────────────────────────────────────────
  async function callUrl(baseUrl, action, args) {
    _activeReqs++; _syncLoadingIcon();
    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        // 'text/plain' dipakai supaya request jadi "simple request" tanpa CORS preflight,
        // yang wajib untuk Apps Script Web App. Body tetap JSON string biasa.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, payload: { args: args || [] } })
      });

      if (!res.ok) {
        return { success: false, message: `Server error (HTTP ${res.status})` };
      }
      return await res.json();
    } catch (e) {
      console.error('API call failed:', action, e);
      return { success: false, message: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.' };
    } finally {
      _activeReqs--; _syncLoadingIcon();
    }
  }

  // Panggil ke Apps Script warung yang sedang aktif (CONFIG.API_URL)
  function call(action, args) {
    if (!CONFIG.API_URL) {
      return Promise.resolve({ success: false, message: 'Belum terhubung ke warung manapun.' });
    }
    return callUrl(CONFIG.API_URL, action, args);
  }

  // Panggil ke Registry pusat (dipakai khusus untuk onboarding / resolve kode warung)
  function callRegistry(action, args) {
    return callUrl(CONFIG.REGISTRY_URL, action, args);
  }

  return {
    // Generic passthrough — dipakai untuk migrasi 1:1 dari serverCall(fn, ...args) lama.
    call,

    // ── Onboarding / Registry ────────────────────────────────────────────
    // Registry (project Apps Script terpisah) harus punya action 'resolveWarung'
    // yang mencari kode warung di sheet Registry dan mengembalikan { apiUrl, warungName }.
    async connectWarung(warungCode) {
      const res = await callRegistry('resolveWarung', [warungCode]);
      if (res.success && res.data && res.data.apiUrl) {
        saveWarungConnection(warungCode, res.data.apiUrl, res.data.warungName);
      }
      return res;
    },
    // Self-service: pemilik toko daftar sendiri setelah selesai Deploy Apps Script mereka.
    async registerWarung(code, apiUrl, warungName) {
      const res = await callRegistry('registerWarung', [{ code, apiUrl, warungName }]);
      if (res.success && res.data) {
        saveWarungConnection(res.data.code, res.data.apiUrl, res.data.warungName);
      }
      return res;
    },
    disconnectWarung() {
      clearWarungConnection();
    },

    // ── Utilitas file (dipakai untuk upload logo / gambar menu) ───────────
    fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error('Gagal membaca file'));
        reader.readAsDataURL(file);
      });
    },

    // ── Wrapper bernama untuk setiap action backend yang dipakai frontend ─
    // (Semuanya cuma delegasi ke call(), disediakan supaya app.js bisa menulis
    //  API.login(email, password) alih-alih API.call('login', [email, password]))
    addCategory: (...args) => call('addCategory', args),
  addCustomer: (...args) => call('addCustomer', args),
  addCustomerPayment: (...args) => call('addCustomerPayment', args),
  addExpense: (...args) => call('addExpense', args),
  addMenuItem: (...args) => call('addMenuItem', args),
  addPayment: (...args) => call('addPayment', args),
  addPurchase: (...args) => call('addPurchase', args),
  addSaleItem: (...args) => call('addSaleItem', args),
  addSupplier: (...args) => call('addSupplier', args),
  addUser: (...args) => call('addUser', args),
  bulkImportMenu: (...args) => call('bulkImportMenu', args),
  cancelSale: (...args) => call('cancelSale', args),
  changePassword: (...args) => call('changePassword', args),
  checkCategoryName: (...args) => call('checkCategoryName', args),
  checkMenuName: (...args) => call('checkMenuName', args),
  completeSale: (...args) => call('completeSale', args),
  deleteCategory: (...args) => call('deleteCategory', args),
  deleteCustomer: (...args) => call('deleteCustomer', args),
  deleteExpense: (...args) => call('deleteExpense', args),
  deleteMenuItem: (...args) => call('deleteMenuItem', args),
  deletePurchase: (...args) => call('deletePurchase', args),
  deleteSale: (...args) => call('deleteSale', args),
  deleteSupplier: (...args) => call('deleteSupplier', args),
  deleteUser: (...args) => call('deleteUser', args),
  getAvailableMenu: (...args) => call('getAvailableMenu', args),
  getCategories: (...args) => call('getCategories', args),
  getCategoriesForDropdown: (...args) => call('getCategoriesForDropdown', args),
  getCustomerLedger: (...args) => call('getCustomerLedger', args),
  getCustomers: (...args) => call('getCustomers', args),
  getCustomersForDropdown: (...args) => call('getCustomersForDropdown', args),
  getDashboardStats: (...args) => call('getDashboardStats', args),
  getExpenses: (...args) => call('getExpenses', args),
  getImportLogs: (...args) => call('getImportLogs', args),
  getLogs: (...args) => call('getLogs', args),
  getMenuItemDetail: (...args) => call('getMenuItemDetail', args),
  getMenuItems: (...args) => call('getMenuItems', args),
  getOverdueSummary: (...args) => call('getOverdueSummary', args),
  getPayments: (...args) => call('getPayments', args),
  getProfile: (...args) => call('getProfile', args),
  getPurchaseDetail: (...args) => call('getPurchaseDetail', args),
  getPurchases: (...args) => call('getPurchases', args),
  getReportsData: (...args) => call('getReportsData', args),
  getSaleDetail: (...args) => call('getSaleDetail', args),
  getSales: (...args) => call('getSales', args),
  getSettings: (...args) => call('getSettings', args),
  getSupplierLedger: (...args) => call('getSupplierLedger', args),
  getSuppliers: (...args) => call('getSuppliers', args),
  getSuppliersForDropdown: (...args) => call('getSuppliersForDropdown', args),
  getUsers: (...args) => call('getUsers', args),
  login: (...args) => call('login', args),
  removeBusinessLogo: (...args) => call('removeBusinessLogo', args),
  resetPassword: (...args) => call('resetPassword', args),
  returnSaleItem: (...args) => call('returnSaleItem', args),
  saveAllSettings: (...args) => call('saveAllSettings', args),
  saveBusinessLogo: (...args) => call('saveBusinessLogo', args),
  searchMenu: (...args) => call('searchMenu', args),
  sendForgotOTP: (...args) => call('sendForgotOTP', args),
  toggleCategoryStatus: (...args) => call('toggleCategoryStatus', args),
  toggleCustomerStatus: (...args) => call('toggleCustomerStatus', args),
  toggleMenuAvailability: (...args) => call('toggleMenuAvailability', args),
  toggleSupplierStatus: (...args) => call('toggleSupplierStatus', args),
  toggleUserStatus: (...args) => call('toggleUserStatus', args),
  updateCategory: (...args) => call('updateCategory', args),
  updateCustomer: (...args) => call('updateCustomer', args),
  updateExpense: (...args) => call('updateExpense', args),
  updateMenuItem: (...args) => call('updateMenuItem', args),
  updateMenuStock: (...args) => call('updateMenuStock', args),
  updateProfile: (...args) => call('updateProfile', args),
  updatePurchase: (...args) => call('updatePurchase', args),
  updateSale: (...args) => call('updateSale', args),
  updateSupplier: (...args) => call('updateSupplier', args),
  updateUser: (...args) => call('updateUser', args)
  };
})();