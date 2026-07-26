/**
 * config.js
 * Konfigurasi global aplikasi POS Warungan (Multi-Tenant Frontend)
 * Tidak boleh berisi logic bisnis. Hanya konstanta & helper baca/tulis konfigurasi.
 */

const CONFIG = {
  APP_NAME: 'Point of Sale Warungan',
  VERSION: '1.0.0',

  // URL Apps Script Registry PUSAT (satu-satunya backend yang alamatnya tetap/hardcode).
  // Registry ini menyimpan daftar semua warung: kode -> URL Apps Script masing-masing warung.
  // GANTI dengan URL deploy Apps Script Registry milikmu.
  REGISTRY_URL: 'https://script.google.com/macros/s/AKfycbwt8_hXCg5fT8zuoLJeAAKMHjS9t-3JwZvpY5j8QUW1K2ww0yPy9eZT9JEGjo4C3n0VrA/exec',

  // Diisi otomatis saat runtime dari Local Storage (hasil onboarding). Jangan diisi manual di sini.
  API_URL: null,
  WARUNG_CODE: null,
  WARUNG_NAME: null,

  // Tema default (akan ditimpa oleh Settings warung masing-masing setelah login)
  THEME_COLOR: '#b3261e',
  THEME_COLOR_HOVER: '#8f1e18',
  THEME_ACCENT: '#e07a1f',

  LOCAL_STORAGE_KEY: 'pos_warung_session'
};

// Key-key yang dipakai di Local Storage, dikelompokkan agar konsisten di seluruh app
const STORAGE_KEYS = {
  API_URL: 'pos_api_url',
  WARUNG_CODE: 'pos_warung_code',
  WARUNG_NAME: 'pos_warung_name',
  USER: 'pos_user',
  THEME: 'pos_theme'
};

/**
 * Memuat konfigurasi tersimpan (API_URL, kode warung, dst) dari Local Storage ke CONFIG.
 * Dipanggil sekali saat aplikasi pertama kali dibuka (sebelum render App).
 * Return true jika warung sudah pernah terhubung (API_URL tersedia), false jika belum (perlu onboarding).
 */
function loadStoredConfig() {
  try {
    const apiUrl = localStorage.getItem(STORAGE_KEYS.API_URL);
    const warungCode = localStorage.getItem(STORAGE_KEYS.WARUNG_CODE);
    const warungName = localStorage.getItem(STORAGE_KEYS.WARUNG_NAME);

    if (apiUrl) {
      CONFIG.API_URL = apiUrl;
      CONFIG.WARUNG_CODE = warungCode || null;
      CONFIG.WARUNG_NAME = warungName || null;
      return true;
    }
    return false;
  } catch (e) {
    console.error('loadStoredConfig:', e);
    return false;
  }
}

/**
 * Menyimpan hasil onboarding (kode warung + API URL warung tersebut) ke Local Storage
 * dan meng-update CONFIG di memori. Dipanggil oleh api.js setelah Registry berhasil resolve kode warung.
 */
function saveWarungConnection(warungCode, apiUrl, warungName) {
  try {
    localStorage.setItem(STORAGE_KEYS.API_URL, apiUrl);
    localStorage.setItem(STORAGE_KEYS.WARUNG_CODE, warungCode);
    if (warungName) localStorage.setItem(STORAGE_KEYS.WARUNG_NAME, warungName);

    CONFIG.API_URL = apiUrl;
    CONFIG.WARUNG_CODE = warungCode;
    CONFIG.WARUNG_NAME = warungName || null;
    return true;
  } catch (e) {
    console.error('saveWarungConnection:', e);
    return false;
  }
}

/**
 * Menghapus koneksi warung dari Local Storage (mis. tombol "Ganti Warung" / logout total).
 * CONFIG.API_URL kembali null sehingga app menampilkan layar onboarding lagi.
 */
function clearWarungConnection() {
  try {
    localStorage.removeItem(STORAGE_KEYS.API_URL);
    localStorage.removeItem(STORAGE_KEYS.WARUNG_CODE);
    localStorage.removeItem(STORAGE_KEYS.WARUNG_NAME);
    localStorage.removeItem(STORAGE_KEYS.USER);

    CONFIG.API_URL = null;
    CONFIG.WARUNG_CODE = null;
    CONFIG.WARUNG_NAME = null;
  } catch (e) {
    console.error('clearWarungConnection:', e);
  }
}

/**
 * Helper generik untuk baca/tulis object (mis. data user login, tema tersimpan) ke Local Storage.
 * Dipakai oleh app.js & api.js agar tidak menulis JSON.parse/stringify berulang-ulang.
 */
function getStoredJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('getStoredJSON:', key, e);
    return null;
  }
}

function setStoredJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('setStoredJSON:', key, e);
    return false;
  }
}