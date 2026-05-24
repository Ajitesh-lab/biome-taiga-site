// ── Backend config ─────────────────────────────────────────────────────────
const DEFAULT_BACKEND_URL = 'https://api.biomeai.uk';
const BACKEND_OVERRIDE_KEY = 'biome_backend_url';
const APPROVED_BACKEND_HOSTS = new Set(['api.biomeai.uk']);

function isDevelopmentHost() {
  const h = location.hostname.toLowerCase();
  return location.protocol === 'file:' || h === 'localhost' || h === '0.0.0.0' || /^127(?:\.\d+){3}$/.test(h);
}
function normalizeUrl(raw) { return String(raw || '').trim().replace(/\/+$/, '') || null; }
function isLocalUrl(raw) {
  const v = normalizeUrl(raw); if (!v) return false;
  try { const u = new URL(v); const h = u.hostname.toLowerCase(); return (u.protocol === 'http:' || u.protocol === 'https:') && (h === 'localhost' || /^127(?:\.\d+){3}$/.test(h)); } catch { return false; }
}
function isApprovedUrl(raw) {
  const v = normalizeUrl(raw); if (!v) return false;
  try { const u = new URL(v); if (APPROVED_BACKEND_HOSTS.has(u.hostname.toLowerCase())) return true; return isDevelopmentHost() && isLocalUrl(v); } catch { return false; }
}
function resolveBackendUrl() {
  const stored = normalizeUrl(localStorage.getItem(BACKEND_OVERRIDE_KEY));
  if (stored && isApprovedUrl(stored)) return stored;
  if (stored) localStorage.removeItem(BACKEND_OVERRIDE_KEY);
  return DEFAULT_BACKEND_URL;
}
let BACKEND_URL = resolveBackendUrl();

async function fetchBackend(path, options = {}) {
  const opts = {
    credentials: 'include', ...options,
    headers: { ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
  };
  try { return await fetch(`${BACKEND_URL}${path}`, opts); }
  catch (err) {
    const stored = normalizeUrl(localStorage.getItem(BACKEND_OVERRIDE_KEY));
    if (stored && BACKEND_URL !== DEFAULT_BACKEND_URL) {
      localStorage.removeItem(BACKEND_OVERRIDE_KEY);
      BACKEND_URL = DEFAULT_BACKEND_URL;
      return fetch(`${BACKEND_URL}${path}`, opts);
    }
    throw err;
  }
}
function backendNetworkMsg() { return 'Could not reach Biome. Refresh and try again, or email team@biomeai.uk.'; }

// ── Session ────────────────────────────────────────────────────────────────
const AUTH_USER_KEY = 'biome_auth_user';
function getUser() { try { return JSON.parse(localStorage.getItem(AUTH_USER_KEY)) || null; } catch { return null; } }
function saveSession(user) { if (user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user)); }
function clearSession() { localStorage.removeItem(AUTH_USER_KEY); localStorage.removeItem('biome_auth_token'); }

function updateNavAuth(user) {
  const btn = document.getElementById('nav-auth-btn');
  if (!btn) return;
  if (user) {
    btn.textContent = user.name || user.username || user.email.split('@')[0];
    btn.onclick = handleSignOut;
    btn.title = 'Click to sign out';
  } else {
    btn.textContent = 'Sign in';
    btn.onclick = () => openModal('signin');
    btn.title = '';
  }
}
async function handleSignOut() {
  try { await fetchBackend('/auth/logout', { method: 'POST' }); } catch {}
  clearSession(); postAuthAction = null; updateNavAuth(null);
  showToast('Signed out successfully.');
}

// Session check on load
(async () => {
  const cached = getUser();
  if (cached) updateNavAuth(cached);
  try {
    const res = await fetchBackend('/auth/me');
    const data = await res.json();
    if (data.ok) { saveSession(data.user); updateNavAuth(data.user); }
    else { clearSession(); updateNavAuth(null); }
  } catch { if (cached) updateNavAuth(cached); }
})();

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  clearTimeout(toastTimer);
  t.classList.add('show');
  toastTimer = setTimeout(() => t.classList.remove('show'), 4000);
}

// ── Modal ──────────────────────────────────────────────────────────────────
const modalConfigs = {
  personal:       { label: 'Personal Plan — Free Forever', title: 'Start for Free', desc: 'Create your account and deploy your first AI agent in under 60 seconds. No credit card required.' },
  pro:            { label: 'Professional Plan — $29/mo', title: 'Upgrade to Pro', desc: 'Managed model proxy, extended memory, and priority support. Cancel anytime.' },
  signin:         { label: 'Welcome Back', title: 'Sign In to Biome', desc: 'Sign in to your account.' },
  download_macos: { label: 'Download for macOS — v1.5.0', title: 'Create an Account First', desc: 'Your download starts immediately after signup. Takes 30 seconds, no credit card needed.' },
};
let pendingDownload = null;
let postAuthAction = null;
let _modalActiveTab = 'create';
let _pendingRegEmail = '';

function openModal(plan, preservePostAuth = false) {
  if (plan === 'pro') {
    postAuthAction = 'pro_checkout';
    if (getUser()) { startProCheckout(); return; }
  } else if (!preservePostAuth) {
    postAuthAction = null;
  }
  const isProFlow = plan === 'pro' || postAuthAction === 'pro_checkout';
  const cfg = modalConfigs[plan] || modalConfigs.personal;
  document.getElementById('modal-plan-label').textContent = cfg.label;
  document.getElementById('modal-title-el').textContent = cfg.title;
  document.getElementById('modal-desc').textContent = cfg.desc;
  document.getElementById('modal-email-app-notice').classList.toggle('hidden', !isProFlow);
  document.getElementById('modal-cta').disabled = false;
  document.getElementById('modal-cta').textContent = postAuthAction === 'pro_checkout' ? 'Continue to Checkout' : 'Send Verification Code';
  document.getElementById('modal-otp-cta').disabled = false;
  document.getElementById('modal-otp-cta').textContent = postAuthAction === 'pro_checkout' ? 'Verify & Continue to Checkout' : 'Verify & Create Account';
  document.getElementById('modal-signin-cta').disabled = false;
  document.getElementById('modal-form')?.reset();
  document.getElementById('modal-signin-form')?.reset();
  document.getElementById('modal-error').classList.add('hidden');
  document.getElementById('modal-signin-error').classList.add('hidden');
  document.getElementById('modal-step-1').classList.remove('hidden');
  document.getElementById('modal-step-2').classList.add('hidden');
  switchModalTab(plan === 'signin' ? 'signin' : 'create');
  const overlay = document.getElementById('modal-overlay');
  overlay.hidden = false;
  overlay.removeAttribute('inert');
  overlay.setAttribute('aria-hidden', 'false');
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('show');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('inert', '');
  overlay.hidden = true;
  document.body.style.overflow = '';
}
function switchModalTab(tab) {
  _modalActiveTab = tab;
  const isCreate = tab === 'create';
  document.getElementById('modal-tab-create').classList.toggle('active', isCreate);
  document.getElementById('modal-tab-signin').classList.toggle('active', !isCreate);
  document.getElementById('modal-panel-create').classList.toggle('hidden', !isCreate);
  document.getElementById('modal-panel-signin').classList.toggle('hidden', isCreate);
  document.getElementById('modal-error')?.classList.add('hidden');
  document.getElementById('modal-signin-error')?.classList.add('hidden');
  setTimeout(() => {
    if (isCreate) document.getElementById('modal-username-input')?.focus();
    else document.getElementById('modal-si-identifier')?.focus();
  }, 50);
}
function backToStep1() {
  document.getElementById('modal-step-1').classList.remove('hidden');
  document.getElementById('modal-step-2').classList.add('hidden');
  document.getElementById('modal-otp-error').classList.add('hidden');
  document.getElementById('modal-otp-input').value = '';
}
document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === document.getElementById('modal-overlay')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Auth: Register (send OTP) ──────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  const username = document.getElementById('modal-username-input').value.trim();
  const email    = document.getElementById('modal-email-input').value.trim();
  const password = document.getElementById('modal-password-input').value;
  const cta = document.getElementById('modal-cta');
  const err = document.getElementById('modal-error');
  cta.disabled = true; cta.textContent = 'Sending code…'; err.classList.add('hidden');
  try {
    const res  = await fetchBackend('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) throw new Error(data.error || 'Failed to send code');
    _pendingRegEmail = email;
    document.getElementById('modal-otp-email-display').textContent = email;
    document.getElementById('modal-step-1').classList.add('hidden');
    document.getElementById('modal-step-2').classList.remove('hidden');
    setTimeout(() => document.getElementById('modal-otp-input')?.focus(), 100);
  } catch (ex) {
    err.textContent = ex instanceof TypeError ? backendNetworkMsg() : ex.message;
    err.classList.remove('hidden');
    cta.disabled = false;
    cta.textContent = postAuthAction === 'pro_checkout' ? 'Continue to Checkout' : 'Send Verification Code';
  }
}

// ── Auth: Verify OTP → complete registration ───────────────────────────────
async function handleVerifyOTP(e) {
  e.preventDefault();
  const otp = document.getElementById('modal-otp-input').value.trim();
  const cta = document.getElementById('modal-otp-cta');
  const err = document.getElementById('modal-otp-error');
  cta.disabled = true; cta.textContent = 'Creating account…'; err.classList.add('hidden');
  try {
    const res  = await fetchBackend('/auth/complete-registration', { method: 'POST', body: JSON.stringify({ email: _pendingRegEmail, otp }) });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) throw new Error(data.error || 'Verification failed');
    saveSession(data.user); updateNavAuth(data.user);
    if (postAuthAction === 'pro_checkout') {
      cta.textContent = 'Redirecting to checkout…'; closeModal(); startProCheckout();
    } else {
      const dl = pendingDownload; pendingDownload = null; closeModal();
      if (dl) { setTimeout(() => triggerDownload(dl), 400); }
      else { showToast(`Welcome to Biome, ${data.user.name || data.user.username || data.user.email.split('@')[0]}! ✓`); }
    }
  } catch (ex) {
    err.textContent = ex instanceof TypeError ? backendNetworkMsg() : ex.message;
    err.classList.remove('hidden');
    cta.disabled = false;
    cta.textContent = postAuthAction === 'pro_checkout' ? 'Verify & Continue to Checkout' : 'Verify & Create Account';
  }
}

// ── Auth: Sign In ──────────────────────────────────────────────────────────
async function handleSignIn(e) {
  e.preventDefault();
  const identifier = document.getElementById('modal-si-identifier').value.trim();
  const password   = document.getElementById('modal-si-password').value;
  const cta = document.getElementById('modal-signin-cta');
  const err = document.getElementById('modal-signin-error');
  cta.disabled = true; cta.textContent = 'Signing in…'; err.classList.add('hidden');
  try {
    const res  = await fetchBackend('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password }) });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) throw new Error(data.error || 'Sign in failed');
    saveSession(data.user); updateNavAuth(data.user);
    if (postAuthAction === 'pro_checkout') { closeModal(); startProCheckout(); }
    else {
      const dl = pendingDownload; pendingDownload = null; closeModal();
      if (dl) { setTimeout(() => triggerDownload(dl), 400); }
      else { showToast(`Welcome back, ${data.user.name || data.user.username || data.user.email.split('@')[0]}! ✓`); }
    }
  } catch (ex) {
    err.textContent = ex instanceof TypeError ? backendNetworkMsg() : ex.message;
    err.classList.remove('hidden');
    cta.disabled = false; cta.textContent = 'Sign In';
  }
}

// ── Auth: Resend OTP ───────────────────────────────────────────────────────
async function resendOTP() {
  const username = document.getElementById('modal-username-input')?.value.trim() || '';
  const email    = _pendingRegEmail || document.getElementById('modal-email-input')?.value.trim();
  const password = document.getElementById('modal-password-input')?.value || '';
  try {
    const res  = await fetchBackend('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) });
    const data = await res.json().catch(() => ({}));
    showToast(data.ok ? 'New code sent — check your inbox.' : 'Could not resend. Try again in a moment.');
  } catch { showToast('Could not resend. Check your connection.'); }
}

// ── Pro checkout ───────────────────────────────────────────────────────────
async function startProCheckout() {
  showToast('Redirecting to checkout…');
  try {
    const res  = await fetchBackend('/billing/create-checkout-session', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok && data.url) { postAuthAction = null; window.location.href = data.url; }
    else if (res.status === 401) { clearSession(); updateNavAuth(null); postAuthAction = 'pro_checkout'; showToast('Please sign in again to continue to checkout.'); openModal('signin', true); }
    else { showToast(data.error || 'Could not start checkout — please try again.'); }
  } catch { showToast('Could not reach payment server — check your connection.'); }
}

// ── Download ───────────────────────────────────────────────────────────────
const DOWNLOAD_URLS = { macOS: 'https://github.com/Ajitesh-lab/biome-taiga-site/releases/download/v1.5.0/Biome-1.5.0.dmg' };

async function triggerDownload(platform) {
  const url = DOWNLOAD_URLS[platform];
  if (!url) { showToast(`${platform} is not available in this release.`); return; }
  try { await fetchBackend('/track', { method: 'POST', body: JSON.stringify({ event: 'download', platform, file: url.split('/').pop() }) }); } catch {}
  const a = document.createElement('a');
  a.href = url; a.download = url.split('/').pop();
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  showToast(`Biome v1.5.0 for ${platform} — download starting.`);
}
async function handleDownload(platform) {
  if (getUser()) { await triggerDownload(platform); }
  else { pendingDownload = platform; openModal(platform === 'macOS' ? 'download_macos' : 'personal'); }
}

// ── Mobile menu ────────────────────────────────────────────────────────────
function setMenuHeight(menu, open) {
  if (open) {
    menu.style.height = '0px';
    requestAnimationFrame(() => { menu.style.height = menu.scrollHeight + 'px'; });
    menu.addEventListener('transitionend', () => { menu.style.height = 'auto'; }, { once: true });
  } else {
    menu.style.height = menu.scrollHeight + 'px';
    requestAnimationFrame(() => { menu.style.height = '0px'; });
  }
}
function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const icon = document.getElementById('hamburger-icon');
  const hamburger = document.getElementById('hamburger');
  const isOpen = menu.classList.contains('open');
  menu.classList.toggle('open', !isOpen);
  menu.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
  hamburger.setAttribute('aria-expanded', String(!isOpen));
  icon.innerHTML = isOpen
    ? '<path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
    : '<path d="M4 4l12 12M16 4L4 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
  setMenuHeight(menu, !isOpen);
}
function closeMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  if (!menu.classList.contains('open')) return;
  const icon = document.getElementById('hamburger-icon');
  const hamburger = document.getElementById('hamburger');
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
  hamburger.setAttribute('aria-expanded', 'false');
  icon.innerHTML = '<path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
  setMenuHeight(menu, false);
}

// ── FAQ accordion ──────────────────────────────────────────────────────────
function togglePost(btn) {
  const body = btn.nextElementSibling;
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  btn.classList.toggle('open', !isOpen);
  btn.setAttribute('aria-expanded', String(!isOpen));
}

function toggleFaq(btn) {
  const item = btn.parentElement;
  const body = item.querySelector('.faq-body');
  const chevron = btn.querySelector('.faq-chevron');
  const isOpen = body.classList.contains('open');
  document.querySelectorAll('.faq-body.open').forEach(b => {
    b.style.height = b.scrollHeight + 'px';
    requestAnimationFrame(() => { b.style.height = '0px'; });
    b.classList.remove('open');
    b.closest('.faq-item')?.querySelector('.faq-chevron')?.classList.remove('open');
  });
  if (!isOpen) {
    body.classList.add('open'); chevron?.classList.add('open');
    body.style.height = '0px';
    requestAnimationFrame(() => { body.style.height = body.scrollHeight + 'px'; });
    body.addEventListener('transitionend', () => { body.style.height = 'auto'; }, { once: true });
  }
}

// ── Reveal on scroll ───────────────────────────────────────────────────────
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); kickAnimations(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

function kickAnimations(target) {
  // Count-up
  target.querySelectorAll('[data-count]').forEach(el => {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const end = +el.dataset.count, unit = el.dataset.unit ?? '', dur = 1400, t0 = performance.now();
    (function tick(now) {
      const t = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.innerHTML = Math.floor(end * eased).toLocaleString() + (unit ? `<span class="unit">${unit}</span>` : '');
      if (t < 1) requestAnimationFrame(tick);
    })(t0);
  });
  if (target.querySelector('#bench')) setTimeout(renderBench, 60);
}

// ── Nav active section ─────────────────────────────────────────────────────
const navLinks = document.querySelectorAll('.nav-link[data-section]');
const sectionObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.id;
      navLinks.forEach(a => a.classList.toggle('nav-active', a.dataset.section === id));
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });
['features', 'pricing', 'download', 'support'].forEach(id => {
  const el = document.getElementById(id);
  if (el) sectionObs.observe(el);
});
function revealHashTarget() {
  if (!location.hash) return;
  const target = document.querySelector(location.hash);
  if (!target) return;
  target.classList.add('in');
  kickAnimations(target);
  requestAnimationFrame(() => {
    target.scrollIntoView({ block: 'start' });
    requestAnimationFrame(() => {
      const navOffset = document.querySelector('.nav-wrap')?.offsetHeight || 0;
      const targetTop = target.getBoundingClientRect().top;
      if (Math.abs(targetTop - navOffset) > 2) window.scrollBy({ top: targetTop - navOffset });
    });
  });
}
window.addEventListener('load', revealHashTarget);
window.addEventListener('hashchange', revealHashTarget);

// ── Hero terminal animation ────────────────────────────────────────────────
const termLines = [
  { type: 'p',   text: 'biome › ', delay: 600 },
  { type: 'c',   text: 'Research top AI coding tools and summarise', speed: 22 },
  { type: 'br' },
  { type: 'o',   text: '  Searching the web…', speed: 12 },
  { type: 'br' },
  { type: 'o',   text: '  Reading ', extra: '<span class="acc">6 sources</span><span> in Chrome…</span>', speed: 12 },
  { type: 'br' },
  { type: 'o',   text: '  Reasoning across sources…', speed: 12 },
  { type: 'br' },
  { type: 'o',   text: '  Saved report → ', extra: '<span class="ok">~/Desktop/ai-tools.md ✓</span>', speed: 12 },
  { type: 'br' },
  { type: 'br' },
  { type: 'p',   text: 'biome › ' },
  { type: 'cur' }
];
const termEl = document.getElementById('term');
let li = 0;
function nextLine() {
  if (!termEl) return;
  if (li >= termLines.length) return;
  const l = termLines[li];
  if (l.type === 'br')  { termEl.innerHTML += '<br>'; li++; return setTimeout(nextLine, 60); }
  if (l.type === 'cur') { termEl.innerHTML += '<span style="display:inline-block;width:8px;height:1.1em;background:#accfaf;vertical-align:text-bottom;animation:cur-blink 1s steps(2) infinite"></span>'; return; }
  if (l.type === 'p')   { termEl.innerHTML += `<span class="prompt">${l.text}</span>`; li++; return setTimeout(nextLine, l.delay || 100); }
  termEl.innerHTML += `<span id="tl-${li}"></span>`;
  const span = document.getElementById(`tl-${li}`);
  let i = 0;
  (function type() {
    span.textContent = l.text.slice(0, i);
    if (i++ < l.text.length) return setTimeout(type, l.speed || 8);
    if (l.extra) span.innerHTML += l.extra;
    li++; setTimeout(nextLine, 200);
  })();
}
const styleEl = document.createElement('style');
styleEl.textContent = '@keyframes cur-blink { 50% { opacity: 0; } }';
document.head.appendChild(styleEl);
if (termEl) setTimeout(nextLine, 500);

// ── Benchmark bars ─────────────────────────────────────────────────────────
const benchData = {
  research: [
    { name: 'Manual',      t: '~45 min', w: 100 },
    { name: 'ChatGPT',     t: '~12 min', w: 27 },
    { name: 'Biome agent', t: '~2 min',  w: 5, win: true }
  ],
  code: [
    { name: 'Manual',      t: '~60 min', w: 100 },
    { name: 'Copilot',     t: '~20 min', w: 33 },
    { name: 'Biome agent', t: '~4 min',  w: 7, win: true }
  ]
};
let currentMode = 'research';
function renderBench() {
  const wrap = document.getElementById('bench');
  if (!wrap) return;
  wrap.innerHTML = benchData[currentMode].map(r => `
    <div class="bench-row${r.win ? ' win' : ''}">
      <div class="name">${r.name}</div>
      <div class="bench-bar"><span data-w="${r.w}"></span></div>
      <div class="t">${r.t}</div>
    </div>`).join('');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    wrap.querySelectorAll('[data-w]').forEach(s => { s.style.width = s.dataset.w + '%'; });
  }));
}
document.getElementById('benchToggle')?.addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  document.querySelectorAll('#benchToggle button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentMode = btn.dataset.mode;
  renderBench();
});
