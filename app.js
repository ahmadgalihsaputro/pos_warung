/**
 * app.js
 * Seluruh React Application: semua Component, semua Page, semua State, semua Routing.
 * TIDAK ADA fetch() atau google.script.run di sini — semua request backend lewat API.xxx()
 * (lihat api.js). Ini hasil migrasi 1:1 dari index.html lama (React di dalam Apps Script),
 * tanpa mengubah fitur maupun alur — hanya dipindah + serverCall() diganti API.xxx(),
 * ditambah gerbang onboarding multi-tenant (OnboardingView + App root) di paling bawah file.
 *
 * CATATAN JUJUR (technical debt, sengaja tidak diubah pada refactor tahap ini):
 * Banyak komponen di bawah masih memakai inline `style={{...}}` pada JSX alih-alih class
 * dari style.css. Ini perilaku ASLI dari kode sebelumnya (bukan hal baru yang saya tambahkan).
 * Menghapus semuanya butuh menulis ulang ratusan tempat dan berisiko mengubah tampilan/fitur
 * yang sudah ada — bertentangan dengan RULE "jangan mengubah UI/fitur yang sudah ada".
 * Kalau kamu mau, ini bisa dirapikan bertahap per halaman di sesi berikutnya.
 */
// (serverCall/_activeReqs/_syncLoadingIcon dipindah ke api.js — network layer)

var _swrCache = {};
var _SWR_PFX = 'rpos_c_';
function swrGet(key) {
  if (_swrCache[key]) return _swrCache[key];
  try { var raw = localStorage.getItem(_SWR_PFX + key); if (!raw) return null; var entry = JSON.parse(raw); _swrCache[key] = entry.d; return entry.d; } catch(e) { return null; }
}
function swrSet(key, data) {
  _swrCache[key] = data;
  try { localStorage.setItem(_SWR_PFX + key, JSON.stringify({ d: data, t: Date.now() })); }
  catch(e) { try { swrClearStorage(); localStorage.setItem(_SWR_PFX + key, JSON.stringify({ d: data, t: Date.now() })); } catch(e2){} }
}
function swrClear(key) { if (key) { delete _swrCache[key]; try { localStorage.removeItem(_SWR_PFX + key); } catch(e){} } else { _swrCache = {}; swrClearStorage(); } }
function swrClearStorage() { try { var ks = Object.keys(localStorage); ks.forEach(function(k){ if(k.indexOf(_SWR_PFX)===0) localStorage.removeItem(k); }); } catch(e){} }


var _appSettings = {};
function _loadSettingsFromCache() { try { var c = localStorage.getItem('rpos_settings'); if (c) _appSettings = JSON.parse(c); } catch(e){} }
_loadSettingsFromCache();
function CS() { return _appSettings.currency_symbol || 'Rp'; }
function BN() { return _appSettings.business_name || 'Warung Sejahtera'; }
function fmtRp(n) { return CS() + ' ' + Math.round(n||0).toLocaleString('id-ID'); }

function applyThemeFromSettings(s) {
  s = s || {};
  var root = document.documentElement;
  var primary = s.theme_primary || '#b3261e';
  var hover = s.theme_primary_hover || '#8f1e18';
  var accent = s.theme_accent || '#e07a1f';
  
  root.style.setProperty('--brand', primary);
  root.style.setProperty('--brand-hover', hover);
  root.style.setProperty('--brand-accent', accent);
  root.style.setProperty('--navy', primary);
  root.style.setProperty('--navy-primary', primary);
  root.style.setProperty('--navy-dark', primary);
  root.style.setProperty('--navy-hover', hover);
  root.style.setProperty('--navy-accent', accent);
  root.style.setProperty('--info', accent);
}
applyThemeFromSettings(_appSettings);

function fmtDate(iso) { if (!iso) return '-'; return new Date(iso).toLocaleString('id-ID', { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' }); }
function fmtDateShort(iso) { if (!iso) return '-'; return new Date(iso).toLocaleDateString('id-ID', { year:'numeric', month:'short', day:'2-digit' }); }
function avatarUrl(fileId) { return fileId ? 'https://lh3.google.com/u/0/d/' + fileId : ''; }
function getInitials(name) { return (name || '').split(' ').map(function(n){return n[0]}).join('').substring(0,2).toUpperCase(); }

(function() {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function getStack() { var s = document.getElementById('rs-toast-stack'); if (!s) { s = document.createElement('div'); s.id='rs-toast-stack'; s.className='toast-stack'; document.body.appendChild(s); } return s; }
  function showToast(type, msg, timer) {
    var stack = getStack();
    var t = document.createElement('div');
    t.className = 'toast ' + (type || 'info');
    var icons = { success:'fa-check-circle', error:'fa-times-circle', warning:'fa-exclamation-triangle', info:'fa-info-circle', question:'fa-question-circle' };
    t.innerHTML = '<i class="fas ' + (icons[type]||icons.info) + ' toast-icon"></i><div class="toast-msg">' + esc(msg) + '</div><button class="toast-close" aria-label="Tutup"><i class="fas fa-times"></i></button>';
    stack.appendChild(t);
    var done = false;
    function remove() { if (done) return; done = true; t.classList.add('leaving'); setTimeout(function(){ if (t.parentNode) t.remove(); }, 200); }
    t.querySelector('.toast-close').addEventListener('click', remove);
    setTimeout(remove, timer || 2500);
    return remove;
  }
  function showDialog(opts) {
    return new Promise(function(resolve) {
      var icon = opts.icon || '';
      var iconMap = { success:'fa-check-circle', error:'fa-times-circle', warning:'fa-exclamation-triangle', question:'fa-question-circle', info:'fa-info-circle' };
      var iconHtml = icon ? '<div class="rs-popup-icon ' + esc(icon) + '"><i class="fas ' + (iconMap[icon]||'fa-info-circle') + '"></i></div>' : '';
      var titleHtml = opts.title ? '<div class="rs-popup-title">' + esc(opts.title) + '</div>' : '';
      var bodyHtml = '';
      if (opts.html != null) bodyHtml = '<div class="rs-popup-text">' + opts.html + '</div>';
      else if (opts.text) bodyHtml = '<div class="rs-popup-text">' + esc(opts.text) + '</div>';
      var isInput = !!opts.input;
      var inputHtml = '';
      if (isInput) {
        var attrs = opts.inputAttributes || {};
        var attrStr = Object.keys(attrs).map(function(k){ return k + '="' + esc(String(attrs[k])) + '"'; }).join(' ');
        var val = opts.inputValue != null ? esc(String(opts.inputValue)) : '';
        var ph = opts.inputPlaceholder ? ' placeholder="' + esc(opts.inputPlaceholder) + '"' : '';
        inputHtml = '<input type="' + esc(opts.input) + '" class="rs-popup-input" ' + attrStr + ph + ' value="' + val + '" /><div class="rs-popup-err"><i class="fas fa-exclamation-circle"></i> <span></span></div>';
      }
      var showCancel = !!opts.showCancelButton || isInput;
      var confirmText = opts.confirmButtonText || 'OK';
      var cancelText = opts.cancelButtonText || 'Batal';
      var confirmColor = opts.confirmButtonColor || '';
      var actionsHtml = '<div class="rs-popup-actions">' +
        (showCancel ? '<button class="btn btn-secondary rs-cancel">' + esc(cancelText) + '</button>' : '') +
        '<button class="btn btn-primary rs-confirm"' + (confirmColor ? ' style="background:' + esc(confirmColor) + ';border-color:' + esc(confirmColor) + '"' : '') + '>' + confirmText + '</button>' +
        '</div>';
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay rs-popup-overlay';
      overlay.innerHTML = '<div class="modal rs-popup"><div class="modal-body" style="padding:28px 28px 22px">' + iconHtml + titleHtml + bodyHtml + inputHtml + actionsHtml + '</div></div>';
      document.body.appendChild(overlay);
      var inputEl = isInput ? overlay.querySelector('.rs-popup-input') : null;
      var errEl = isInput ? overlay.querySelector('.rs-popup-err') : null;
      var errSpan = errEl ? errEl.querySelector('span') : null;
      if (inputEl) setTimeout(function(){ inputEl.focus(); if (inputEl.select) inputEl.select(); }, 60);
      var done = false;
      function close(result) { if (done) return; done = true; overlay.remove(); resolve(result); }
      function onConfirm() {
        if (isInput && opts.inputValidator) { var v = inputEl.value; var err = opts.inputValidator(v); if (err) { errSpan.textContent = err; errEl.classList.add('show'); return; } }
        close({ isConfirmed: true, isDismissed: false, value: isInput ? inputEl.value : true });
      }
      function onCancel() { close({ isConfirmed: false, isDismissed: true, isDenied: false, value: undefined }); }
      overlay.querySelector('.rs-confirm').addEventListener('click', onConfirm);
      var cancelBtn = overlay.querySelector('.rs-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
      overlay.addEventListener('click', function(e) { if (e.target === overlay) onCancel(); });
      document.addEventListener('keydown', function escListener(e) { if (done) { document.removeEventListener('keydown', escListener); return; } if (e.key === 'Escape') onCancel(); });
      if (inputEl) inputEl.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); onConfirm(); } if (errEl) { errEl.classList.remove('show'); } });
      if (opts.timer && !showCancel && !isInput) setTimeout(function(){ close({ isConfirmed:false, isDismissed:true, value:undefined }); }, opts.timer);
    });
  }
  window.Swal = window.Swal || {};
  window.Swal.fire = function(opts) {
    if (typeof opts === 'string') opts = { title: opts };
    opts = opts || {};
    if (opts.timer && opts.showConfirmButton === false && !opts.input && !opts.showCancelButton) {
      var msg = opts.text || opts.title || (opts.html ? String(opts.html).replace(/<[^>]+>/g,' ') : '');
      showToast(opts.icon || 'info', msg, opts.timer);
      return Promise.resolve({ isConfirmed:false, isDismissed:true });
    }
    return showDialog(opts);
  };
})();

var ROLE_LABELS = { admin:'Admin', manager:'Manajer', kasir:'Kasir' };
var ROLE_OPTIONS = [ { value:'admin', label:'Admin' }, { value:'manager', label:'Manajer' }, { value:'kasir', label:'Kasir' } ];
var ORDER_TYPE_LABELS = { dine_in:'Makan di Tempat', takeaway:'Bawa Pulang', delivery:'Antar' };
var PRESET_THEMES = [
  { name:'Merah Resto', primary:'#b3261e', hover:'#8f1e18', accent:'#e07a1f' },
  { name:'Hijau Alami', primary:'#1b6d3b', hover:'#14512c', accent:'#f2a71b' },
  { name:'Biru Navy', primary:'#001f3f', hover:'#002a52', accent:'#0074D9' },
  { name:'Ungu Elegan', primary:'#5b2a86', hover:'#451f68', accent:'#e0a11e' },
  { name:'Coklat Kopi', primary:'#5c3a21', hover:'#432a18', accent:'#d98324' },
  { name:'Hitam Modern', primary:'#1c1c1e', hover:'#000000', accent:'#e0a11e' }
];

const { useState, useEffect, useRef } = React;
function dtCleanup() { while ($.fn.dataTable.ext.search.length > 0) $.fn.dataTable.ext.search.pop(); }

/* ── SearchableDropdown ── */
function SearchableDropdown({ options, value, onChange, placeholder='Pilih...', label, icon, required=false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const selectedLabel = options.find(o => o.value === value)?.label || '';
  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) { setIsOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="form-group">
      {label && <label>{icon && <i className={icon}></i>} {label}{required && ' *'}</label>}
      <div className="searchable-dropdown" ref={ref}>
        <input type="text" className="searchable-dropdown-input" placeholder={placeholder} value={isOpen ? search : selectedLabel}
          onChange={(e) => { setSearch(e.target.value); if (!isOpen) setIsOpen(true); }}
          onClick={() => { setIsOpen(!isOpen); if (!isOpen) setSearch(''); }}
          required={required && !value} readOnly={false} />
        <span className={`searchable-dropdown-arrow ${isOpen ? 'open' : ''}`}><i className="fas fa-chevron-down"></i></span>
        {isOpen && (
          <div className="searchable-dropdown-list">
            <div className={`searchable-dropdown-item ${!value ? 'selected' : ''}`} onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}>{placeholder}</div>
            {filtered.length > 0 ? filtered.map((o, i) => (
              <div key={i} className={`searchable-dropdown-item ${value === o.value ? 'selected' : ''}`} onClick={() => { onChange(o.value); setIsOpen(false); setSearch(''); }}>{o.label}</div>
            )) : <div className="searchable-dropdown-item no-results">Tidak ada hasil</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, required, label, icon }) {
  const [show, setShow] = useState(false);
  return (
    <div className="form-group">
      {label && <label>{icon && <i className={icon}></i>} {label}</label>}
      <div className="pwd-wrapper">
        <input type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} required={required} />
        <button type="button" className="pwd-toggle" onClick={() => setShow(!show)}><i className={`fas ${show ? 'fa-eye-slash' : 'fa-eye'}`}></i></button>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange, label }) {
  return (
    <div className="form-group">
      {label && <label>{label}</label>}
      <div className="toggle-container" onClick={() => onChange(!checked)}>
        <div className={`toggle-track ${checked ? 'active' : ''}`}><div className="toggle-thumb"></div></div>
        <span className="toggle-label">{checked ? 'Aktif' : 'Nonaktif'}</span>
      </div>
    </div>
  );
}

function AvatarUpload({ existingFileId, onChange, label='Foto', icon='fas fa-camera', round=true }) {
  const [preview, setPreview] = useState(existingFileId ? avatarUrl(existingFileId) : '');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  useEffect(() => { if (existingFileId) setPreview(avatarUrl(existingFileId)); }, [existingFileId]);
  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) { Swal.fire({ icon:'warning', text:'Pilih berkas gambar' }); return; }
    if (file.size > 5 * 1024 * 1024) { Swal.fire({ icon:'warning', text:'Ukuran gambar maksimal 5MB' }); return; }
    const reader = new FileReader();
    reader.onload = (e) => { setPreview(e.target.result); onChange({ data: e.target.result.split(',')[1], name: file.name, type: file.type }); };
    reader.readAsDataURL(file);
  };
  const handleRemove = (e) => { e.stopPropagation(); setPreview(''); onChange(null, true); };
  const previewCls = round ? 'upload-preview' : 'img-preview-rect';
  return (
    <div className="form-group">
      <label><i className={icon}></i> {label}</label>
      <div className={`upload-zone ${dragOver ? 'dragover' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); }}
        onClick={() => inputRef.current?.click()}>
        {preview ? (
          <div style={{textAlign:'center'}}>
            <img src={preview} className={previewCls} alt={label} />
            <div><button type="button" className="btn btn-danger btn-sm" onClick={handleRemove}><i className="fas fa-trash"></i> Hapus</button></div>
          </div>
        ) : (
          <div style={{textAlign:'center'}}>
            <i className="fas fa-cloud-upload-alt" style={{fontSize:'36px', color:'#ccc', marginBottom:'10px', display:'block'}}></i>
            <p className="upload-hint">Seret & lepas atau klik untuk unggah</p>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" style={{display:'none'}} onChange={(e) => { if (e.target.files.length) handleFile(e.target.files[0]); }} />
      </div>
    </div>
  );
}

function TableSkeleton({ rows=5, columns=6 }) {
  return (<div className="skeleton-table"><div className="skeleton-table-row">{[...Array(columns)].map((_,i) => <div key={i} className="skeleton skeleton-table-cell" style={{flex:1}}></div>)}</div>{[...Array(rows)].map((_,r) => <div key={r} className="skeleton-table-row">{[...Array(columns)].map((_,c) => <div key={c} className="skeleton skeleton-table-cell" style={{flex:1}}></div>)}</div>)}</div>);
}
function DashboardCardSkeleton() { return (<div className="skeleton-card"><div className="skeleton skeleton-icon"></div><div className="skeleton skeleton-text-large" style={{width:'60%'}}></div><div className="skeleton skeleton-text" style={{width:'80%'}}></div></div>); }
function ChartSkeleton() { return <div className="chart-card"><div className="skeleton skeleton-chart"></div></div>; }

/* ── Login ── */
function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [direction, setDirection] = useState('forward');
  const [brandSettings, setBrandSettings] = useState(_appSettings || {});
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    API.getSettings().then(r => {
      if (r.success) {
        const next = r.data || {};
        _appSettings = next;
        try { localStorage.setItem('rpos_settings', JSON.stringify(next)); } catch(e) {}
        applyThemeFromSettings(next);
        setBrandSettings(next);
      }
    }).catch(() => {});
  }, []);

  const goTo = (m, dir) => { setDirection(dir || 'forward'); setError(''); setMode(m); };

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try { const r = await API.login(email, password); setLoading(false); if (r.success) onLogin(r.data); else setError(r.message); }
    catch (err) { setLoading(false); setError('Kesalahan koneksi. Coba lagi.'); }
  };
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError('Masukkan email Anda'); return; }
    setLoading(true); setError('');
    try { const r = await API.sendForgotOTP(email); setLoading(false); if (r.success) { Swal.fire({ icon:'success', text:'Kode terkirim — cek kotak masuk Anda', timer:1800, showConfirmButton:false }); goTo('reset', 'forward'); } else setError(r.message); }
    catch (err) { setLoading(false); setError('Gagal mengirim. Coba lagi.'); }
  };
  const handleResend = async () => {
    if (!email.trim()) return;
    setLoading(true); setError('');
    try { const r = await API.sendForgotOTP(email); setLoading(false); if (r.success) Swal.fire({ icon:'success', text:'Kode baru terkirim', timer:1500, showConfirmButton:false }); else setError(r.message); }
    catch (err) { setLoading(false); setError('Gagal mengirim ulang.'); }
  };
  const handleReset = async (e) => {
    e.preventDefault();
    if (otp.replace(/\s/g,'').length !== 6) { setError('Masukkan kode 6 digit'); return; }
    if (newPwd.length < 6) { setError('Kata sandi minimal 6 karakter'); return; }
    if (newPwd !== confirmPwd) { setError('Kata sandi tidak cocok'); return; }
    setLoading(true); setError('');
    try {
      const r = await API.resetPassword(email, otp.replace(/\s/g,''), newPwd);
      setLoading(false);
      if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:2200, showConfirmButton:false }); setOtp(''); setNewPwd(''); setConfirmPwd(''); setPassword(''); goTo('login', 'back'); }
      else setError(r.message);
    } catch (err) { setLoading(false); setError('Reset gagal. Coba lagi.'); }
  };

  const renderPanel = () => {
    if (mode === 'forgot') return (
      <form onSubmit={handleSendOtp}>
        <div className="login-info-pill"><i className="fas fa-key"></i> Reset Kata Sandi</div>
        <div className="login-subtitle" style={{marginBottom:'22px'}}>Masukkan email Anda, kami akan kirim kode 6 digit</div>
        <div className="form-group"><label><i className="fas fa-envelope"></i> Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anda@warungsejahtera.id" autoComplete="email" required autoFocus /></div>
        <button type="submit" className="login-btn" disabled={loading}>{loading ? <><i className="fas fa-spinner fa-spin"></i> Mengirim...</> : <><i className="fas fa-paper-plane"></i> Kirim Kode</>}</button>
        {error && <div className="login-error"><i className="fas fa-exclamation-circle"></i> {error}</div>}
        <div className="login-link-row center" style={{marginTop:'16px'}}><button type="button" className="login-link" onClick={() => goTo('login', 'back')}><i className="fas fa-arrow-left"></i> Kembali ke Login</button></div>
      </form>
    );
    if (mode === 'reset') return (
      <form onSubmit={handleReset}>
        <div className="login-info-pill"><i className="fas fa-shield-alt"></i> Verifikasi & Reset</div>
        <div className="login-subtitle" style={{marginBottom:'18px'}}>Masukkan kode 6 digit yang dikirim ke <strong style={{color:'var(--navy-primary)'}}>{email}</strong></div>
        <div className="form-group"><label><i className="fas fa-key"></i> Kode Verifikasi</label><input type="text" inputMode="numeric" maxLength="6" className="login-otp-input" value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0,6))} placeholder="000000" autoFocus required /></div>
        <div className="form-group"><label><i className="fas fa-lock"></i> Kata Sandi Baru</label><div className="pwd-wrapper"><input type={showNewPwd ? 'text' : 'password'} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Minimal 6 karakter" autoComplete="new-password" required /><button type="button" className="pwd-toggle" onClick={() => setShowNewPwd(!showNewPwd)}><i className={'fas ' + (showNewPwd ? 'fa-eye-slash' : 'fa-eye')}></i></button></div></div>
        <div className="form-group"><label><i className="fas fa-check-double"></i> Konfirmasi Kata Sandi</label><input type={showNewPwd ? 'text' : 'password'} value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Ulangi kata sandi" autoComplete="new-password" required /></div>
        <button type="submit" className="login-btn" disabled={loading}>{loading ? <><i className="fas fa-spinner fa-spin"></i> Mereset...</> : <><i className="fas fa-check-circle"></i> Reset Kata Sandi</>}</button>
        {error && <div className="login-error"><i className="fas fa-exclamation-circle"></i> {error}</div>}
        <div className="login-link-row" style={{marginTop:'14px'}}><button type="button" className="login-link" onClick={() => goTo('forgot', 'back')}><i className="fas fa-arrow-left"></i> Kembali</button><button type="button" className="login-link" onClick={handleResend} disabled={loading}><i className="fas fa-redo"></i> Kirim ulang</button></div>
      </form>
    );
    return (
      <form onSubmit={handleLogin}>
        <div className="login-subtitle">Masuk untuk melanjutkan ke dashboard Anda</div>
        <div className="form-group"><label><i className="fas fa-envelope"></i> Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anda@warungsejahtera.id" autoComplete="username" required /></div>
        <div className="form-group"><label><i className="fas fa-lock"></i> Kata Sandi</label><div className="pwd-wrapper"><input type={showPwd ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan kata sandi" autoComplete="current-password" required /><button type="button" className="pwd-toggle" onClick={() => setShowPwd(!showPwd)}><i className={'fas ' + (showPwd ? 'fa-eye-slash' : 'fa-eye')}></i></button></div></div>
        <button type="submit" className="login-btn" disabled={loading}>{loading ? <><i className="fas fa-spinner fa-spin"></i> Masuk...</> : <><i className="fas fa-sign-in-alt"></i> Masuk</>}</button>
        {error && <div className="login-error"><i className="fas fa-exclamation-circle"></i> {error}</div>}
        <div className="login-link-row center" style={{marginTop:'14px'}}><button type="button" className="login-link" onClick={() => goTo('forgot', 'forward')}><i className="fas fa-key"></i> Lupa Kata Sandi?</button></div>
      </form>
    );
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-logo-ico">
        {brandSettings.business_logo ? <img src={avatarUrl(brandSettings.business_logo)} className="login-logo-img" alt="Logo warung" /> : <i className="fas fa-utensils"></i>}
      </div>
        <h2>{BN()}</h2>
        <div className="login-panel-wrap"><div key={mode} className={'login-panel ' + direction}>{renderPanel()}</div></div>
        <div className="login-footer">Oleh Tanpa Sorotan</div>
      </div>
    </div>
  );
}

/* ── Onboarding (Multi-Tenant: pilih warung dulu sebelum login) ── */
function OnboardingView({ onConnected }) {
  const [mode, setMode] = useState('connect'); // 'connect' | 'register'

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-logo-ico"><i className="fas fa-utensils"></i></div>
        <h2>Point of Sale Warung</h2>
        {mode === 'connect'
          ? <ConnectWarungForm onConnected={onConnected} onSwitchMode={() => setMode('register')} />
          : <RegisterWarungForm onConnected={onConnected} onSwitchMode={() => setMode('connect')} />}
        <div className="login-footer">Oleh Tanpa Sorotan</div>
      </div>
    </div>
  );
}

function ConnectWarungForm({ onConnected, onSwitchMode }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true); setError('');
    try {
      const r = await API.connectWarung(code.trim());
      setLoading(false);
      if (r.success) { onConnected(); }
      else setError(r.message || 'Kode warung tidak ditemukan');
    } catch (err) {
      setLoading(false);
      setError('Tidak dapat terhubung ke server registry');
    }
  };

  return (
    <>
      <p className="login-subtitle">Masukkan Kode Warung untuk memulai</p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Kode Warung</label>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Misalnya TKB001" autoCapitalize="characters" required />
        </div>
        {error && <div className="rs-popup-err show" style={{marginBottom:'12px'}}><i className="fas fa-exclamation-circle"></i> <span>{error}</span></div>}
        <button type="submit" className="btn btn-primary" style={{width:'100%'}} disabled={loading}>
          {loading ? <><i className="fas fa-spinner fa-spin"></i> Menghubungkan...</> : <><i className="fas fa-link"></i> Hubungkan</>}
        </button>
      </form>
      <p style={{textAlign:'center', marginTop:'16px', fontSize:'14px'}}>
        Toko baru? <a href="#" onClick={(e) => { e.preventDefault(); onSwitchMode(); }}>Daftarkan warung di sini</a>
      </p>
    </>
  );
}

function RegisterWarungForm({ onConnected, onSwitchMode }) {
  const [warungName, setWarungName] = useState('');
  const [code, setCode] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!warungName.trim() || !code.trim() || !apiUrl.trim()) return;
    setLoading(true); setError('');
    try {
      const r = await API.registerWarung(code.trim(), apiUrl.trim(), warungName.trim());
      setLoading(false);
      if (r.success) { onConnected(); }
      else setError(r.message || 'Gagal mendaftarkan warung');
    } catch (err) {
      setLoading(false);
      setError('Tidak dapat terhubung ke server registry');
    }
  };

  return (
    <>
      <p className="login-subtitle">Daftarkan warung baru (sekali saja)</p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nama Warung</label>
          <input type="text" value={warungName} onChange={(e) => setWarungName(e.target.value)} placeholder="Misalnya Toko Baru" required />
        </div>
        <div className="form-group">
          <label>Kode Warung (bebas, buat sendiri)</label>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Misalnya TKB001" autoCapitalize="characters" required />
        </div>
        <div className="form-group">
          <label>Apps Script Web App URL</label>
          <input type="text" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" required />
          <small style={{color:'#888'}}>Didapat setelah kamu Deploy backend Apps Script di Google Sheet kamu sendiri (Deploy → New deployment → Web app).</small>
        </div>
        {error && <div className="rs-popup-err show" style={{marginBottom:'12px'}}><i className="fas fa-exclamation-circle"></i> <span>{error}</span></div>}
        <button type="submit" className="btn btn-primary" style={{width:'100%'}} disabled={loading}>
          {loading ? <><i className="fas fa-spinner fa-spin"></i> Memeriksa & mendaftarkan...</> : <><i className="fas fa-store"></i> Daftarkan Warung</>}
        </button>
      </form>
      <p style={{textAlign:'center', marginTop:'16px', fontSize:'14px'}}>
        Sudah punya warung terdaftar? <a href="#" onClick={(e) => { e.preventDefault(); onSwitchMode(); }}>Masukkan Kode Warung</a>
      </p>
    </>
  );
}

/* ── MainApp: login + dashboard untuk warung yang sudah terhubung ── */
function MainApp() {
  const SESSION_KEY = 'respos_session';
  const SESSION_HOURS = 24;
  const cached = React.useMemo(() => {
    try { const saved = localStorage.getItem(SESSION_KEY); if (!saved) return null; const d = JSON.parse(saved); if (d.expires && Date.now() > d.expires) { localStorage.removeItem(SESSION_KEY); return null; } return d.user || null; } catch(e) { return null; }
  }, []);
  const [isLoggedIn, setIsLoggedIn] = useState(!!cached);
  const [currentUser, setCurrentUser] = useState(cached);

  useEffect(() => {
    if (!cached) return;
    API.getProfile(cached.id).then(r => { if (r.success && r.data.is_active) setCurrentUser(r.data); else { setIsLoggedIn(false); setCurrentUser(null); localStorage.removeItem(SESSION_KEY); } }).catch(() => {});
  }, []);

  const handleLogin = (userData) => { setCurrentUser(userData); setIsLoggedIn(true); localStorage.setItem(SESSION_KEY, JSON.stringify({ id: userData.id, user: userData, expires: Date.now() + (SESSION_HOURS * 60 * 60 * 1000) })); };
  const handleLogout = () => { setIsLoggedIn(false); setCurrentUser(null); localStorage.removeItem(SESSION_KEY); swrClear(); };
  const handleSwitchWarung = () => { handleLogout(); API.disconnectWarung(); window.location.reload(); };

  return (<div>{!isLoggedIn ? <LoginPage onLogin={handleLogin} /> : <DashboardLayout user={currentUser} onLogout={handleLogout} onSwitchWarung={handleSwitchWarung} onUserUpdate={(d) => setCurrentUser(prev => ({...prev, ...d}))} />}</div>);
}

/* ── App Root: gerbang multi-tenant — tentukan warung sebelum render MainApp ── */
function App() {
  const [connected, setConnected] = useState(() => loadStoredConfig());
  if (!connected) return <OnboardingView onConnected={() => setConnected(true)} />;
  return <MainApp />;
}

/* ── DashboardLayout ── */
function DashboardLayout({ user, onLogout, onSwitchWarung, onUserUpdate }) {
  const isAdmin = user.role === 'admin';
  const isManager = user.role === 'manager';
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, setSettingsVer] = useState(0);

  useEffect(() => {
    API.getSettings().then(r => {
      if (r.success) { _appSettings = r.data; try { localStorage.setItem('rpos_settings', JSON.stringify(r.data)); } catch(e){} applyThemeFromSettings(r.data); setSettingsVer(v => v+1); }
    });
  }, []);
  const handleSettingsUpdate = (s) => { _appSettings = s; try { localStorage.setItem('rpos_settings', JSON.stringify(s)); } catch(e){} applyThemeFromSettings(s); setSettingsVer(v => v+1); };
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => { try { return localStorage.getItem('respos_sidebar') === 'collapsed'; } catch(e) { return false; } });
  const toggleCollapse = () => { const next = !sidebarCollapsed; setSidebarCollapsed(next); try { localStorage.setItem('respos_sidebar', next ? 'collapsed' : 'expanded'); } catch(e) {} };
  const [ledgerSupplierId, setLedgerSupplierId] = useState(null);
  const [detailPurchaseId, setDetailPurchaseId] = useState(null);
  const [ledgerCustomerId, setLedgerCustomerId] = useState(null);
  const navigate = (p) => { setActiveMenu(p); setSidebarOpen(false); if (p !== 'supplier_ledger') setLedgerSupplierId(null); if (p !== 'purchase_detail') setDetailPurchaseId(null); if (p !== 'customer_ledger') setLedgerCustomerId(null); };
  const openLedger = (suppId) => { setLedgerSupplierId(suppId); setActiveMenu('supplier_ledger'); };
  const openPurchaseDetail = (purId) => { setDetailPurchaseId(purId); setActiveMenu('purchase_detail'); };
  const openCustomerLedger = (custId) => { setLedgerCustomerId(custId); setActiveMenu('customer_ledger'); };

  const canSeeCategories = isAdmin || isManager;
  const canSeeSuppliers = isAdmin || isManager;
  const canSeePurchases = isAdmin || isManager;
  const canSeeCustomers = true;
  const canSeeSales = true;
  const canSeePayments = isAdmin || isManager;
  const canSeeExpenses = isAdmin || isManager;
  const canSeeImports = isAdmin || isManager;

  const pageLabels = { dashboard:'Dashboard', users:'Manajemen Pengguna', categories:'Kategori Menu', suppliers:'Supplier', supplier_ledger:'Kartu Hutang Supplier', purchases:'Pembelian Bahan Baku', purchase_detail:'Detail Pembelian', menu:'Menu', bulk_import:'Impor Massal Menu', customers:'Pelanggan', customer_ledger:'Kartu Piutang Pelanggan', pos:'Kasir / Pesanan Baru', sales:'Daftar Transaksi', payments:'Pembayaran', expenses:'Pengeluaran', due_reminders:'Pengingat Tagihan', reports:'Laporan', settings:'Pengaturan', account:'Akun Saya', logs:'Log Aktivitas', about:'Tentang Aplikasi' };
  const pageIcons = { dashboard:'fas fa-chart-line', users:'fas fa-users-cog', categories:'fas fa-th-large', suppliers:'fas fa-handshake', supplier_ledger:'fas fa-file-invoice-dollar', purchases:'fas fa-shopping-cart', purchase_detail:'fas fa-file-alt', menu:'fas fa-utensils', bulk_import:'fas fa-file-import', customers:'fas fa-user-friends', customer_ledger:'fas fa-file-invoice', pos:'fas fa-cash-register', sales:'fas fa-receipt', payments:'fas fa-money-bill-wave', expenses:'fas fa-receipt', due_reminders:'fas fa-bell', reports:'fas fa-chart-bar', settings:'fas fa-cog', account:'fas fa-user-circle', logs:'fas fa-history', about:'fas fa-info-circle' };

  return (
    <div className="app-container">
      <button className="mobile-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}><i className="fas fa-bars"></i></button>
      {sidebarOpen && <div className="sidebar-overlay show" onClick={() => setSidebarOpen(false)}></div>}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-brand" style={{padding: sidebarCollapsed ? '14px 8px' : '20px 24px', borderBottom:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'space-between', minHeight:'62px'}}>
          <div style={{color:'white', fontSize:'20px', fontWeight:'700', display:'flex', alignItems:'center', gap:'10px', minWidth:0}}>
            {_appSettings.business_logo ? <img src={avatarUrl(_appSettings.business_logo)} className="sidebar-brand-logo" alt="Logo warung" /> : <div className="sidebar-brand-logo placeholder"><i className="fas fa-utensils"></i></div>}
            {!sidebarCollapsed && <span className="sidebar-brand-text" style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{BN()}</span>}
          </div>
          <button className="sidebar-collapse-btn" onClick={toggleCollapse} title={sidebarCollapsed ? 'Perluas' : 'Perkecil'} style={sidebarCollapsed ? {margin:'0 auto'} : {}}><i className={`fas fa-chevron-${sidebarCollapsed ? 'right' : 'left'}`}></i></button>
        </div>
        <div className="sidebar-user-info">
          {user.avatar ? <img src={avatarUrl(user.avatar)} className="sidebar-avatar" alt="" /> : <div className="sidebar-avatar-initials">{getInitials(user.full_name)}</div>}
          <div className="sidebar-user-name">{user.full_name}</div>
          <div className="sidebar-user-role">{ROLE_LABELS[user.role] || user.role}</div>
        </div>
        <div className="sidebar-menu-section">
          <div className="sidebar-menu-title">Navigasi</div>
          <ul className="sidebar-menu">
            <li><button className={activeMenu==='dashboard'?'active':''} onClick={() => navigate('dashboard')}><i className="fas fa-chart-line"></i><span>Dashboard</span></button></li>
            {canSeeSales && <li><button className={activeMenu==='pos'?'active':''} onClick={() => navigate('pos')}><i className="fas fa-cash-register"></i><span>Kasir / Pesanan Baru</span></button></li>}
            {canSeeSales && <li><button className={activeMenu==='sales'?'active':''} onClick={() => navigate('sales')}><i className="fas fa-receipt"></i><span>Daftar Transaksi</span></button></li>}
            {canSeeCustomers && <li><button className={activeMenu==='customers'||activeMenu==='customer_ledger'?'active':''} onClick={() => navigate('customers')}><i className="fas fa-user-friends"></i><span>Pelanggan</span></button></li>}
            <li><button className={activeMenu==='menu'?'active':''} onClick={() => navigate('menu')}><i className="fas fa-utensils"></i><span>Menu</span></button></li>
            {canSeePurchases && <li><button className={activeMenu==='purchases'||activeMenu==='purchase_detail'?'active':''} onClick={() => navigate('purchases')}><i className="fas fa-shopping-cart"></i><span>Pembelian Bahan Baku</span></button></li>}
            {canSeeSuppliers && <li><button className={activeMenu==='suppliers'||activeMenu==='supplier_ledger'?'active':''} onClick={() => navigate('suppliers')}><i className="fas fa-handshake"></i><span>Supplier</span></button></li>}
            {canSeePayments && <li><button className={activeMenu==='payments'?'active':''} onClick={() => navigate('payments')}><i className="fas fa-money-bill-wave"></i><span>Pembayaran</span></button></li>}
            {canSeeExpenses && <li><button className={activeMenu==='expenses'?'active':''} onClick={() => navigate('expenses')}><i className="fas fa-receipt"></i><span>Pengeluaran</span></button></li>}
            <li><button className={activeMenu==='due_reminders'?'active':''} onClick={() => navigate('due_reminders')}><i className="fas fa-bell" style={{color: activeMenu==='due_reminders' ? '' : '#c62828'}}></i><span>Pengingat Tagihan</span></button></li>
            {(isAdmin || isManager) && <li><button className={activeMenu==='reports'?'active':''} onClick={() => navigate('reports')}><i className="fas fa-chart-bar"></i><span>Laporan</span></button></li>}
            {canSeeCategories && <li><button className={activeMenu==='categories'?'active':''} onClick={() => navigate('categories')}><i className="fas fa-th-large"></i><span>Kategori Menu</span></button></li>}
            {canSeeImports && <li><button className={activeMenu==='bulk_import'?'active':''} onClick={() => navigate('bulk_import')}><i className="fas fa-file-import"></i><span>Impor Massal Menu</span></button></li>}
            {isAdmin && <li><button className={activeMenu==='users'?'active':''} onClick={() => navigate('users')}><i className="fas fa-users-cog"></i><span>Manajemen Pengguna</span></button></li>}
            {isAdmin && <li><button className={activeMenu==='settings'?'active':''} onClick={() => navigate('settings')}><i className="fas fa-cog"></i><span>Pengaturan</span></button></li>}
            {isAdmin && <li><button className={activeMenu==='logs'?'active':''} onClick={() => navigate('logs')}><i className="fas fa-history"></i><span>Log Aktivitas</span></button></li>}
            <li><button className={activeMenu==='account'?'active':''} onClick={() => navigate('account')}><i className="fas fa-user-circle"></i><span>Akun Saya</span></button></li>
            <li><button className={activeMenu==='about'?'active':''} onClick={() => navigate('about')}><i className="fas fa-info-circle"></i><span>Tentang Aplikasi</span></button></li>
          </ul>
        </div>
        <div className="sidebar-logout"><button onClick={onLogout}><i className="fas fa-sign-out-alt"></i><span>Keluar</span></button></div>
        {onSwitchWarung && <div className="sidebar-logout"><button onClick={async () => { const r = await Swal.fire({ icon:'question', text:'Ganti ke warung lain? Anda perlu memasukkan Kode Warung lagi.', showCancelButton:true, confirmButtonText:'Ya, Ganti' }); if (r.isConfirmed) onSwitchWarung(); }}><i className="fas fa-exchange-alt"></i><span>Ganti Warung</span></button></div>}
      </div>
      <div className="main-content">
        <div className="breadcrumb"><a onClick={() => navigate('dashboard')}><i className="fas fa-home"></i> Dashboard</a>{activeMenu !== 'dashboard' && <><span className="breadcrumb-sep">/</span><span>{pageLabels[activeMenu]}</span></>}</div>
        <div className="header"><h1><i className={pageIcons[activeMenu]}></i> {pageLabels[activeMenu]}</h1><div className="header-right"><i id="globalLoadingIcon" className="fas fa-sync-alt global-loading"></i><span>Halo, {user.full_name}</span></div></div>
        <MainContent activeMenu={activeMenu} user={user} onUserUpdate={onUserUpdate} onSettingsUpdate={handleSettingsUpdate} openLedger={openLedger} ledgerSupplierId={ledgerSupplierId} openPurchaseDetail={openPurchaseDetail} detailPurchaseId={detailPurchaseId} openCustomerLedger={openCustomerLedger} ledgerCustomerId={ledgerCustomerId} goBack={() => navigate('suppliers')} goBackPurchases={() => navigate('purchases')} goBackCustomers={() => navigate('customers')} onNavigate={navigate} />
      </div>
      <div className="bottom-nav">
        <button className={'bnav-item' + (activeMenu==='dashboard'?' active':'')} onClick={() => navigate('dashboard')}><i className="fas fa-chart-line"></i><span>Home</span></button>
        <button className={'bnav-item' + (activeMenu==='pos'?' active':'')} onClick={() => navigate('pos')}><i className="fas fa-cash-register"></i><span>Kasir</span></button>
        <button className={'bnav-item' + (activeMenu==='sales'?' active':'')} onClick={() => navigate('sales')}><i className="fas fa-receipt"></i><span>Transaksi</span></button>
        <button className={'bnav-item' + (activeMenu==='menu'?' active':'')} onClick={() => navigate('menu')}><i className="fas fa-utensils"></i><span>Menu</span></button>
        <button className={'bnav-item'} onClick={() => setSidebarOpen(true)}><i className="fas fa-th"></i><span>Lainnya</span></button>
      </div>
    </div>
  );
}

function MainContent({ activeMenu, user, onUserUpdate, onSettingsUpdate, openLedger, ledgerSupplierId, openPurchaseDetail, detailPurchaseId, openCustomerLedger, ledgerCustomerId, goBack, goBackPurchases, goBackCustomers, onNavigate }) {
  switch (activeMenu) {
    case 'dashboard': return <DashboardView user={user} onNavigate={onNavigate} />;
    case 'users': return <UsersView user={user} />;
    case 'categories': return <CategoriesView user={user} />;
    case 'suppliers': return <SuppliersView user={user} openLedger={openLedger} />;
    case 'supplier_ledger': return <SupplierLedgerView user={user} supplierId={ledgerSupplierId} goBack={goBack} />;
    case 'purchases': return <PurchasesView user={user} openDetail={openPurchaseDetail} />;
    case 'purchase_detail': return <PurchaseDetailView user={user} purchaseId={detailPurchaseId} goBack={goBackPurchases} />;
    case 'menu': return <MenuView user={user} />;
    case 'customers': return <CustomersView user={user} openLedger={openCustomerLedger} />;
    case 'customer_ledger': return <CustomerLedgerView user={user} customerId={ledgerCustomerId} goBack={goBackCustomers} />;
    case 'pos': return <POSView user={user} />;
    case 'sales': return <SalesListView user={user} onNavigate={onNavigate} />;
    case 'payments': return <PaymentsPageView user={user} />;
    case 'expenses': return <ExpensesView user={user} />;
    case 'bulk_import': return <BulkImportPageView user={user} />;
    case 'settings': return <SettingsView user={user} onSettingsUpdate={onSettingsUpdate} />;
    case 'account': return <AccountView user={user} onUserUpdate={onUserUpdate} />;
    case 'due_reminders': return <DueRemindersView user={user} />;
    case 'reports': return <ReportsView user={user} />;
    case 'logs': return <LogsView user={user} />;
    case 'about': return <AboutView />;
    default: return null;
  }
}

/* ── Dashboard ── */
function DashboardView({ user, onNavigate }) {
  const _c = swrGet('dash_' + user.role);
  const [loading, setLoading] = useState(!_c);
  const [s, setS] = useState(_c);
  const chartRefs = useRef({});
  const [overdue, setOverdue] = useState(null);

  useEffect(() => {
    if (_c) setTimeout(() => initCharts(_c), 200);
    (async () => {
      try { const r = await API.getDashboardStats(user.id, user.role); setLoading(false); if (r.success) { swrSet('dash_' + user.role, r.data); setS(r.data); setTimeout(() => initCharts(r.data), 200); } } catch(e) { setLoading(false); }
    })();
    if (user.role === 'admin' || user.role === 'manager') API.getOverdueSummary(user.id, user.role).then(r => { if (r.success) setOverdue(r.data); }).catch(() => {});
    return () => { Object.values(chartRefs.current).forEach(c => { if(c) c.destroy(); }); };
  }, []);

  const initCharts = (d) => {
    Object.values(chartRefs.current).forEach(c => { if(c) { try { c.destroy(); } catch(e){} } });
    chartRefs.current = {};
    ['dailySalesChart','orderTypeChart','topCustChart','expDonutChart'].forEach(id => { const el = document.getElementById(id); if (el) { const ex = Chart.getChart(el); if (ex) ex.destroy(); } });
    const ctx1 = document.getElementById('dailySalesChart');
    if (ctx1 && d.dailySales?.length) {
      const gr = ctx1.getContext('2d').createLinearGradient(0,0,0,280);
      gr.addColorStop(0,'rgba(179,38,30,0.45)'); gr.addColorStop(1,'rgba(179,38,30,0)');
      const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#b3261e';
      chartRefs.current.line = new Chart(ctx1, { type:'line', data:{ labels:d.dailySales.map(x=>x.date), datasets:[{ label:'Penjualan', data:d.dailySales.map(x=>x.amount), borderColor:primaryColor, backgroundColor:gr, fill:true, tension:0.4, pointRadius:0, pointHoverRadius:5, pointBackgroundColor:primaryColor, borderWidth:2.5 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, tooltip:{ backgroundColor:primaryColor, padding:10 } }, scales:{ y:{beginAtZero:true, ticks:{ font:{size:10} }, grid:{color:'#f0f0f0'} }, x:{grid:{display:false}, ticks:{font:{size:10}, maxRotation:0}} } } });
    }
    const ctx2 = document.getElementById('orderTypeChart');
    if (ctx2 && d.orderTypeDist) {
      chartRefs.current.pie = new Chart(ctx2, { type:'doughnut', data:{ labels:['Makan di Tempat','Bawa Pulang','Antar'], datasets:[{ data:[d.orderTypeDist.dine_in||0, d.orderTypeDist.takeaway||0, d.orderTypeDist.delivery||0], backgroundColor:['#2e7d32','#e65100','#1565c0'], borderWidth:3, borderColor:'#fff' }] }, options:{ responsive:true, maintainAspectRatio:false, cutout:'60%', plugins:{ legend:{position:'bottom', labels:{padding:8, usePointStyle:true, font:{size:11}, boxWidth:8}} } } });
    }
    const ctx3 = document.getElementById('topCustChart');
    if (ctx3 && d.topCusts?.length) {
      chartRefs.current.topCust = new Chart(ctx3, { type:'bar', data:{ labels:d.topCusts.slice(0,7).map(c=>c.name), datasets:[{ data:d.topCusts.slice(0,7).map(c=>c.total), backgroundColor:'rgba(224,122,31,0.75)', hoverBackgroundColor:'#b3261e', borderRadius:4, barThickness:18 }] }, options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} }, scales:{ x:{beginAtZero:true, grid:{display:false}, ticks:{font:{size:10}}}, y:{grid:{display:false}, ticks:{font:{size:11}}} } } });
    }
    const ctx4 = document.getElementById('expDonutChart');
    if (ctx4 && d.expBreakdown) {
      const cats = Object.keys(d.expBreakdown);
      const expColors = { bahan_baku:'#e65100', gaji:'#6a1b9a', utilitas:'#00838f', sewa:'#00695c', transport:'#1565c0', lainnya:'#888' };
      chartRefs.current.expDonut = new Chart(ctx4, { type:'doughnut', data:{ labels:cats.map(c=>c.replace('_',' ')), datasets:[{ data:cats.map(c=>d.expBreakdown[c]), backgroundColor:cats.map(c=>expColors[c]||'#888'), borderWidth:3, borderColor:'#fff' }] }, options:{ responsive:true, maintainAspectRatio:false, cutout:'62%', plugins:{ legend:{position:'bottom', labels:{padding:8, usePointStyle:true, font:{size:11}, boxWidth:8}} } } });
    }
  };

  if (loading) return <div><div className="dashboard-grid-3">{[...Array(6)].map((_,i) => <DashboardCardSkeleton key={i} />)}</div><div className="dashboard-grid-2"><ChartSkeleton /><ChartSkeleton /></div></div>;

  const tk = (v) => fmtRp(v);
  const role = user.role;
  const go = (p) => onNavigate && onNavigate(p);
  const h = new Date().getHours();
  const greet = h < 12 ? 'Selamat Pagi' : h < 15 ? 'Selamat Siang' : h < 18 ? 'Selamat Sore' : 'Selamat Malam';
  const greetIcon = h < 12 ? 'fa-sun' : h < 18 ? 'fa-cloud-sun' : 'fa-moon';
  const todayStr = new Date().toLocaleDateString('id-ID', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const firstName = (user.full_name || '').split(' ')[0] || user.full_name;

  const ds = s?.dailySales || [];
  const yest = ds.length >= 2 ? (ds[ds.length-2]?.amount || 0) : 0;
  const todayAmt = s?.todaySalesAmt || 0;
  const dlt = todayAmt - yest;
  const pct = yest > 0 ? Math.round((dlt / yest) * 100) : (todayAmt > 0 ? 100 : 0);
  const trendCls = dlt > 0 ? 'up' : dlt < 0 ? 'down' : 'neutral';
  const trendIco = dlt > 0 ? 'fa-arrow-up' : dlt < 0 ? 'fa-arrow-down' : 'fa-minus';

  const alerts = [];
  if (overdue && overdue.customers?.length > 0) alerts.push({ cls:'danger', ico:'fa-exclamation-triangle', text:<><strong>{overdue.customers.length}</strong> pelanggan memiliki tagihan tertunda senilai <strong>{tk(overdue.totalCustDue)}</strong></>, nav:'due_reminders' });
  if (s?.lowStockCount > 0) alerts.push({ cls:'warning', ico:'fa-box-open', text:<><strong>{s.lowStockCount}</strong> menu stoknya menipis (≤5)</>, nav:'menu' });
  if (s?.pendingPurchases > 0 && (role === 'admin' || role === 'manager')) alerts.push({ cls:'info', ico:'fa-clock', text:<><strong>{s.pendingPurchases}</strong> pembelian belum lunas</>, nav:'purchases' });
  if (alerts.length === 0 && (role === 'admin' || role === 'manager')) alerts.push({ cls:'success', ico:'fa-check-circle', text:'Semua aman — tidak ada peringatan' });

  const activity = [];
  (s?.recentSales || []).forEach(sl => activity.push({ type:'sale', date:sl.date, text:<><strong>{sl.invoice_no}</strong> — {sl.customer}</>, amt:sl.total }));
  (s?.recentPayments || []).forEach(p => activity.push({ type:'payment', date:p.date, text:<>Pembayaran diterima via <strong>{p.method}</strong></>, amt:p.amount }));
  activity.sort((a,b) => new Date(b.date) - new Date(a.date));
  const feed = activity.slice(0, 8);

  const heroStats = role === 'admin' || role === 'manager' ? [
    { val: tk(s?.todaySalesAmt), lbl:'Penjualan Hari Ini' }, { val: tk(s?.todayCollectionAmt), lbl:'Kas Masuk Hari Ini' }, { val: (s?.availableMenuCount || 0), lbl:'Menu Tersedia' }
  ] : [
    { val: tk(s?.myTodaySalesAmt), lbl:'Penjualan Saya Hari Ini' }, { val: tk(s?.myTodayCollection), lbl:'Kas Masuk Saya' }, { val: tk(s?.myMonthSales), lbl:'Bulan Berjalan' }
  ];

  const actions = role === 'admin' || role === 'manager' ? [
    { id:'pos', ico:'fa-cash-register', color:'#2e7d32', title:'Pesanan Baru', sub:'Buka Kasir' },
    { id:'menu', ico:'fa-utensils', color:'#6f42c1', title:'Menu', sub:'Kelola menu' },
    { id:'purchases', ico:'fa-shopping-cart', color:'#1565c0', title:'Pembelian', sub:'Bahan baku' },
    { id:'payments', ico:'fa-money-bill-wave', color:'#e65100', title:'Pembayaran', sub:'Lihat riwayat' },
    { id:'reports', ico:'fa-chart-bar', color:'#00838f', title:'Laporan', sub:'Laba rugi, dll' },
    { id:'expenses', ico:'fa-receipt', color:'#c62828', title:'Pengeluaran', sub:'Catat biaya' }
  ] : [
    { id:'pos', ico:'fa-cash-register', color:'#2e7d32', title:'Pesanan Baru', sub:'Buka Kasir' },
    { id:'sales', ico:'fa-receipt', color:'#1565c0', title:'Transaksi Saya', sub:'Lihat riwayat' },
    { id:'customers', ico:'fa-user-friends', color:'#6f42c1', title:'Pelanggan', sub:'Cari / tambah' },
    { id:'due_reminders', ico:'fa-bell', color:'#e65100', title:'Pengingat Tagihan', sub:'Tagihan tertunda' }
  ];

  const Hero = (
    <div className="dash-hero">
      <div className="dash-hero-top">
        <div><div className="dash-hero-greet"><i className={'fas ' + greetIcon}></i> {greet}, {firstName}!</div><div className="dash-hero-sub">Selamat datang kembali di {BN()}. Berikut ringkasan hari ini.</div></div>
        <div className="dash-hero-date"><i className="fas fa-calendar-day"></i> {todayStr}</div>
      </div>
      <div className="dash-hero-stats">{heroStats.map((st, i) => (<div key={i}><div className="dash-hero-stat-val">{st.val}</div><div className="dash-hero-stat-lbl">{st.lbl}</div></div>))}</div>
    </div>
  );
  const QuickActions = (<div className="dash-actions">{actions.map(a => (<button key={a.id} className="dash-action" onClick={() => go(a.id)}><div className="dash-action-ico" style={{background: a.color}}><i className={'fas ' + a.ico}></i></div><div className="dash-action-text"><div className="dash-action-title">{a.title}</div><div className="dash-action-sub">{a.sub}</div></div></button>))}</div>);
  const Alerts = alerts.length > 0 && (<div className="dash-alerts">{alerts.map((a, i) => (<div key={i} className={'dash-alert ' + a.cls} onClick={() => a.nav && go(a.nav)} style={{cursor: a.nav ? 'pointer' : 'default'}}><i className={'fas ' + a.ico + ' dash-alert-ico'}></i><div className="dash-alert-text">{a.text}</div>{a.nav && <i className="fas fa-chevron-right dash-alert-arrow"></i>}</div>))}</div>);

  if (role === 'kasir') {
    const ticket = s?.myRecentSales?.length ? Math.round(s.myRecentSales.reduce((sum,r)=>sum+r.total,0) / s.myRecentSales.length) : 0;
    return (
      <div>{Hero}{QuickActions}
        <div className="dash-kpis">
          <div className="dash-kpi"><div className="dash-kpi-head"><div className="dash-kpi-ico" style={{background:'#34a853'}}><i className="fas fa-cash-register"></i></div></div><div className="dash-kpi-val">{tk(s?.myTodaySalesAmt)}</div><div className="dash-kpi-lbl">Penjualan Saya Hari Ini</div></div>
          <div className="dash-kpi"><div className="dash-kpi-head"><div className="dash-kpi-ico" style={{background:'var(--navy)'}}><i className="fas fa-coins"></i></div></div><div className="dash-kpi-val">{tk(s?.myTodayCollection)}</div><div className="dash-kpi-lbl">Kas Masuk Saya</div></div>
          <div className="dash-kpi"><div className="dash-kpi-head"><div className="dash-kpi-ico" style={{background:'#6f42c1'}}><i className="fas fa-chart-bar"></i></div></div><div className="dash-kpi-val">{tk(s?.myMonthSales)}</div><div className="dash-kpi-lbl">Bulan Berjalan</div></div>
          <div className="dash-kpi"><div className="dash-kpi-head"><div className="dash-kpi-ico" style={{background:'#00838f'}}><i className="fas fa-ticket-alt"></i></div></div><div className="dash-kpi-val">{tk(ticket)}</div><div className="dash-kpi-lbl">Rata-rata per Struk</div></div>
        </div>
        <div className="dash-panel"><h3 className="dash-panel-title"><i className="fas fa-receipt"></i> Transaksi Terbaru Saya</h3>
          {s?.myRecentSales?.length > 0 ? (<ul className="dash-timeline">{s.myRecentSales.map((sl,i) => (<li key={i} className="dash-tl-item"><div className="dash-tl-ico sale"><i className="fas fa-receipt"></i></div><div className="dash-tl-content"><div className="dash-tl-text"><strong>{sl.invoice_no}</strong> — {sl.customer}</div><div className="dash-tl-meta"><i className="fas fa-clock"></i> {fmtDate(sl.date)} <span className="dash-tl-amt">{tk(sl.total)}</span></div></div></li>))}</ul>) : <div className="dash-empty"><i className="fas fa-inbox"></i><p>Belum ada transaksi hari ini</p></div>}
        </div>
      </div>
    );
  }

  return (
    <div>{Hero}{Alerts}{QuickActions}
      <div className="dash-kpis">
        <div className="dash-kpi"><div className="dash-kpi-head"><div className="dash-kpi-ico" style={{background:'#34a853'}}><i className="fas fa-cash-register"></i></div>{ds.length >= 2 && <span className={'dash-kpi-trend ' + trendCls}><i className={'fas ' + trendIco}></i> {Math.abs(pct)}%</span>}</div><div className="dash-kpi-val">{tk(s?.todaySalesAmt)}</div><div className="dash-kpi-lbl">Penjualan Hari Ini</div>{ds.length >= 2 && <div className="dash-kpi-extra">vs kemarin {tk(yest)}</div>}</div>
        <div className="dash-kpi"><div className="dash-kpi-head"><div className="dash-kpi-ico" style={{background:'var(--navy)'}}><i className="fas fa-coins"></i></div></div><div className="dash-kpi-val">{tk(s?.todayCollectionAmt)}</div><div className="dash-kpi-lbl">Kas Masuk Hari Ini</div></div>
        <div className="dash-kpi"><div className="dash-kpi-head"><div className="dash-kpi-ico" style={{background:'#ea4335'}}><i className="fas fa-exclamation-triangle"></i></div>{overdue?.customers?.length > 0 && <span className="dash-kpi-trend down"><i className="fas fa-bell"></i> {overdue.customers.length}</span>}</div><div className="dash-kpi-val danger">{tk(s?.totalCustDue)}</div><div className="dash-kpi-lbl">Piutang Pelanggan</div></div>
        <div className="dash-kpi"><div className="dash-kpi-head"><div className="dash-kpi-ico" style={{background:'#fbbc04'}}><i className="fas fa-handshake"></i></div></div><div className="dash-kpi-val">{tk(s?.totalSuppDue)}</div><div className="dash-kpi-lbl">Hutang Supplier</div></div>
        <div className="dash-kpi"><div className="dash-kpi-head"><div className="dash-kpi-ico" style={{background:'#6f42c1'}}><i className="fas fa-box"></i></div></div><div className="dash-kpi-val">{s?.availableMenuCount || 0}</div><div className="dash-kpi-lbl">Menu Tersedia</div></div>
        <div className="dash-kpi"><div className="dash-kpi-head"><div className="dash-kpi-ico" style={{background:'#00838f'}}><i className="fas fa-receipt"></i></div></div><div className="dash-kpi-val">{tk(s?.expThisMonth)}</div><div className="dash-kpi-lbl">Pengeluaran (Bulan Ini)</div></div>
      </div>
      <div className="dash-row-2">
        <div className="dash-panel"><h3 className="dash-panel-title"><i className="fas fa-chart-line"></i> Penjualan Harian (30 hari)</h3><div style={{height:'260px'}}><canvas id="dailySalesChart"></canvas></div></div>
        <div className="dash-panel"><h3 className="dash-panel-title"><i className="fas fa-chart-pie"></i> Tipe Pesanan</h3><div style={{height:'260px'}}><canvas id="orderTypeChart"></canvas></div></div>
      </div>
      <div className="dash-row-2 eq">
        <div className="dash-panel"><h3 className="dash-panel-title"><i className="fas fa-users"></i> Pelanggan Teratas</h3><div style={{height:'240px'}}><canvas id="topCustChart"></canvas></div></div>
        <div className="dash-panel"><h3 className="dash-panel-title"><i className="fas fa-receipt"></i> Rincian Pengeluaran (Bulan Ini)</h3><div style={{height:'240px'}}><canvas id="expDonutChart"></canvas></div></div>
      </div>
      <div className="dash-row-2">
        <div className="dash-panel"><h3 className="dash-panel-title"><i className="fas fa-stream"></i> Aktivitas Terbaru</h3>
          {feed.length > 0 ? (<ul className="dash-timeline">{feed.map((a, i) => (<li key={i} className="dash-tl-item"><div className={'dash-tl-ico ' + a.type}><i className={'fas ' + (a.type === 'sale' ? 'fa-receipt' : 'fa-money-bill-wave')}></i></div><div className="dash-tl-content"><div className="dash-tl-text">{a.text}</div><div className="dash-tl-meta"><i className="fas fa-clock"></i> {fmtDate(a.date)} {a.amt != null && <span className="dash-tl-amt">{tk(a.amt)}</span>}</div></div></li>))}</ul>) : <div className="dash-empty"><i className="fas fa-inbox"></i><p>Belum ada aktivitas</p></div>}
        </div>
        <div className="dash-panel"><h3 className="dash-panel-title"><i className="fas fa-utensils"></i> Menu Terlaris</h3>
          {s?.topMenu?.length > 0 ? (<ul className="dash-top">{s.topMenu.slice(0, 8).map((c, i) => (<li key={i} className="dash-top-item"><div className="dash-top-rank">{i+1}</div><div className="dash-top-name">{c.name}</div><div className="dash-top-val">{c.qty}x</div></li>))}</ul>) : <div className="dash-empty"><i className="fas fa-utensils"></i><p>Belum ada data penjualan menu</p></div>}
        </div>
      </div>
      {overdue && (overdue.customers?.length > 0 || overdue.suppliers?.length > 0) && (
        <div className="dash-row-2 eq">
          {overdue.customers?.length > 0 && (
            <div className="dash-panel"><h3 className="dash-panel-title"><i className="fas fa-user-friends"></i> Piutang Pelanggan <span style={{marginLeft:'auto'}}>{overdue.customers.length}</span></h3>
              {overdue.customers.slice(0,5).map((c,i) => { const dCls = c.days_overdue <= 7 ? 'green' : c.days_overdue <= 30 ? 'orange' : 'red'; const p = String(c.phone||''); const ph = p ? (p.startsWith('0') ? '62' + p.substring(1) : p).replace(/[^0-9]/g,'') : ''; const waMsg = encodeURIComponent('Pengingat: Anda memiliki tagihan tertunda sebesar ' + fmtRp(c.total_due) + '. Mohon segera diselesaikan. - ' + BN());
                return (<div key={i} className="overdue-card"><div className="oc-info"><div className="oc-name">{c.name} <span className={'overdue-days ' + dCls}><i className="fas fa-clock"></i> {c.days_overdue}h</span></div><div className="oc-meta"><span className="due-amount" style={{fontWeight:'700'}}>{tk(c.total_due)}</span>{c.phone && <a href={'tel:' + c.phone} style={{color:'var(--navy-accent)', textDecoration:'none'}}><i className="fas fa-phone"></i> {c.phone}</a>}</div></div>{ph && <a href={'https://wa.me/' + ph + '?text=' + waMsg} target="_blank" className="wa-btn"><i className="fab fa-whatsapp"></i></a>}</div>); })}
            </div>
          )}
          {overdue.suppliers?.length > 0 && (
            <div className="dash-panel"><h3 className="dash-panel-title"><i className="fas fa-handshake"></i> Hutang Supplier <span style={{marginLeft:'auto'}}>{overdue.suppliers.length}</span></h3>
              {overdue.suppliers.slice(0,5).map((sp,i) => { const dCls = sp.days_overdue <= 7 ? 'green' : sp.days_overdue <= 30 ? 'orange' : 'red'; const spp = String(sp.phone||''); const ph = spp ? (spp.startsWith('0') ? '62' + spp.substring(1) : spp).replace(/[^0-9]/g,'') : ''; const waMsg = encodeURIComponent('Pengingat: Anda memiliki tagihan tertunda sebesar ' + fmtRp(sp.total_due) + '. Mohon segera diselesaikan. - ' + BN());
                return (<div key={i} className="overdue-card" style={{borderLeftColor:'#e65100'}}><div className="oc-info"><div className="oc-name">{sp.name} <span className={'overdue-days ' + dCls}><i className="fas fa-clock"></i> {sp.days_overdue}h</span></div><div className="oc-meta"><span className="due-amount" style={{fontWeight:'700'}}>{tk(sp.total_due)}</span>{sp.phone && <a href={'tel:' + sp.phone} style={{color:'var(--navy-accent)', textDecoration:'none'}}><i className="fas fa-phone"></i> {sp.phone}</a>}</div></div>{ph && <a href={'https://wa.me/' + ph + '?text=' + waMsg} target="_blank" className="wa-btn"><i className="fab fa-whatsapp"></i></a>}</div>); })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Users Management ── */
function UsersView({ user }) {
  const _c = swrGet('users');
  const [loading, setLoading] = useState(!_c);
  const [users, setUsers] = useState(_c || []);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [load, setLoad] = useState('');
  const tableRef = useRef(null);
  const [filters, setFilters] = useState({ role:'', status:'', dateFrom:'', dateTo:'' });

  useEffect(() => { if (_c) setTimeout(() => initTable(_c), 150); loadUsers(); return () => { dtCleanup(); if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; } catch(e){} } }; }, []);

  const loadUsers = async () => {
    if (!_c) setLoading(true);
    try {
      const r = await API.getUsers(user.id, user.role);
      setLoading(false);
      if (r.success) { swrSet('users', r.data); setUsers(r.data); initTable(r.data); }
      else Swal.fire({ icon:'error', text:r.message });
    } catch(e) { setLoading(false); Swal.fire({ icon:'error', text:'Gagal memuat pengguna' }); }
  };

  const initTable = (data) => {
    if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; $('#usersTable').empty(); } catch(e){} }
    setTimeout(() => {
      try {
        const t = $('#usersTable').DataTable({
          data, destroy:true,
          columns: [
            { data:'avatar', title:'Foto', orderable:false, width:'50px', render:(d,_,row) => d ? '<img src="' + avatarUrl(d) + '" class="dt-avatar" onerror="this.outerHTML=\'<span class=dt-avatar-ph>' + getInitials(row.full_name) + '</span>\'" />' : '<span class="dt-avatar-ph">' + getInitials(row.full_name) + '</span>' },
            { data:'full_name', title:'Nama Lengkap' },
            { data:'email', title:'Email' },
            { data:'phone', title:'Telepon' },
            { data:'role', title:'Peran', render:(d) => '<span class="role-badge role-' + d + '">' + (ROLE_LABELS[d]||d) + '</span>' },
            { data:'is_active', title:'Status', render:(d) => '<span class="status-dot ' + (d==1?'active':'inactive') + '"></span>' + (d==1?'Aktif':'Nonaktif') },
            { data:'created_at', title:'Dibuat', render:(d) => fmtDateShort(d) },
            { data:null, title:'Aksi', orderable:false, render:(_,__,row) => '<button class="action-icon edit-icon" data-action="edit"><i class="fas fa-edit"></i></button><button class="action-icon toggle-icon ' + (row.is_active==1?'':'off') + '" data-action="toggle"><i class="fas ' + (row.is_active==1?'fa-toggle-on':'fa-toggle-off') + '"></i></button><button class="action-icon delete-icon" data-action="delete"><i class="fas fa-trash"></i></button>' }
          ],
          pageLength:10, lengthMenu:[[10,25,50,100,-1],[10,25,50,100,"Semua"]], responsive:true, dom:'Blfrtip',
          buttons:[
            { extend:'csv', text:'<i class="fas fa-file-csv"></i> CSV', exportOptions:{columns:[1,2,3,4,5,6]} },
            { extend:'pdf', text:'<i class="fas fa-file-pdf"></i> PDF', exportOptions:{columns:[1,2,3,4,5,6]} },
            { extend:'print', text:'<i class="fas fa-print"></i> Cetak', exportOptions:{columns:[1,2,3,4,5,6]} }
          ],
          order:[[6,'desc']],
          language: { search:'Cari:', lengthMenu:'Tampilkan _MENU_ data', info:'Menampilkan _START_ - _END_ dari _TOTAL_ data', paginate:{ previous:'Sebelumnya', next:'Berikutnya' }, zeroRecords:'Tidak ada data ditemukan' }
        });
        $('#usersTable').off('click', '.action-icon');
        $('#usersTable').on('click', '.action-icon', function() {
          const action = $(this).data('action');
          const rowData = t.row($(this).parents('tr')).data();
          if (action === 'edit') { setEditingUser(rowData); setShowModal(true); }
          else if (action === 'toggle') handleToggle(rowData);
          else handleDelete(rowData);
        });
        tableRef.current = t;
      } catch(e) { console.error('DataTable:', e); }
    }, 150);
  };

  const applyFilters = () => {
    if (!tableRef.current) return;
    const dt = tableRef.current;
    while ($.fn.dataTable.ext.search.length > 0) $.fn.dataTable.ext.search.pop();
    if (filters.dateFrom || filters.dateTo) {
      $.fn.dataTable.ext.search.push((s, sd, idx) => {
        const row = dt.row(idx).data(); if (!row) return true;
        const d = new Date(row.created_at);
        if (filters.dateFrom && d < new Date(filters.dateFrom)) return false;
        if (filters.dateTo && d > new Date(filters.dateTo + 'T23:59:59')) return false;
        return true;
      });
    }
    dt.columns().search('');
    if (filters.role) dt.column(4).search(filters.role);
    if (filters.status) dt.column(5).search(filters.status === '1' ? 'Aktif' : 'Nonaktif');
    dt.draw();
  };
  const clearFilters = () => { setFilters({ role:'', status:'', dateFrom:'', dateTo:'' }); if (tableRef.current) { while ($.fn.dataTable.ext.search.length>0) $.fn.dataTable.ext.search.pop(); tableRef.current.columns().search('').draw(); } };
  useEffect(() => { if (tableRef.current && users.length > 0) applyFilters(); }, [filters]);

  const handleSave = async (formData) => {
    setLoad(editingUser ? 'Memperbarui pengguna...' : 'Menambahkan pengguna...');
    try {
      let r;
      if (editingUser) r = await API.updateUser({ ...formData, id: editingUser.id }, user.id, user.role);
      else r = await API.addUser(formData, user.id, user.role);
      setLoad('');
      if (r.success) { setShowModal(false); setEditingUser(null); Swal.fire({ icon:'success', text:r.message, timer:2000, showConfirmButton:false }); loadUsers(); }
      else Swal.fire({ icon:'error', text:r.message });
    } catch(e) { setLoad(''); Swal.fire({ icon:'error', text:'Operasi gagal' }); }
  };

  const handleToggle = (record) => {
    const msg = record.is_active == 1 ? 'Nonaktifkan ' : 'Aktifkan ';
    Swal.fire({ icon:'question', title: msg + record.full_name + '?', showCancelButton:true, confirmButtonColor:'var(--navy-primary)', confirmButtonText:'Ya' }).then(async (res) => {
      if (res.isConfirmed) {
        setLoad('Memperbarui status...');
        try {
          const r = await API.toggleUserStatus(record.id, user.id, user.role);
          setLoad('');
          if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); loadUsers(); }
          else Swal.fire({ icon:'error', text:r.message });
        } catch(e) { setLoad(''); Swal.fire({ icon:'error', text:'Gagal mengubah status' }); }
      }
    });
  };

  const handleDelete = (record) => {
    Swal.fire({ icon:'warning', title:'Hapus Pengguna?', text:'Ini akan menghapus permanen ' + record.full_name, showCancelButton:true, confirmButtonColor:'#ea4335', confirmButtonText:'Hapus' }).then(async (res) => {
      if (res.isConfirmed) {
        setLoad('Menghapus...');
        try {
          const r = await API.deleteUser(record.id, user.id, user.role);
          setLoad('');
          if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); loadUsers(); }
          else Swal.fire({ icon:'error', text:r.message });
        } catch(e) { setLoad(''); Swal.fire({ icon:'error', text:'Gagal menghapus' }); }
      }
    });
  };

  const STATUS_OPTIONS = [{ value:'1', label:'Aktif' }, { value:'0', label:'Nonaktif' }];

  return (
    <div className="data-section">
      <div className="section-header">
        <h2><i className="fas fa-users-cog"></i> Manajemen Pengguna</h2>
        <button className="btn btn-success" onClick={() => { setEditingUser(null); setShowModal(true); }}><i className="fas fa-plus"></i> Tambah Pengguna</button>
      </div>
      {!loading && (
        <div className="filters-section">
          <div className="filters-header"><h3><i className="fas fa-filter"></i> Filter</h3><button className="btn btn-secondary btn-sm" onClick={clearFilters}><i className="fas fa-times-circle"></i> Bersihkan</button></div>
          <div className="filters-grid">
            <SearchableDropdown label="Peran" icon="fas fa-user-tag" options={ROLE_OPTIONS} value={filters.role} onChange={(v) => setFilters({...filters, role:v})} placeholder="Semua Peran" />
            <SearchableDropdown label="Status" icon="fas fa-toggle-on" options={STATUS_OPTIONS} value={filters.status} onChange={(v) => setFilters({...filters, status:v})} placeholder="Semua Status" />
            <div className="filter-group"><label><i className="fas fa-calendar-alt"></i> Dari Tanggal</label><input type="date" className="filter-input" value={filters.dateFrom} onChange={(e) => setFilters({...filters, dateFrom:e.target.value})} /></div>
            <div className="filter-group"><label><i className="fas fa-calendar-alt"></i> Sampai Tanggal</label><input type="date" className="filter-input" value={filters.dateTo} onChange={(e) => setFilters({...filters, dateTo:e.target.value})} /></div>
          </div>
        </div>
      )}
      {loading && <TableSkeleton rows={6} columns={7} />}
      <div style={{ display: loading ? 'none' : 'block' }}><table id="usersTable" className="display" style={{width:'100%'}}></table></div>
      {showModal && <UserModal editUser={editingUser} onClose={() => { setShowModal(false); setEditingUser(null); }} onSave={handleSave} />}
      {load && <div className="loading-ov"><div className="loading-popup"><div className="loading-progress"><div className="loading-progress-bar"></div></div><div className="loading-txt">{load}</div></div></div>}
    </div>
  );
}

function UserModal({ editUser, onClose, onSave }) {
  const [form, setForm] = useState({
    full_name: editUser?.full_name || '', email: editUser?.email || '', phone: editUser?.phone || '',
    password: '', userRole: editUser?.role || 'kasir', is_active: editUser ? (editUser.is_active == 1) : true
  });
  const [avatarData, setAvatarData] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [showPwdChange, setShowPwdChange] = useState(false);

  const handleAvatarChange = (data, remove) => { if (remove) { setAvatarData(null); setRemoveAvatar(true); } else { setAvatarData(data); setRemoveAvatar(false); } };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editUser && !form.password) { Swal.fire({ icon:'warning', text:'Kata sandi wajib diisi' }); return; }
    if (form.password && form.password.length < 6) { Swal.fire({ icon:'warning', text:'Kata sandi minimal 6 karakter' }); return; }
    const payload = { ...form, is_active: form.is_active ? 1 : 0 };
    if (avatarData) payload.avatarData = avatarData;
    if (removeAvatar) payload.removeAvatar = true;
    onSave(payload);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3><i className={editUser ? 'fas fa-user-edit' : 'fas fa-user-plus'}></i> {editUser ? 'Ubah' : 'Tambah'} Pengguna</h3><button className="close-btn" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="user-form-layout">
              <div>
                <div className="form-group"><label><i className="fas fa-user"></i> Nama Lengkap *</label><input type="text" value={form.full_name} onChange={(e) => setForm({...form, full_name:e.target.value})} required /></div>
                <div className="form-group"><label><i className="fas fa-envelope"></i> Email *</label><input type="email" value={form.email} onChange={(e) => setForm({...form, email:e.target.value})} required /></div>
                <div className="form-group"><label><i className="fas fa-phone"></i> Telepon</label><input type="tel" value={form.phone} onChange={(e) => setForm({...form, phone:e.target.value})} /></div>
                {editUser ? (
                  showPwdChange ? (<PasswordInput label="Kata Sandi Baru" icon="fas fa-lock" value={form.password} onChange={(e) => setForm({...form, password:e.target.value})} placeholder="Minimal 6 karakter" />)
                  : (<button type="button" className="change-pwd-link" onClick={() => setShowPwdChange(true)}><i className="fas fa-key"></i> Ganti Kata Sandi</button>)
                ) : (<PasswordInput label="Kata Sandi *" icon="fas fa-lock" value={form.password} onChange={(e) => setForm({...form, password:e.target.value})} placeholder="Minimal 6 karakter" required={true} />)}
              </div>
              <div>
                <SearchableDropdown label="Peran" icon="fas fa-user-tag" options={ROLE_OPTIONS} value={form.userRole} onChange={(v) => setForm({...form, userRole:v||'kasir'})} placeholder="Pilih peran..." required />
                <AvatarUpload existingFileId={editUser?.avatar || ''} onChange={handleAvatarChange} />
                <ToggleSwitch label="Status Akun" checked={form.is_active} onChange={(v) => setForm({...form, is_active:v})} />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary"><i className="fas fa-save"></i> {editUser ? 'Perbarui' : 'Tambah'} Pengguna</button>
              <button type="button" className="btn btn-secondary" onClick={onClose}><i className="fas fa-times"></i> Batal</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Akun Saya ── */
function AccountView({ user, onUserUpdate }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [load, setLoad] = useState('');

  useEffect(() => { loadProfile(); }, []);
  const loadProfile = async () => {
    try { const r = await API.getProfile(user.id); setLoading(false); if (r.success) setProfile(r.data); }
    catch(e) { setLoading(false); Swal.fire({ icon:'error', text:'Gagal memuat profil' }); }
  };

  if (loading) return <div><div className="skeleton-card"><div className="skeleton skeleton-icon" style={{width:'120px', height:'120px', borderRadius:'50%', margin:'0 auto 20px'}}></div><div className="skeleton skeleton-text-large" style={{width:'50%', margin:'0 auto 12px'}}></div><div className="skeleton skeleton-text" style={{width:'70%', margin:'0 auto'}}></div></div></div>;
  const initials = getInitials(profile?.full_name);

  return (
    <div>
      <div className="profile-hero">
        {profile?.avatar ? <img src={avatarUrl(profile.avatar)} className="profile-hero-avatar" alt="" /> : <div className="profile-hero-initials">{initials}</div>}
        <h2>{profile?.full_name}</h2>
        <div className="profile-hero-email"><i className="fas fa-envelope"></i> {profile?.email}</div>
        <div className="profile-hero-phone"><i className="fas fa-phone"></i> {profile?.phone || 'Tanpa telepon'}</div>
        <div><span className={`role-badge role-${profile?.role}`}>{ROLE_LABELS[profile?.role]||profile?.role}</span></div>
        <div className="profile-hero-actions">
          <button className="btn btn-primary" onClick={() => setShowEdit(true)}><i className="fas fa-user-edit"></i> Ubah Profil</button>
          <button className="btn btn-secondary" onClick={() => setShowPwd(true)}><i className="fas fa-key"></i> Ganti Kata Sandi</button>
        </div>
      </div>
      {showEdit && <ProfileEditModal profile={profile} userId={user.id} onClose={() => setShowEdit(false)} onSaved={(d) => { setProfile(p => ({...p, ...d})); onUserUpdate(d); setShowEdit(false); }} setLoad={setLoad} />}
      {showPwd && <PasswordChangeModal userId={user.id} onClose={() => setShowPwd(false)} setLoad={setLoad} />}
      {load && <div className="loading-ov"><div className="loading-popup"><div className="loading-progress"><div className="loading-progress-bar"></div></div><div className="loading-txt">{load}</div></div></div>}
    </div>
  );
}

function ProfileEditModal({ profile, userId, onClose, onSaved, setLoad }) {
  const [form, setForm] = useState({ full_name: profile.full_name, phone: profile.phone || '' });
  const [avatarData, setAvatarData] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const handleAvatarChange = (data, remove) => { if (remove) { setAvatarData(null); setRemoveAvatar(true); } else { setAvatarData(data); setRemoveAvatar(false); } };
  const handleSubmit = async (e) => {
    e.preventDefault(); setLoad('Memperbarui profil...');
    try {
      const payload = { ...form };
      if (avatarData) payload.avatarData = avatarData;
      if (removeAvatar) payload.removeAvatar = true;
      const r = await API.updateProfile(payload, userId);
      setLoad('');
      if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); onSaved({ full_name:r.data.full_name, phone:r.data.phone, avatar:r.data.avatar }); }
      else Swal.fire({ icon:'error', text:r.message });
    } catch(e) { setLoad(''); Swal.fire({ icon:'error', text:'Update gagal' }); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'500px'}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3><i className="fas fa-user-edit"></i> Ubah Profil</h3><button className="close-btn" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group"><label><i className="fas fa-user"></i> Nama Lengkap *</label><input type="text" value={form.full_name} onChange={(e) => setForm({...form, full_name:e.target.value})} required /></div>
            <div className="form-group"><label><i className="fas fa-phone"></i> Telepon</label><input type="tel" value={form.phone} onChange={(e) => setForm({...form, phone:e.target.value})} /></div>
            <AvatarUpload existingFileId={profile.avatar} onChange={handleAvatarChange} />
            <div className="form-group"><label><i className="fas fa-user-tag"></i> Peran</label><div><span className={`role-badge role-${profile.role}`}>{ROLE_LABELS[profile.role]||profile.role}</span> <span style={{fontSize:'13px', color:'#999', marginLeft:'8px'}}>(hanya-baca)</span></div></div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary"><i className="fas fa-save"></i> Simpan Perubahan</button>
              <button type="button" className="btn btn-secondary" onClick={onClose}><i className="fas fa-times"></i> Batal</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function PasswordChangeModal({ userId, onClose, setLoad }) {
  const [form, setForm] = useState({ current:'', newPwd:'', confirm:'' });
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPwd !== form.confirm) { Swal.fire({ icon:'warning', text:'Kata sandi tidak cocok' }); return; }
    if (form.newPwd.length < 6) { Swal.fire({ icon:'warning', text:'Minimal 6 karakter' }); return; }
    setLoad('Mengubah kata sandi...');
    try {
      const r = await API.changePassword(userId, form.current, form.newPwd);
      setLoad('');
      if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); onClose(); }
      else Swal.fire({ icon:'error', text:r.message });
    } catch(e) { setLoad(''); Swal.fire({ icon:'error', text:'Gagal' }); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'450px'}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3><i className="fas fa-key"></i> Ganti Kata Sandi</h3><button className="close-btn" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <PasswordInput label="Kata Sandi Saat Ini *" icon="fas fa-lock" value={form.current} onChange={(e) => setForm({...form, current:e.target.value})} required={true} />
            <PasswordInput label="Kata Sandi Baru *" icon="fas fa-lock" value={form.newPwd} onChange={(e) => setForm({...form, newPwd:e.target.value})} placeholder="Minimal 6 karakter" required={true} />
            <PasswordInput label="Konfirmasi Kata Sandi *" icon="fas fa-lock" value={form.confirm} onChange={(e) => setForm({...form, confirm:e.target.value})} required={true} />
            <div className="form-actions">
              <button type="submit" className="btn btn-primary"><i className="fas fa-key"></i> Ganti Kata Sandi</button>
              <button type="button" className="btn btn-secondary" onClick={onClose}><i className="fas fa-times"></i> Batal</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Log Aktivitas ── */
function LogsView({ user }) {
  const _c = swrGet('logs');
  const [loading, setLoading] = useState(!_c);
  const [logs, setLogs] = useState(_c || []);
  const tableRef = useRef(null);
  const [filters, setFilters] = useState({ action:'', dateFrom:'', dateTo:'' });
  const actionOptions = [{ value:'LOGIN', label:'Login' },{ value:'CREATE', label:'Tambah' },{ value:'UPDATE', label:'Ubah' },{ value:'DELETE', label:'Hapus' },{ value:'CHANGE_PWD', label:'Ganti Sandi' },{ value:'TOGGLE_STATUS', label:'Ubah Status' }];

  useEffect(() => { if (_c) setTimeout(() => initTable(_c), 150); loadLogs(); return () => { dtCleanup(); if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; } catch(e){} } }; }, []);

  const loadLogs = async () => {
    if (!_c) setLoading(true);
    try { const r = await API.getLogs(user.id, user.role, 200); setLoading(false); if (r.success) { swrSet('logs', r.data); setLogs(r.data); initTable(r.data); } else Swal.fire({ icon:'error', text:r.message }); }
    catch(e) { setLoading(false); Swal.fire({ icon:'error', text:'Gagal memuat log' }); }
  };

  const initTable = (data) => {
    if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; $('#logsTable').empty(); } catch(e){} }
    setTimeout(() => {
      try {
        const t = $('#logsTable').DataTable({
          data, destroy:true,
          columns:[
            { data:'id', title:'ID' }, { data:'username', title:'Pengguna' },
            { data:'action', title:'Aksi', render:(d) => { const c = d==='LOGIN'?'log-login':d==='CREATE'?'log-create':d==='UPDATE'||d==='CHANGE_PWD'||d==='TOGGLE_STATUS'?'log-update':d==='DELETE'?'log-delete':'log-default'; return '<span class="recent-log-action '+c+'">'+d+'</span>'; } },
            { data:'table_name', title:'Tabel' }, { data:'record_id', title:'ID Record' }, { data:'details', title:'Detail' },
            { data:'created_at', title:'Tanggal', render:(d) => fmtDate(d) }
          ],
          pageLength:10, lengthMenu:[[10,25,50,100],[10,25,50,100]], responsive:true, dom:'Blfrtip',
          buttons:[{ extend:'csv', text:'<i class="fas fa-file-csv"></i> CSV' },{ extend:'pdf', text:'<i class="fas fa-file-pdf"></i> PDF' },{ extend:'print', text:'<i class="fas fa-print"></i> Cetak' }],
          order:[[0,'desc']]
        });
        tableRef.current = t;
      } catch(e) { console.error('Logs table:', e); }
    }, 150);
  };

  const applyFilters = () => {
    if (!tableRef.current) return;
    const dt = tableRef.current;
    while ($.fn.dataTable.ext.search.length>0) $.fn.dataTable.ext.search.pop();
    if (filters.dateFrom || filters.dateTo) {
      $.fn.dataTable.ext.search.push((s,sd,idx) => {
        const row = dt.row(idx).data(); if (!row) return true;
        const d = new Date(row.created_at);
        if (filters.dateFrom && d < new Date(filters.dateFrom)) return false;
        if (filters.dateTo && d > new Date(filters.dateTo+'T23:59:59')) return false;
        return true;
      });
    }
    dt.columns().search('');
    if (filters.action) dt.column(2).search(filters.action);
    dt.draw();
  };
  const clearFilters = () => { setFilters({ action:'', dateFrom:'', dateTo:'' }); if (tableRef.current) { while ($.fn.dataTable.ext.search.length>0) $.fn.dataTable.ext.search.pop(); tableRef.current.columns().search('').draw(); } };
  useEffect(() => { if (tableRef.current && logs.length>0) applyFilters(); }, [filters]);

  return (
    <div className="data-section">
      <div className="section-header"><h2><i className="fas fa-history"></i> Log Aktivitas</h2><button className="btn btn-primary btn-sm" onClick={loadLogs}><i className="fas fa-sync-alt"></i> Muat Ulang</button></div>
      {!loading && (
        <div className="filters-section">
          <div className="filters-header"><h3><i className="fas fa-filter"></i> Filter</h3><button className="btn btn-secondary btn-sm" onClick={clearFilters}><i className="fas fa-times-circle"></i> Bersihkan</button></div>
          <div className="filters-grid">
            <SearchableDropdown label="Aksi" icon="fas fa-bolt" options={actionOptions} value={filters.action} onChange={(v) => setFilters({...filters, action:v})} placeholder="Semua Aksi" />
            <div className="filter-group"><label><i className="fas fa-calendar-alt"></i> Dari Tanggal</label><input type="date" className="filter-input" value={filters.dateFrom} onChange={(e) => setFilters({...filters, dateFrom:e.target.value})} /></div>
            <div className="filter-group"><label><i className="fas fa-calendar-alt"></i> Sampai Tanggal</label><input type="date" className="filter-input" value={filters.dateTo} onChange={(e) => setFilters({...filters, dateTo:e.target.value})} /></div>
          </div>
        </div>
      )}
      {loading && <TableSkeleton rows={8} columns={6} />}
      <div style={{ display:loading?'none':'block' }}><table id="logsTable" className="display" style={{width:'100%'}}></table></div>
    </div>
  );
}

/* ── Kategori Menu ── */
function CategoriesView({ user }) {
  const _c = swrGet('cats');
  const [loading, setLoading] = useState(!_c);
  const [categories, setCategories] = useState(_c || []);
  const [viewMode, setViewMode] = useState('table');
  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [load, setLoad] = useState('');
  const tableRef = useRef(null);
  const canWrite = user.role === 'admin' || user.role === 'manager';
  const canDelete = user.role === 'admin';

  useEffect(() => { if (_c && viewMode === 'table') setTimeout(() => initTable(_c), 150); loadCategories(); return () => { if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; } catch(e){} } }; }, []);

  const loadCategories = async () => {
    if (!_c) setLoading(true);
    try { const r = await API.getCategories(user.id, user.role); setLoading(false); if (r.success) { swrSet('cats', r.data); setCategories(r.data); if (viewMode === 'table') setTimeout(() => initTable(r.data), 150); } else Swal.fire({ icon:'error', text:r.message }); }
    catch(e) { setLoading(false); Swal.fire({ icon:'error', text:'Gagal memuat kategori' }); }
  };

  useEffect(() => {
    if (!loading && categories.length > 0) {
      if (viewMode === 'table') setTimeout(() => initTable(categories), 150);
      else { if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; } catch(e){} } }
    }
  }, [viewMode]);

  const initTable = (data) => {
    if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; $('#catTable').empty(); } catch(e){} }
    setTimeout(() => {
      try {
        const t = $('#catTable').DataTable({
          data, destroy:true,
          columns:[
            { data:'name', title:'Nama Kategori', render:(d) => '<strong>' + d + '</strong>' },
            { data:'description', title:'Deskripsi', render:(d) => d && d.length > 50 ? d.substring(0,50) + '...' : (d || '<span style="color:#ccc">—</span>') },
            { data:'menu_count', title:'Jumlah Menu', className:'dt-center', render:(d) => '<span class="sub-badge ' + (d===0?'zero':'') + '">' + d + '</span>' },
            { data:'is_active', title:'Status', render:(d,_,row) => canWrite ? '<button class="action-icon toggle-icon ' + (d==1?'':'off') + '" data-action="toggle"><i class="fas ' + (d==1?'fa-toggle-on':'fa-toggle-off') + '"></i></button>' : '<span class="status-dot ' + (d==1?'active':'inactive') + '"></span>' + (d==1?'Aktif':'Nonaktif') },
            { data:'created_by_name', title:'Dibuat Oleh' }, { data:'created_at', title:'Tanggal', render:(d) => fmtDateShort(d) },
            { data:null, title:'Aksi', orderable:false, render:(_,__,row) => {
              let h = '';
              if (canWrite) h += '<button class="action-icon edit-icon" data-action="edit"><i class="fas fa-edit"></i></button>';
              if (canDelete) { if (row.menu_count > 0) h += '<button class="action-icon delete-icon disabled" title="Masih ada menu terkait"><i class="fas fa-trash"></i></button>'; else h += '<button class="action-icon delete-icon" data-action="delete"><i class="fas fa-trash"></i></button>'; }
              return h || '—';
            }}
          ],
          pageLength:10, lengthMenu:[[10,25,50,-1],[10,25,50,"Semua"]], responsive:true, dom:'Blfrtip',
          buttons:[{ extend:'csv', text:'<i class="fas fa-file-csv"></i> CSV', exportOptions:{columns:[0,1,2,4,5]} },{ extend:'pdf', text:'<i class="fas fa-file-pdf"></i> PDF', exportOptions:{columns:[0,1,2,4,5]} },{ extend:'print', text:'<i class="fas fa-print"></i> Cetak', exportOptions:{columns:[0,1,2,4,5]} }],
          order:[[5,'desc']]
        });
        $('#catTable').off('click', '.action-icon');
        $('#catTable').on('click', '.action-icon', function() {
          if ($(this).hasClass('disabled')) return;
          const action = $(this).data('action');
          const row = t.row($(this).parents('tr')).data();
          if (action === 'edit') { setEditingCat(row); setShowModal(true); }
          else if (action === 'toggle') handleToggle(row);
          else if (action === 'delete') handleDelete(row);
        });
        tableRef.current = t;
      } catch(e) { console.error('CatTable:', e); }
    }, 50);
  };

  const handleSave = async (formData) => {
    setLoad(editingCat ? 'Memperbarui...' : 'Menambahkan...');
    try {
      let r;
      if (editingCat) r = await API.updateCategory({ ...formData, id: editingCat.id }, user.id, user.role);
      else r = await API.addCategory(formData, user.id, user.role);
      setLoad('');
      if (r.success) { setShowModal(false); setEditingCat(null); Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); loadCategories(); }
      else Swal.fire({ icon:'error', text:r.message });
    } catch(e) { setLoad(''); Swal.fire({ icon:'error', text:'Operasi gagal' }); }
  };

  const handleToggle = async (cat) => {
    setLoad('Memperbarui...');
    try { const r = await API.toggleCategoryStatus(cat.id, user.id, user.role); setLoad(''); if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1200, showConfirmButton:false }); loadCategories(); } else Swal.fire({ icon:'error', text:r.message }); }
    catch(e) { setLoad(''); }
  };

  const handleDelete = (cat) => {
    Swal.fire({ icon:'warning', title:'Hapus Kategori?', text:'Hapus "' + cat.name + '"? Tindakan ini tidak bisa dibatalkan.', showCancelButton:true, confirmButtonColor:'#ea4335', confirmButtonText:'Hapus' }).then(async (res) => {
      if (res.isConfirmed) { setLoad('Menghapus...'); try { const r = await API.deleteCategory(cat.id, user.id, user.role); setLoad(''); if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); loadCategories(); } else Swal.fire({ icon:'error', text:r.message }); } catch(e) { setLoad(''); Swal.fire({ icon:'error', text:'Gagal menghapus' }); } }
    });
  };

  return (
    <div className="data-section">
      <div className="section-header">
        <h2><i className="fas fa-th-large"></i> Kategori Menu</h2>
        <div style={{display:'flex', gap:'12px', alignItems:'center'}}>
          <div className="view-toggle"><button className={viewMode==='table'?'active':''} onClick={() => setViewMode('table')}><i className="fas fa-table"></i> Tabel</button><button className={viewMode==='cards'?'active':''} onClick={() => setViewMode('cards')}><i className="fas fa-th-large"></i> Kartu</button></div>
          {canWrite && <button className="btn btn-success" onClick={() => { setEditingCat(null); setShowModal(true); }}><i className="fas fa-plus"></i> Tambah Kategori</button>}
        </div>
      </div>
      {loading && <TableSkeleton rows={5} columns={6} />}
      <div style={{ display: !loading && viewMode==='table' ? 'block' : 'none' }}><table id="catTable" className="display" style={{width:'100%'}}></table></div>
      {!loading && viewMode==='cards' && (
        categories.length > 0 ? (
          <div className="cat-grid">
            {categories.map(cat => (
              <div key={cat.id} className={`cat-card ${cat.is_active ? '' : 'inactive'}`}>
                <div className="cat-card-header"><div className="cat-card-name">{cat.name}</div><span className={`sub-badge ${cat.menu_count===0?'zero':''}`}>{cat.menu_count}</span></div>
                <div className="cat-card-desc">{cat.description ? (cat.description.length > 80 ? cat.description.substring(0,80) + '...' : cat.description) : 'Tanpa deskripsi'}</div>
                <div className="cat-card-footer">
                  <span className="cat-card-meta"><i className="fas fa-user"></i> {cat.created_by_name}</span>
                  <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    {canWrite && (<div className="toggle-container" onClick={(e) => { e.stopPropagation(); handleToggle(cat); }} style={{marginBottom:0}}><div className={`toggle-track ${cat.is_active ? 'active' : ''}`} style={{width:'38px', height:'20px'}}><div className="toggle-thumb" style={{width:'16px', height:'16px', left: cat.is_active ? '20px' : '2px'}}></div></div></div>)}
                    {canWrite && <button className="action-icon edit-icon" onClick={(e) => { e.stopPropagation(); setEditingCat(cat); setShowModal(true); }} title="Ubah"><i className="fas fa-edit"></i></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (<div className="empty-state"><i className="fas fa-inbox"></i><p>Belum ada kategori</p></div>)
      )}
      {showModal && <CategoryModal editCat={editingCat} onClose={() => { setShowModal(false); setEditingCat(null); }} onSave={handleSave} />}
      {load && <div className="loading-ov"><div className="loading-popup"><div className="loading-progress"><div className="loading-progress-bar"></div></div><div className="loading-txt">{load}</div></div></div>}
    </div>
  );
}

function CategoryModal({ editCat, onClose, onSave }) {
  const [form, setForm] = useState({ name: editCat?.name || '', description: editCat?.description || '', is_active: editCat ? (editCat.is_active == 1) : true });
  const [nameError, setNameError] = useState('');
  const [nameOk, setNameOk] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleNameBlur = async () => {
    const n = form.name.trim();
    if (!n) { setNameError(''); setNameOk(false); return; }
    if (editCat && n === editCat.name) { setNameError(''); setNameOk(false); return; }
    setChecking(true);
    try { const r = await API.checkCategoryName(n, editCat?.id || 0); setChecking(false); if (r.success && r.exists) { setNameError('Nama kategori sudah ada'); setNameOk(false); } else { setNameError(''); setNameOk(true); } }
    catch(e) { setChecking(false); }
  };

  const handleSubmit = (e) => { e.preventDefault(); if (nameError) { Swal.fire({ icon:'warning', text:'Perbaiki dulu kesalahan validasi' }); return; } onSave({ name: form.name, description: form.description, is_active: form.is_active ? 1 : 0 }); };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'520px'}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3><i className={editCat ? 'fas fa-edit' : 'fas fa-plus-circle'}></i> {editCat ? 'Ubah' : 'Tambah'} Kategori</h3><button className="close-btn" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label><i className="fas fa-tag"></i> Nama Kategori *</label>
              <input type="text" value={form.name} onChange={(e) => { setForm({...form, name:e.target.value}); setNameError(''); setNameOk(false); }} onBlur={handleNameBlur} required />
              {checking && <div className="field-ok"><i className="fas fa-spinner fa-spin"></i> Memeriksa...</div>}
              {nameError && <div className="field-error"><i className="fas fa-exclamation-circle"></i> {nameError}</div>}
              {nameOk && <div className="field-ok"><i className="fas fa-check-circle"></i> Nama tersedia</div>}
            </div>
            <div className="form-group"><label><i className="fas fa-align-left"></i> Deskripsi</label><textarea rows="3" value={form.description} onChange={(e) => setForm({...form, description:e.target.value})} style={{resize:'vertical'}}></textarea></div>
            <ToggleSwitch label="Status" checked={form.is_active} onChange={(v) => setForm({...form, is_active:v})} />
            <div className="form-actions">
              <button type="submit" className="btn btn-primary"><i className="fas fa-save"></i> {editCat ? 'Perbarui' : 'Simpan'}</button>
              <button type="button" className="btn btn-secondary" onClick={onClose}><i className="fas fa-times"></i> Batal</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Supplier ── */
function SuppliersView({ user, openLedger }) {
  const _c = swrGet('suppliers');
  const [loading, setLoading] = useState(!_c);
  const [suppliers, setSuppliers] = useState(_c || []);
  const [showModal, setShowModal] = useState(false);
  const [editingSP, setEditingSP] = useState(null);
  const [load, setLoad] = useState('');
  const tableRef = useRef(null);
  const canWrite = user.role === 'admin' || user.role === 'manager';
  const canDelete = user.role === 'admin';

  useEffect(() => { if (_c) setTimeout(() => initTable(_c), 150); loadSuppliers(); return () => { if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; } catch(e){} } }; }, []);

  const loadSuppliers = async () => {
    if (!_c) setLoading(true);
    try { const r = await API.getSuppliers(user.id, user.role); setLoading(false); if (r.success) { swrSet('suppliers', r.data); setSuppliers(r.data); initTable(r.data); } else Swal.fire({ icon:'error', text:r.message }); }
    catch(e) { setLoading(false); Swal.fire({ icon:'error', text:'Gagal memuat supplier' }); }
  };

  const initTable = (data) => {
    if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; $('#suppTable').empty(); } catch(e){} }
    setTimeout(() => {
      try {
        const t = $('#suppTable').DataTable({
          data, destroy:true,
          columns:[
            { data:'name', title:'Nama Supplier', render:(d) => '<strong>' + d + '</strong>' },
            { data:'phone', title:'Telepon', render:(d) => d ? '<a href="tel:' + d + '" class="car-link">' + d + '</a>' : '<span style="color:#ccc">—</span>' },
            { data:'address', title:'Alamat', render:(d) => d && d.length > 40 ? d.substring(0,40) + '...' : (d || '<span style="color:#ccc">—</span>') },
            { data:'purchase_count', title:'Pembelian', className:'dt-center', render:(d) => '<span class="sub-badge ' + (d===0?'zero':'') + '">' + d + '</span>' },
            { data:'total_paid', title:'Total Dibayar', render:(d) => '<span class="paid-amount">' + fmtRp(d) + '</span>' },
            { data:'total_due', title:'Sisa Hutang', render:(d) => d > 0 ? '<span class="due-amount">' + fmtRp(d) + '</span>' : '<span style="color:#aaa">0</span>' },
            { data:'is_active', title:'Status', render:(d) => canWrite ? '<button class="action-icon toggle-icon ' + (d==1?'':'off') + '" data-action="toggle"><i class="fas ' + (d==1?'fa-toggle-on':'fa-toggle-off') + '"></i></button>' : '<span class="status-dot ' + (d==1?'active':'inactive') + '"></span>' },
            { data:null, title:'Aksi', orderable:false, render:(_,__,row) => {
              let h = '';
              if (canWrite) h += '<button class="action-icon edit-icon" data-action="edit"><i class="fas fa-edit"></i></button>';
              h += '<button class="action-icon ledger-icon" data-action="ledger" title="Kartu Hutang"><i class="fas fa-file-invoice-dollar"></i></button>';
              if (canDelete) { if (row.purchase_count > 0) h += '<button class="action-icon delete-icon disabled" title="Masih ada pembelian terkait"><i class="fas fa-trash"></i></button>'; else h += '<button class="action-icon delete-icon" data-action="delete"><i class="fas fa-trash"></i></button>'; }
              return h;
            }}
          ],
          pageLength:10, lengthMenu:[[10,25,50,-1],[10,25,50,"Semua"]], responsive:true, dom:'Blfrtip',
          buttons:[{ extend:'csv', text:'<i class="fas fa-file-csv"></i> CSV', exportOptions:{columns:[0,1,2,3,4,5]} },{ extend:'pdf', text:'<i class="fas fa-file-pdf"></i> PDF', exportOptions:{columns:[0,1,2,3,4,5]} },{ extend:'print', text:'<i class="fas fa-print"></i> Cetak', exportOptions:{columns:[0,1,2,3,4,5]} }],
          order:[[0,'desc']]
        });
        $('#suppTable').off('click', '.action-icon');
        $('#suppTable').on('click', '.action-icon', function() {
          if ($(this).hasClass('disabled')) return;
          const action = $(this).data('action');
          const row = t.row($(this).parents('tr')).data();
          if (action === 'edit') { setEditingSP(row); setShowModal(true); }
          else if (action === 'toggle') handleToggle(row);
          else if (action === 'ledger') openLedger(row.id);
          else if (action === 'delete') handleDelete(row);
        });
        tableRef.current = t;
      } catch(e) { console.error('suppTable:', e); }
    }, 150);
  };

  const handleSave = async (formData) => {
    setLoad(editingSP ? 'Memperbarui...' : 'Menambahkan...');
    try {
      let r;
      if (editingSP) r = await API.updateSupplier({ ...formData, id: editingSP.id }, user.id, user.role);
      else r = await API.addSupplier(formData, user.id, user.role);
      setLoad('');
      if (r.success) { setShowModal(false); setEditingSP(null); Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); loadSuppliers(); }
      else Swal.fire({ icon:'error', text:r.message });
    } catch(e) { setLoad(''); Swal.fire({ icon:'error', text:'Operasi gagal' }); }
  };

  const handleToggle = async (sp) => { setLoad('Memperbarui...'); try { const r = await API.toggleSupplierStatus(sp.id, user.id, user.role); setLoad(''); if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1200, showConfirmButton:false }); loadSuppliers(); } else Swal.fire({ icon:'error', text:r.message }); } catch(e) { setLoad(''); } };

  const handleDelete = (sp) => {
    Swal.fire({ icon:'warning', title:'Hapus Supplier?', text:'Hapus "' + sp.name + '"?', showCancelButton:true, confirmButtonColor:'#ea4335', confirmButtonText:'Hapus' }).then(async (res) => {
      if (res.isConfirmed) { setLoad('Menghapus...'); try { const r = await API.deleteSupplier(sp.id, user.id, user.role); setLoad(''); if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); loadSuppliers(); } else Swal.fire({ icon:'error', text:r.message }); } catch(e) { setLoad(''); Swal.fire({ icon:'error', text:'Gagal menghapus' }); } }
    });
  };

  return (
    <div className="data-section">
      <div className="section-header"><h2><i className="fas fa-handshake"></i> Supplier</h2>{canWrite && <button className="btn btn-success" onClick={() => { setEditingSP(null); setShowModal(true); }}><i className="fas fa-plus"></i> Tambah Supplier</button>}</div>
      {loading && <TableSkeleton rows={5} columns={7} />}
      <div style={{ display: loading ? 'none' : 'block' }}><table id="suppTable" className="display" style={{width:'100%'}}></table></div>
      {showModal && <SupplierModal editSP={editingSP} onClose={() => { setShowModal(false); setEditingSP(null); }} onSave={handleSave} />}
      {load && <div className="loading-ov"><div className="loading-popup"><div className="loading-progress"><div className="loading-progress-bar"></div></div><div className="loading-txt">{load}</div></div></div>}
    </div>
  );
}

function SupplierModal({ editSP, onClose, onSave }) {
  const [form, setForm] = useState({ name: editSP?.name || '', phone: editSP?.phone || '', address: editSP?.address || '', is_active: editSP ? (editSP.is_active == 1) : true });
  const handleSubmit = (e) => { e.preventDefault(); onSave({ ...form, is_active: form.is_active ? 1 : 0 }); };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'520px'}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3><i className={editSP ? 'fas fa-edit' : 'fas fa-plus-circle'}></i> {editSP ? 'Ubah' : 'Tambah'} Supplier</h3><button className="close-btn" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group"><label><i className="fas fa-user-tie"></i> Nama Supplier *</label><input type="text" value={form.name} onChange={(e) => setForm({...form, name:e.target.value})} required /></div>
            <div className="form-group"><label><i className="fas fa-phone"></i> Telepon</label><input type="tel" value={form.phone} onChange={(e) => setForm({...form, phone:e.target.value})} /></div>
            <div className="form-group"><label><i className="fas fa-map-marker-alt"></i> Alamat</label><textarea rows="2" value={form.address} onChange={(e) => setForm({...form, address:e.target.value})} style={{resize:'vertical'}}></textarea></div>
            <ToggleSwitch label="Status" checked={form.is_active} onChange={(v) => setForm({...form, is_active:v})} />
            <div className="form-actions"><button type="submit" className="btn btn-primary"><i className="fas fa-save"></i> {editSP ? 'Perbarui' : 'Simpan'}</button><button type="button" className="btn btn-secondary" onClick={onClose}><i className="fas fa-times"></i> Batal</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Kartu Hutang Supplier ── */
function SupplierLedgerView({ user, supplierId, goBack }) {
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [totals, setTotals] = useState({ paid: 0, due: 0, total: 0 });
  const [payPurchase, setPayPurchase] = useState(null);
  const tableRef = useRef(null);
  const canWrite = user.role === 'admin' || user.role === 'manager';

  useEffect(() => { if (supplierId) loadLedger(); return () => { if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; } catch(e){} } }; }, [supplierId]);

  const loadLedger = async () => {
    if (!supplier) setLoading(true);
    try {
      const r = await API.getSupplierLedger(supplierId, user.id, user.role);
      setLoading(false);
      if (r.success) {
        setSupplier(r.data.supplier); setLedger(r.data.ledger);
        const p = r.data.ledger.reduce((s,l) => s + l.paid_amount, 0);
        const t = r.data.ledger.reduce((s,l) => s + l.total_amount, 0);
        setTotals({ paid: Math.round(p*100)/100, due: Math.round((t-p)*100)/100, total: Math.round(t*100)/100 });
        if (r.data.ledger.length > 0) setTimeout(() => initLedgerTable(r.data.ledger), 150);
      } else { Swal.fire({ icon:'error', text:r.message }); goBack(); }
    } catch(e) { setLoading(false); Swal.fire({ icon:'error', text:'Gagal memuat kartu hutang' }); goBack(); }
  };

  const initLedgerTable = (data) => {
    if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; $('#ledgerTable').empty(); } catch(e){} }
    setTimeout(() => {
      try {
        const t = $('#ledgerTable').DataTable({
          data, destroy:true,
          columns:[
            { data:'purchase_no', title:'No Pembelian', render:(d) => '<strong>' + d + '</strong>' },
            { data:'item_name', title:'Barang' },
            { data:'date', title:'Tanggal', render:(d) => d ? fmtDateShort(d) : '—' },
            { data:'total_amount', title:'Total', render:(d) => '<strong>' + fmtRp(d) + '</strong>' },
            { data:'paid_amount', title:'Dibayar', render:(d) => '<span class="paid-amount">' + fmtRp(d) + '</span>' },
            { data:'due', title:'Sisa', render:(d) => d > 0 ? '<span class="due-amount">' + fmtRp(d) + '</span>' : '<span style="color:#aaa">0</span>' },
            { data:'status', title:'Status', render:(d) => '<span class="pur-status pur-' + d + '">' + d + '</span>' },
            { data:null, title:'', orderable:false, width:'40px', render:(_,__,row) => row.due > 0 && canWrite ? '<button class="action-icon" data-action="pay" title="Bayar" style="color:#2e7d32"><i class="fas fa-hand-holding-usd"></i></button>' : '' }
          ],
          pageLength:25, lengthMenu:[[25,50,100,-1],[25,50,100,"Semua"]], responsive:true, dom:'Blfrtip',
          buttons:[{ extend:'csv', text:'<i class="fas fa-file-csv"></i> CSV' },{ extend:'print', text:'<i class="fas fa-print"></i> Cetak' }],
          order:[[2,'asc']]
        });
        $('#ledgerTable').off('click', '.action-icon');
        $('#ledgerTable').on('click', '.action-icon', function() { const row = t.row($(this).parents('tr')).data(); if (row && row.due > 0) setPayPurchase(row); });
        tableRef.current = t;
      } catch(e) { console.error('ledgerTable:', e); }
    }, 50);
  };

  if (loading) return <div><div className="skeleton-card"><div className="skeleton skeleton-text-large" style={{width:'50%'}}></div><div className="skeleton skeleton-text" style={{width:'80%'}}></div></div><div style={{marginTop:'20px'}}><TableSkeleton rows={5} columns={6} /></div></div>;
  if (!supplier) return <div className="empty-state"><i className="fas fa-exclamation-circle"></i><p>Supplier tidak ditemukan</p></div>;

  return (
    <div>
      <div className="ledger-back"><button className="btn btn-secondary btn-sm" onClick={goBack}><i className="fas fa-arrow-left"></i> Kembali ke Supplier</button></div>
      <div className="ledger-header">
        <div className="ledger-info"><h2><i className="fas fa-user-tie"></i> {supplier.name}</h2>{supplier.phone && <p><i className="fas fa-phone"></i> <a href={'tel:' + supplier.phone} className="car-link">{supplier.phone}</a></p>}{supplier.address && <p><i className="fas fa-map-marker-alt"></i> {supplier.address}</p>}</div>
        <div className="ledger-stats">
          <div className="ledger-stat"><div className="ledger-stat-val" style={{color:'var(--navy-primary)'}}>{fmtRp(totals.total)}</div><div className="ledger-stat-lbl">Total</div></div>
          <div className="ledger-stat"><div className="ledger-stat-val paid-amount">{fmtRp(totals.paid)}</div><div className="ledger-stat-lbl">Dibayar</div></div>
          <div className="ledger-stat"><div className="ledger-stat-val due-amount">{fmtRp(totals.due)}</div><div className="ledger-stat-lbl">Sisa</div></div>
        </div>
      </div>
      <div className="data-section">
        <div className="section-header"><h2><i className="fas fa-file-invoice-dollar"></i> Riwayat Pembelian</h2></div>
        {ledger.length > 0 ? <table id="ledgerTable" className="display" style={{width:'100%'}}></table> : <div className="empty-state"><i className="fas fa-inbox"></i><p>Belum ada pembelian dari supplier ini</p></div>}
      </div>
      {payPurchase && <PaymentModal purchaseId={payPurchase.id} dueAmount={payPurchase.due} userId={user.id} role={user.role} onClose={() => setPayPurchase(null)} onSaved={() => { setPayPurchase(null); loadLedger(); }} />}
    </div>
  );
}

/* ── Pembelian Bahan Baku ── */
function PurchasesView({ user, openDetail }) {
  const _c = swrGet('purchases');
  const [loading, setLoading] = useState(!_c);
  const [purchases, setPurchases] = useState(_c || []);
  const [showForm, setShowForm] = useState(false);
  const [editingPur, setEditingPur] = useState(null);
  const [load, setLoad] = useState('');
  const tableRef = useRef(null);
  const [filters, setFilters] = useState({ supplier:'', status:'', dateFrom:'', dateTo:'' });
  const [suppliers, setSuppliers] = useState([]);
  const canWrite = user.role === 'admin' || user.role === 'manager';
  const canDelete = user.role === 'admin';

  useEffect(() => { if (_c) setTimeout(() => initTable(_c), 150); loadData(); return () => { dtCleanup(); if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; } catch(e){} } }; }, []);

  const loadData = async () => {
    if (!_c) setLoading(true);
    try {
      const [pRes, spRes] = await Promise.all([API.getPurchases(user.id, user.role), API.getSuppliersForDropdown()]);
      setLoading(false);
      if (pRes.success) { swrSet('purchases', pRes.data); setPurchases(pRes.data); initTable(pRes.data); }
      if (spRes.success) setSuppliers(spRes.data);
    } catch(e) { setLoading(false); Swal.fire({ icon:'error', text:'Gagal memuat' }); }
  };

  const qStats = React.useMemo(() => {
    const now = new Date(); const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nonCancelled = purchases.filter(p => p.status !== 'cancelled');
    return { totalAmt: nonCancelled.reduce((s,p) => s + p.total_amount, 0), thisMonth: nonCancelled.filter(p => new Date(p.purchase_date) >= mStart).reduce((s,p) => s + p.total_amount, 0), totalDue: nonCancelled.reduce((s,p) => s + p.due_amount, 0) };
  }, [purchases]);

  const initTable = (data) => {
    if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; $('#purTable').empty(); } catch(e){} }
    setTimeout(() => {
      try {
        const t = $('#purTable').DataTable({
          data, destroy:true,
          columns:[
            { data:'purchase_no', title:'No Pembelian', render:(d) => '<a class="car-link" data-action="detail">' + d + '</a>' },
            { data:'supplier_name', title:'Supplier' }, { data:'item_name', title:'Barang' },
            { data:'qty', title:'Qty', className:'dt-center', render:(d,_,row) => d + ' ' + (row.unit||'') },
            { data:'total_amount', title:'Total', render:(d) => '<strong>' + fmtRp(d) + '</strong>' },
            { data:'paid_amount', title:'Dibayar', render:(d) => '<span class="paid-amount">' + fmtRp(d) + '</span>' },
            { data:'due_amount', title:'Sisa', render:(d) => d > 0 ? '<span class="due-amount">' + fmtRp(d) + '</span>' : '<span style="color:#aaa">0</span>' },
            { data:'status', title:'Status', render:(d) => '<span class="pur-status pur-' + d + '">' + d + '</span>' },
            { data:'purchase_date', title:'Tanggal', render:(d) => fmtDateShort(d) },
            { data:null, title:'', orderable:false, width:'90px', render:(_,__,row) => {
              let h = '<button class="action-icon ledger-icon" data-action="detail" title="Lihat Detail"><i class="fas fa-eye"></i></button>';
              if (canWrite) h += '<button class="action-icon edit-icon" data-action="edit" title="Ubah"><i class="fas fa-edit"></i></button>';
              if (canDelete) h += '<button class="action-icon delete-icon" data-action="delete"><i class="fas fa-trash"></i></button>';
              return h;
            }}
          ],
          pageLength:10, lengthMenu:[[10,25,50,-1],[10,25,50,"Semua"]], responsive:true, dom:'Blfrtip',
          buttons:[{ extend:'csv', text:'<i class="fas fa-file-csv"></i> CSV' },{ extend:'pdf', text:'<i class="fas fa-file-pdf"></i> PDF' },{ extend:'print', text:'<i class="fas fa-print"></i> Cetak' }],
          order:[[8,'desc']]
        });
        $('#purTable').off('click', '.car-link, .action-icon');
        $('#purTable').on('click', '.car-link', function() { const row = t.row($(this).parents('tr')).data(); openDetail(row.id); });
        $('#purTable').on('click', '.action-icon', function() {
          const action = $(this).data('action'); const row = t.row($(this).parents('tr')).data();
          if (action === 'detail') openDetail(row.id); else if (action === 'edit') setEditingPur(row); else if (action === 'delete') handleDelete(row);
        });
        tableRef.current = t;
      } catch(e) { console.error('purTable:', e); }
    }, 150);
  };

  const applyFilters = () => {
    if (!tableRef.current) return;
    const dt = tableRef.current;
    while ($.fn.dataTable.ext.search.length > 0) $.fn.dataTable.ext.search.pop();
    if (filters.dateFrom || filters.dateTo) {
      $.fn.dataTable.ext.search.push((s,sd,idx) => { const row = dt.row(idx).data(); if (!row) return true; const d = new Date(row.purchase_date); if (filters.dateFrom && d < new Date(filters.dateFrom)) return false; if (filters.dateTo && d > new Date(filters.dateTo + 'T23:59:59')) return false; return true; });
    }
    dt.columns().search('');
    if (filters.supplier) dt.column(1).search(filters.supplier);
    if (filters.status) dt.column(7).search(filters.status);
    dt.draw();
  };
  const clearFilters = () => { setFilters({ supplier:'', status:'', dateFrom:'', dateTo:'' }); if (tableRef.current) { while ($.fn.dataTable.ext.search.length>0) $.fn.dataTable.ext.search.pop(); tableRef.current.columns().search('').draw(); } };
  useEffect(() => { if (tableRef.current && purchases.length > 0) applyFilters(); }, [filters]);

  const handleSaved = () => { setShowForm(false); loadData(); };
  const handleDelete = (pur) => {
    Swal.fire({ icon:'warning', title:'Hapus Pembelian?', text:'Hapus ' + pur.purchase_no + '?', showCancelButton:true, confirmButtonColor:'#ea4335', confirmButtonText:'Hapus' }).then(async (res) => {
      if (res.isConfirmed) { setLoad('Menghapus...'); try { const r = await API.deletePurchase(pur.id, user.id, user.role); setLoad(''); if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); loadData(); } else Swal.fire({ icon:'error', text:r.message }); } catch(e) { setLoad(''); } }
    });
  };

  const spOpts = suppliers.map(s => ({ value: s.name, label: s.name }));
  const statusOpts = [{ value:'pending', label:'Belum Lunas' },{ value:'completed', label:'Lunas' },{ value:'cancelled', label:'Dibatalkan' }];

  return (
    <div>
      {!loading && (
        <div className="quick-stats">
          <div className="quick-stat"><div className="quick-stat-icon" style={{background:'var(--navy-primary)'}}><i className="fas fa-shopping-cart"></i></div><div><div className="quick-stat-val">{fmtRp(qStats.totalAmt)}</div><div className="quick-stat-lbl">Total Pembelian</div></div></div>
          <div className="quick-stat"><div className="quick-stat-icon" style={{background:'var(--navy-accent)'}}><i className="fas fa-calendar-check"></i></div><div><div className="quick-stat-val">{fmtRp(qStats.thisMonth)}</div><div className="quick-stat-lbl">Bulan Ini</div></div></div>
          <div className="quick-stat"><div className="quick-stat-icon" style={{background:'#c62828'}}><i className="fas fa-exclamation-triangle"></i></div><div><div className="quick-stat-val due-amount">{fmtRp(qStats.totalDue)}</div><div className="quick-stat-lbl">Total Sisa Hutang</div></div></div>
        </div>
      )}
      <div className="data-section">
        <div className="section-header"><h2><i className="fas fa-shopping-cart"></i> Pembelian Bahan Baku</h2>{canWrite && <button className="btn btn-success" onClick={() => setShowForm(true)}><i className="fas fa-plus"></i> Tambah Pembelian</button>}</div>
        {!loading && (
          <div className="filters-section">
            <div className="filters-header"><h3><i className="fas fa-filter"></i> Filter</h3><button className="btn btn-secondary btn-sm" onClick={clearFilters}><i className="fas fa-times-circle"></i> Bersihkan</button></div>
            <div className="filters-grid">
              <SearchableDropdown label="Supplier" icon="fas fa-handshake" options={spOpts} value={filters.supplier} onChange={(v) => setFilters({...filters, supplier:v})} placeholder="Semua Supplier" />
              <SearchableDropdown label="Status" icon="fas fa-flag" options={statusOpts} value={filters.status} onChange={(v) => setFilters({...filters, status:v})} placeholder="Semua Status" />
              <div className="filter-group"><label><i className="fas fa-calendar-alt"></i> Dari Tanggal</label><input type="date" className="filter-input" value={filters.dateFrom} onChange={(e) => setFilters({...filters, dateFrom:e.target.value})} /></div>
              <div className="filter-group"><label><i className="fas fa-calendar-alt"></i> Sampai Tanggal</label><input type="date" className="filter-input" value={filters.dateTo} onChange={(e) => setFilters({...filters, dateTo:e.target.value})} /></div>
            </div>
          </div>
        )}
        {loading && <TableSkeleton rows={6} columns={9} />}
        <div style={{ display: loading ? 'none' : 'block' }}><table id="purTable" className="display" style={{width:'100%'}}></table></div>
      </div>
      {showForm && <PurchaseFormModal user={user} suppliers={suppliers} onClose={() => setShowForm(false)} onSaved={handleSaved} />}
      {editingPur && <PurchaseEditModal purchase={editingPur} suppliers={suppliers} user={user} onClose={() => setEditingPur(null)} onSaved={() => { setEditingPur(null); loadData(); }} />}
      {load && <div className="loading-ov"><div className="loading-popup"><div className="loading-progress"><div className="loading-progress-bar"></div></div><div className="loading-txt">{load}</div></div></div>}
    </div>
  );
}

function PurchaseFormModal({ user, suppliers, onClose, onSaved }) {
  const [form, setForm] = useState({ supplier_id:'', item_name:'', qty:'1', unit:'kg', unit_price:'', purchase_date: new Date().toISOString().split('T')[0], paid_amount:'0', notes:'' });
  const [load, setLoad] = useState('');
  const spOpts = suppliers.map(s => ({ value:String(s.id), label:s.name }));
  const unitOpts = [{value:'kg',label:'Kg'},{value:'gram',label:'Gram'},{value:'liter',label:'Liter'},{value:'pcs',label:'Pcs'},{value:'pack',label:'Pack'},{value:'karung',label:'Karung'}];
  const qty = parseFloat(form.qty)||0, price = parseFloat(form.unit_price)||0, total = Math.round(qty*price*100)/100;
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.item_name.trim()) { Swal.fire({ icon:'warning', text:'Nama barang wajib diisi' }); return; }
    setLoad('Menyimpan pembelian...');
    try { const r = await API.addPurchase(form, user.id, user.role); setLoad(''); if (r.success) { Swal.fire({ icon:'success', text: r.message + ' — ' + r.data.purchase_no, timer:2000, showConfirmButton:false }); onSaved(); } else Swal.fire({ icon:'error', text:r.message }); }
    catch(e) { setLoad(''); Swal.fire({ icon:'error', text:'Gagal' }); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'620px'}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3><i className="fas fa-plus-circle"></i> Pembelian Baru</h3><button className="close-btn" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <SearchableDropdown label="Supplier" icon="fas fa-handshake" options={spOpts} value={form.supplier_id} onChange={(v) => setForm({...form, supplier_id:v})} placeholder="Pilih supplier..." />
            <div className="form-group"><label><i className="fas fa-box"></i> Nama Barang *</label><input type="text" value={form.item_name} onChange={(e) => setForm({...form, item_name:e.target.value})} placeholder="cth: Beras, Ayam, Minyak Goreng" required /></div>
            <div className="form-grid">
              <div className="form-group"><label><i className="fas fa-balance-scale"></i> Jumlah *</label><input type="number" step="0.01" value={form.qty} onChange={(e) => setForm({...form, qty:e.target.value})} required /></div>
              <SearchableDropdown label="Satuan" icon="fas fa-ruler" options={unitOpts} value={form.unit} onChange={(v) => setForm({...form, unit:v||'kg'})} placeholder="Satuan" />
            </div>
            <div className="form-grid">
              <div className="form-group"><label><i className="fas fa-tag"></i> Harga Satuan *</label><input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({...form, unit_price:e.target.value})} required /></div>
              <div className="form-group"><label><i className="fas fa-calendar-alt"></i> Tanggal *</label><input type="date" value={form.purchase_date} onChange={(e) => setForm({...form, purchase_date:e.target.value})} required /></div>
            </div>
            <div className="form-group"><label><i className="fas fa-money-bill-wave"></i> Jumlah Dibayar</label><input type="number" step="0.01" value={form.paid_amount} onChange={(e) => setForm({...form, paid_amount:e.target.value})} /></div>
            <div className="calc-panel"><div className="calc-row"><span className="calc-label">Total</span><span className="calc-val">{fmtRp(total)}</span></div></div>
            <div className="form-group" style={{marginTop:'16px'}}><label><i className="fas fa-sticky-note"></i> Catatan</label><textarea rows="2" value={form.notes} onChange={(e) => setForm({...form, notes:e.target.value})} style={{resize:'vertical'}}></textarea></div>
            <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={!!load}>{load ? <><i className="fas fa-spinner fa-spin"></i> Menyimpan...</> : <><i className="fas fa-save"></i> Simpan Pembelian</>}</button><button type="button" className="btn btn-secondary" onClick={onClose}><i className="fas fa-times"></i> Batal</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}

function PurchaseEditModal({ purchase, suppliers, user, onClose, onSaved }) {
  const [form, setForm] = useState({ supplier_id: String(purchase.supplier_id||''), item_name: purchase.item_name||'', qty: String(purchase.qty||'1'), unit: purchase.unit||'kg', unit_price: String(purchase.unit_price||''), paid_amount: String(purchase.paid_amount||'0'), purchase_date: purchase.purchase_date||'', notes: purchase.notes||'', status: purchase.status||'pending' });
  const [saving, setSaving] = useState(false);
  const spOpts = suppliers.map(s => ({ value:String(s.id), label:s.name }));
  const unitOpts = [{value:'kg',label:'Kg'},{value:'gram',label:'Gram'},{value:'liter',label:'Liter'},{value:'pcs',label:'Pcs'},{value:'pack',label:'Pack'},{value:'karung',label:'Karung'}];
  const statusOpts = [{ value:'pending', label:'Belum Lunas' },{ value:'completed', label:'Lunas' },{ value:'cancelled', label:'Dibatalkan' }];
  const qty = parseFloat(form.qty)||0, price = parseFloat(form.unit_price)||0, total = Math.round(qty*price*100)/100;
  const paid = Math.min(parseFloat(form.paid_amount)||0, total); const due = Math.round((total-paid)*100)/100;
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try { const r = await API.updatePurchase({ id: purchase.id, ...form, paid_amount: paid }, user.id, user.role); setSaving(false); if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); onSaved(); } else Swal.fire({ icon:'error', text:r.message }); }
    catch(e) { setSaving(false); Swal.fire({ icon:'error', text:'Update gagal' }); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'620px'}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3><i className="fas fa-edit"></i> Ubah Pembelian — {purchase.purchase_no}</h3><button className="close-btn" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <SearchableDropdown label="Supplier" icon="fas fa-handshake" options={spOpts} value={form.supplier_id} onChange={(v) => setForm({...form, supplier_id:v})} placeholder="Pilih supplier..." />
            <div className="form-group"><label><i className="fas fa-box"></i> Nama Barang</label><input type="text" value={form.item_name} onChange={(e) => setForm({...form, item_name:e.target.value})} /></div>
            <div className="form-grid">
              <div className="form-group"><label>Jumlah</label><input type="number" step="0.01" value={form.qty} onChange={(e) => setForm({...form, qty:e.target.value})} /></div>
              <SearchableDropdown label="Satuan" options={unitOpts} value={form.unit} onChange={(v) => setForm({...form, unit:v||'kg'})} placeholder="Satuan" />
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Harga Satuan</label><input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({...form, unit_price:e.target.value})} /></div>
              <div className="form-group"><label><i className="fas fa-calendar-alt"></i> Tanggal</label><input type="date" value={form.purchase_date} onChange={(e) => setForm({...form, purchase_date:e.target.value})} /></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label><i className="fas fa-money-bill-wave"></i> Dibayar</label><input type="number" step="0.01" value={form.paid_amount} onChange={(e) => setForm({...form, paid_amount:e.target.value})} /></div>
              <SearchableDropdown label="Status" icon="fas fa-flag" options={statusOpts} value={form.status} onChange={(v) => setForm({...form, status:v||'pending'})} placeholder="Status" />
            </div>
            <div className="calc-panel" style={{marginBottom:'16px'}}>
              <div className="calc-row"><span className="calc-label">Total</span><span className="calc-val" style={{fontWeight:'700'}}>{fmtRp(total)}</span></div>
              <div className="calc-row"><span className="calc-label">Dibayar</span><span className="calc-val" style={{color:'#2e7d32'}}>{fmtRp(paid)}</span></div>
              <div className="calc-row"><span className="calc-label">Sisa</span><span className={'calc-val' + (due > 0 ? ' due-amount' : '')}>{due > 0 ? fmtRp(due) : '0'}</span></div>
            </div>
            <div className="form-group"><label><i className="fas fa-sticky-note"></i> Catatan</label><textarea rows="2" value={form.notes} onChange={(e) => setForm({...form, notes:e.target.value})} style={{resize:'vertical'}}></textarea></div>
            <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <><i className="fas fa-spinner fa-spin"></i> Menyimpan...</> : <><i className="fas fa-save"></i> Perbarui</>}</button><button type="button" className="btn btn-secondary" onClick={onClose}><i className="fas fa-times"></i> Batal</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}

function PurchaseDetailView({ user, purchaseId, goBack }) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);

  useEffect(() => { if (purchaseId) loadDetail(); }, [purchaseId]);
  const loadDetail = async () => {
    if (!detail) setLoading(true);
    try { const r = await API.getPurchaseDetail(purchaseId, user.id, user.role); setLoading(false); if (r.success) setDetail(r.data); else { Swal.fire({ icon:'error', text:r.message }); goBack(); } }
    catch(e) { setLoading(false); goBack(); }
  };
  const handlePaymentSaved = () => { setShowPayModal(false); loadDetail(); };
  if (loading) return <div><div className="skeleton-card"><div className="skeleton skeleton-text-large" style={{width:'40%'}}></div></div></div>;
  if (!detail) return <div className="empty-state"><i className="fas fa-exclamation-circle"></i><p>Pembelian tidak ditemukan</p></div>;
  const canWrite = user.role === 'admin' || user.role === 'manager';
  return (
    <div>
      <div className="ledger-back"><button className="btn btn-secondary btn-sm" onClick={goBack}><i className="fas fa-arrow-left"></i> Kembali ke Pembelian</button></div>
      <div className="data-section" style={{marginBottom:'20px'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}><h2 style={{color:'#333', display:'flex', alignItems:'center', gap:'10px'}}><i className="fas fa-file-alt"></i> {detail.purchase_no}</h2><span className={'pur-status pur-' + detail.status}>{detail.status}</span></div>
        <div className="pur-info-grid">
          <div className="pur-info-item"><label>Supplier</label><span>{detail.supplier_name}</span></div>
          <div className="pur-info-item"><label>Barang</label><span>{detail.item_name}</span></div>
          <div className="pur-info-item"><label>Tanggal</label><span>{fmtDateShort(detail.purchase_date)}</span></div>
          <div className="pur-info-item"><label>Jumlah</label><span>{detail.qty} {detail.unit}</span></div>
          <div className="pur-info-item"><label>Harga Satuan</label><span>{fmtRp(detail.unit_price)}</span></div>
          <div className="pur-info-item"><label>Total</label><span><strong>{fmtRp(detail.total_amount)}</strong></span></div>
          <div className="pur-info-item"><label>Dibayar</label><span className="paid-amount">{fmtRp(detail.paid_amount)}</span></div>
          <div className="pur-info-item"><label>Sisa</label><span className="due-amount">{fmtRp(detail.due_amount)}</span></div>
        </div>
        {detail.notes && <p style={{color:'#666', fontSize:'14px', marginTop:'8px'}}><i className="fas fa-sticky-note"></i> {detail.notes}</p>}
      </div>
      <div className="data-section">
        <div className="section-header"><h2><i className="fas fa-money-bill-wave"></i> Riwayat Pembayaran</h2>{canWrite && detail.due_amount > 0 && <button className="btn btn-success btn-sm" onClick={() => setShowPayModal(true)}><i className="fas fa-plus"></i> Tambah Pembayaran</button>}</div>
        {detail.payments.length > 0 ? detail.payments.map((p,i) => (
          <div key={i} className="payment-row"><div><span className="paid-amount" style={{fontSize:'16px', fontWeight:'700'}}>{fmtRp(p.amount)}</span>{p.notes && <span style={{color:'#888', fontSize:'13px', marginLeft:'10px'}}>— {p.notes}</span>}</div><div style={{textAlign:'right'}}><div style={{fontSize:'13px', color:'#888'}}>{fmtDateShort(p.date)}</div><div style={{fontSize:'12px', color:'#aaa'}}>oleh {p.created_by_name}</div></div></div>
        )) : <div className="empty-state"><i className="fas fa-inbox"></i><p>Belum ada pembayaran tercatat</p></div>}
      </div>
      {showPayModal && <PaymentModal purchaseId={detail.id} dueAmount={detail.due_amount} userId={user.id} role={user.role} onClose={() => setShowPayModal(false)} onSaved={handlePaymentSaved} />}
    </div>
  );
}

function PaymentModal({ purchaseId, dueAmount, userId, role, onClose, onSaved }) {
  const [form, setForm] = useState({ amount:'', payment_method:'tunai', reference_no:'', payment_date: new Date().toISOString().split('T')[0], notes:'' });
  const [saving, setSaving] = useState(false);
  const methodOpts = [{ value:'tunai', label:'Tunai' },{ value:'transfer', label:'Transfer Bank' },{ value:'qris', label:'QRIS' },{ value:'ewallet', label:'E-Wallet' }];
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (parseFloat(form.amount) <= 0) { Swal.fire({ icon:'warning', text:'Masukkan jumlah yang valid' }); return; }
    if (parseFloat(form.amount) > dueAmount) { Swal.fire({ icon:'warning', text:'Jumlah melebihi sisa hutang (' + fmtRp(dueAmount) + ')' }); return; }
    setSaving(true);
    try { const r = await API.addPayment({ purchase_id: purchaseId, ...form }, userId, role); setSaving(false); if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); onSaved(); } else Swal.fire({ icon:'error', text:r.message }); }
    catch(e) { setSaving(false); Swal.fire({ icon:'error', text:'Gagal' }); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'450px'}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3><i className="fas fa-money-bill-wave"></i> Tambah Pembayaran</h3><button className="close-btn" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-body">
          <p style={{marginBottom:'16px', fontSize:'14px', color:'#666'}}>Sisa: <strong className="due-amount">{fmtRp(dueAmount)}</strong></p>
          <form onSubmit={handleSubmit}>
            <div className="form-group"><label><i className="fas fa-money-bill-wave"></i> Jumlah *</label><input type="number" step="0.01" max={dueAmount} value={form.amount} onChange={(e) => setForm({...form, amount:e.target.value})} required placeholder="Masukkan jumlah" /></div>
            <SearchableDropdown label="Metode Pembayaran" icon="fas fa-credit-card" options={methodOpts} value={form.payment_method} onChange={(v) => setForm({...form, payment_method:v||'tunai'})} placeholder="Pilih metode..." />
            <div className="form-group"><label><i className="fas fa-hashtag"></i> No. Referensi</label><input type="text" value={form.reference_no} onChange={(e) => setForm({...form, reference_no:e.target.value})} /></div>
            <div className="form-group"><label><i className="fas fa-calendar-alt"></i> Tanggal Bayar</label><input type="date" value={form.payment_date} onChange={(e) => setForm({...form, payment_date:e.target.value})} /></div>
            <div className="form-group"><label><i className="fas fa-sticky-note"></i> Catatan</label><input type="text" value={form.notes} onChange={(e) => setForm({...form, notes:e.target.value})} /></div>
            <div className="form-actions"><button type="submit" className="btn btn-success" disabled={saving}>{saving ? <><i className="fas fa-spinner fa-spin"></i> Menyimpan...</> : <><i className="fas fa-check"></i> Catat Pembayaran</>}</button><button type="button" className="btn btn-secondary" onClick={onClose}><i className="fas fa-times"></i> Batal</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Menu (inti) ── */
function MenuView({ user }) {
  const _c = swrGet('menu');
  const [loading, setLoading] = useState(!_c);
  const [items, setItems] = useState(_c || []);
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [load, setLoad] = useState('');
  const [categories, setCategories] = useState([]);
  const tableRef = useRef(null);
  const [filters, setFilters] = useState({ category:'', status:'', name:'' });
  const canWrite = user.role === 'admin' || user.role === 'manager';
  const canDelete = user.role === 'admin';

  useEffect(() => { if (_c) setTimeout(() => initTable(_c), 150); loadData(); return () => { dtCleanup(); if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; } catch(e){} } }; }, []);

  const loadData = async () => {
    if (!_c) setLoading(true);
    try {
      const [miRes, catRes] = await Promise.all([API.getMenuItems(user.id, user.role), API.getCategoriesForDropdown()]);
      setLoading(false);
      if (miRes.success) { swrSet('menu', miRes.data); setItems(miRes.data); initTable(miRes.data); }
      if (catRes.success) setCategories(catRes.data);
    } catch(e) { setLoading(false); Swal.fire({ icon:'error', text:'Gagal memuat' }); }
  };

  const qStats = React.useMemo(() => {
    const avail = items.filter(i => i.is_available);
    return { total: items.length, available: avail.length, lowStock: items.filter(i => i.track_stock && i.stock_qty <= 5).length, avgPrice: avail.length ? avail.reduce((s,i) => s+i.price,0)/avail.length : 0 };
  }, [items]);

  const handleMenuAction = (action, row) => {
    if (!row) return;
    if (action === 'detail') setDetailItem(row);
    else if (action === 'edit') { setEditingItem(row); setShowDrawer(true); }
    else if (action === 'toggle') handleToggle(row);
    else if (action === 'delete') handleDelete(row);
  };

  const initTable = (data) => {
    if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; $('#menuTable').empty(); } catch(e){} }
    setTimeout(() => {
      try {
        const t = $('#menuTable').DataTable({
          data, destroy:true,
          columns:[
            { data:null, title:'', orderable:false, width:'56px', render:(_,__,row) => { const d = row.image || ''; return d ? '<img src="https://lh3.google.com/u/0/d/' + d + '" class="dt-thumb" alt="" />' : '<span class="dt-thumb-ph"><i class="fas fa-utensils"></i></span>'; } },
            { data:'name', title:'Nama Menu', render:(d) => '<a class="car-link" data-action="detail"><strong>' + d + '</strong></a>' },
            { data:'category_name', title:'Kategori', render:(d) => '<span class="role-badge role-manager">' + d + '</span>' },
            { data:'price', title:'Harga Jual', render:(d) => '<strong>' + fmtRp(d) + '</strong>' },
            { data:null, title:'Stok', className:'dt-center', render:(_,__,row) => row.track_stock ? '<span class="piece-badge ' + (row.stock_qty <= 5 ? 'sold' : 'avail') + '">' + row.stock_qty + '</span>' : '<span style="color:#aaa">Tanpa lacak</span>' },
            { data:'is_available', title:'Status', render:(d) => '<span class="pur-status ' + (d==1?'pur-completed':'pur-cancelled') + '">' + (d==1?'Tersedia':'Habis/Nonaktif') + '</span>' },
            { data:null, title:'', orderable:false, width:'90px', render:(_,__,row) => {
              let h = '<button type="button" class="action-icon ledger-icon" data-action="detail" title="Lihat"><i class="fas fa-eye"></i></button>';
              if (canWrite) h += '<button type="button" class="action-icon edit-icon" data-action="edit" title="Ubah"><i class="fas fa-edit"></i></button>';
              h += '<button type="button" class="action-icon toggle-icon ' + (row.is_available==1?'':'off') + '" data-action="toggle" title="Toggle Tersedia"><i class="fas ' + (row.is_available==1?'fa-toggle-on':'fa-toggle-off') + '"></i></button>';
              if (canDelete) h += '<button type="button" class="action-icon delete-icon" data-action="delete" title="Hapus"><i class="fas fa-trash"></i></button>';
              return h;
            }}
          ],
          pageLength:10, lengthMenu:[[10,25,50,100,-1],[10,25,50,100,"Semua"]], responsive:true, dom:'Blfrtip',
          buttons:[{ extend:'csv', text:'<i class="fas fa-file-csv"></i> CSV', exportOptions:{columns:[1,2,3,4,5]} },{ extend:'pdf', text:'<i class="fas fa-file-pdf"></i> PDF', exportOptions:{columns:[1,2,3,4,5]} },{ extend:'print', text:'<i class="fas fa-print"></i> Cetak', exportOptions:{columns:[1,2,3,4,5]} }],
          order:[[1,'asc']]
        });
        $('#menuTable').off('click', '.car-link, .action-icon');
        $('#menuTable').on('click', '.car-link', function(e) { e.preventDefault(); e.stopPropagation(); const row = t.row($(this).closest('tr')).data(); setDetailItem(row); });
        $('#menuTable').on('click', '.action-icon', function(e) {
          e.preventDefault(); e.stopPropagation();
          const action = $(this).data('action');
          const row = t.row($(this).closest('tr')).data();
          handleMenuAction(action, row);
        });
        tableRef.current = t;
      } catch(e) { console.error('menuTable:', e); }
    }, 150);
  };

  const applyFilters = () => {
    if (!tableRef.current) return;
    const dt = tableRef.current;
    while ($.fn.dataTable.ext.search.length > 0) $.fn.dataTable.ext.search.pop();
    dt.columns().search('');
    if (filters.name) dt.column(1).search(filters.name);
    if (filters.category) dt.column(2).search(filters.category);
    if (filters.status) dt.column(5).search(filters.status === '1' ? 'Tersedia' : 'Habis');
    dt.draw();
  };
  const clearFilters = () => { setFilters({ category:'', status:'', name:'' }); if (tableRef.current) { tableRef.current.columns().search('').draw(); } };
  useEffect(() => { if (tableRef.current && items.length > 0) applyFilters(); }, [filters]);

  const handleToggle = async (item) => {
    setLoad('Memperbarui...');
    try { const r = await API.toggleMenuAvailability(item.id, user.id, user.role); setLoad(''); if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1000, showConfirmButton:false }); loadData(); } else Swal.fire({ icon:'error', text:r.message }); } catch(e) { setLoad(''); }
  };
  const handleDelete = (item) => {
    Swal.fire({ icon:'warning', title:'Hapus Menu?', text:'Hapus "' + item.name + '"?', showCancelButton:true, confirmButtonColor:'#ea4335', confirmButtonText:'Hapus' }).then(async (res) => {
      if (res.isConfirmed) { setLoad('Menghapus...'); try { const r = await API.deleteMenuItem(item.id, user.id, user.role); setLoad(''); if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); loadData(); } else Swal.fire({ icon:'error', text:r.message }); } catch(e) { setLoad(''); Swal.fire({ icon:'error', text:'Gagal menghapus' }); } }
    });
  };
  const handleDrawerSaved = () => { setShowDrawer(false); setEditingItem(null); loadData(); };
  const catOpts = categories.map(c => ({ value:c.name, label:c.name }));
  const statusOpts = [{ value:'1', label:'Tersedia' },{ value:'0', label:'Habis/Nonaktif' }];

  return (
    <div>
      {!loading && (
        <div className="quick-stats">
          <div className="quick-stat"><div className="quick-stat-icon" style={{background:'#2e7d32'}}><i className="fas fa-utensils"></i></div><div><div className="quick-stat-val">{qStats.total}</div><div className="quick-stat-lbl">Total Menu</div></div></div>
          <div className="quick-stat"><div className="quick-stat-icon" style={{background:'var(--navy-primary)'}}><i className="fas fa-check-circle"></i></div><div><div className="quick-stat-val">{qStats.available}</div><div className="quick-stat-lbl">Tersedia</div></div></div>
          <div className="quick-stat"><div className="quick-stat-icon" style={{background:'#e65100'}}><i className="fas fa-box-open"></i></div><div><div className="quick-stat-val">{qStats.lowStock}</div><div className="quick-stat-lbl">Stok Menipis</div></div></div>
          <div className="quick-stat"><div className="quick-stat-icon" style={{background:'#6f42c1'}}><i className="fas fa-tags"></i></div><div><div className="quick-stat-val">{fmtRp(qStats.avgPrice)}</div><div className="quick-stat-lbl">Rata-rata Harga</div></div></div>
        </div>
      )}
      <div className="data-section">
        <div className="section-header"><h2><i className="fas fa-utensils"></i> Menu</h2>{canWrite && <button className="btn btn-success" onClick={() => { setEditingItem(null); setShowDrawer(true); }}><i className="fas fa-plus"></i> Tambah Menu</button>}</div>
        {!loading && (
          <div className="filters-section">
            <div className="filters-header"><h3><i className="fas fa-filter"></i> Filter</h3><button className="btn btn-secondary btn-sm" onClick={clearFilters}><i className="fas fa-times-circle"></i> Bersihkan</button></div>
            <div className="filters-grid">
              <div className="filter-group"><label><i className="fas fa-search"></i> Cari Nama</label><input type="text" className="filter-input" value={filters.name} onChange={(e) => setFilters({...filters, name:e.target.value})} placeholder="Cari menu..." /></div>
              <SearchableDropdown label="Kategori" icon="fas fa-th-large" options={catOpts} value={filters.category} onChange={(v) => setFilters({...filters, category:v})} placeholder="Semua Kategori" />
              <SearchableDropdown label="Status" icon="fas fa-flag" options={statusOpts} value={filters.status} onChange={(v) => setFilters({...filters, status:v})} placeholder="Semua Status" />
            </div>
          </div>
        )}
        {loading && <TableSkeleton rows={8} columns={6} />}
        <div style={{ display: loading ? 'none' : 'block' }}><table id="menuTable" className="display" style={{width:'100%'}}></table></div>
      </div>
      {showDrawer && <MenuDrawer user={user} categories={categories} editingItem={editingItem} onClose={() => { setShowDrawer(false); setEditingItem(null); }} onSaved={handleDrawerSaved} />}
      {detailItem && <MenuDetailModal item={detailItem} user={user} onClose={() => setDetailItem(null)} onUpdated={() => { setDetailItem(null); loadData(); }} />}
      {load && <div className="loading-ov"><div className="loading-popup"><div className="loading-progress"><div className="loading-progress-bar"></div></div><div className="loading-txt">{load}</div></div></div>}
    </div>
  );
}

function MenuDrawer({ user, categories, editingItem, onClose, onSaved }) {
  const isEdit = !!editingItem;
  const [form, setForm] = useState({ category_id: isEdit ? String(editingItem.category_id) : '', name: editingItem?.name || '', description: editingItem?.description || '', price: editingItem ? String(editingItem.price) : '', cost: editingItem ? String(editingItem.cost) : '0', track_stock: editingItem ? !!editingItem.track_stock : false, stock_qty: editingItem ? String(editingItem.stock_qty) : '0', notes: editingItem?.notes || '' });
  const [imageData, setImageData] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [nameErr, setNameErr] = useState(''); const [nameOk, setNameOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const catOpts = categories.map(c => ({ value:String(c.id), label:c.name }));

  const checkName = async () => {
    const n = form.name.trim();
    if (!n) { setNameErr(''); setNameOk(false); return; }
    if (isEdit && n.toLowerCase() === editingItem.name.toLowerCase()) { setNameErr(''); setNameOk(false); return; }
    const r = await API.checkMenuName(n, isEdit ? editingItem.id : 0);
    if (r.success && r.exists) { setNameErr('Nama menu sudah ada'); setNameOk(false); } else { setNameErr(''); setNameOk(true); }
  };

  const price = parseFloat(form.price)||0, cost = parseFloat(form.cost)||0, margin = price - cost;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (nameErr) { Swal.fire({ icon:'warning', text:'Perbaiki dulu nama menu' }); return; }
    setSaving(true);
    const payload = { ...form, track_stock: form.track_stock ? 1 : 0 };
    if (imageData) payload.imageData = imageData;
    if (removeImage) payload.removeImage = true;
    let r;
    if (isEdit) r = await API.updateMenuItem({ ...payload, id: editingItem.id }, user.id, user.role);
    else r = await API.addMenuItem(payload, user.id, user.role);
    setSaving(false);
    if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); onSaved(); }
    else Swal.fire({ icon:'error', text:r.message });
  };

  return (
    <div>
      <div className="drawer-overlay" onClick={onClose} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000}}></div>
      <div style={{position:'fixed', top:0, right:0, width:'480px', maxWidth:'95vw', height:'100vh', background:'white', zIndex:1001, boxShadow:'-4px 0 24px rgba(0,0,0,0.15)', overflowY:'auto', display:'flex', flexDirection:'column'}}>
        <div className="modal-header" style={{borderRadius:0}}><h3><i className={isEdit ? 'fas fa-edit' : 'fas fa-plus-circle'}></i> {isEdit ? 'Ubah' : 'Tambah'} Menu</h3><button className="close-btn" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div style={{padding:'24px', flex:1}}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label><i className="fas fa-utensils"></i> Nama Menu *</label>
              <input type="text" value={form.name} onChange={(e) => { setForm({...form, name:e.target.value}); setNameErr(''); setNameOk(false); }} onBlur={checkName} required />
              {nameErr && <div className="field-error"><i className="fas fa-exclamation-circle"></i> {nameErr}</div>}
              {nameOk && <div className="field-ok"><i className="fas fa-check-circle"></i> Nama tersedia</div>}
            </div>
            <SearchableDropdown label="Kategori" icon="fas fa-th-large" options={catOpts} value={form.category_id} onChange={(v) => setForm({...form, category_id:v})} placeholder="Pilih kategori..." required />
            <div className="form-group"><label><i className="fas fa-align-left"></i> Deskripsi</label><textarea rows="2" value={form.description} onChange={(e) => setForm({...form, description:e.target.value})} style={{resize:'vertical'}}></textarea></div>
            <div className="form-grid">
              <div className="form-group"><label><i className="fas fa-tag"></i> Harga Jual *</label><input type="number" step="100" value={form.price} onChange={(e) => setForm({...form, price:e.target.value})} required /></div>
              <div className="form-group"><label><i className="fas fa-coins"></i> Modal (opsional)</label><input type="number" step="100" value={form.cost} onChange={(e) => setForm({...form, cost:e.target.value})} /></div>
            </div>
            {price > 0 && cost > 0 && (<div className="calc-panel"><div className="calc-row"><span className="calc-label">Estimasi Margin</span><span className="calc-val profit">{fmtRp(margin)}</span></div></div>)}
            <div style={{marginTop:'16px'}}>
              <ToggleSwitch label="Lacak Stok?" checked={form.track_stock} onChange={(v) => setForm({...form, track_stock:v})} />
              {form.track_stock && (<div className="form-group"><label><i className="fas fa-cubes"></i> Jumlah Stok</label><input type="number" value={form.stock_qty} onChange={(e) => setForm({...form, stock_qty:e.target.value})} /></div>)}
            </div>
            <div className="form-group"><label><i className="fas fa-sticky-note"></i> Catatan (varian, alergen, dll)</label><input type="text" value={form.notes} onChange={(e) => setForm({...form, notes:e.target.value})} /></div>
            <AvatarUpload existingFileId={editingItem?.image || ''} onChange={(d, removed) => { setImageData(removed ? null : d); setRemoveImage(!!removed); }} label="Foto Menu" icon="fas fa-image" round={false} />
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <><i className="fas fa-spinner fa-spin"></i> Menyimpan...</> : <><i className="fas fa-save"></i> {isEdit ? 'Perbarui' : 'Simpan'} Menu</>}</button>
              <button type="button" className="btn btn-secondary" onClick={onClose}><i className="fas fa-times"></i> Batal</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function MenuDetailModal({ item, user, onClose, onUpdated }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [load, setLoad] = useState('');
  const [stockEdit, setStockEdit] = useState(false);
  const [newStock, setNewStock] = useState('');
  const canEdit = user.role === 'admin' || user.role === 'manager';

  useEffect(() => { loadDetail(); }, []);
  const loadDetail = async () => { const r = await API.getMenuItemDetail(item.id); setLoading(false); if (r.success) { setDetail(r.data); setNewStock(String(r.data.stock_qty)); } };
  const saveStock = async () => {
    setLoad('Memperbarui stok...');
    const r = await API.updateMenuStock(item.id, newStock, user.id, user.role);
    setLoad('');
    if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1200, showConfirmButton:false }); setStockEdit(false); onUpdated(); }
    else Swal.fire({ icon:'error', text:r.message });
  };
  if (loading) return <div className="modal-overlay" onClick={onClose}><div className="modal" style={{maxWidth:'500px'}} onClick={(e)=>e.stopPropagation()}><div className="modal-body"><TableSkeleton rows={3} columns={2} /></div></div></div>;
  if (!detail) return null;
  const margin = detail.price - detail.cost;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'560px'}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3><i className="fas fa-utensils"></i> {detail.name}</h3><button className="close-btn" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-body">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px'}}><span className="role-badge role-manager">{detail.category_name}</span><span className={'pur-status ' + (detail.is_available?'pur-completed':'pur-cancelled')}>{detail.is_available?'Tersedia':'Habis/Nonaktif'}</span></div>
          {detail.image ? <img src={'https://lh3.google.com/u/0/d/' + detail.image} alt={detail.name} style={{maxWidth:'100%', maxHeight:'200px', borderRadius:'6px', border:'1px solid #e0e0e0', display:'block', margin:'0 auto 16px'}} /> : null}
          {detail.description && <p style={{color:'#666', marginBottom:'16px'}}>{detail.description}</p>}
          <div className="stock-detail-grid">
            <div className="stock-detail-item"><div className="val">{fmtRp(detail.price)}</div><div className="lbl">Harga Jual</div></div>
            <div className="stock-detail-item"><div className="val">{fmtRp(detail.cost)}</div><div className="lbl">Modal</div></div>
            <div className="stock-detail-item"><div className="val paid-amount">{fmtRp(margin)}</div><div className="lbl">Margin</div></div>
          </div>
          {detail.track_stock && (
            <div style={{marginBottom:'16px'}}>
              <label style={{fontSize:'13px', fontWeight:'600', color:'#555', marginBottom:'8px', display:'block'}}>Stok Saat Ini</label>
              {!stockEdit ? (
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}><span className="piece-badge total" style={{fontSize:'16px'}}>{detail.stock_qty}</span>{canEdit && <button className="btn btn-secondary btn-sm" onClick={() => setStockEdit(true)}><i className="fas fa-edit"></i> Ubah Stok</button>}</div>
              ) : (
                <div style={{display:'flex', gap:'8px'}}><input type="number" value={newStock} onChange={(e) => setNewStock(e.target.value)} style={{width:'100px', padding:'8px'}} /><button className="btn btn-success btn-sm" onClick={saveStock}><i className="fas fa-save"></i></button><button className="btn btn-secondary btn-sm" onClick={() => setStockEdit(false)}><i className="fas fa-times"></i></button></div>
              )}
            </div>
          )}
          {detail.notes && <p style={{color:'#666', fontSize:'13px'}}><i className="fas fa-sticky-note"></i> {detail.notes}</p>}
        </div>
      </div>
      {load && <div className="loading-ov"><div className="loading-popup"><div className="loading-progress"><div className="loading-progress-bar"></div></div><div className="loading-txt">{load}</div></div></div>}
    </div>
  );
}

/* ── Impor Massal Menu ── */
function BulkImportModal({ user, categories, onClose, onDone }) {
  const [catId, setCatId] = useState('');
  const [items, setItems] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const catOpts = categories.map(c => ({ value:String(c.id), label:c.name }));

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split('\n').filter(l => l.trim());
      const parsed = [];
      lines.forEach((line, i) => {
        if (i === 0 && line.toLowerCase().includes('nama')) return;
        const parts = line.split(',').map(p => p.trim().replace(/"/g, ''));
        if (parts.length >= 2) {
          const name = parts[0], price = parseFloat(parts[1]), stock = parseInt(parts[2]) || 0;
          const valid = name && !isNaN(price) && price > 0;
          parsed.push({ name, price: price || 0, stock, valid, reason: !name ? 'Nama kosong' : (!price || price<=0) ? 'Harga tidak valid' : '' });
        }
      });
      setItems(parsed);
    };
    reader.readAsText(file);
  };

  const doImport = async () => {
    setImporting(true);
    const validItems = items.filter(i => i.valid).map(i => ({ name: i.name, price: i.price, stock: i.stock }));
    const r = await API.bulkImportMenu(validItems, parseInt(catId), user.id, user.role);
    setImporting(false);
    if (r.success) setResult(r.data); else Swal.fire({ icon:'error', text:r.message });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'650px'}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3><i className="fas fa-file-import"></i> Impor Massal Menu</h3><button className="close-btn" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-body">
          {!result ? (
            <div>
              <div className="import-step">
                <span className="import-step-num">1</span><strong>Pilih Kategori</strong>
                <div style={{marginTop:'12px'}}><SearchableDropdown label="Kategori" icon="fas fa-th-large" options={catOpts} value={catId} onChange={setCatId} placeholder="Pilih kategori..." required /></div>
              </div>
              <div className="import-step">
                <span className="import-step-num">2</span><strong>Unggah CSV</strong>
                <p style={{fontSize:'13px', color:'#888', margin:'8px 0'}}>Format: nama_menu, harga, stok (stok opsional, default 0 = tidak dilacak)</p>
                <a href="data:text/csv;charset=utf-8,nama_menu,harga,stok%0ANasi Goreng,22000,0%0AEs Teh Manis,5000,50" download="template_impor_menu.csv" className="btn btn-secondary btn-sm" style={{marginBottom:'10px'}}><i className="fas fa-download"></i> Unduh Template</a>
                <div className="upload-zone" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); }}>
                  <i className="fas fa-cloud-upload-alt" style={{fontSize:'32px', color:'#ccc', marginBottom:'8px'}}></i>
                  <p className="upload-hint">Seret CSV atau klik untuk unggah</p>
                </div>
                <input ref={fileRef} type="file" accept=".csv,.txt" style={{display:'none'}} onChange={(e) => { if (e.target.files.length) handleFile(e.target.files[0]); }} />
              </div>
              {items.length > 0 && (
                <div className="import-step">
                  <span className="import-step-num">3</span><strong>Pratinjau ({items.filter(i=>i.valid).length} valid, {items.filter(i=>!i.valid).length} error)</strong>
                  <div style={{maxHeight:'200px', overflowY:'auto', marginTop:'10px'}}>
                    {items.slice(0, 30).map((item, i) => (<div key={i} className={'import-preview-row ' + (item.valid ? 'valid' : 'invalid')}><strong>{item.name || '(kosong)'}</strong> — {fmtRp(item.price)} {item.stock > 0 ? '(' + item.stock + ' stok)' : ''} {!item.valid && <span style={{color:'#c62828', marginLeft:'8px'}}>{item.reason}</span>}</div>))}
                  </div>
                  <button className="btn btn-success" style={{marginTop:'12px'}} disabled={importing || !catId || items.filter(i=>i.valid).length === 0} onClick={doImport}>{importing ? <><i className="fas fa-spinner fa-spin"></i> Mengimpor...</> : <><i className="fas fa-check"></i> Impor {items.filter(i=>i.valid).length} Item</>}</button>
                </div>
              )}
            </div>
          ) : (
            <div style={{textAlign:'center', padding:'20px'}}>
              <i className="fas fa-check-circle" style={{fontSize:'48px', color:'#2e7d32', marginBottom:'16px'}}></i>
              <h3 style={{marginBottom:'12px'}}>Impor Selesai</h3>
              <p><span className="paid-amount" style={{fontSize:'20px'}}>{result.success}</span> berhasil diimpor</p>
              {result.failed > 0 && <p style={{marginTop:'8px'}}><span className="due-amount" style={{fontSize:'18px'}}>{result.failed}</span> gagal</p>}
              {result.errors?.length > 0 && (<div style={{textAlign:'left', marginTop:'16px', maxHeight:'150px', overflowY:'auto'}}>{result.errors.map((e, i) => <div key={i} className="import-preview-row invalid">Baris {e.row}: {e.name} — {e.reason}</div>)}</div>)}
              <button className="btn btn-primary" style={{marginTop:'20px'}} onClick={onDone}><i className="fas fa-check"></i> Selesai</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BulkImportPageView({ user }) {
  const _c = swrGet('import_logs');
  const [logs, setLogs] = useState(_c || []);
  const [loading, setLoading] = useState(!_c);
  const [showImportModal, setShowImportModal] = useState(false);
  const [errorDetail, setErrorDetail] = useState(null);
  const [categories, setCategories] = useState([]);
  const tableRef = useRef(null);
  const canWrite = user.role === 'admin' || user.role === 'manager';

  useEffect(() => { if (_c) setTimeout(() => initTable(_c), 150); loadData(); return () => { if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; } catch(e){} } }; }, []);
  const loadData = async () => {
    if (!_c) setLoading(true);
    try { const [ilRes, catRes] = await Promise.all([API.getImportLogs(user.id, user.role), API.getCategoriesForDropdown()]); setLoading(false); if (ilRes.success) { swrSet('import_logs', ilRes.data); setLogs(ilRes.data); initTable(ilRes.data); } if (catRes.success) setCategories(catRes.data); }
    catch(e) { setLoading(false); }
  };
  const initTable = (data) => {
    if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; $('#importLogTable').empty(); } catch(e){} }
    if (!data.length) return;
    setTimeout(() => {
      try {
        const t = $('#importLogTable').DataTable({
          data, destroy:true,
          columns:[
            { data:'file_name', title:'Nama File' }, { data:'category_name', title:'Kategori', render:(d) => '<span class="role-badge role-manager">' + d + '</span>' },
            { data:'total_rows', title:'Total', className:'dt-center' }, { data:'success_rows', title:'Berhasil', className:'dt-center', render:(d) => '<span class="paid-amount">' + d + '</span>' },
            { data:'failed_rows', title:'Gagal', className:'dt-center', render:(d) => d > 0 ? '<span class="due-amount">' + d + '</span>' : '0' },
            { data:'status', title:'Status', render:(d) => '<span class="pur-status imp-' + d + '">' + d + '</span>' }, { data:'created_by_name', title:'Oleh' }, { data:'created_at', title:'Tanggal', render:(d) => fmtDateShort(d) },
            { data:null, title:'', orderable:false, width:'40px', render:(_,__,row) => row.failed_rows > 0 ? '<button class="action-icon ledger-icon" data-action="errors" title="Lihat error"><i class="fas fa-exclamation-triangle"></i></button>' : '' }
          ],
          pageLength:10, responsive:true, dom:'Blfrtip', buttons:[{ extend:'csv', text:'CSV' }], order:[[7,'desc']]
        });
        $('#importLogTable').off('click', '.action-icon');
        $('#importLogTable').on('click', '.action-icon', function() { const row = t.row($(this).parents('tr')).data(); if (row.error_log) { try { setErrorDetail(JSON.parse(row.error_log)); } catch(e) { setErrorDetail([{ reason: row.error_log }]); } } });
        tableRef.current = t;
      } catch(e) {}
    }, 150);
  };
  return (
    <div>
      <div className="data-section" style={{marginBottom:'20px'}}>
        <div className="section-header"><h2><i className="fas fa-file-import"></i> Impor Massal Menu</h2>{canWrite && <button className="btn btn-success" onClick={() => setShowImportModal(true)}><i className="fas fa-upload"></i> Impor Baru</button>}</div>
        <p style={{color:'#666', fontSize:'14px'}}>Impor daftar menu dari file CSV. Pilih kategori, unggah berkas, pratinjau lalu konfirmasi.</p>
      </div>
      <div className="data-section">
        <h2 style={{color:'#333', marginBottom:'15px', display:'flex', alignItems:'center', gap:'10px'}}><i className="fas fa-history"></i> Riwayat Impor</h2>
        {loading && <TableSkeleton rows={4} columns={8} />}
        <div style={{ display: loading ? 'none' : 'block' }}>{logs.length > 0 ? <table id="importLogTable" className="display" style={{width:'100%'}}></table> : (!loading && <div className="empty-state"><i className="fas fa-inbox"></i><p>Belum ada riwayat impor</p></div>)}</div>
      </div>
      {showImportModal && <BulkImportModal user={user} categories={categories} onClose={() => setShowImportModal(false)} onDone={() => { setShowImportModal(false); loadData(); }} />}
      {errorDetail && (
        <div className="modal-overlay" onClick={() => setErrorDetail(null)}>
          <div className="modal" style={{maxWidth:'500px'}} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3><i className="fas fa-exclamation-triangle"></i> Error Impor</h3><button className="close-btn" onClick={() => setErrorDetail(null)}><i className="fas fa-times"></i></button></div>
            <div className="modal-body" style={{maxHeight:'400px', overflowY:'auto'}}>{errorDetail.map((err, i) => (<div key={i} className="import-preview-row invalid" style={{marginBottom:'4px'}}>{err.row && <strong>Baris {err.row}: </strong>}{err.name && <span>{err.name} — </span>}{err.reason}</div>))}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Pelanggan ── */
function CustomersView({ user, openLedger }) {
  const _c = swrGet('customers');
  const [loading, setLoading] = useState(!_c);
  const [customers, setCustomers] = useState(_c || []);
  const [showModal, setShowModal] = useState(false);
  const [editingCU, setEditingCU] = useState(null);
  const [load, setLoad] = useState('');
  const [filterDue, setFilterDue] = useState('');
  const tableRef = useRef(null);
  const canWrite = user.role === 'admin' || user.role === 'manager';
  const canDelete = user.role === 'admin';

  useEffect(() => { if (_c) setTimeout(() => initTable(_c), 150); loadCustomers(); return () => { dtCleanup(); if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; } catch(e){} } }; }, []);

  const loadCustomers = async () => {
    if (!_c) setLoading(true);
    try { const r = await API.getCustomers(user.id, user.role); setLoading(false); if (r.success) { swrSet('customers', r.data); setCustomers(r.data); initTable(r.data); } else Swal.fire({ icon:'error', text:r.message }); }
    catch(e) { setLoading(false); Swal.fire({ icon:'error', text:'Gagal memuat pelanggan' }); }
  };

  const initTable = (data) => {
    if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; $('#custTable').empty(); } catch(e){} }
    setTimeout(() => {
      try {
        const t = $('#custTable').DataTable({
          data, destroy:true,
          columns:[
            { data:'name', title:'Nama Pelanggan', render:(d) => '<a class="car-link" data-action="ledger"><strong>' + d + '</strong></a>' },
            { data:'phone', title:'Telepon', render:(d) => d ? '<a href="tel:' + d + '" class="car-link">' + d + '</a>' : '<span style="color:#ccc">—</span>' },
            { data:'total_purchase', title:'Total Belanja', render:(d) => '<strong>' + fmtRp(d) + '</strong>' },
            { data:'total_paid', title:'Dibayar', render:(d) => '<span class="paid-amount">' + fmtRp(d) + '</span>' },
            { data:'total_due', title:'Piutang', render:(d) => d > 0 ? '<span class="due-alert"><i class="fas fa-exclamation-triangle"></i> <span class="due-amount">' + fmtRp(d) + '</span></span>' : '<span style="color:#aaa">0</span>' },
            { data:'is_active', title:'Status', render:(d) => canWrite ? '<button class="action-icon toggle-icon ' + (d==1?'':'off') + '" data-action="toggle"><i class="fas ' + (d==1?'fa-toggle-on':'fa-toggle-off') + '"></i></button>' : '<span class="status-dot ' + (d==1?'active':'inactive') + '"></span>' },
            { data:null, title:'Aksi', orderable:false, render:(_,__,row) => {
              let h = '';
              if (canWrite) h += '<button class="action-icon edit-icon" data-action="edit"><i class="fas fa-edit"></i></button>';
              h += '<button class="action-icon ledger-icon" data-action="ledger" title="Kartu Piutang"><i class="fas fa-file-invoice"></i></button>';
              if (canDelete) { if (row.total_purchase > 0) h += '<button class="action-icon delete-icon disabled" title="Ada transaksi terkait"><i class="fas fa-trash"></i></button>'; else h += '<button class="action-icon delete-icon" data-action="delete"><i class="fas fa-trash"></i></button>'; }
              return h;
            }}
          ],
          pageLength:10, lengthMenu:[[10,25,50,-1],[10,25,50,"Semua"]], responsive:true, dom:'Blfrtip',
          buttons:[{ extend:'csv', text:'<i class="fas fa-file-csv"></i> CSV', exportOptions:{columns:[0,1,2,3,4]} },{ extend:'pdf', text:'<i class="fas fa-file-pdf"></i> PDF', exportOptions:{columns:[0,1,2,3,4]} },{ extend:'print', text:'<i class="fas fa-print"></i> Cetak', exportOptions:{columns:[0,1,2,3,4]} }],
          order:[[0,'desc']]
        });
        $('#custTable').off('click', '.car-link, .action-icon');
        $('#custTable').on('click', '.car-link', function() { const row = t.row($(this).parents('tr')).data(); openLedger(row.id); });
        $('#custTable').on('click', '.action-icon', function() {
          if ($(this).hasClass('disabled')) return;
          const action = $(this).data('action'); const row = t.row($(this).parents('tr')).data();
          if (action === 'edit') { setEditingCU(row); setShowModal(true); } else if (action === 'toggle') handleToggle(row); else if (action === 'ledger') openLedger(row.id); else if (action === 'delete') handleDelete(row);
        });
        tableRef.current = t;
      } catch(e) { console.error('custTable:', e); }
    }, 150);
  };

  const dueOpts = [{ value:'yes', label:'Ada Piutang' },{ value:'no', label:'Lunas' }];
  useEffect(() => {
    if (!tableRef.current || customers.length === 0) return;
    const dt = tableRef.current;
    while ($.fn.dataTable.ext.search.length > 0) $.fn.dataTable.ext.search.pop();
    if (filterDue) $.fn.dataTable.ext.search.push((s,sd,idx) => { const row = dt.row(idx).data(); if (!row) return true; return filterDue === 'yes' ? row.total_due > 0 : row.total_due <= 0; });
    dt.draw();
  }, [filterDue]);

  const handleSave = async (formData) => {
    setLoad(editingCU ? 'Memperbarui...' : 'Menambahkan...');
    try {
      let r;
      if (editingCU) r = await API.updateCustomer({ ...formData, id: editingCU.id }, user.id, user.role);
      else r = await API.addCustomer(formData, user.id, user.role);
      setLoad('');
      if (r.success) { setShowModal(false); setEditingCU(null); Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); loadCustomers(); }
      else Swal.fire({ icon:'error', text:r.message });
    } catch(e) { setLoad(''); Swal.fire({ icon:'error', text:'Gagal' }); }
  };
  const handleToggle = async (cu) => { setLoad('Memperbarui...'); try { const r = await API.toggleCustomerStatus(cu.id, user.id, user.role); setLoad(''); if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1200, showConfirmButton:false }); loadCustomers(); } else Swal.fire({ icon:'error', text:r.message }); } catch(e) { setLoad(''); } };
  const handleDelete = (cu) => {
    Swal.fire({ icon:'warning', title:'Hapus?', text:'Hapus "' + cu.name + '"?', showCancelButton:true, confirmButtonColor:'#ea4335', confirmButtonText:'Hapus' }).then(async (res) => {
      if (res.isConfirmed) { setLoad('Menghapus...'); try { const r = await API.deleteCustomer(cu.id, user.id, user.role); setLoad(''); if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); loadCustomers(); } else Swal.fire({ icon:'error', text:r.message }); } catch(e) { setLoad(''); Swal.fire({ icon:'error', text:'Gagal menghapus' }); } }
    });
  };

  return (
    <div className="data-section">
      <div className="section-header"><h2><i className="fas fa-user-friends"></i> Pelanggan</h2><button className="btn btn-success" onClick={() => { setEditingCU(null); setShowModal(true); }}><i className="fas fa-plus"></i> Tambah Pelanggan</button></div>
      {!loading && (
        <div className="filters-section">
          <div className="filters-header"><h3><i className="fas fa-filter"></i> Filter</h3><button className="btn btn-secondary btn-sm" onClick={() => { setFilterDue(''); if (tableRef.current) { while ($.fn.dataTable.ext.search.length>0) $.fn.dataTable.ext.search.pop(); tableRef.current.draw(); } }}><i className="fas fa-times-circle"></i> Bersihkan</button></div>
          <div className="filters-grid"><SearchableDropdown label="Status Piutang" icon="fas fa-money-bill-wave" options={dueOpts} value={filterDue} onChange={setFilterDue} placeholder="Semua Pelanggan" /></div>
        </div>
      )}
      {loading && <TableSkeleton rows={5} columns={6} />}
      <div style={{ display: loading ? 'none' : 'block' }}><table id="custTable" className="display" style={{width:'100%'}}></table></div>
      {showModal && <CustomerModal editCU={editingCU} onClose={() => { setShowModal(false); setEditingCU(null); }} onSave={handleSave} />}
      {load && <div className="loading-ov"><div className="loading-popup"><div className="loading-progress"><div className="loading-progress-bar"></div></div><div className="loading-txt">{load}</div></div></div>}
    </div>
  );
}

function CustomerModal({ editCU, onClose, onSave }) {
  const [form, setForm] = useState({ name: editCU?.name || '', phone: editCU?.phone || '', address: editCU?.address || '', is_active: editCU ? (editCU.is_active == 1) : true });
  const handleSubmit = (e) => { e.preventDefault(); onSave({ ...form, is_active: form.is_active ? 1 : 0 }); };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'500px'}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3><i className={editCU ? 'fas fa-edit' : 'fas fa-plus-circle'}></i> {editCU ? 'Ubah' : 'Tambah'} Pelanggan</h3><button className="close-btn" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group"><label><i className="fas fa-user"></i> Nama *</label><input type="text" value={form.name} onChange={(e) => setForm({...form, name:e.target.value})} required /></div>
            <div className="form-group"><label><i className="fas fa-phone"></i> Telepon</label><input type="tel" value={form.phone} onChange={(e) => setForm({...form, phone:e.target.value})} /></div>
            <div className="form-group"><label><i className="fas fa-map-marker-alt"></i> Alamat</label><textarea rows="2" value={form.address} onChange={(e) => setForm({...form, address:e.target.value})} style={{resize:'vertical'}}></textarea></div>
            {editCU && <ToggleSwitch label="Status" checked={form.is_active} onChange={(v) => setForm({...form, is_active:v})} />}
            <div className="form-actions"><button type="submit" className="btn btn-primary"><i className="fas fa-save"></i> {editCU ? 'Perbarui' : 'Simpan'}</button><button type="button" className="btn btn-secondary" onClick={onClose}><i className="fas fa-times"></i> Batal</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Kartu Piutang Pelanggan ── */
function CustomerLedgerView({ user, customerId, goBack }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('invoices');
  const [showPayModal, setShowPayModal] = useState(false);
  const invTableRef = useRef(null); const payTableRef = useRef(null);

  useEffect(() => { if (customerId) loadLedger(); return () => { [invTableRef, payTableRef].forEach(r => { if (r.current) { try { r.current.destroy(); r.current=null; } catch(e){} } }); }; }, [customerId]);
  const loadLedger = async () => {
    if (!data) setLoading(true);
    try { const r = await API.getCustomerLedger(customerId, user.id, user.role); setLoading(false); if (r.success) { setData(r.data); setTimeout(() => initInvTable(r.data.invoices), 200); } else { Swal.fire({ icon:'error', text:r.message }); goBack(); } }
    catch(e) { setLoading(false); goBack(); }
  };
  useEffect(() => {
    if (!data) return;
    if (activeTab === 'invoices' && !invTableRef.current && data.invoices.length) setTimeout(() => initInvTable(data.invoices), 100);
    if (activeTab === 'payments' && !payTableRef.current && data.payments.length) setTimeout(() => initPayTable(data.payments), 100);
  }, [activeTab, data]);

  const initInvTable = (invoices) => {
    if (invTableRef.current) { try { invTableRef.current.destroy(); $('#custInvTable').empty(); } catch(e){} }
    if (!invoices.length) return;
    setTimeout(() => {
      try {
        invTableRef.current = $('#custInvTable').DataTable({ data: invoices, destroy:true, columns:[
          { data:'invoice_no', title:'No Struk', render:(d) => '<strong>' + d + '</strong>' }, { data:'date', title:'Tanggal', render:(d) => fmtDateShort(d) },
          { data:'total', title:'Total', render:(d) => '<strong>' + fmtRp(d) + '</strong>' }, { data:'paid', title:'Dibayar', render:(d) => '<span class="paid-amount">' + fmtRp(d) + '</span>' },
          { data:'due', title:'Sisa', render:(d) => d > 0 ? '<span class="due-amount">' + fmtRp(d) + '</span>' : '0' }, { data:'status', title:'Status', render:(d) => '<span class="pur-status ' + (d==='completed'?'pur-completed':'pur-pending') + '">' + d + '</span>' }
        ], pageLength:10, responsive:true, dom:'Blfrtip', buttons:[{ extend:'csv', text:'CSV' },{ extend:'print', text:'Cetak' }], order:[[1,'desc']] });
      } catch(e) {}
    }, 50);
  };
  const initPayTable = (payments) => {
    if (payTableRef.current) { try { payTableRef.current.destroy(); $('#custPayTable').empty(); } catch(e){} }
    if (!payments.length) return;
    setTimeout(() => {
      try {
        payTableRef.current = $('#custPayTable').DataTable({ data: payments, destroy:true, columns:[
          { data:'date', title:'Tanggal', render:(d) => fmtDateShort(d) }, { data:'amount', title:'Jumlah', render:(d) => '<span class="paid-amount">' + fmtRp(d) + '</span>' },
          { data:'method', title:'Metode' }, { data:'reference', title:'Referensi', render:(d) => d || '—' }, { data:'notes', title:'Catatan', render:(d) => d || '—' }, { data:'created_by_name', title:'Oleh' }
        ], pageLength:10, responsive:true, dom:'Blfrtip', buttons:[{ extend:'csv', text:'CSV' }], order:[[0,'desc']] });
      } catch(e) {}
    }, 50);
  };

  const handlePaymentSaved = () => { setShowPayModal(false); loadLedger(); };
  if (loading) return <div><div className="skeleton-card"><div className="skeleton skeleton-text-large" style={{width:'40%'}}></div></div></div>;
  if (!data) return <div className="empty-state"><i className="fas fa-exclamation-circle"></i><p>Pelanggan tidak ditemukan</p></div>;
  const cu = data.customer;

  return (
    <div>
      <div className="ledger-back"><button className="btn btn-secondary btn-sm" onClick={goBack}><i className="fas fa-arrow-left"></i> Kembali ke Pelanggan</button></div>
      <div className="ledger-header">
        <div className="ledger-info"><div style={{display:'flex', alignItems:'center', gap:'16px'}}><div style={{width:'60px', height:'60px', borderRadius:'50%', background:'var(--navy)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', fontWeight:'700', flexShrink:0}}>{getInitials(cu.name)}</div><div><h2 style={{marginBottom:'4px'}}>{cu.name}</h2>{cu.phone && <p><i className="fas fa-phone"></i> <a href={'tel:' + cu.phone} className="car-link">{cu.phone}</a></p>}{cu.address && <p><i className="fas fa-map-marker-alt"></i> {cu.address}</p>}</div></div></div>
        <div style={{display:'flex', gap:'8px'}}>{cu.total_due > 0 && <button className="btn btn-success btn-sm" onClick={() => setShowPayModal(true)}><i className="fas fa-money-bill-wave"></i> Terima Pembayaran</button>}</div>
      </div>
      <div className="cust-stats">
        <div className="cust-stat-box"><div className="val" style={{color:'var(--navy-primary)'}}>{fmtRp(cu.total_purchase)}</div><div className="lbl">Total Belanja</div></div>
        <div className="cust-stat-box"><div className="val paid-amount">{fmtRp(cu.total_paid)}</div><div className="lbl">Total Dibayar</div></div>
        <div className="cust-stat-box"><div className="val due-amount">{fmtRp(cu.total_due)}</div><div className="lbl">Sisa Piutang</div></div>
      </div>
      <div className="data-section">
        <div className="ledger-tabs">
          <button className={`ledger-tab ${activeTab==='invoices'?'active':''}`} onClick={() => setActiveTab('invoices')}><i className="fas fa-file-invoice"></i> Struk ({data.invoices.length})</button>
          <button className={`ledger-tab ${activeTab==='payments'?'active':''}`} onClick={() => setActiveTab('payments')}><i className="fas fa-money-bill-wave"></i> Pembayaran ({data.payments.length})</button>
        </div>
        <div style={{display: activeTab==='invoices' ? 'block' : 'none'}}>{data.invoices.length > 0 ? <table id="custInvTable" className="display" style={{width:'100%'}}></table> : <div className="empty-state"><i className="fas fa-inbox"></i><p>Belum ada struk</p></div>}</div>
        <div style={{display: activeTab==='payments' ? 'block' : 'none'}}>{data.payments.length > 0 ? <table id="custPayTable" className="display" style={{width:'100%'}}></table> : <div className="empty-state"><i className="fas fa-inbox"></i><p>Belum ada pembayaran</p></div>}</div>
      </div>
      {showPayModal && <CustPaymentModal customer={cu} userId={user.id} role={user.role} onClose={() => setShowPayModal(false)} onSaved={handlePaymentSaved} />}
    </div>
  );
}

function CustPaymentModal({ customer, userId, role, onClose, onSaved }) {
  const [form, setForm] = useState({ amount:'', method:'Tunai', reference:'', payment_date: new Date().toISOString().split('T')[0], notes:'' });
  const [saving, setSaving] = useState(false);
  const methodOpts = [{ value:'Tunai', label:'Tunai' },{ value:'Transfer Bank', label:'Transfer Bank' },{ value:'QRIS', label:'QRIS' },{ value:'E-Wallet', label:'E-Wallet' }];
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (parseFloat(form.amount) <= 0) { Swal.fire({ icon:'warning', text:'Masukkan jumlah valid' }); return; }
    setSaving(true);
    const r = await API.addCustomerPayment({ customer_id: customer.id, ...form }, userId, role);
    setSaving(false);
    if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); onSaved(); } else Swal.fire({ icon:'error', text:r.message });
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'450px'}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3><i className="fas fa-money-bill-wave"></i> Terima Pembayaran</h3><button className="close-btn" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-body">
          <p style={{marginBottom:'16px'}}><strong>{customer.name}</strong> — Sisa: <span className="due-amount">{fmtRp(customer.total_due)}</span></p>
          <form onSubmit={handleSubmit}>
            <div className="form-group"><label><i className="fas fa-money-bill-wave"></i> Jumlah *</label><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({...form, amount:e.target.value})} required /></div>
            <SearchableDropdown label="Metode Pembayaran" icon="fas fa-credit-card" options={methodOpts} value={form.method} onChange={(v) => setForm({...form, method:v||'Tunai'})} placeholder="Pilih metode..." />
            <div className="form-group"><label><i className="fas fa-hashtag"></i> No. Referensi</label><input type="text" value={form.reference} onChange={(e) => setForm({...form, reference:e.target.value})} /></div>
            <div className="form-group"><label><i className="fas fa-calendar-alt"></i> Tanggal</label><input type="date" value={form.payment_date} onChange={(e) => setForm({...form, payment_date:e.target.value})} /></div>
            <div className="form-group"><label><i className="fas fa-sticky-note"></i> Catatan</label><input type="text" value={form.notes} onChange={(e) => setForm({...form, notes:e.target.value})} /></div>
            <div className="form-actions"><button type="submit" className="btn btn-success" disabled={saving}>{saving ? <><i className="fas fa-spinner fa-spin"></i> Menyimpan...</> : <><i className="fas fa-check"></i> Catat Pembayaran</>}</button><button type="button" className="btn btn-secondary" onClick={onClose}><i className="fas fa-times"></i> Batal</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Struk Thermal ── */
function ThermalSlip({ data, slipRef }) {
  const d = data || {};
  return (
    <div ref={slipRef} className="thermal-slip">
      <div className="ts-header"><div className="ts-biz">{BN()}</div><div className="ts-subtitle">STRUK PENJUALAN</div></div>
      <div className="ts-div"></div>
      <div className="ts-info">
        <div><strong>{d.invoice_no || ''}</strong></div>
        <div>{d.date ? fmtDate(d.date) : ''}</div>
        <div>{ORDER_TYPE_LABELS[d.orderType] || 'Makan di Tempat'}{d.tableNo ? ' — Meja ' + d.tableNo : ''}</div>
        <div>Pelanggan: <strong>{d.customer || 'Umum'}</strong></div>
      </div>
      <div className="ts-div"></div>
      <div className="ts-items">
        {(d.items || []).map((item, i) => (
          <div key={i} className="ts-item">
            <div className="ts-item-head"><span>{i+1}. {item.name}{(item.qty||1) > 1 ? ' ×'+(item.qty||1) : ''}</span><span>{fmtRp(item.line_total || item.total || 0)}</span></div>
            <div className="ts-item-sub">@{fmtRp(item.price||0)}{item.notes ? ' — ' + item.notes : ''}</div>
          </div>
        ))}
      </div>
      <div className="ts-div"></div>
      <div className="ts-row"><span>Subtotal</span><span>{fmtRp(d.subtotal||0)}</span></div>
      {(d.discount||0) > 0 && <div className="ts-row" style={{color:'#c62828'}}><span>Diskon</span><span>-{fmtRp(d.discount||0)}</span></div>}
      <div className="ts-row grand"><span>TOTAL</span><span>{fmtRp(d.grandTotal||0)}</span></div>
      <div className="ts-row paid-row"><span>Tunai Diterima</span><span>{fmtRp(d.paid||0)}</span></div>
      {(d.kembalian||0) > 0 && <div className="ts-row paid-row"><span>Kembalian</span><span>{fmtRp(d.kembalian||0)}</span></div>}
      {(d.due||0) > 0 && <div className="ts-row due-row"><span>Kurang Bayar</span><span>{fmtRp(d.due||0)}</span></div>}
      <div className="ts-row"><span>Metode</span><span>{d.payMethod || 'tunai'}</span></div>
      {d.payRef && <div className="ts-row"><span>Ref</span><span>{d.payRef}</span></div>}
      <div className="ts-div"></div>
      {d.notes && <div style={{fontSize:'10px', color:'#888', textAlign:'center', marginBottom:'4px'}}>{d.notes}</div>}
      <div className="ts-footer">{(_appSettings.invoice_footer) || 'Terima kasih atas kunjungan Anda!'}</div>
      <div className="ts-footer" style={{marginTop:'4px'}}>Rameez Scripts</div>
    </div>
  );
}
function printThermalSlip(ref) {
  if (!ref?.current) return;
  const w = window.open('', '', 'width=350,height=600');
  w.document.write('<html><head><title>Struk</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Courier New",monospace;font-size:12px;padding:8px;width:80mm;color:#333}.ts-header{text-align:center}.ts-biz{font-size:14px;font-weight:700}.ts-subtitle{font-size:10px;color:#888;letter-spacing:1px}.ts-div{border-top:1px dashed #bbb;margin:6px 0}.ts-info{font-size:11px;color:#555}.ts-info div{margin-bottom:2px}.ts-item{margin-bottom:6px;padding-bottom:4px;border-bottom:1px dotted #ddd}.ts-item:last-child{border-bottom:none}.ts-item-head{display:flex;justify-content:space-between;font-weight:700}.ts-item-sub{font-size:10px;color:#888}.ts-row{display:flex;justify-content:space-between;padding:2px 0}.ts-row.grand{font-weight:700;font-size:14px;border-top:1px dashed #333;border-bottom:1px dashed #333;padding:4px 0;margin:4px 0}.ts-row.due-row{color:#c62828;font-weight:700}.ts-row.paid-row{color:#2e7d32}.ts-footer{text-align:center;font-size:10px;color:#aaa}</style></head><body>');
  w.document.write(ref.current.innerHTML);
  w.document.write('</body></html>');
  w.document.close();
  setTimeout(() => { w.print(); w.close(); }, 300);
}
function downloadSlip(ref, name) {
  if (!ref?.current || typeof html2canvas === 'undefined') return;
  html2canvas(ref.current, { scale: 3, backgroundColor: '#ffffff', useCORS: true }).then(canvas => { const link = document.createElement('a'); link.download = (name || 'struk') + '-' + Date.now() + '.png'; link.href = canvas.toDataURL('image/png'); link.click(); });
}

/* ── POS / Kasir ── */
function POSView({ user }) {
  const _cuC = swrGet('pos_customers');
  const _caC = swrGet('pos_categories');
  const _miC = swrGet('pos_menu_0');

  const [cart, setCart] = useState([]);
  const [allMenu, setAllMenu] = useState(_miC || []);
  const [searchQ, setSearchQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [customers, setCustomers] = useState(_cuC || []);
  const [categories, setCategories] = useState(_caC || []);
  const [customerId, setCustomerId] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [orderType, setOrderType] = useState('dine_in');
  const [tableNo, setTableNo] = useState('');
  const [discount, setDiscount] = useState('0');
  const [paidAmt, setPaidAmt] = useState('');
  const [payMethod, setPayMethod] = useState('tunai');
  const [payRef, setPayRef] = useState('');
  const [notes, setNotes] = useState('');
  const [load, setLoad] = useState('');
  const [showInvoice, setShowInvoice] = useState(null);
  const [showAddCust, setShowAddCust] = useState(false);
  const [menuLoading, setMenuLoading] = useState(!_miC);
  const [slipOpen, setSlipOpen] = useState(true);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);
  const slipRef = useRef(null);

  useEffect(() => {
    Promise.all([API.getCustomersForDropdown(), API.getCategoriesForDropdown()]).then(([cu, ca]) => {
      if (cu.success) { setCustomers(cu.data); swrSet('pos_customers', cu.data); }
      if (ca.success) { setCategories(ca.data); swrSet('pos_categories', ca.data); }
    });
    setTimeout(() => searchRef.current?.focus(), 300);
  }, []);

  useEffect(() => {
    const k = 'pos_menu_' + (filterCat || 0);
    const _mc = swrGet(k);
    if (_mc) { setAllMenu(_mc); setMenuLoading(false); } else setMenuLoading(true);
    API.getAvailableMenu(filterCat ? parseInt(filterCat) : 0).then(r => { if (r.success) { setAllMenu(r.data); swrSet(k, r.data); } setMenuLoading(false); }).catch(() => setMenuLoading(false));
  }, [filterCat]);

  const displayMenu = React.useMemo(() => {
    let list = allMenu;
    if (searchQ.trim()) { const q = searchQ.trim().toLowerCase(); list = list.filter(m => m.name.toLowerCase().includes(q)); }
    return list;
  }, [allMenu, searchQ]);

  const doSearch = (q) => {
    setSearchQ(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => { setSearching(true); const r = await API.searchMenu(q.trim()); setSearching(false); if (r.success) setResults(r.data); }, 300);
  };

  const addToCart = (menu) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.menu_item_id === menu.id);
      if (idx >= 0) {
        const item = prev[idx];
        const maxQ = menu.track_stock ? menu.stock_qty : Infinity;
        if (item.qty + 1 > maxQ) { Swal.fire({ icon:'warning', text:'Stok tidak mencukupi' }); return prev; }
        const next = [...prev]; next[idx] = { ...item, qty: item.qty+1, line_total: Math.round(menu.price*(item.qty+1)*100)/100 }; return next;
      }
      return [...prev, { menu_item_id: menu.id, name: menu.name, price: menu.price, qty: 1, line_total: menu.price, max_qty: menu.track_stock ? menu.stock_qty : Infinity, notes: '' }];
    });
    setResults([]); setSearchQ('');
    setTimeout(() => searchRef.current?.focus(), 100);
  };
  const removeFromCart = (idx) => setCart(prev => prev.filter((_, i) => i !== idx));
  const updateCartQty = (idx, newQty) => setCart(prev => prev.map((item, i) => { if (i !== idx) return item; const q = Math.max(1, Math.min(parseInt(newQty) || 1, item.max_qty)); return { ...item, qty: q, line_total: Math.round(item.price * q * 100) / 100 }; }));
  const updateCartNotes = (idx, val) => setCart(prev => prev.map((item, i) => i === idx ? { ...item, notes: val } : item));

  const totalItems = cart.reduce((s, i) => s + (i.qty || 1), 0);
  const subtotal = cart.reduce((s, i) => s + i.line_total, 0);
  const disc = parseFloat(discount) || 0;
  const grandTotal = Math.round((subtotal - disc) * 100) / 100;
  const paid = parseFloat(paidAmt) || 0;
  const due = Math.round((grandTotal - paid) * 100) / 100;
  const kembalian = paid > grandTotal ? Math.round((paid - grandTotal) * 100) / 100 : 0;

  const handleSale = async (status) => {
    if (!cart.length) { Swal.fire({ icon:'warning', text:'Tambahkan item ke keranjang' }); return; }
    const paidCapped = Math.min(paid, grandTotal);
    setLoad(status === 'pending' ? 'Menahan transaksi...' : 'Menyelesaikan transaksi...');
    try {
      const r = await API.completeSale({ customer_id: customerId || '', items: cart, discount: disc, paid_amount: status === 'pending' ? 0 : paidCapped, payment_method: payMethod, payment_reference: payRef, notes, status, order_type: orderType, table_no: tableNo }, user.id, user.role);
      setLoad('');
      if (r.success) {
        if (status !== 'pending') setShowInvoice({ invoice_no: r.data.invoice_no, customer: customers.find(c => c.id == customerId)?.name || 'Pelanggan Umum', orderType, tableNo, items: cart, subtotal, discount: disc, grandTotal, paid: status === 'pending' ? 0 : paid, kembalian, due: status === 'pending' ? grandTotal : due, payMethod, payRef, notes, date: new Date().toISOString() });
        else Swal.fire({ icon:'success', text:'Pesanan ditahan — ' + r.data.invoice_no, timer:2000, showConfirmButton:false });
        setCart([]); setDiscount('0'); setPaidAmt(''); setPayRef(''); setNotes(''); setCustomerId(''); setTableNo('');
        const k = 'pos_menu_' + (filterCat || 0);
        API.getAvailableMenu(filterCat ? parseInt(filterCat) : 0).then(am => { if (am.success) { setAllMenu(am.data); swrSet(k, am.data); } });
      } else Swal.fire({ icon:'error', text:r.message });
    } catch(e) { setLoad(''); Swal.fire({ icon:'error', text:'Transaksi gagal' }); }
  };

  const handleQuickAddCust = async (name, phone) => {
    const r = await API.addCustomer({ name, phone }, user.id, user.role);
    if (r.success) { const next = [...customers, { id: r.data.id, name: r.data.name }]; setCustomers(next); swrSet('pos_customers', next); setCustomerId(String(r.data.id)); setShowAddCust(false); Swal.fire({ icon:'success', text:'Pelanggan ditambahkan', timer:1200, showConfirmButton:false }); }
    else Swal.fire({ icon:'error', text:r.message });
  };

  const custOpts = customers.map(c => ({ value:String(c.id), label:c.name }));
  const catOpts = categories.map(c => ({ value:String(c.id), label:c.name }));
  const methods = ['tunai','transfer','qris','ewallet','kredit'];
  const orderTypes = [{ v:'dine_in', ico:'fa-utensils', lbl:'Makan di Tempat' }, { v:'takeaway', ico:'fa-shopping-bag', lbl:'Bawa Pulang' }, { v:'delivery', ico:'fa-motorcycle', lbl:'Antar' }];

  return (
    <div>
      <div className="pos-layout">
        <div className="pos-left">
          <div className="filters-section" style={{marginBottom:'12px', padding:'14px 16px'}}>
            <div className="filters-header" style={{marginBottom:'12px', paddingBottom:'10px'}}><h3 style={{fontSize:'15px'}}><i className="fas fa-filter"></i> Filter Cepat</h3><button className="btn btn-secondary btn-sm" onClick={() => { setFilterCat(''); setSearchQ(''); }}><i className="fas fa-times-circle"></i> Bersihkan</button></div>
            <div className="filters-grid" style={{gap:'12px'}}><SearchableDropdown options={catOpts} value={filterCat} onChange={setFilterCat} placeholder="Semua Kategori" label="Kategori" icon="fas fa-th-large" /></div>
          </div>
          <div className="pos-search">
            <i className="fas fa-search search-icon"></i>
            <input ref={searchRef} type="text" value={searchQ} onChange={(e) => doSearch(e.target.value)} placeholder="Cari nama menu..." autoComplete="off" />
            {(results.length > 0 || searching) && (
              <div className="pos-results">
                {searching && <div style={{padding:'12px', textAlign:'center', color:'#888'}}><i className="fas fa-spinner fa-spin"></i> Mencari...</div>}
                {results.map((m, i) => (<div key={i} className="pos-result-item" onClick={() => addToCart(m)}><div><span className="pos-result-serial">{m.name}</span><div className="pos-result-info">{m.category_name}</div></div><span className="pos-result-price">{fmtRp(m.price)}</span></div>))}
                {!searching && results.length === 0 && searchQ.length > 1 && <div style={{padding:'12px', textAlign:'center', color:'#aaa'}}>Tidak ada hasil</div>}
              </div>
            )}
          </div>
          {cart.length > 0 && (
            <div style={{marginBottom:'16px'}}>
              <h4 style={{color:'var(--navy-primary)', marginBottom:'8px', display:'flex', alignItems:'center', gap:'8px'}}><i className="fas fa-shopping-cart"></i> Keranjang ({cart.length} item)</h4>
              <div style={{border:'1px solid #e6e6e6', borderRadius:'16px', overflow:'hidden'}}>
              <table className="cart-table">
                <thead><tr><th>#</th><th>Menu</th><th>Qty</th><th>Harga</th><th>Total</th><th>Catatan</th><th></th></tr></thead>
                <tbody>
                  {cart.map((item, i) => (
                    <tr key={i}>
                      <td>{i+1}</td><td><strong>{item.name}</strong></td>
                      <td><input type="number" className="cart-rate" value={item.qty} min="1" onChange={(e) => updateCartQty(i, e.target.value)} style={{width:'52px', textAlign:'center'}} /></td>
                      <td>{fmtRp(item.price)}</td><td><strong>{fmtRp(item.line_total)}</strong></td>
                      <td><input type="text" value={item.notes} onChange={(e) => updateCartNotes(i, e.target.value)} placeholder="cth: pedas" style={{width:'90px', padding:'4px 6px', border:'1px solid #ddd', borderRadius:'8px', fontSize:'12px'}} /></td>
                      <td><button className="cart-remove" onClick={() => removeFromCart(i)}><i className="fas fa-times-circle"></i></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
          <h4 style={{color:'#555', marginBottom:'8px'}}><i className="fas fa-utensils"></i> Menu Tersedia {!menuLoading && <>({displayMenu.length})</>}</h4>
          <div className="pos-products-wrap" style={{maxHeight: cart.length > 0 ? '320px' : '500px', overflowY:'auto'}}>
            {menuLoading ? (<div style={{padding:'30px 20px', display:'flex', flexDirection:'column', alignItems:'center', gap:'12px'}}><div className="loading-progress" style={{width:'160px'}}><div className="loading-progress-bar"></div></div><span style={{fontSize:'13px', color:'#888'}}>Memuat menu...</span></div>) : displayMenu.length > 0 ? (
              <div className="pos-product-grid">
                {displayMenu.map(m => (
                  <div key={m.id} className="pos-product-card" onClick={() => addToCart(m)}>
                    {m.track_stock && <span className="ppc-qty-badge"><i className="fas fa-cubes"></i> {m.stock_qty}</span>}
                    {m.image ? <img src={'https://lh3.google.com/u/0/d/' + m.image} className="ppc-img" alt={m.name} /> : <div className="ppc-img-ph"><i className="fas fa-utensils"></i></div>}
                    <div className="ppc-serial"><i className="fas fa-utensils"></i> {m.name}</div>
                    <div className="ppc-meta"><i className="fas fa-th-large"></i> {m.category_name}</div>
                    <div className="ppc-price">{fmtRp(m.price)}</div>
                  </div>
                ))}
              </div>
            ) : <div className="pos-products-empty">Tidak ada menu tersedia {searchQ ? 'yang cocok dengan "' + searchQ + '"' : ''}</div>}
          </div>
        </div>

        <div className="pos-right">
          <div className="pos-pane">
            <div className="pos-pane-title"><i className="fas fa-receipt"></i> Tipe Pesanan</div>
            <div className="pos-order-type-grid">
              {orderTypes.map(o => (<button key={o.v} type="button" className={'pos-pay-tile ' + (orderType===o.v?'active':'')} onClick={() => setOrderType(o.v)}><i className={'fas ' + o.ico}></i><div className="pos-pay-tile-lbl">{o.lbl}</div></button>))}
            </div>
            {orderType === 'dine_in' && (<input type="text" value={tableNo} onChange={(e) => setTableNo(e.target.value)} placeholder="No. Meja (opsional)" className="pos-compact-input" />)}
          </div>

          <div className="pos-pane">
            <div className="pos-pane-title"><i className="fas fa-user"></i> Pelanggan</div>
            {customerId ? (
              <div className="pos-cust-card"><div className="pos-cust-avatar">{getInitials(customers.find(c => c.id == customerId)?.name || 'U')}</div><div className="pos-cust-info"><div className="pos-cust-name">{customers.find(c => c.id == customerId)?.name || 'Pelanggan'}</div><div className="pos-cust-meta">Dipilih untuk transaksi ini</div></div><button className="pos-cust-clear" onClick={() => setCustomerId('')}><i className="fas fa-times"></i></button></div>
            ) : (
              <div>
                <div className="pos-cust-empty"><i className="fas fa-user-slash"></i> <span>Pelanggan umum</span></div>
                <div style={{display:'flex', gap:'6px', marginTop:'8px'}}><div style={{flex:1}}><SearchableDropdown options={custOpts} value={customerId} onChange={setCustomerId} placeholder="Cari & pilih pelanggan..." /></div><button className="btn btn-primary btn-sm" style={{height:'42px', whiteSpace:'nowrap'}} onClick={() => setShowAddCust(true)}><i className="fas fa-plus"></i> Baru</button></div>
              </div>
            )}
          </div>

          <div className="pos-pane">
            <div className="pos-pane-title"><i className="fas fa-shopping-cart"></i> Ringkasan Keranjang</div>
            <div className="pos-summary-grid"><div className="pos-mini-stat"><div className="pos-mini-stat-val">{totalItems}</div><div className="pos-mini-stat-lbl">Item</div></div><div className="pos-mini-stat"><div className="pos-mini-stat-val">{cart.length}</div><div className="pos-mini-stat-lbl">Jenis Menu</div></div></div>
            <div className="pos-line bordered"><span>Subtotal</span><span style={{color:'#222', fontWeight:'600'}}>{fmtRp(subtotal)}</span></div>
            <div className="pos-line"><span>Diskon</span><input type="number" className="pos-line-input" value={discount} onChange={(e) => setDiscount(e.target.value)} step="100" min="0" /></div>
            <div className="pos-grand"><div className="pos-grand-lbl">Total Bayar</div><div className="pos-grand-val">{fmtRp(grandTotal)}</div></div>
          </div>

          <div className="pos-pane">
            <div className="pos-pane-title"><i className="fas fa-hand-holding-usd"></i> Pembayaran</div>
            <div className="pos-line bordered"><span>Uang Diterima (Tunai)</span><input type="number" className="pos-line-input" value={paidAmt} onChange={(e) => setPaidAmt(e.target.value)} step="500" min="0" placeholder={String(grandTotal)} autoFocus /></div>
            {kembalian > 0 ? (
              <div className="pos-due-callout zero"><span className="pos-due-callout-lbl"><i className="fas fa-hand-holding-usd"></i> Kembalian</span><span className="pos-due-callout-val">{fmtRp(kembalian)}</span></div>
            ) : due > 0 && paid > 0 ? (
              <div className="pos-due-callout has"><span className="pos-due-callout-lbl"><i className="fas fa-exclamation-circle"></i> Kurang Bayar</span><span className="pos-due-callout-val">{fmtRp(due)}</span></div>
            ) : null}
            <div style={{marginTop:'12px'}}>
              <div style={{fontSize:'11px', fontWeight:'600', color:'#666', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.4px'}}>Metode</div>
              <div className="pos-pay-grid">
                {methods.map(m => { const ico = { tunai:'fa-money-bill-wave', transfer:'fa-university', qris:'fa-qrcode', ewallet:'fa-mobile-alt', kredit:'fa-credit-card' }[m] || 'fa-coins'; return (<button key={m} type="button" className={'pos-pay-tile ' + (payMethod===m?'active':'')} onClick={() => setPayMethod(m)}><i className={'fas ' + ico}></i><div className="pos-pay-tile-lbl">{m}</div></button>); })}
              </div>
              <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Referensi / No. TXN (opsional)" className="pos-compact-input" style={{marginTop:'8px'}} />
            </div>
          </div>

          <div className="pos-pane"><div className="pos-pane-title"><i className="fas fa-sticky-note"></i> Catatan</div><textarea rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan internal (opsional)" className="pos-compact-input"></textarea></div>

          <div className="pos-action-bar"><button className="btn btn-warning" onClick={() => handleSale('pending')} disabled={!cart.length}><i className="fas fa-pause"></i> Tahan</button><button className="btn btn-success" onClick={() => handleSale('completed')} disabled={!cart.length}><i className="fas fa-check-circle"></i> Selesaikan</button></div>

          {cart.length > 0 && (
            <div>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', cursor:'pointer', borderTop:'1px solid #e0e0e0', marginTop:'12px', color:'var(--navy-primary)', fontWeight:'600', fontSize:'13px'}} onClick={() => setSlipOpen(!slipOpen)}><span><i className="fas fa-receipt"></i> Pratinjau Struk</span><i className={'fas fa-chevron-' + (slipOpen ? 'up' : 'down')}></i></div>
              {slipOpen && (<div><ThermalSlip slipRef={slipRef} data={{ invoice_no: '(Transaksi Baru)', date: new Date().toISOString(), customer: customers.find(c => c.id == customerId)?.name || 'Pelanggan Umum', orderType, tableNo, items: cart, subtotal, discount: disc, grandTotal, paid, kembalian, due: due > 0 ? due : 0, payMethod, payRef, notes }} /><div className="ts-actions"><button className="ts-btn-print" onClick={() => printThermalSlip(slipRef)}><i className="fas fa-print"></i> Cetak</button><button className="ts-btn-dl" onClick={() => downloadSlip(slipRef, 'struk')}><i className="fas fa-download"></i> Simpan Gambar</button></div></div>)}
            </div>
          )}
        </div>
      </div>
      {showAddCust && <QuickAddCustomerModal onClose={() => setShowAddCust(false)} onSave={handleQuickAddCust} />}
      {showInvoice && <InvoicePrintModal data={showInvoice} onClose={() => setShowInvoice(null)} />}
      {load && <div className="loading-ov"><div className="loading-popup"><div className="loading-progress"><div className="loading-progress-bar"></div></div><div className="loading-txt">{load}</div></div></div>}
    </div>
  );
}

function QuickAddCustomerModal({ onClose, onSave }) {
  const [name, setName] = useState(''); const [phone, setPhone] = useState('');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'380px'}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3><i className="fas fa-user-plus"></i> Tambah Cepat</h3><button className="close-btn" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-body">
          <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSave(name.trim(), phone); }}>
            <div className="form-group"><label>Nama *</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></div>
            <div className="form-group"><label>Telepon</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="form-actions"><button type="submit" className="btn btn-success"><i className="fas fa-check"></i> Tambah</button><button type="button" className="btn btn-secondary" onClick={onClose}>Batal</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}

function InvoicePrintModal({ data, onClose }) {
  const ref = useRef(null);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'380px', background:'#fafafa'}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3><i className="fas fa-receipt"></i> {data.invoice_no}</h3><button className="close-btn" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-body" style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
          <ThermalSlip slipRef={ref} data={data} />
          <div className="ts-actions" style={{marginTop:'16px'}}>
            <button className="ts-btn-print" onClick={() => printThermalSlip(ref)}><i className="fas fa-print"></i> Cetak</button>
            <button className="ts-btn-dl" onClick={() => downloadSlip(ref, data.invoice_no || 'struk')}><i className="fas fa-download"></i> Simpan Gambar</button>
            <button className="ts-btn-dl" onClick={onClose}><i className="fas fa-times"></i> Tutup</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Daftar Transaksi ── */
function SalesListView({ user, onNavigate }) {
  const _c = swrGet('sales');
  const [loading, setLoading] = useState(!_c);
  const [sales, setSales] = useState(_c || []);
  const [load, setLoad] = useState('');
  const [editingSale, setEditingSale] = useState(null);
  const [paySale, setPaySale] = useState(null);
  const [printSale, setPrintSale] = useState(null);
  const [customers, setCustomers] = useState([]);
  const tableRef = useRef(null);
  const [filters, setFilters] = useState({ status:'', method:'', orderType:'', dateFrom:'', dateTo:'' });
  const canEdit = user.role === 'admin' || user.role === 'manager';
  const canDelete = user.role === 'admin';

  useEffect(() => { if (_c) setTimeout(() => initTable(_c), 150); loadSales(); API.getCustomersForDropdown().then(r => { if (r.success) setCustomers(r.data); }); return () => { dtCleanup(); if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; } catch(e){} } }; }, []);

  const loadSales = async () => { if (!_c) setLoading(true); try { const r = await API.getSales(user.id, user.role); setLoading(false); if (r.success) { swrSet('sales', r.data); setSales(r.data); initTable(r.data); } } catch(e) { setLoading(false); } };

  const initTable = (data) => {
    if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; $('#salesTable').empty(); } catch(e){} }
    setTimeout(() => {
      try {
        const t = $('#salesTable').DataTable({
          data, destroy:true,
          columns:[
            { data:'invoice_no', title:'Struk', render:(d) => '<strong>' + d + '</strong>' }, { data:'customer_name', title:'Pelanggan' },
            { data:'order_type', title:'Tipe', render:(d) => ORDER_TYPE_LABELS[d] || d },
            { data:'total_items', title:'Item', className:'dt-center', render:(d) => '<span class="piece-badge total">' + d + '</span>' },
            { data:'grand_total', title:'Total', render:(d) => '<strong>' + fmtRp(d) + '</strong>' },
            { data:'paid_amount', title:'Dibayar', render:(d) => '<span class="paid-amount">' + fmtRp(d) + '</span>' },
            { data:'due_amount', title:'Sisa', render:(d) => d > 0 ? '<span class="due-amount">' + fmtRp(d) + '</span>' : '<span style="color:#aaa">0</span>' },
            { data:'payment_method', title:'Metode', render:(d) => '<span class="pay-method active" style="font-size:11px;padding:3px 8px;cursor:default">' + d + '</span>' },
            { data:'status', title:'Status', render:(d) => '<span class="pur-status pur-' + (d==='completed'?'completed':d==='pending'?'pending':'cancelled') + '">' + d + '</span>' },
            { data:'cashier_name', title:'Kasir' }, { data:'sale_date', title:'Tanggal', render:(d) => fmtDateShort(d) },
            { data:null, title:'Aksi', orderable:false, width:'150px', render:(_,__,row) => {
              let h = '<button class="action-icon" data-action="print" title="Cetak Struk" style="color:var(--navy-primary)"><i class="fas fa-print"></i></button>';
              if (row.due_amount > 0 && row.status !== 'cancelled' && row.customer_id) h += '<button class="action-icon" data-action="pay" title="Terima Pembayaran" style="color:#2e7d32"><i class="fas fa-hand-holding-usd"></i></button>';
              if (canEdit && row.status !== 'cancelled') h += '<button class="action-icon edit-icon" data-action="edit" title="Ubah"><i class="fas fa-edit"></i></button>';
              if (canEdit && row.status !== 'cancelled') h += '<button class="action-icon" data-action="cancel" title="Batalkan" style="color:#e65100"><i class="fas fa-ban"></i></button>';
              if (canDelete) h += '<button class="action-icon delete-icon" data-action="delete" title="Hapus"><i class="fas fa-trash"></i></button>';
              return h;
            }}
          ],
          pageLength:10, lengthMenu:[[10,25,50,-1],[10,25,50,"Semua"]], responsive:true, dom:'Blfrtip',
          buttons:[{ extend:'csv', text:'<i class="fas fa-file-csv"></i> CSV' },{ extend:'pdf', text:'<i class="fas fa-file-pdf"></i> PDF' },{ extend:'print', text:'<i class="fas fa-print"></i> Cetak' }],
          order:[[10,'desc']]
        });
        $('#salesTable').off('click', '.action-icon');
        $('#salesTable').on('click', '.action-icon', function() {
          const action = $(this).data('action'); const row = t.row($(this).parents('tr')).data();
          if (action === 'edit') setEditingSale(row); else if (action === 'delete') handleDelete(row); else if (action === 'pay') setPaySale(row); else if (action === 'print') handlePrint(row); else if (action === 'cancel') handleCancel(row);
        });
        tableRef.current = t;
      } catch(e) { console.error('salesTable:', e); }
    }, 150);
  };

  const handleCancel = (sale) => {
    Swal.fire({ icon:'warning', title:'Batalkan Transaksi?', input:'text', inputPlaceholder:'Alasan (opsional)', text:'Batalkan ' + sale.invoice_no + '? Stok menu akan dikembalikan.', showCancelButton:true, confirmButtonColor:'#e65100', confirmButtonText:'Batalkan' }).then(async (res) => {
      if (res.isConfirmed) { setLoad('Membatalkan...'); try { const r = await API.cancelSale(sale.id, res.value || '', user.id, user.role); setLoad(''); if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); loadSales(); } else Swal.fire({ icon:'error', text:r.message }); } catch(e) { setLoad(''); } }
    });
  };
  const handleDelete = (sale) => {
    Swal.fire({ icon:'warning', title:'Hapus Transaksi?', html:'<p>Hapus permanen <strong>' + sale.invoice_no + '</strong>?</p><p style="color:#c62828;font-size:13px;margin-top:8px">Ini akan mengembalikan stok menu, membalik total pelanggan, dan menghapus semua pembayaran terkait.</p>', showCancelButton:true, confirmButtonColor:'#ea4335', confirmButtonText:'Ya, Hapus' }).then(async (res) => {
      if (res.isConfirmed) { setLoad('Menghapus transaksi...'); try { const r = await API.deleteSale(sale.id, user.id, user.role); setLoad(''); if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); loadSales(); } else Swal.fire({ icon:'error', text:r.message }); } catch(e) { setLoad(''); Swal.fire({ icon:'error', text:'Gagal menghapus' }); } }
    });
  };
  const handleEditSaved = () => { setEditingSale(null); loadSales(); };
  const handlePrint = async (sale) => {
    setLoad('Memuat struk...');
    try { const r = await API.getSaleDetail(sale.id, user.id, user.role); setLoad(''); if (r.success) { const d = r.data; setPrintSale({ invoice_no: d.invoice_no, customer: d.customer_name, orderType: d.order_type, tableNo: d.table_no, items: d.items, subtotal: d.subtotal, discount: d.discount, grandTotal: d.grand_total, paid: d.paid_amount, due: d.due_amount, payMethod: d.payment_method, notes: d.notes, date: d.sale_date }); } } catch(e) { setLoad(''); }
  };
  const handlePaySaved = () => { setPaySale(null); loadSales(); };

  const statusOpts = [{ value:'completed', label:'Selesai' },{ value:'pending', label:'Belum Lunas' },{ value:'cancelled', label:'Dibatalkan' }];
  const methodOpts = ['tunai','transfer','qris','ewallet','kredit'].map(m => ({ value:m, label:m }));
  const orderTypeOpts = [{ value:'dine_in', label:'Makan di Tempat' },{ value:'takeaway', label:'Bawa Pulang' },{ value:'delivery', label:'Antar' }];
  const applyFilters = () => {
    if (!tableRef.current) return;
    const dt = tableRef.current;
    while ($.fn.dataTable.ext.search.length > 0) $.fn.dataTable.ext.search.pop();
    if (filters.dateFrom || filters.dateTo) $.fn.dataTable.ext.search.push((s,sd,idx) => { const row = dt.row(idx).data(); if (!row) return true; const d = new Date(row.sale_date); if (filters.dateFrom && d < new Date(filters.dateFrom)) return false; if (filters.dateTo && d > new Date(filters.dateTo + 'T23:59:59')) return false; return true; });
    dt.columns().search('');
    if (filters.status) dt.column(8).search(filters.status);
    if (filters.method) dt.column(7).search(filters.method);
    if (filters.orderType) dt.column(2).search(ORDER_TYPE_LABELS[filters.orderType]);
    dt.draw();
  };
  const clearFilters = () => { setFilters({ status:'', method:'', orderType:'', dateFrom:'', dateTo:'' }); if (tableRef.current) { while ($.fn.dataTable.ext.search.length>0) $.fn.dataTable.ext.search.pop(); tableRef.current.columns().search('').draw(); } };
  useEffect(() => { if (tableRef.current && sales.length > 0) applyFilters(); }, [filters]);

  return (
    <div className="data-section">
      <div className="section-header"><h2><i className="fas fa-receipt"></i> Transaksi</h2></div>
      {!loading && (
        <div className="filters-section">
          <div className="filters-header"><h3><i className="fas fa-filter"></i> Filter</h3><button className="btn btn-secondary btn-sm" onClick={clearFilters}><i className="fas fa-times-circle"></i> Bersihkan</button></div>
          <div className="filters-grid">
            <SearchableDropdown label="Status" icon="fas fa-flag" options={statusOpts} value={filters.status} onChange={(v) => setFilters({...filters, status:v})} placeholder="Semua Status" />
            <SearchableDropdown label="Pembayaran" icon="fas fa-credit-card" options={methodOpts} value={filters.method} onChange={(v) => setFilters({...filters, method:v})} placeholder="Semua Metode" />
            <SearchableDropdown label="Tipe Pesanan" icon="fas fa-receipt" options={orderTypeOpts} value={filters.orderType} onChange={(v) => setFilters({...filters, orderType:v})} placeholder="Semua Tipe" />
            <div className="filter-group"><label><i className="fas fa-calendar-alt"></i> Dari Tanggal</label><input type="date" className="filter-input" value={filters.dateFrom} onChange={(e) => setFilters({...filters, dateFrom:e.target.value})} /></div>
            <div className="filter-group"><label><i className="fas fa-calendar-alt"></i> Sampai Tanggal</label><input type="date" className="filter-input" value={filters.dateTo} onChange={(e) => setFilters({...filters, dateTo:e.target.value})} /></div>
          </div>
        </div>
      )}
      {loading && <TableSkeleton rows={6} columns={10} />}
      <div style={{ display: loading ? 'none' : 'block' }}><table id="salesTable" className="display" style={{width:'100%'}}></table></div>
      {editingSale && <SaleEditModal sale={editingSale} customers={customers} user={user} onClose={() => setEditingSale(null)} onSaved={handleEditSaved} />}
      {paySale && <SalePayModal sale={paySale} user={user} onClose={() => setPaySale(null)} onSaved={handlePaySaved} />}
      {printSale && <InvoicePrintModal data={printSale} onClose={() => setPrintSale(null)} />}
      {load && <div className="loading-ov"><div className="loading-popup"><div className="loading-progress"><div className="loading-progress-bar"></div></div><div className="loading-txt">{load}</div></div></div>}
    </div>
  );
}

function SalePayModal({ sale, user, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ amount:'', method:'Tunai', reference:'', payment_date: new Date().toISOString().split('T')[0], notes:'' });
  const [saving, setSaving] = useState(false);
  const methodOpts = [{ value:'Tunai', label:'Tunai' },{ value:'Transfer Bank', label:'Transfer Bank' },{ value:'QRIS', label:'QRIS' },{ value:'E-Wallet', label:'E-Wallet' }];
  useEffect(() => { API.getSaleDetail(sale.id, user.id, user.role).then(r => { setLoading(false); if (r.success) setDetail(r.data); }); }, []);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (parseFloat(form.amount) <= 0) { Swal.fire({ icon:'warning', text:'Masukkan jumlah valid' }); return; }
    if (detail && parseFloat(form.amount) > detail.due_amount) { Swal.fire({ icon:'warning', text:'Jumlah melebihi sisa (' + fmtRp(detail.due_amount) + ')' }); return; }
    setSaving(true);
    const r = await API.addCustomerPayment({ customer_id: sale.customer_id, sale_id: sale.id, ...form }, user.id, user.role);
    setSaving(false);
    if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); onSaved(); } else Swal.fire({ icon:'error', text:r.message });
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'520px'}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3><i className="fas fa-hand-holding-usd"></i> Terima Pembayaran</h3><button className="close-btn" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-body">
          {loading ? <TableSkeleton rows={3} columns={3} /> : detail ? (
            <div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', paddingBottom:'12px', borderBottom:'1px solid #f0f0f0'}}><div><strong style={{fontSize:'15px'}}>{detail.invoice_no}</strong><div style={{fontSize:'13px', color:'#888', marginTop:'2px'}}>{detail.customer_name} — {fmtDateShort(detail.sale_date)}</div></div><span className={'pur-status ' + (detail.status==='completed'?'pur-completed':'pur-pending')}>{detail.status}</span></div>
              <div className="pay-remain"><div><div className="pay-remain-lbl">Sisa Tagihan</div><div style={{fontSize:'12px', color:'#888'}}>Total: {fmtRp(detail.grand_total)} | Dibayar: {fmtRp(detail.paid_amount)}</div></div><div className="pay-remain-val">{fmtRp(detail.due_amount)}</div></div>
              {detail.payments.length > 0 && (
                <div style={{marginBottom:'16px'}}>
                  <h4 style={{fontSize:'13px', fontWeight:'700', color:'#555', marginBottom:'8px'}}><i className="fas fa-history"></i> Riwayat Pembayaran ({detail.payments.length})</h4>
                  <div style={{border:'1px solid #e0e0e0', borderRadius:'4px', maxHeight:'150px', overflowY:'auto'}}>{detail.payments.map((p, i) => (<div key={i} className="pay-history-item"><div><span className="paid-amount" style={{fontWeight:'700'}}>{fmtRp(p.amount)}</span><span style={{marginLeft:'8px', color:'#888', fontSize:'12px'}}>{p.method}</span></div><div style={{textAlign:'right', fontSize:'12px', color:'#999'}}>{fmtDateShort(p.date)}<br/><span style={{fontSize:'11px'}}>{p.created_by_name}</span></div></div>))}</div>
                </div>
              )}
              {detail.due_amount > 0 ? (
                <form onSubmit={handleSubmit}>
                  <div className="form-grid">
                    <div className="form-group"><label><i className="fas fa-money-bill-wave"></i> Jumlah *</label><input type="number" step="0.01" max={detail.due_amount} value={form.amount} onChange={(e) => setForm({...form, amount:e.target.value})} required /></div>
                    <SearchableDropdown label="Metode" icon="fas fa-credit-card" options={methodOpts} value={form.method} onChange={(v) => setForm({...form, method:v||'Tunai'})} placeholder="Pilih..." />
                  </div>
                  <div className="form-group"><label><i className="fas fa-sticky-note"></i> Catatan</label><input type="text" value={form.notes} onChange={(e) => setForm({...form, notes:e.target.value})} /></div>
                  <div className="form-actions"><button type="submit" className="btn btn-success" disabled={saving}>{saving ? <><i className="fas fa-spinner fa-spin"></i> Menyimpan...</> : <><i className="fas fa-check"></i> Catat Pembayaran</>}</button><button type="button" className="btn btn-secondary" onClick={onClose}><i className="fas fa-times"></i> Batal</button></div>
                </form>
              ) : (<div style={{textAlign:'center', padding:'16px', color:'#2e7d32'}}><i className="fas fa-check-circle" style={{fontSize:'28px', marginBottom:'8px'}}></i><p style={{fontWeight:'600'}}>Lunas</p></div>)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SaleEditModal({ sale, customers, user, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ customer_id: sale.customer_id ? String(sale.customer_id) : '', discount:'0', paid_amount: String(sale.paid_amount||0), payment_method: sale.payment_method||'tunai', notes: sale.notes||'', order_type: sale.order_type||'dine_in', table_no: sale.table_no||'' });
  const [saving, setSaving] = useState(false);
  const [itemLoad, setItemLoad] = useState('');
  const [searchQ, setSearchQ] = useState(''); const [searchResults, setSearchResults] = useState([]); const [searching, setSearching] = useState(false); const [showSearch, setShowSearch] = useState(false);
  const debRef = useRef(null);

  useEffect(() => { loadDetail(); }, []);
  const loadDetail = async () => {
    try { const r = await API.getSaleDetail(sale.id, user.id, user.role); setLoading(false); if (r.success) { setDetail(r.data); setForm(f => ({ ...f, discount: String(r.data.discount||0), paid_amount: String(r.data.paid_amount||0), payment_method: r.data.payment_method||'tunai', notes: r.data.notes||'', customer_id: r.data.customer_id ? String(r.data.customer_id) : '', order_type: r.data.order_type||'dine_in', table_no: r.data.table_no||'' })); } } catch(e) { setLoading(false); }
  };
  const doSearch = (q) => {
    setSearchQ(q);
    if (debRef.current) clearTimeout(debRef.current);
    if (!q.trim()) { setSearchResults([]); return; }
    debRef.current = setTimeout(async () => { setSearching(true); const r = await API.searchMenu(q.trim()); setSearching(false); if (r.success) setSearchResults(r.data); }, 300);
  };
  const handleAddItem = async (menu) => {
    setItemLoad('Menambahkan ' + menu.name + '...'); setSearchQ(''); setSearchResults([]);
    try { const r = await API.addSaleItem(sale.id, menu.id, 1, user.id, user.role); setItemLoad(''); if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:800, showConfirmButton:false }); loadDetail(); } else Swal.fire({ icon:'error', text:r.message }); } catch(e) { setItemLoad(''); Swal.fire({ icon:'error', text:'Gagal' }); }
  };
  const handleRemoveItem = (item) => {
    Swal.fire({ icon:'warning', title:'Retur Item?', text:'Retur ' + item.name + '? Stok akan dikembalikan.', input:'text', inputPlaceholder:'Alasan (opsional)', showCancelButton:true, confirmButtonColor:'#e65100', confirmButtonText:'Retur' }).then(async (res) => {
      if (res.isConfirmed) { setItemLoad('Meretur ' + item.name + '...'); try { const r = await API.returnSaleItem(item.id, sale.id, res.value || '', user.id, user.role); setItemLoad(''); if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:800, showConfirmButton:false }); loadDetail(); } else Swal.fire({ icon:'error', text:r.message }); } catch(e) { setItemLoad(''); } }
    });
  };
  const subtotal = detail ? (detail.subtotal || detail.items.reduce((s, i) => s + (i.total||0), 0)) : 0;
  const disc = parseFloat(form.discount) || 0;
  const grandTotal = Math.round((subtotal - disc) * 100) / 100;
  const paid = Math.min(parseFloat(form.paid_amount) || 0, grandTotal);
  const due = Math.round((grandTotal - paid) * 100) / 100;
  const custOpts = customers.map(c => ({ value: String(c.id), label: c.name }));
  const methods = ['tunai','transfer','qris','ewallet','kredit'];
  const orderTypeOpts = [{ value:'dine_in', label:'Makan di Tempat' },{ value:'takeaway', label:'Bawa Pulang' },{ value:'delivery', label:'Antar' }];

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try { const r = await API.updateSale({ id: sale.id, customer_id: form.customer_id || '', discount: disc, paid_amount: paid, payment_method: form.payment_method, notes: form.notes, order_type: form.order_type, table_no: form.table_no }, user.id, user.role); setSaving(false); if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); onSaved(); } else Swal.fire({ icon:'error', text:r.message }); }
    catch(e) { setSaving(false); Swal.fire({ icon:'error', text:'Update gagal' }); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'820px', maxHeight:'90vh', display:'flex', flexDirection:'column'}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3><i className="fas fa-edit"></i> Ubah Transaksi — {sale.invoice_no}</h3><button className="close-btn" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-body" style={{overflowY:'auto', flex:1}}>
          {loading ? (<div style={{padding:'40px 20px', display:'flex', flexDirection:'column', alignItems:'center', gap:'12px'}}><div className="loading-progress" style={{width:'200px'}}><div className="loading-progress-bar"></div></div><span style={{fontSize:'14px', color:'#888'}}>Memuat detail transaksi...</span></div>) : detail ? (
            <div>
              {itemLoad && (<div style={{marginBottom:'16px', padding:'10px 16px', background:'#fdf1e6', borderRadius:'4px', display:'flex', alignItems:'center', gap:'12px'}}><div className="loading-progress" style={{width:'120px'}}><div className="loading-progress-bar"></div></div><span style={{fontSize:'13px', color:'var(--navy-accent)', fontWeight:'500'}}>{itemLoad}</span></div>)}
              <div style={{marginBottom:'20px'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}><h4 style={{fontSize:'14px', fontWeight:'700', color:'var(--navy-primary)'}}><i className="fas fa-utensils"></i> Item Transaksi ({detail.items.length})</h4><button type="button" className="btn btn-success btn-sm" onClick={() => setShowSearch(!showSearch)}><i className={'fas ' + (showSearch ? 'fa-times' : 'fa-plus')}></i> {showSearch ? 'Tutup' : 'Tambah Item'}</button></div>
                {detail.items.length > 0 ? (
                  <div style={{border:'1px solid #e0e0e0', borderRadius:'4px', overflowX:'auto', marginBottom:'12px'}}>
                    <table className="cart-table" style={{marginBottom:0}}><thead><tr><th>#</th><th>Menu</th><th>Qty</th><th>Harga</th><th>Total</th><th></th></tr></thead>
                      <tbody>{detail.items.map((item, i) => (<tr key={item.id || i}><td>{i+1}</td><td><strong>{item.name}</strong></td><td>{item.qty}</td><td>{fmtRp(item.price)}</td><td><strong>{fmtRp(item.total)}</strong></td><td>{detail.items.length > 1 && <button type="button" className="cart-remove" onClick={() => handleRemoveItem(item)}><i className="fas fa-times-circle"></i></button>}</td></tr>))}</tbody>
                    </table>
                  </div>
                ) : (<div className="empty-state" style={{padding:'16px'}}><i className="fas fa-inbox"></i><p>Belum ada item</p></div>)}
                {showSearch && (
                  <div style={{border:'1px solid #e0e0e0', borderRadius:'4px', padding:'12px', background:'#fafafa'}}>
                    <div className="pos-search" style={{marginBottom:'8px'}}><i className="fas fa-search search-icon"></i><input type="text" value={searchQ} onChange={(e) => doSearch(e.target.value)} placeholder="Cari nama menu..." autoFocus autoComplete="off" /></div>
                    <div style={{maxHeight:'180px', overflowY:'auto'}}>
                      {searching && <div style={{padding:'10px', textAlign:'center', color:'#888'}}><i className="fas fa-spinner fa-spin"></i> Mencari...</div>}
                      {!searching && searchResults.map((m, i) => (<div key={i} className="pos-result-item" onClick={() => handleAddItem(m)}><div><span className="pos-result-serial">{m.name}</span><div className="pos-result-info">{m.category_name}</div></div><span className="pos-result-price">{fmtRp(m.price)}</span></div>))}
                      {!searching && searchQ.length > 1 && searchResults.length === 0 && <div style={{padding:'10px', textAlign:'center', color:'#aaa'}}>Tidak ditemukan</div>}
                    </div>
                  </div>
                )}
              </div>
              <form onSubmit={handleSubmit}>
                <div style={{borderTop:'1px solid #e0e0e0', paddingTop:'16px'}}>
                  <h4 style={{fontSize:'14px', fontWeight:'700', color:'var(--navy-primary)', marginBottom:'12px'}}><i className="fas fa-sliders-h"></i> Pengaturan Transaksi</h4>
                  <SearchableDropdown label="Pelanggan" icon="fas fa-user" options={custOpts} value={form.customer_id} onChange={(v) => setForm({...form, customer_id:v})} placeholder="Pelanggan Umum" />
                  <div className="form-grid">
                    <SearchableDropdown label="Tipe Pesanan" icon="fas fa-receipt" options={orderTypeOpts} value={form.order_type} onChange={(v) => setForm({...form, order_type:v||'dine_in'})} placeholder="Pilih..." />
                    <div className="form-group"><label><i className="fas fa-chair"></i> No. Meja</label><input type="text" value={form.table_no} onChange={(e) => setForm({...form, table_no:e.target.value})} /></div>
                  </div>
                  <div className="form-grid">
                    <div className="form-group"><label><i className="fas fa-tag"></i> Diskon</label><input type="number" step="100" value={form.discount} onChange={(e) => setForm({...form, discount:e.target.value})} /></div>
                    <div className="form-group"><label><i className="fas fa-money-bill-wave"></i> Dibayar</label><input type="number" step="100" value={form.paid_amount} onChange={(e) => setForm({...form, paid_amount:e.target.value})} /></div>
                  </div>
                  <div className="calc-panel" style={{marginBottom:'16px'}}>
                    <div className="calc-row"><span className="calc-label">Subtotal ({detail.items.length} item)</span><span className="calc-val">{fmtRp(subtotal)}</span></div>
                    {disc > 0 && <div className="calc-row"><span className="calc-label">Diskon</span><span className="calc-val" style={{color:'#c62828'}}>-{fmtRp(disc)}</span></div>}
                    <div className="calc-row"><span className="calc-label">Total Bayar</span><span className="calc-val" style={{fontWeight:'700', fontSize:'15px'}}>{fmtRp(grandTotal)}</span></div>
                    <div className="calc-row"><span className="calc-label">Dibayar</span><span className="calc-val" style={{color:'#2e7d32'}}>{fmtRp(paid)}</span></div>
                    <div className="calc-row"><span className="calc-label">Sisa</span><span className={'calc-val' + (due > 0 ? ' due-amount' : '')}>{due > 0 ? fmtRp(due) : '0'}</span></div>
                  </div>
                  <div><label style={{fontSize:'13px', fontWeight:'600', color:'#555', marginBottom:'8px', display:'block'}}><i className="fas fa-credit-card"></i> Metode Pembayaran</label><div className="pay-methods" style={{marginBottom:'16px'}}>{methods.map(m => <button key={m} type="button" className={'pay-method ' + (form.payment_method===m?'active':'')} onClick={() => setForm({...form, payment_method:m})}>{m}</button>)}</div></div>
                  <div className="form-group"><label><i className="fas fa-sticky-note"></i> Catatan</label><textarea rows="2" value={form.notes} onChange={(e) => setForm({...form, notes:e.target.value})} style={{resize:'vertical'}}></textarea></div>
                  <div className="form-actions"><button type="submit" className="btn btn-primary" disabled={saving || !!itemLoad}>{saving ? <><i className="fas fa-spinner fa-spin"></i> Menyimpan...</> : <><i className="fas fa-save"></i> Simpan Perubahan</>}</button><button type="button" className="btn btn-secondary" onClick={onClose}><i className="fas fa-times"></i> Batal</button></div>
                </div>
              </form>
            </div>
          ) : (<div className="empty-state"><i className="fas fa-exclamation-circle"></i><p>Gagal memuat transaksi</p></div>)}
        </div>
      </div>
    </div>
  );
}

/* ── Halaman Pembayaran ── */
function PaymentsPageView({ user }) {
  const _c = swrGet('payments');
  const [loading, setLoading] = useState(!_c);
  const [payments, setPayments] = useState(_c || []);
  const [activeTab, setActiveTab] = useState('customer_payment');
  const custTableRef = useRef(null); const suppTableRef = useRef(null);

  useEffect(() => {
    if (_c) setTimeout(() => { initTab(_c.filter(p => p.payment_type === 'customer_payment'), custTableRef, 'custPaymentsTable'); initTab(_c.filter(p => p.payment_type === 'supplier_payment'), suppTableRef, 'suppPaymentsTable'); }, 200);
    loadPayments();
    return () => { [custTableRef, suppTableRef].forEach(r => { if (r.current) { try { r.current.destroy(); r.current=null; } catch(e){} } }); };
  }, []);
  const loadPayments = async () => {
    if (!_c) setLoading(true);
    try { const r = await API.getPayments(user.id, user.role); setLoading(false); if (r.success) { swrSet('payments', r.data); setPayments(r.data); setTimeout(() => { initTab(r.data.filter(p => p.payment_type === 'customer_payment'), custTableRef, 'custPaymentsTable'); initTab(r.data.filter(p => p.payment_type === 'supplier_payment'), suppTableRef, 'suppPaymentsTable'); }, 200); } } catch(e) { setLoading(false); }
  };
  const initTab = (data, tableRefObj, tableId) => {
    if (tableRefObj.current) { try { tableRefObj.current.destroy(); $('#'+tableId).empty(); } catch(e){} }
    if (!data.length) return;
    setTimeout(() => {
      try {
        tableRefObj.current = $('#'+tableId).DataTable({ data, destroy:true, columns:[
          { data:'date', title:'Tanggal', render:(d) => fmtDateShort(d) }, { data:'ref_no', title:'Referensi', render:(d) => d ? '<strong>' + d + '</strong>' : '—' },
          { data:'party_name', title:'Pihak' }, { data:'amount', title:'Jumlah', render:(d) => '<strong class="paid-amount">' + fmtRp(d) + '</strong>' },
          { data:'method', title:'Metode', render:(d) => '<span class="pay-method active" style="font-size:11px;padding:3px 8px;cursor:default">' + (d||'-') + '</span>' },
          { data:'reference', title:'Referensi', render:(d) => d || '—' }, { data:'created_by_name', title:'Dicatat Oleh' }
        ], pageLength:15, responsive:true, dom:'Blfrtip', buttons:[{ extend:'csv', text:'CSV' },{ extend:'print', text:'Cetak' }], order:[[0,'desc']] });
      } catch(e) {}
    }, 50);
  };
  const custPayments = payments.filter(p => p.payment_type === 'customer_payment');
  const suppPayments = payments.filter(p => p.payment_type === 'supplier_payment');
  return (
    <div className="data-section">
      <div className="section-header"><h2><i className="fas fa-money-bill-wave"></i> Pembayaran</h2></div>
      <div className="ledger-tabs">
        <button className={`ledger-tab ${activeTab==='customer_payment'?'active':''}`} onClick={() => setActiveTab('customer_payment')}><i className="fas fa-user-friends"></i> Pembayaran Pelanggan ({custPayments.length})</button>
        <button className={`ledger-tab ${activeTab==='supplier_payment'?'active':''}`} onClick={() => setActiveTab('supplier_payment')}><i className="fas fa-handshake"></i> Pembayaran Supplier ({suppPayments.length})</button>
      </div>
      {loading && <TableSkeleton rows={5} columns={7} />}
      <div style={{ display: !loading && activeTab==='customer_payment' ? 'block' : 'none' }}>{custPayments.length > 0 ? <table id="custPaymentsTable" className="display" style={{width:'100%'}}></table> : (!loading && <div className="empty-state"><i className="fas fa-inbox"></i><p>Belum ada pembayaran pelanggan</p></div>)}</div>
      <div style={{ display: !loading && activeTab==='supplier_payment' ? 'block' : 'none' }}>{suppPayments.length > 0 ? <table id="suppPaymentsTable" className="display" style={{width:'100%'}}></table> : (!loading && <div className="empty-state"><i className="fas fa-inbox"></i><p>Belum ada pembayaran supplier</p></div>)}</div>
    </div>
  );
}

/* ── Pengeluaran ── */
function ExpensesView({ user }) {
  const _c = swrGet('expenses');
  const [loading, setLoading] = useState(!_c);
  const [expenses, setExpenses] = useState(_c || []);
  const [showModal, setShowModal] = useState(false);
  const [editingEx, setEditingEx] = useState(null);
  const [load, setLoad] = useState('');
  const tableRef = useRef(null);
  const canDelete = user.role === 'admin';
  const CAT_LABELS = { bahan_baku:'Bahan Baku', gaji:'Gaji', utilitas:'Utilitas', sewa:'Sewa', transport:'Transport', lainnya:'Lainnya' };
  const CAT_COLORS = { bahan_baku:'#e65100', gaji:'#6a1b9a', utilitas:'#00838f', sewa:'#00695c', transport:'#1565c0', lainnya:'#888' };

  useEffect(() => { if (_c) setTimeout(() => initTable(_c), 150); loadExpenses(); return () => { if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; } catch(e){} } }; }, []);
  const loadExpenses = async () => { if (!_c) setLoading(true); try { const r = await API.getExpenses(user.id, user.role); setLoading(false); if (r.success) { swrSet('expenses', r.data); setExpenses(r.data); initTable(r.data); } } catch(e) { setLoading(false); } };

  const stats = React.useMemo(() => {
    const now = new Date(); const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = expenses.filter(e => new Date(e.expense_date) >= mStart);
    const monthTotal = thisMonth.reduce((s, e) => s + e.amount, 0);
    const catBreakdown = {};
    thisMonth.forEach(e => { catBreakdown[e.category] = (catBreakdown[e.category] || 0) + e.amount; });
    return { monthTotal, catBreakdown };
  }, [expenses]);

  const initTable = (data) => {
    if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current=null; $('#expTable').empty(); } catch(e){} }
    setTimeout(() => {
      try {
        const t = $('#expTable').DataTable({
          data, destroy:true, columns:[
            { data:'title', title:'Judul', render:(d) => '<strong>' + d + '</strong>' },
            { data:'category', title:'Kategori', render:(d) => '<span class="pur-status exp-' + d + '">' + (CAT_LABELS[d]||d) + '</span>' },
            { data:'amount', title:'Jumlah', render:(d) => '<strong>' + fmtRp(d) + '</strong>' },
            { data:'expense_date', title:'Tanggal', render:(d) => fmtDateShort(d) }, { data:'created_by_name', title:'Dicatat Oleh' },
            { data:null, title:'', orderable:false, width:'70px', render:(_,__,row) => { let h = '<button class="action-icon edit-icon" data-action="edit"><i class="fas fa-edit"></i></button>'; if (canDelete) h += '<button class="action-icon delete-icon" data-action="delete"><i class="fas fa-trash"></i></button>'; return h; } }
          ], pageLength:10, lengthMenu:[[10,25,50,-1],[10,25,50,"Semua"]], responsive:true, dom:'Blfrtip',
          buttons:[{ extend:'csv', text:'<i class="fas fa-file-csv"></i> CSV' },{ extend:'pdf', text:'<i class="fas fa-file-pdf"></i> PDF' },{ extend:'print', text:'<i class="fas fa-print"></i> Cetak' }], order:[[3,'desc']]
        });
        $('#expTable').off('click', '.action-icon');
        $('#expTable').on('click', '.action-icon', function() { const action = $(this).data('action'); const row = t.row($(this).parents('tr')).data(); if (action === 'edit') { setEditingEx(row); setShowModal(true); } else if (action === 'delete') handleDelete(row); });
        tableRef.current = t;
      } catch(e) { console.error('expTable:', e); }
    }, 150);
  };

  const handleSave = async (formData) => {
    setLoad(editingEx ? 'Memperbarui...' : 'Menambahkan...');
    try {
      let r;
      if (editingEx) r = await API.updateExpense({ ...formData, id: editingEx.id }, user.id, user.role);
      else r = await API.addExpense(formData, user.id, user.role);
      setLoad('');
      if (r.success) { setShowModal(false); setEditingEx(null); Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); loadExpenses(); }
      else Swal.fire({ icon:'error', text:r.message });
    } catch(e) { setLoad(''); Swal.fire({ icon:'error', text:'Gagal' }); }
  };
  const handleDelete = (ex) => {
    Swal.fire({ icon:'warning', title:'Hapus?', text:'Hapus "' + ex.title + '"?', showCancelButton:true, confirmButtonColor:'#ea4335', confirmButtonText:'Hapus' }).then(async (res) => {
      if (res.isConfirmed) { setLoad('Menghapus...'); try { const r = await API.deleteExpense(ex.id, user.id, user.role); setLoad(''); if (r.success) { Swal.fire({ icon:'success', text:r.message, timer:1500, showConfirmButton:false }); loadExpenses(); } else Swal.fire({ icon:'error', text:r.message }); } catch(e) { setLoad(''); } }
    });
  };

  return (
    <div>
      {!loading && (
        <div style={{marginBottom:'20px'}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'16px'}}>
            <div className="stat-card"><div className="stat-card-icon"><i className="fas fa-calendar-check"></i></div><div className="stat-card-value">{fmtRp(stats.monthTotal)}</div><div className="stat-card-label">Total Bulan Ini</div></div>
            <div className="stat-card"><div className="stat-card-icon"><i className="fas fa-layer-group"></i></div><div className="stat-card-value">{Object.keys(stats.catBreakdown).length}</div><div className="stat-card-label">Kategori</div></div>
          </div>
          <div className="data-section" style={{padding:'16px 20px'}}>
            <h3 style={{fontSize:'14px', fontWeight:'700', color:'var(--navy-primary)', marginBottom:'12px'}}><i className="fas fa-tags"></i> Rincian</h3>
            <div className="exp-pills">{Object.entries(stats.catBreakdown).sort((a,b) => b[1]-a[1]).map(([cat, amt]) => (<span key={cat} className="exp-pill" style={{background: CAT_COLORS[cat] + '15', color: CAT_COLORS[cat], border:'1px solid ' + CAT_COLORS[cat] + '30'}}><span className="dot" style={{background: CAT_COLORS[cat]}}></span>{CAT_LABELS[cat] || cat}: {fmtRp(amt)}</span>))}</div>
          </div>
        </div>
      )}
      <div className="data-section">
        <div className="section-header"><h2><i className="fas fa-receipt"></i> Pengeluaran</h2><button className="btn btn-success" onClick={() => { setEditingEx(null); setShowModal(true); }}><i className="fas fa-plus"></i> Tambah Pengeluaran</button></div>
        {loading && <TableSkeleton rows={5} columns={5} />}
        <div style={{ display: loading ? 'none' : 'block' }}><table id="expTable" className="display" style={{width:'100%'}}></table></div>
      </div>
      {showModal && <ExpenseModal editEx={editingEx} onClose={() => { setShowModal(false); setEditingEx(null); }} onSave={handleSave} />}
      {load && <div className="loading-ov"><div className="loading-popup"><div className="loading-progress"><div className="loading-progress-bar"></div></div><div className="loading-txt">{load}</div></div></div>}
    </div>
  );
}

function ExpenseModal({ editEx, onClose, onSave }) {
  const [form, setForm] = useState({ title: editEx?.title || '', category: editEx?.category || 'lainnya', amount: editEx?.amount || '', expense_date: editEx?.expense_date || new Date().toISOString().split('T')[0], notes: editEx?.notes || '' });
  const catOpts = [{ value:'bahan_baku', label:'Bahan Baku' },{ value:'gaji', label:'Gaji' },{ value:'utilitas', label:'Utilitas' },{ value:'sewa', label:'Sewa' },{ value:'transport', label:'Transport' },{ value:'lainnya', label:'Lainnya' }];
  const handleSubmit = (e) => { e.preventDefault(); onSave(form); };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:'500px'}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3><i className={editEx ? 'fas fa-edit' : 'fas fa-plus-circle'}></i> {editEx ? 'Ubah' : 'Tambah'} Pengeluaran</h3><button className="close-btn" onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group"><label><i className="fas fa-heading"></i> Judul *</label><input type="text" value={form.title} onChange={(e) => setForm({...form, title:e.target.value})} required autoFocus /></div>
            <div className="form-grid">
              <SearchableDropdown label="Kategori" icon="fas fa-tag" options={catOpts} value={form.category} onChange={(v) => setForm({...form, category:v||'lainnya'})} placeholder="Pilih..." required />
              <div className="form-group"><label><i className="fas fa-money-bill-wave"></i> Jumlah *</label><input type="number" step="100" value={form.amount} onChange={(e) => setForm({...form, amount:e.target.value})} required /></div>
            </div>
            <div className="form-group"><label><i className="fas fa-calendar-alt"></i> Tanggal</label><input type="date" value={form.expense_date} onChange={(e) => setForm({...form, expense_date:e.target.value})} /></div>
            <div className="form-group"><label><i className="fas fa-sticky-note"></i> Catatan</label><textarea rows="2" value={form.notes} onChange={(e) => setForm({...form, notes:e.target.value})} style={{resize:'vertical'}}></textarea></div>
            <div className="form-actions"><button type="submit" className="btn btn-primary"><i className="fas fa-save"></i> {editEx ? 'Perbarui' : 'Simpan'}</button><button type="button" className="btn btn-secondary" onClick={onClose}><i className="fas fa-times"></i> Batal</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Pengaturan (termasuk Tema Warna Kustom) ── */
function SettingsView({ user, onSettingsUpdate }) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [openSections, setOpenSections] = useState({ business: true, theme: true, invoice: true });
  const originalRef = useRef({});

  useEffect(() => { loadSettings(); }, []);
  const loadSettings = async () => { try { const r = await API.getSettings(); setLoading(false); if (r.success) { setSettings(r.data); originalRef.current = r.data; } } catch(e) { setLoading(false); } };

  useEffect(() => { return () => { applyThemeFromSettings(originalRef.current); }; }, []);

  const updateField = (key, val) => { setSettings(prev => { const next = { ...prev, [key]: val }; if (key.startsWith('theme_')) applyThemeFromSettings(next); return next; }); };
  const toggleSection = (s) => setOpenSections(prev => ({ ...prev, [s]: !prev[s] }));
  const applyPreset = (preset) => { setSettings(prev => { const next = { ...prev, theme_primary: preset.primary, theme_primary_hover: preset.hover, theme_accent: preset.accent }; applyThemeFromSettings(next); return next; }); };

  const handleLogoUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      Swal.fire({ icon:'warning', text:'Format gambar yang didukung: PNG, JPG, JPEG, atau WebP.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      Swal.fire({ icon:'warning', text:'Ukuran logo maksimal 2 MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      setLogoUploading(true);
      try {
        const r = await API.saveBusinessLogo({ data: base64, name: file.name, type: file.type }, user.id, user.role);
        setLogoUploading(false);
        if (r.success) {
          const next = { ...settings, business_logo: r.data.fileId };
          setSettings(next);
          originalRef.current = next;
          if (onSettingsUpdate) onSettingsUpdate(next);
          Swal.fire({ icon:'success', text:'Logo warung berhasil disimpan.' });
        } else {
          Swal.fire({ icon:'error', text: r.message });
        }
      } catch (err) {
        setLogoUploading(false);
        Swal.fire({ icon:'error', text:'Gagal mengunggah logo.' });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveLogo = async () => {
    try {
      const r = await API.removeBusinessLogo(user.id, user.role);
      if (r.success) {
        const next = { ...settings, business_logo: '' };
        setSettings(next);
        originalRef.current = next;
        if (onSettingsUpdate) onSettingsUpdate(next);
        Swal.fire({ icon:'success', text:'Logo warung berhasil dihapus.' });
      } else Swal.fire({ icon:'error', text:r.message });
    } catch (e) { Swal.fire({ icon:'error', text:'Gagal menghapus logo.' }); }
  };

  const handleSave = async () => {
    setSaving(true);
    try { const r = await API.saveAllSettings(settings, user.id, user.role); setSaving(false); if (r.success) { originalRef.current = settings; if (onSettingsUpdate) onSettingsUpdate(settings); Swal.fire({ icon:'success', text:'Pengaturan disimpan! Perubahan telah diterapkan.', timer:1500, showConfirmButton:false }); } else Swal.fire({ icon:'error', text:r.message }); }
    catch(e) { setSaving(false); Swal.fire({ icon:'error', text:'Gagal' }); }
  };

  if (loading) return <div className="data-section"><div className="skeleton skeleton-text-large" style={{width:'40%', marginBottom:'20px'}}></div><div className="skeleton skeleton-text" style={{width:'80%'}}></div></div>;

  return (
    <div style={{width:'100%'}}>
      <div className="settings-section">
        <div className="settings-section-header" onClick={() => toggleSection('business')}><h3><i className="fas fa-building"></i> Informasi Bisnis</h3><i className={'fas fa-chevron-' + (openSections.business ? 'up' : 'down')} style={{color:'#888'}}></i></div>
        {openSections.business && (
          <div className="settings-section-body">
            <div className="settings-grid">
              <div className="form-group"><label>Nama Bisnis</label><input type="text" value={settings.business_name || ''} onChange={(e) => updateField('business_name', e.target.value)} /></div>
              <div className="form-group"><label>Telepon</label><input type="tel" value={settings.business_phone || ''} onChange={(e) => updateField('business_phone', e.target.value)} /></div>
            </div>
            <div className="form-group"><label>Alamat</label><textarea rows="2" value={settings.business_address || ''} onChange={(e) => updateField('business_address', e.target.value)} style={{resize:'vertical'}}></textarea></div>
            <div className="form-group" style={{maxWidth:'200px'}}><label>Simbol Mata Uang</label><input type="text" value={settings.currency_symbol || 'Rp'} onChange={(e) => updateField('currency_symbol', e.target.value)} /></div>
            <div className="form-group">
              <label>Logo Warung</label>
              <div className="logo-upload-box">
                <div className="brand-preview-card">
                  <div className="brand-preview-sample">
                    <div className="brand-preview-title">Login</div>
                    <div className="brand-preview-frame login">
                      {settings.business_logo ? <img src={avatarUrl(settings.business_logo)} alt="Preview login" /> : <div className="placeholder"><i className="fas fa-utensils"></i></div>}
                    </div>
                  </div>
                  <div className="brand-preview-sample">
                    <div className="brand-preview-title">Sidebar</div>
                    <div className="brand-preview-frame sidebar">
                      {settings.business_logo ? <img src={avatarUrl(settings.business_logo)} alt="Preview sidebar" /> : <div className="placeholder"><i className="fas fa-utensils"></i></div>}
                    </div>
                  </div>
                </div>
                <div style={{display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap'}}>
                  {settings.business_logo ? <img src={avatarUrl(settings.business_logo)} className="logo-preview" alt="Preview logo" /> : <div className="logo-preview"><i className="fas fa-image"></i></div>}
                  <div style={{flex:1, minWidth:'220px'}}>
                    <div className="logo-upload-hint">Format yang didukung: PNG, JPG, JPEG, atau WebP. Gunakan logo persegi/1:1, ukuran ideal sekitar 512×512 px, dan maksimal 2 MB agar tetap rapi di login dan sidebar.</div>
                  </div>
                </div>
                <div className="logo-upload-actions">
                  <label className="btn btn-secondary btn-sm" style={{cursor:'pointer'}}>
                    <i className="fas fa-upload"></i> {settings.business_logo ? 'Ganti Logo' : 'Pilih Logo'}
                    <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleLogoUpload} style={{display:'none'}} />
                  </label>
                  {settings.business_logo && <button type="button" className="btn btn-danger btn-sm" onClick={handleRemoveLogo}><i className="fas fa-trash"></i> Hapus Logo</button>}
                </div>
                {logoUploading && <div style={{fontSize:'13px', color:'#666'}}><i className="fas fa-spinner fa-spin"></i> Mengunggah logo...</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── TEMA WARNA — bisa disesuaikan bebas dengan logo/brand siapa pun ── */}
      <div className="settings-section">
        <div className="settings-section-header" onClick={() => toggleSection('theme')}><h3><i className="fas fa-palette"></i> Tampilan & Tema Warna</h3><i className={'fas fa-chevron-' + (openSections.theme ? 'up' : 'down')} style={{color:'#888'}}></i></div>
        {openSections.theme && (
          <div className="settings-section-body">
            <p style={{color:'#666', fontSize:'13px', marginBottom:'16px'}}>Sesuaikan warna aplikasi ini dengan warna logo atau brand toko Anda. Perubahan berlaku untuk semua pengguna setelah disimpan.</p>
            <div className="settings-grid">
              <div className="form-group">
                <label>Warna Utama (Primary)</label>
                <div className="color-picker-row"><input type="color" value={settings.theme_primary || '#b3261e'} onChange={(e) => updateField('theme_primary', e.target.value)} /><input type="text" value={settings.theme_primary || '#b3261e'} onChange={(e) => updateField('theme_primary', e.target.value)} /></div>
              </div>
              <div className="form-group">
                <label>Warna Utama saat Hover</label>
                <div className="color-picker-row"><input type="color" value={settings.theme_primary_hover || '#8f1e18'} onChange={(e) => updateField('theme_primary_hover', e.target.value)} /><input type="text" value={settings.theme_primary_hover || '#8f1e18'} onChange={(e) => updateField('theme_primary_hover', e.target.value)} /></div>
              </div>
              <div className="form-group">
                <label>Warna Aksen (Accent)</label>
                <div className="color-picker-row"><input type="color" value={settings.theme_accent || '#e07a1f'} onChange={(e) => updateField('theme_accent', e.target.value)} /><input type="text" value={settings.theme_accent || '#e07a1f'} onChange={(e) => updateField('theme_accent', e.target.value)} /></div>
              </div>
            </div>

            <div style={{marginTop:'16px'}}>
              <label style={{fontSize:'13px', fontWeight:'600', color:'#555', marginBottom:'8px', display:'block'}}>Pilihan Tema Cepat</label>
              <div className="preset-swatches">
                {PRESET_THEMES.map((p, i) => (<button key={i} type="button" className="preset-swatch-btn" title={p.name} style={{background: p.primary}} onClick={() => applyPreset(p)}></button>))}
              </div>
            </div>

            <div className="theme-preview-bar">
              <div className="theme-swatch" style={{background: settings.theme_primary || '#b3261e'}}>Utama</div>
              <div className="theme-swatch" style={{background: settings.theme_primary_hover || '#8f1e18'}}>Hover</div>
              <div className="theme-swatch" style={{background: settings.theme_accent || '#e07a1f'}}>Aksen</div>
            </div>
          </div>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-section-header" onClick={() => toggleSection('invoice')}><h3><i className="fas fa-file-invoice"></i> Pengaturan Struk</h3><i className={'fas fa-chevron-' + (openSections.invoice ? 'up' : 'down')} style={{color:'#888'}}></i></div>
        {openSections.invoice && (
          <div className="settings-section-body">
            <div className="settings-grid">
              <div className="form-group"><label>Awalan No. Struk</label><input type="text" value={settings.invoice_prefix || 'STRK'} onChange={(e) => updateField('invoice_prefix', e.target.value)} /></div>
              <div className="form-group"><label>Awalan No. Pembelian</label><input type="text" value={settings.purchase_prefix || 'BELI'} onChange={(e) => updateField('purchase_prefix', e.target.value)} /></div>
            </div>
            <div className="form-group"><label>Teks Footer Struk</label><textarea rows="2" value={settings.invoice_footer || ''} onChange={(e) => updateField('invoice_footer', e.target.value)} style={{resize:'vertical'}}></textarea></div>
          </div>
        )}
      </div>

      <div style={{textAlign:'right', marginTop:'10px'}}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? <><i className="fas fa-spinner fa-spin"></i> Menyimpan...</> : <><i className="fas fa-save"></i> Simpan Semua Pengaturan</>}</button>
      </div>
    </div>
  );
}

/* ── Pengingat Tagihan ── */
function DueRemindersView({ user }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const custTableRef = useRef(null); const suppTableRef = useRef(null);

  useEffect(() => { loadData(); return () => { [custTableRef, suppTableRef].forEach(r => { if (r.current) { try { r.current.destroy(); r.current=null; } catch(e){} } }); }; }, []);
  const loadData = async () => {
    try { const r = await API.getOverdueSummary(user.id, user.role); setLoading(false); if (r.success) { setData(r.data); setTimeout(() => { initTable(r.data.customers, custTableRef, 'dueCustTable'); initTable(r.data.suppliers, suppTableRef, 'dueSuppTable'); }, 200); } } catch(e) { setLoading(false); }
  };
  const initTable = (itemsData, ref, tableId) => {
    if (ref.current) { try { ref.current.destroy(); $('#'+tableId).empty(); } catch(e){} }
    if (!itemsData?.length) return;
    setTimeout(() => {
      try {
        ref.current = $('#'+tableId).DataTable({ data:itemsData, destroy:true, columns:[
          { data:'name', title:'Nama', render:(d) => '<strong>' + d + '</strong>' }, { data:'phone', title:'Telepon', render:(d) => d ? '<a href="tel:' + d + '" class="car-link">' + d + '</a>' : '—' },
          { data:'total_due', title:'Jumlah Tagihan', render:(d) => '<span class="due-amount" style="font-weight:700">' + fmtRp(d) + '</span>' },
          { data:'days_overdue', title:'Hari Tertunda', render:(d) => { const cls = d <= 7 ? 'green' : d <= 30 ? 'orange' : 'red'; return '<span class="overdue-days ' + cls + '"><i class="fas fa-clock"></i> ' + d + 'h</span>'; } },
          { data:null, title:'', orderable:false, width:'50px', render:(_,__,row) => { const p = String(row.phone||''); const ph = p ? (p.replace(/^0/,'62')).replace(/[^0-9]/g,'') : ''; if (!ph) return ''; const msg = encodeURIComponent('Pengingat: Anda memiliki tagihan tertunda sebesar ' + fmtRp(row.total_due) + '. Mohon segera diselesaikan. - ' + BN()); return '<a href="https://wa.me/' + ph + '?text=' + msg + '" target="_blank" class="wa-btn" style="padding:6px 10px;font-size:12px"><i class="fab fa-whatsapp"></i></a>'; } }
        ], pageLength:25, responsive:true, dom:'Blfrtip', buttons:[{ extend:'csv', text:'CSV' },{ extend:'print', text:'Cetak' }], order:[[2,'desc']] });
      } catch(e){}
    }, 50);
  };

  if (loading) return <div><div className="skeleton-card"><div className="skeleton skeleton-text-large" style={{width:'40%'}}></div></div><TableSkeleton rows={5} columns={5} /></div>;

  return (
    <div>
      {data && (
        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'12px', marginBottom:'20px'}}>
          <div className="stat-card" style={{borderLeftColor:'#c62828'}}><div className="stat-card-icon" style={{background:'#ea4335', width:'45px', height:'45px', fontSize:'20px'}}><i className="fas fa-user-friends"></i></div><div className="stat-card-value" style={{fontSize:'22px'}}>{fmtRp(data.totalCustDue||0)}</div><div className="stat-card-label">Piutang Pelanggan</div></div>
          <div className="stat-card" style={{borderLeftColor:'#e65100'}}><div className="stat-card-icon" style={{background:'#fbbc04', width:'45px', height:'45px', fontSize:'20px'}}><i className="fas fa-handshake"></i></div><div className="stat-card-value" style={{fontSize:'22px'}}>{fmtRp(data.totalSuppDue||0)}</div><div className="stat-card-label">Hutang Supplier</div></div>
          <div className="stat-card" style={{borderLeftColor:'#c62828'}}><div className="stat-card-icon" style={{background:'#ea4335', width:'45px', height:'45px', fontSize:'18px'}}><i className="fas fa-exclamation-triangle"></i></div><div className="stat-card-value" style={{fontSize:'22px'}}>{(data.buckets?.customers?.over_30||0) + (data.buckets?.suppliers?.over_30||0)}</div><div className="stat-card-label">Lebih dari 30 Hari</div></div>
          <div className="stat-card" style={{borderLeftColor:'var(--navy-primary)'}}><div className="stat-card-icon" style={{background:'var(--navy)', width:'45px', height:'45px', fontSize:'20px'}}><i className="fas fa-calculator"></i></div><div className="stat-card-value" style={{fontSize:'22px'}}>{fmtRp((data.totalCustDue||0) + (data.totalSuppDue||0))}</div><div className="stat-card-label">Total Tertunda</div></div>
        </div>
      )}
      <div className="data-section" style={{marginBottom:'20px'}}>
        <div className="section-header"><h2><i className="fas fa-user-friends"></i> Piutang Pelanggan ({data?.customers?.length||0})</h2><button className="btn btn-primary btn-sm" onClick={loadData}><i className="fas fa-sync-alt"></i> Muat Ulang</button></div>
        {data?.customers?.length > 0 ? <table id="dueCustTable" className="display" style={{width:'100%'}}></table> : (!loading && <div className="empty-state"><i className="fas fa-check-circle" style={{color:'#2e7d32'}}></i><p>Tidak ada tagihan pelanggan yang tertunda</p></div>)}
      </div>
      <div className="data-section">
        <div className="section-header"><h2><i className="fas fa-handshake"></i> Hutang Supplier ({data?.suppliers?.length||0})</h2></div>
        {data?.suppliers?.length > 0 ? <table id="dueSuppTable" className="display" style={{width:'100%'}}></table> : (!loading && <div className="empty-state"><i className="fas fa-check-circle" style={{color:'#2e7d32'}}></i><p>Tidak ada tagihan supplier yang tertunda</p></div>)}
      </div>
    </div>
  );
}

/* ── Laporan ── */
function ReportsView({ user }) {
  const [activeReport, setActiveReport] = useState('profit_loss');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], dateTo: new Date().toISOString().split('T')[0], groupBy: 'daily' });
  const chartRef = useRef(null); const tableRef = useRef(null);

  const reports = [
    { id:'profit_loss', label:'Laba / Rugi', icon:'fas fa-balance-scale', color:'#1565c0' },
    { id:'sales_summary', label:'Ringkasan Penjualan', icon:'fas fa-chart-line', color:'#2e7d32' },
    { id:'menu_terlaris', label:'Menu Terlaris', icon:'fas fa-utensils', color:'#e65100' },
    { id:'customer_profit', label:'Analisa Pelanggan', icon:'fas fa-users', color:'#6f42c1' }
  ];

  const loadReport = async () => {
    setLoading(true); setData(null);
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    if (tableRef.current) { try { tableRef.current.destroy(); tableRef.current = null; } catch(e){} }
    try { const r = await API.getReportsData(activeReport, filters, user.id, user.role); setLoading(false); if (r.success) { setData(r.data); setTimeout(() => renderReport(activeReport, r.data), 200); } else Swal.fire({ icon:'error', text:r.message }); }
    catch(e) { setLoading(false); Swal.fire({ icon:'error', text:'Gagal memuat laporan' }); }
  };

  useEffect(() => { loadReport(); }, [activeReport]);
  useEffect(() => { return () => { if (chartRef.current) chartRef.current.destroy(); if (tableRef.current) { try { tableRef.current.destroy(); } catch(e){} } }; }, []);

  const renderReport = (type, d) => {
    if (!d) return;
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#b3261e';
    if (type === 'profit_loss' && d.dailyData?.length) {
      const ctx = document.getElementById('reportChart');
      if (ctx) { if (chartRef.current) chartRef.current.destroy(); chartRef.current = new Chart(ctx, { type:'bar', data:{ labels:d.dailyData.map(x => x.date), datasets:[ { label:'Penjualan', data:d.dailyData.map(x => x.sales), backgroundColor:'rgba(46,125,50,0.7)', borderRadius:3 }, { label:'Pembelian', data:d.dailyData.map(x => x.purchases), backgroundColor:'rgba(21,101,192,0.7)', borderRadius:3 }, { label:'Pengeluaran', data:d.dailyData.map(x => x.expenses), backgroundColor:'rgba(198,40,40,0.5)', borderRadius:3 } ]}, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'top'} }, scales:{ y:{beginAtZero:true}, x:{grid:{display:false}} } } }); }
    }
    if (type === 'sales_summary' && d.groupedData?.length) {
      const ctx = document.getElementById('reportChart');
      if (ctx) { if (chartRef.current) chartRef.current.destroy(); const gr = ctx.getContext('2d').createLinearGradient(0,0,0,280); gr.addColorStop(0,'rgba(179,38,30,0.5)'); gr.addColorStop(1,'rgba(179,38,30,0)'); chartRef.current = new Chart(ctx, { type:'line', data:{ labels:d.groupedData.map(x => x.label), datasets:[{ label:'Penjualan', data:d.groupedData.map(x => x.amount), borderColor:primaryColor, backgroundColor:gr, fill:true, tension:0.4, pointRadius:3 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} }, scales:{ y:{beginAtZero:true}, x:{grid:{display:false}} } } }); }
    }
    if (type === 'menu_terlaris' && d.menu?.length) {
      const tid = '#reportTable';
      if (tableRef.current) { try { tableRef.current.destroy(); $(tid).empty(); } catch(e){} }
      setTimeout(() => { try { tableRef.current = $(tid).DataTable({ data:d.menu, destroy:true, columns:[
        { data:'name', title:'Menu', render:(d) => '<strong>' + d + '</strong>' }, { data:'qty', title:'Terjual', className:'dt-center', render:(d) => '<span class="piece-badge total">' + d + 'x</span>' }, { data:'revenue', title:'Pendapatan', render:(d) => '<strong>' + fmtRp(d) + '</strong>' }
      ], pageLength:25, responsive:true, dom:'Blfrtip', buttons:[{ extend:'csv', text:'CSV' },{ extend:'print', text:'Cetak' }], order:[[1,'desc']] }); } catch(e){} }, 50);
      const ctx = document.getElementById('reportChart');
      if (ctx) { if (chartRef.current) chartRef.current.destroy(); chartRef.current = new Chart(ctx, { type:'bar', data:{ labels:d.menu.slice(0,10).map(m=>m.name), datasets:[{ data:d.menu.slice(0,10).map(m=>m.qty), backgroundColor:'rgba(224,122,31,0.75)', borderRadius:4 }] }, options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true, grid:{display:false}}, y:{grid:{display:false}}} } }); }
    }
    if (type === 'customer_profit' && d.customers?.length) {
      const tid = '#reportTable';
      if (tableRef.current) { try { tableRef.current.destroy(); $(tid).empty(); } catch(e){} }
      setTimeout(() => { try { tableRef.current = $(tid).DataTable({ data:d.customers, destroy:true, columns:[
        { data:'name', title:'Pelanggan', render:(d) => '<strong>' + d + '</strong>' }, { data:'phone', title:'Telepon', render:(d) => d || '—' }, { data:'saleCount', title:'Transaksi', className:'dt-center' },
        { data:'totalSales', title:'Total Belanja', render:(d) => '<strong>' + fmtRp(d) + '</strong>' }, { data:'avgTicket', title:'Rata-rata', render:(d) => fmtRp(d) }
      ], pageLength:25, responsive:true, dom:'Blfrtip', buttons:[{ extend:'csv', text:'CSV' },{ extend:'print', text:'Cetak' }], order:[[3,'desc']] }); } catch(e){} }, 50);
    }
  };

  const groupByOpts = [{ value:'daily', label:'Harian' },{ value:'weekly', label:'Mingguan' },{ value:'monthly', label:'Bulanan' }];

  return (
    <div>
      <div style={{display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'20px'}}>{reports.map(r => (<button key={r.id} className={'btn btn-sm ' + (activeReport===r.id ? 'btn-primary' : 'btn-secondary')} style={activeReport===r.id ? {background:r.color, borderColor:r.color} : {}} onClick={() => setActiveReport(r.id)}><i className={r.icon} style={{marginRight:'6px'}}></i>{r.label}</button>))}</div>
      <div className="filters-section" style={{marginBottom:'20px', padding:'14px 16px'}}>
        <div className="filters-header" style={{marginBottom:'12px', paddingBottom:'10px'}}><h3 style={{fontSize:'15px'}}><i className="fas fa-calendar-alt"></i> Rentang Tanggal</h3><button className="btn btn-primary btn-sm" onClick={loadReport}><i className="fas fa-sync-alt"></i> Buat Laporan</button></div>
        <div className="filters-grid" style={{gap:'12px'}}>
          <div className="filter-group"><label><i className="fas fa-calendar"></i> Dari</label><input type="date" className="filter-input" value={filters.dateFrom} onChange={(e) => setFilters({...filters, dateFrom:e.target.value})} /></div>
          <div className="filter-group"><label><i className="fas fa-calendar"></i> Sampai</label><input type="date" className="filter-input" value={filters.dateTo} onChange={(e) => setFilters({...filters, dateTo:e.target.value})} /></div>
          {activeReport === 'sales_summary' && <SearchableDropdown label="Kelompokkan" icon="fas fa-layer-group" options={groupByOpts} value={filters.groupBy} onChange={(v) => setFilters({...filters, groupBy:v||'daily'})} placeholder="Harian" />}
        </div>
      </div>
      {loading && (<div style={{padding:'60px 20px', display:'flex', flexDirection:'column', alignItems:'center', gap:'12px'}}><div className="loading-progress" style={{width:'200px'}}><div className="loading-progress-bar"></div></div><span style={{fontSize:'14px', color:'#888'}}>Membuat laporan...</span></div>)}
      {!loading && data && (
        <div>
          {activeReport === 'profit_loss' && (
            <div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:'12px', marginBottom:'20px'}}>
                <div className="stat-card" style={{borderLeftColor:'#2e7d32'}}><div className="stat-card-icon" style={{background:'#34a853', width:'45px', height:'45px', fontSize:'20px'}}><i className="fas fa-arrow-up"></i></div><div className="stat-card-value" style={{fontSize:'22px'}}>{fmtRp(data.totalSales||0)}</div><div className="stat-card-label">Penjualan ({data.salesCount||0})</div></div>
                <div className="stat-card" style={{borderLeftColor:'#1565c0'}}><div className="stat-card-icon" style={{background:'#1565c0', width:'45px', height:'45px', fontSize:'20px'}}><i className="fas fa-arrow-down"></i></div><div className="stat-card-value" style={{fontSize:'22px'}}>{fmtRp(data.totalPurchases||0)}</div><div className="stat-card-label">Pembelian ({data.purchasesCount||0})</div></div>
                <div className="stat-card" style={{borderLeftColor:'#c62828'}}><div className="stat-card-icon" style={{background:'#ea4335', width:'45px', height:'45px', fontSize:'20px'}}><i className="fas fa-receipt"></i></div><div className="stat-card-value" style={{fontSize:'22px'}}>{fmtRp(data.totalExpenses||0)}</div><div className="stat-card-label">Pengeluaran</div></div>
                <div className="stat-card" style={{borderLeftColor:'#e65100'}}><div className="stat-card-icon" style={{background:'#fbbc04', width:'45px', height:'45px', fontSize:'20px'}}><i className="fas fa-chart-line"></i></div><div className="stat-card-value" style={{fontSize:'22px'}}>{fmtRp(data.grossProfit||0)}</div><div className="stat-card-label">Laba Kotor</div></div>
                <div className="stat-card" style={{borderLeftColor: (data.netProfit||0) >= 0 ? '#2e7d32' : '#c62828'}}><div className="stat-card-icon" style={{background: (data.netProfit||0) >= 0 ? '#34a853' : '#ea4335', width:'45px', height:'45px', fontSize:'20px'}}><i className="fas fa-coins"></i></div><div className="stat-card-value" style={{fontSize:'22px', color:(data.netProfit||0) >= 0 ? '#2e7d32' : '#c62828'}}>{fmtRp(data.netProfit||0)}</div><div className="stat-card-label">Laba Bersih</div></div>
              </div>
              {data.dailyData?.length > 0 && <div className="data-section" style={{padding:'16px'}}><h3 style={{fontSize:'14px', fontWeight:'700', color:'var(--navy-primary)', marginBottom:'12px'}}><i className="fas fa-chart-bar"></i> Rincian Harian</h3><div style={{height:'280px'}}><canvas id="reportChart"></canvas></div></div>}
            </div>
          )}
          {activeReport === 'sales_summary' && (
            <div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'12px', marginBottom:'20px'}}>
                <div className="stat-card" style={{borderLeftColor:'#2e7d32'}}><div className="stat-card-icon" style={{background:'#34a853', width:'45px', height:'45px', fontSize:'20px'}}><i className="fas fa-coins"></i></div><div className="stat-card-value" style={{fontSize:'22px'}}>{fmtRp(data.totalAmount||0)}</div><div className="stat-card-label">Total Penjualan</div></div>
                <div className="stat-card" style={{borderLeftColor:'var(--navy-primary)'}}><div className="stat-card-icon" style={{background:'var(--navy)', width:'45px', height:'45px', fontSize:'20px'}}><i className="fas fa-shopping-bag"></i></div><div className="stat-card-value" style={{fontSize:'22px'}}>{data.totalCount||0}</div><div className="stat-card-label">Total Transaksi</div></div>
                <div className="stat-card" style={{borderLeftColor:'#6f42c1'}}><div className="stat-card-icon" style={{background:'#6f42c1', width:'45px', height:'45px', fontSize:'20px'}}><i className="fas fa-ticket-alt"></i></div><div className="stat-card-value" style={{fontSize:'22px'}}>{fmtRp(Math.round(data.avgTicket||0))}</div><div className="stat-card-label">Rata-rata per Struk</div></div>
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'20px'}}>
                <div className="data-section" style={{padding:'16px'}}><h3 style={{fontSize:'14px', fontWeight:'700', color:'var(--navy-primary)', marginBottom:'8px'}}><i className="fas fa-credit-card"></i> Metode Pembayaran</h3>{data.methodBreakdown && Object.entries(data.methodBreakdown).sort((a,b) => b[1]-a[1]).map(([m, amt]) => <div key={m} style={{display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #f5f5f5', fontSize:'13px'}}><span className="pay-method active" style={{fontSize:'11px', padding:'3px 10px', cursor:'default'}}>{m}</span><strong>{fmtRp(amt)}</strong></div>)}</div>
                <div className="data-section" style={{padding:'16px'}}><h3 style={{fontSize:'14px', fontWeight:'700', color:'var(--navy-primary)', marginBottom:'8px'}}><i className="fas fa-receipt"></i> Tipe Pesanan</h3>{data.orderTypeBreakdown && Object.entries(data.orderTypeBreakdown).map(([t, amt]) => <div key={t} style={{display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #f5f5f5', fontSize:'13px'}}><span>{ORDER_TYPE_LABELS[t] || t}</span><strong>{fmtRp(amt)}</strong></div>)}</div>
              </div>
              {data.groupedData?.length > 0 && <div className="data-section" style={{padding:'16px'}}><h3 style={{fontSize:'14px', fontWeight:'700', color:'var(--navy-primary)', marginBottom:'12px'}}><i className="fas fa-chart-line"></i> Tren</h3><div style={{height:'250px'}}><canvas id="reportChart"></canvas></div></div>}
            </div>
          )}
          {activeReport === 'menu_terlaris' && (
            <div>
              <div className="data-section" style={{padding:'16px', marginBottom:'16px'}}><h3 style={{fontSize:'14px', fontWeight:'700', color:'var(--navy-primary)', marginBottom:'12px'}}><i className="fas fa-chart-bar"></i> 10 Menu Terlaris</h3><div style={{height:'260px'}}><canvas id="reportChart"></canvas></div></div>
              <div className="data-section" style={{padding:'16px'}}><table id="reportTable" className="display" style={{width:'100%'}}></table></div>
            </div>
          )}
          {activeReport === 'customer_profit' && (
            <div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'12px', marginBottom:'20px'}}>
                <div className="stat-card" style={{borderLeftColor:'#6f42c1'}}><div className="stat-card-icon" style={{background:'#6f42c1', width:'45px', height:'45px', fontSize:'20px'}}><i className="fas fa-users"></i></div><div className="stat-card-value" style={{fontSize:'22px'}}>{data.customers?.length||0}</div><div className="stat-card-label">Pelanggan Aktif</div></div>
                <div className="stat-card" style={{borderLeftColor:'#2e7d32'}}><div className="stat-card-icon" style={{background:'#34a853', width:'45px', height:'45px', fontSize:'20px'}}><i className="fas fa-coins"></i></div><div className="stat-card-value" style={{fontSize:'22px'}}>{fmtRp((data.customers||[]).reduce((s,c) => s + c.totalSales, 0))}</div><div className="stat-card-label">Total Pendapatan</div></div>
                <div className="stat-card" style={{borderLeftColor:'var(--navy-primary)'}}><div className="stat-card-icon" style={{background:'var(--navy)', width:'45px', height:'45px', fontSize:'20px'}}><i className="fas fa-shopping-bag"></i></div><div className="stat-card-value" style={{fontSize:'22px'}}>{(data.customers||[]).reduce((s,c) => s + c.saleCount, 0)}</div><div className="stat-card-label">Total Transaksi</div></div>
              </div>
              <div className="data-section" style={{padding:'16px'}}><table id="reportTable" className="display" style={{width:'100%'}}></table></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Tentang Aplikasi ── */
function AboutView() {
  return (
    <div className="about-section">
      <div className="about-header">
        <div className="about-logo-ico"><i className="fas fa-utensils"></i></div>
        <div className="about-title"><h1><i className="fas fa-utensils"></i> {BN()}</h1><p className="about-dev">Dikembangkan oleh <strong>Ahmad Galih Saputro</strong> (Tanpa Sorotan)</p></div>
      </div>
      <div className="about-card">
        <h2><i className="fas fa-question-circle"></i> Apa itu Aplikasi Ini?</h2>
        <p>Ini adalah sistem Point of Sale (POS) yang dibuat khusus untuk restoran dan rumah makan. Digunakan untuk mengelola menu, mencatat transaksi, memantau stok, dan menjaga semuanya tetap rapi dalam satu tempat. Anggap saja ini seperti mesin kasir digital yang bisa Anda akses dari mana saja untuk menjalankan seluruh operasional restoran Anda.</p>
      </div>
      <div className="about-card">
        <h2><i className="fas fa-clipboard-list"></i> Fitur Utama</h2>
        <ul className="about-features">
          <li><i className="fas fa-cash-register"></i> Kasir / POS Restoran</li>
          <li><i className="fas fa-utensils"></i> Manajemen Menu</li>
          <li><i className="fas fa-receipt"></i> Tipe Pesanan (Dine-in/Bawa Pulang/Antar)</li>
          <li><i className="fas fa-user-friends"></i> Manajemen Pelanggan</li>
          <li><i className="fas fa-handshake"></i> Supplier & Pembelian Bahan Baku</li>
          <li><i className="fas fa-money-bill-wave"></i> Pencatatan Pembayaran</li>
          <li><i className="fas fa-chart-bar"></i> Laporan Laba Rugi & Analitik</li>
          <li><i className="fas fa-palette"></i> Tema Warna Kustom</li>
          <li><i className="fas fa-users-cog"></i> Manajemen Pengguna & Peran</li>
          <li><i className="fas fa-history"></i> Log Aktivitas</li>
          <li><i className="fas fa-file-export"></i> Ekspor CSV/PDF</li>
          <li><i className="fas fa-mobile-alt"></i> Tampilan Responsif</li>
        </ul>
      </div>
      <div className="about-card">
        <h2><i className="fas fa-users-cog"></i> Peran & Hak Akses Pengguna</h2>
        <p className="mb-24">Sistem ini memiliki beberapa peran pengguna. Setiap peran memiliki tingkat akses yang berbeda.</p>
        <div className="about-table-wrapper">
          <table className="about-roles-table">
            <thead><tr><th>Fitur / Aksi</th><th><span className="role-badge role-admin">Admin</span></th><th><span className="role-badge role-manager">Manajer</span></th><th><span className="role-badge role-kasir">Kasir</span></th></tr></thead>
            <tbody>
              <tr><td>Lihat Dashboard</td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-check-circle text-success"></i></td></tr>
              <tr><td>Kelola Pengguna</td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-times-circle text-danger"></i></td><td><i className="fas fa-times-circle text-danger"></i></td></tr>
              <tr><td>Kelola Menu & Kategori</td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-times-circle text-danger"></i></td></tr>
              <tr><td>Hapus Menu</td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-times-circle text-danger"></i></td><td><i className="fas fa-times-circle text-danger"></i></td></tr>
              <tr><td>Kasir / Buat Transaksi</td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-check-circle text-success"></i></td></tr>
              <tr><td>Ubah/Batalkan Transaksi</td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-times-circle text-danger"></i></td></tr>
              <tr><td>Hapus Transaksi</td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-times-circle text-danger"></i></td><td><i className="fas fa-times-circle text-danger"></i></td></tr>
              <tr><td>Kelola Supplier & Pembelian</td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-times-circle text-danger"></i></td></tr>
              <tr><td>Kelola Pengeluaran</td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-times-circle text-danger"></i></td></tr>
              <tr><td>Lihat Laporan</td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-times-circle text-danger"></i></td></tr>
              <tr><td>Pengaturan & Tema Warna</td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-times-circle text-danger"></i></td><td><i className="fas fa-times-circle text-danger"></i></td></tr>
              <tr><td>Log Aktivitas</td><td><i className="fas fa-check-circle text-success"></i></td><td><i className="fas fa-times-circle text-danger"></i></td><td><i className="fas fa-times-circle text-danger"></i></td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="about-card about-developer">
        <h2><i className="fas fa-code"></i> Tentang Developer Template Ini</h2>
        <div className="developer-info">
          <div className="developer-avatar-ico"><i className="fas fa-code"></i></div>
          <div className="developer-details">
            <h3>Ahmad Galih Saputro</h3>
            <p className="developer-brand">Tanpa Sorotan</p>
            <p>Template dasar aplikasi POS ini dibangun dengan (Google Apps Script + Google Sheets + React).</p>
            <div className="developer-links">
              <a href="https://www.youtube.com/@tanpasorotan" target="_blank" className="dev-link youtube"><i className="fab fa-youtube"></i> Subscribe YouTube</a>
            </div>
          </div>
        </div>
      </div>
      <div className="about-footer"><p>Kredit untuk Rameez Scripts</p><p className="about-version">Versi 1.0.0 — Edisi Restoran</p></div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);