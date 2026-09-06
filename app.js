const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const state = { sb: null, mode: 'post', results: null, imageUrl: null, signup: false, session: null, toastTimer: null };

const toast = (message) => {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => element.classList.remove('show'), 3000);
};

const setMessage = (id, message = '') => {
  const element = $(`#${id}`);
  element.textContent = message;
  element.hidden = !message;
};

const setBusy = (button, busy) => {
  button.disabled = busy;
  $('.button-label', button).hidden = busy;
  $('.button-loading', button).hidden = !busy;
};

function setAuthMode(signup) {
  state.signup = signup;
  $('#login-tab').classList.toggle('active', !signup);
  $('#signup-tab').classList.toggle('active', signup);
  $('#login-tab').setAttribute('aria-selected', String(!signup));
  $('#signup-tab').setAttribute('aria-selected', String(signup));
  $('#auth-title').textContent = signup ? 'Make space for your ideas.' : 'Your ideas, in one place.';
  $('#auth-subtitle').textContent = signup ? 'Create an account to save every good caption.' : 'Log in to save your captions and revisit your creative history.';
  $('.button-label', $('#auth-submit')).textContent = signup ? 'Create account' : 'Log in';
  $('#password').setAttribute('autocomplete', signup ? 'new-password' : 'current-password');
  setMessage('auth-message');
}

function openAuth() {
  const modal = $('#auth-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('#email').focus(), 80);
}

function closeAuth() {
  const modal = $('#auth-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

async function configureSupabase() {
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    const config = await response.json().catch(() => ({}));
    if (!response.ok || !config.url || !config.anonKey) throw new Error(config.error || 'Account services are not configured yet.');
    if (!window.supabase) throw new Error('Authentication library did not load. Please refresh and try again.');
    state.sb = window.supabase.createClient(config.url, config.anonKey);
    const { data } = await state.sb.auth.getSession();
    updateSession(data.session);
    state.sb.auth.onAuthStateChange((_event, session) => updateSession(session));
  } catch (error) {
    window.supabaseInitError = error.message;
    updateSession(null);
    console.warn('Supabase initialization:', error.message);
  }
}

function updateSession(session) {
  state.session = session;
  const signedIn = Boolean(session);
  $$('.nav-login').forEach((button) => {
    button.textContent = signedIn ? 'Dashboard' : 'Log in';
    button.dataset.action = signedIn ? 'open-dashboard' : 'open-auth';
  });
  if (signedIn) populateProfile(session.user);
}

function populateProfile(user) {
  const email = user.email || 'Signed-in account';
  const initial = email.charAt(0).toUpperCase();
  $('#account-email').textContent = email;
  $('#account-avatar').textContent = initial;
  $('#profile-button').textContent = initial;
  $('#profile-name').textContent = (user.user_metadata?.full_name || email.split('@')[0] || 'creator').slice(0, 28);
  $('#welcome').textContent = `Signed in as ${email}`;
}

async function submitAuth(event) {
  event.preventDefault();
  if (!state.sb) return setMessage('auth-message', window.supabaseInitError || 'Account services are not ready. Please try again later.');
  const email = $('#email').value.trim();
  const password = $('#password').value;
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return setMessage('auth-message', 'Enter a valid email address.');
  if (password.length < 6) return setMessage('auth-message', 'Your password must be at least 6 characters.');
  const button = $('#auth-submit');
  setBusy(button, true);
  setMessage('auth-message');
  try {
    const result = state.signup
      ? await state.sb.auth.signUp({ email, password })
      : await state.sb.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (state.signup && !result.data.session) {
      closeAuth();
      toast('Account created. Check your email to confirm your address.');
    } else {
      closeAuth();
      toast(state.signup ? 'Welcome to CaptionPro.' : 'You’re logged in.');
      openDashboard();
    }
  } catch (error) {
    setMessage('auth-message', error.message || 'We could not complete that request.');
  } finally { setBusy(button, false); }
}

async function resetPassword() {
  if (!state.sb) return setMessage('auth-message', window.supabaseInitError || 'Account services are not ready.');
  const email = $('#email').value.trim();
  if (!email) return setMessage('auth-message', 'Enter your email first, then select password reset.');
  const { error } = await state.sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` });
  if (error) return setMessage('auth-message', error.message);
  toast('If that account exists, a password reset email is on its way.');
}

function setMode(button) {
  state.mode = button.dataset.type;
  $$('.type-tab').forEach((tab) => {
    const active = tab === button;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  $('#hooks').closest('label').hidden = state.mode !== 'reel';
}

function clearImage() {
  const preview = $('#preview');
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.imageUrl = null;
  preview.removeAttribute('src');
  $('#photo').value = '';
  $('#upload-preview').hidden = true;
  $('#upload-label').hidden = false;
}

function selectImage(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { clearImage(); return setMessage('generator-message', 'Please choose a JPG, PNG, or WebP image.'); }
  if (file.size > 1500000) { clearImage(); return setMessage('generator-message', 'Please choose an image smaller than 1.5 MB.'); }
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  state.imageUrl = URL.createObjectURL(file);
  $('#preview').src = state.imageUrl;
  $('#upload-preview').hidden = false;
  $('#upload-label').hidden = true;
  setMessage('generator-message');
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('We could not read that image. Please try another one.'));
    reader.readAsDataURL(file);
  });
}

async function generate() {
  const topic = $('#topic').value.trim();
  const file = $('#photo').files?.[0];
  if (!topic && !file) return setMessage('generator-message', 'Add a topic, upload an image, or do both to get started.');
  const button = $('#generate');
  setBusy(button, true);
  setMessage('generator-message');
  try {
    const payload = {
      mode: state.mode, topic, image: await fileToDataURL(file), style: $('#style').value,
      language: $('#language').value, length: $('#length').value, count: Number($('#count').value),
      emojis: $('#emojis').checked, hashtags: $('#hashtags').checked, hooks: $('#hooks').checked
    };
    const response = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Generation failed. Please try again.');
    state.results = data.results;
    renderResults(data.results);
    await saveCloud(data.results, topic);
    toast(state.session ? 'Ideas generated and saved to your history.' : 'Your ideas are ready. Log in to save them.');
  } catch (error) {
    setMessage('generator-message', error.message || 'We could not generate captions right now.');
  } finally { setBusy(button, false); }
}

function createButton(label, action, index) {
  const button = document.createElement('button');
  button.className = 'small-action'; button.type = 'button'; button.textContent = label;
  button.dataset.resultAction = action; button.dataset.index = String(index);
  return button;
}

function renderResults(results) {
  const root = $('#caption-list'); root.replaceChildren();
  const captions = results.captions || [];
  captions.forEach((caption, index) => {
    const card = document.createElement('article'); card.className = 'caption-card';
    const top = document.createElement('div'); top.className = 'caption-top';
    const number = document.createElement('span'); number.className = 'caption-number'; number.textContent = `OPTION ${String(index + 1).padStart(2, '0')}`;
    const actions = document.createElement('div'); actions.className = 'caption-actions';
    actions.append(createButton('Copy', 'copy-caption', index), createButton('Share', 'share-caption', index));
    top.append(number, actions);
    const text = document.createElement('p'); text.className = 'caption-text'; text.textContent = caption;
    card.append(top, text); root.append(card);
  });
  const chars = captions.join(' ').length;
  $('#result-summary').replaceChildren(...[
    `${captions.length} caption ideas`, `${chars} characters`, `${(results.hashtags || []).length} hashtags`
  ].map((label) => { const item = document.createElement('span'); item.textContent = label; return item; }));
  const secondary = $('#secondary-results'); secondary.replaceChildren();
  addSecondaryResult(secondary, 'Reel hooks', results.hooks || []);
  addSecondaryResult(secondary, 'Hashtags', results.hashtags || []);
  $('#results').hidden = false;
  $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function addSecondaryResult(root, title, values) {
  if (!values.length) return;
  const card = document.createElement('article'); card.className = 'secondary-card';
  const heading = document.createElement('h3'); heading.textContent = title;
  const text = document.createElement('p'); text.textContent = values.join(title === 'Hashtags' ? ' ' : '\n');
  const action = document.createElement('button'); action.className = 'small-action'; action.type = 'button'; action.textContent = `Copy ${title.toLowerCase()}`;
  action.addEventListener('click', () => copyText(text.textContent));
  card.append(heading, text, action); root.append(card);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied to your clipboard.'); }
  catch { toast('Copy is not available in this browser.'); }
}

async function shareText(text) {
  try {
    if (navigator.share) await navigator.share({ title: 'CaptionPro idea', text });
    else await copyText(text);
  } catch (error) { if (error.name !== 'AbortError') toast('Sharing is not available right now.'); }
}

function allResultsText() {
  if (!state.results) return '';
  return ['CAPTIONS', ...(state.results.captions || []), '', 'REEL HOOKS', ...(state.results.hooks || []), '', 'HASHTAGS', ...(state.results.hashtags || [])].join('\n\n');
}

function downloadResults() {
  const text = allResultsText();
  if (!text) return;
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  anchor.download = 'captionpro-ideas.txt'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 0);
  toast('Your ideas have been downloaded.');
}

async function saveCloud(results, topic) {
  if (!state.sb || !state.session) return;
  const { error } = await state.sb.from('captions').insert({ user_id: state.session.user.id, topic, content_type: state.mode, style: $('#style').value, language: $('#language').value, captions: results.captions || [], hooks: results.hooks || [], hashtags: results.hashtags || [] });
  if (error) console.warn('Cloud save error:', error.message);
}

function openDashboard() {
  if (!state.sb || !state.session) return openAuth();
  $('#dashboard').classList.add('open'); $('#dashboard').setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
  loadHistory();
}

function closeDashboard() {
  $('#dashboard').classList.remove('open'); $('#dashboard').setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
}

function historyEmpty(title, copy) {
  const root = $('#history-list'); root.replaceChildren();
  const empty = document.createElement('div'); empty.className = 'empty-state';
  const icon = document.createElement('span'); icon.textContent = '⌁'; const heading = document.createElement('h3'); heading.textContent = title; const paragraph = document.createElement('p'); paragraph.textContent = copy;
  empty.append(icon, heading, paragraph); root.append(empty);
}

async function loadHistory() {
  if (!state.sb || !state.session) return;
  historyEmpty('Loading your ideas', 'One moment while we find your saved captions.');
  const { data, error } = await state.sb.from('captions').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) return historyEmpty('Couldn’t load history', 'Please refresh the page and try again.');
  $('#metric-generations').textContent = data.length;
  $('#metric-captions').textContent = data.reduce((total, row) => total + (row.captions || []).length, 0);
  $('#metric-hashtags').textContent = data.reduce((total, row) => total + (row.hashtags || []).length, 0);
  if (!data.length) return historyEmpty('No saved ideas yet', 'Generate your first caption and it will appear here.');
  const root = $('#history-list'); root.replaceChildren();
  data.forEach((item) => root.append(createHistoryItem(item)));
}

function createHistoryItem(item) {
  const article = document.createElement('article'); article.className = 'history-item';
  const top = document.createElement('div'); top.className = 'history-item-top';
  const content = document.createElement('div'); const title = document.createElement('h3'); title.textContent = item.topic || 'Untitled generation';
  const meta = document.createElement('p'); meta.className = 'history-meta'; meta.textContent = `${new Date(item.created_at).toLocaleString()} · ${item.content_type} · ${item.language}`; content.append(title, meta);
  const remove = document.createElement('button'); remove.className = 'small-action'; remove.type = 'button'; remove.textContent = 'Delete'; remove.addEventListener('click', () => deleteHistory(item.id)); top.append(content, remove);
  const firstCaption = document.createElement('p'); firstCaption.textContent = (item.captions || [])[0] || 'No caption was saved.';
  const actions = document.createElement('div'); actions.className = 'history-actions'; const copy = document.createElement('button'); copy.className = 'small-action'; copy.type = 'button'; copy.textContent = 'Copy all captions'; copy.addEventListener('click', () => copyText((item.captions || []).join('\n\n'))); actions.append(copy);
  article.append(top, firstCaption, actions); return article;
}

async function deleteHistory(id) {
  if (!window.confirm('Delete this saved generation? This cannot be undone.')) return;
  const { error } = await state.sb.from('captions').delete().eq('id', id);
  if (error) return toast('We could not delete that item.');
  toast('Saved generation deleted.'); loadHistory();
}

async function logout() {
  if (!state.sb) return;
  const { error } = await state.sb.auth.signOut();
  if (error) return toast('We could not log you out right now.');
  closeDashboard(); toast('You have been logged out.');
}

function bindEvents() {
  $('.menu-toggle').addEventListener('click', () => { const menu = $('#nav-links'); const open = menu.classList.toggle('open'); $('.menu-toggle').setAttribute('aria-expanded', String(open)); });
  $$('#nav-links a').forEach((link) => link.addEventListener('click', () => { $('#nav-links').classList.remove('open'); $('.menu-toggle').setAttribute('aria-expanded', 'false'); }));
  document.addEventListener('click', (event) => {
    const element = event.target.closest('[data-action]');
    if (!element) return;
    if (element.dataset.action === 'open-auth') openAuth();
    if (element.dataset.action === 'close-auth') closeAuth();
    if (element.dataset.action === 'open-dashboard') openDashboard();
    if (element.dataset.action === 'close-dashboard') closeDashboard();
    if (element.dataset.action === 'interest') toast('Thanks for your interest—we’ll share Pro updates soon.');
  });
  $('#login-tab').addEventListener('click', () => setAuthMode(false)); $('#signup-tab').addEventListener('click', () => setAuthMode(true));
  $('#auth-form').addEventListener('submit', submitAuth); $('#forgot-password').addEventListener('click', resetPassword);
  $$('.type-tab').forEach((tab) => tab.addEventListener('click', () => setMode(tab)));
  $('#photo').addEventListener('change', selectImage); $('.remove-image').addEventListener('click', clearImage); $('#generate').addEventListener('click', generate);
  $('#copy-all').addEventListener('click', () => copyText(allResultsText())); $('#download-results').addEventListener('click', downloadResults);
  $('#caption-list').addEventListener('click', (event) => { const button = event.target.closest('[data-result-action]'); if (!button || !state.results) return; const caption = state.results.captions[Number(button.dataset.index)]; if (button.dataset.resultAction === 'copy-caption') copyText(caption); else shareText(caption); });
  $('#refresh-history').addEventListener('click', loadHistory); $('#logout').addEventListener('click', logout); $('#profile-button').addEventListener('click', () => toast('Your account details are shown below.'));
  document.addEventListener('keydown', (event) => { if (event.key !== 'Escape') return; if ($('#auth-modal').classList.contains('open')) closeAuth(); if ($('#dashboard').classList.contains('open')) closeDashboard(); });
}

function init() {
  $('#year').textContent = new Date().getFullYear();
  bindEvents();
  setMode($('.type-tab.active'));
  configureSupabase();
}
init();
