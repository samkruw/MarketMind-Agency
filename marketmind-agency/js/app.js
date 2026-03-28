// ============================================================
//  app.js  –  MarketMind Agency  –  Hauptlogik
// ============================================================
import {
  onAuthReady, login, register, logout,
  getCurrentUser, getUserProfile, getUid,
  dbSave, dbLoadAll, dbAdd, dbDelete, dbListen,
  updateUserProfile, Keys
} from './firebase.js';
import { callGroq, callORImage, WF_SYSTEM } from './api.js';

// ── STATE ─────────────────────────────────────────────────────
let clients   = [];
let camps     = [];
let saved     = [];
let feedbacks = [];
let team      = [];
let tasks     = [];
let schedule  = [];
let brand     = {};
let stats     = { wf:0, posts:0, imgs:0 };
let selImgM   = 'google/gemini-2.5-flash-image-preview';
let activeCl  = null;
let _fbRating = 5;
let _unsubscribers = [];

// ── DOM HELPERS ───────────────────────────────────────────────
export const ge   = id => document.getElementById(id);
export const qs   = s  => document.querySelector(s);
export const vl   = id => { const e=ge(id); return e ? e.value.trim() : ''; };
export const tc   = el => el.classList.toggle('on');
export function sc2(el, sel) {
  document.querySelectorAll(sel).forEach(c => c.classList.remove('on'));
  el.classList.add('on');
}
export function getChips(sel) {
  return [...document.querySelectorAll(sel + ' .on')].map(c => c.textContent.trim());
}
export function toast(msg, err=false) {
  const t = ge('toast');
  t.textContent = msg;
  t.style.borderLeftColor = err ? 'var(--er)' : 'var(--ok)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
export function copyText(txt) {
  navigator.clipboard.writeText(txt).then(() => toast('📋 Kopiert!'));
}
export function selMod(el, m) {
  document.querySelectorAll('.imgMod').forEach(x => {
    x.classList.remove('on'); x.style.borderColor='var(--l)';
  });
  el.classList.add('on'); el.style.borderColor='var(--a)'; selImgM = m;
}
export function fp(t) { ge('img-p').value = t; }

// ── NAV ───────────────────────────────────────────────────────
export function gp(id) {
  document.querySelectorAll('.pg').forEach(p => p.classList.remove('on'));
  ge(id)?.classList.add('on');
}
export function nba(el) {
  document.querySelectorAll('.nb').forEach(b => b.classList.remove('on'));
  el?.classList.add('on');
}
export function hnav(el, pg) {
  document.querySelectorAll('.ht').forEach(t => t.classList.remove('on'));
  el.classList.add('on'); gp(pg);
}

// Loader overlay
export function setLoading(on, msg='Laden…') {
  const ov = ge('loading-overlay');
  if (!ov) return;
  ov.style.display = on ? 'flex' : 'none';
  const txt = ge('loading-msg'); if (txt) txt.textContent = msg;
}

export function load(prog, btn, sp, on) {
  if (ge(prog)) ge(prog).style.display = on ? 'block' : 'none';
  if (ge(btn))  ge(btn).disabled = on;
  if (ge(sp))   ge(sp).style.display = on ? 'inline-block' : 'none';
}

// ── AUTH ──────────────────────────────────────────────────────
export async function doLogin() {
  const email = vl('login-email'), pass = vl('login-pass');
  if (!email || !pass) { toast('E-Mail und Passwort eingeben', true); return; }
  try {
    ge('login-btn').disabled = true;
    await login(email, pass);
  } catch(e) {
    toast('❌ ' + (e.code === 'auth/invalid-credential' ? 'E-Mail oder Passwort falsch' : e.message), true);
    ge('login-btn').disabled = false;
  }
}

export async function doRegister() {
  const name  = vl('reg-name');
  const email = vl('reg-email');
  const pass  = vl('reg-pass');
  const pass2 = vl('reg-pass2');
  if (!name || !email || !pass) { toast('Alle Felder ausfüllen', true); return; }
  if (pass !== pass2) { toast('Passwörter stimmen nicht überein', true); return; }
  if (pass.length < 6) { toast('Passwort min. 6 Zeichen', true); return; }
  try {
    ge('reg-btn').disabled = true;
    await register(email, pass, name);
  } catch(e) {
    toast('❌ ' + (e.code === 'auth/email-already-in-use' ? 'E-Mail bereits registriert' : e.message), true);
    ge('reg-btn').disabled = false;
  }
}

export async function doLogout() {
  _unsubscribers.forEach(u => u());
  _unsubscribers = [];
  await logout();
}

// ── DATA LOADING ──────────────────────────────────────────────
export async function loadAllData() {
  setLoading(true, 'Daten laden…');
  try {
    const [cl, ca, sv, fb, tm, tk, sc] = await Promise.all([
      dbLoadAll('clients'),
      dbLoadAll('campaigns'),
      dbLoadAll('saved'),
      dbLoadAll('feedbacks'),
      dbLoadAll('team'),
      dbLoadAll('tasks'),
      dbLoadAll('schedule')
    ]);
    clients   = cl;
    camps     = ca;
    saved     = sv;
    feedbacks = fb;
    team      = tm;
    tasks     = tk;
    schedule  = sc;

    // Load brand + stats from user profile
    const prof = getUserProfile();
    brand  = prof?.brand  || {};
    stats  = prof?.stats  || { wf:0, posts:0, imgs:0 };

    renderAll();
  } catch(e) {
    toast('❌ Fehler beim Laden: ' + e.message, true);
    console.error(e);
  }
  setLoading(false);
}

function renderAll() {
  renderClients();
  renderCamps();
  renderSaved();
  renderTeam();
  renderTasks();
  renderSchedule();
  renderFeedbackList();
  renderFeedbackProfile();
  updStats();
  updDash();
  loadBrand();
  populateAllSelects();
}

// ── REALTIME SUBSCRIPTIONS ────────────────────────────────────
export function subscribeRealtime() {
  // Clients live-update
  _unsubscribers.push(
    dbListen('clients', items => { clients = items; renderClients(); updDash(); populateAllSelects(); })
  );
  _unsubscribers.push(
    dbListen('campaigns', items => { camps = items; renderCamps(); updDash(); })
  );
  _unsubscribers.push(
    dbListen('saved', items => { saved = items; renderSaved(); updStats(); })
  );
  _unsubscribers.push(
    dbListen('feedbacks', items => { feedbacks = items; renderFeedbackList(); renderFeedbackProfile(); })
  );
  _unsubscribers.push(
    dbListen('schedule', items => { schedule = items; renderSchedule(); })
  );
  _unsubscribers.push(
    dbListen('tasks', items => { tasks = items; renderTasks(); })
  );
  _unsubscribers.push(
    dbListen('team', items => { team = items; renderTeam(); populateAllSelects(); })
  );
}

// ── API KEYS (localStorage only) ─────────────────────────────
export function saveKeys() {
  const g = vl('key-groq'), o = vl('key-or');
  if (g) Keys.groq.set(g);
  if (o) Keys.openrouter.set(o);
  updStatus();
  closeMo('mo-keys');
  toast('✅ API Keys gespeichert (nur lokal)!');
}

export function updStatus() {
  const gOk = Keys.groq.ok(), oOk = Keys.openrouter.ok();
  const setDot = (id, ok) => {
    const d = ge(id); if (!d) return;
    d.className = 'dot ' + (ok ? 'don' : 'doff');
  };
  setDot('api-dot', gOk && oOk);
  setDot('groq-dot', gOk);
  setDot('or-dot', oOk);
  if (ge('api-lbl')) ge('api-lbl').textContent = (gOk && oOk) ? 'Keys aktiv' : 'API Keys';
  if (ge('groq-st')) ge('groq-st').textContent = gOk ? '✅ Aktiv' : '❌ Kein Key';
  if (ge('or-st'))   ge('or-st').textContent   = oOk ? '✅ Aktiv' : '❌ Kein Key';
}

// ── MODAL ─────────────────────────────────────────────────────
export function openMo(id) {
  if (id === 'mo-keys') {
    if (ge('key-groq')) ge('key-groq').value = Keys.groq.get();
    if (ge('key-or'))   ge('key-or').value   = Keys.openrouter.get();
  }
  ge(id)?.classList.add('open');
}
export function closeMo(id) { ge(id)?.classList.remove('open'); }

// ── BRAND CONTEXT ─────────────────────────────────────────────
export function bCtx(clientId = null) {
  let ctx = '';
  if (brand.name) {
    ctx += `\nBrand: ${brand.name} | Slogan: ${brand.sl||''} | Mission: ${brand.mi||''} | Nie: ${brand.nv||''} | Immer: ${brand.al||''}`;
  }
  // Client-specific brand override
  if (clientId) {
    const cl = clients.find(c => c.id === clientId || c.id === String(clientId));
    if (cl?.notes) ctx += `\nKunden-Kontext: ${cl.name} | ${cl.industry||''} | ${cl.notes.substring(0,150)}`;
  }
  // Inject feedback learning
  if (feedbacks.length) {
    ctx += buildFeedbackContext(clientId);
  }
  return ctx;
}

// ── FEEDBACK LEARNING ─────────────────────────────────────────
export function buildFeedbackContext(clientId = null) {
  const rel = feedbacks
    .filter(f => !clientId || f.clientId === clientId || !f.clientId)
    .slice(0, 15);
  if (!rel.length) return '';
  const good = rel.filter(f => f.rating >= 4).slice(0, 6);
  const bad  = rel.filter(f => f.rating <= 2).slice(0, 6);
  let ctx = '\n\n--- KI-LERNPROFIL ---';
  if (good.length) {
    ctx += '\nWas gut funktioniert (nachahmen):';
    good.forEach(f => { ctx += `\n✅ ${f.type}: "${f.text?.substring(0,60)}…"${f.note?' → '+f.note:''}`; });
  }
  if (bad.length) {
    ctx += '\nWas NICHT funktioniert (vermeiden):';
    bad.forEach(f => { ctx += `\n❌ ${f.type}: "${f.text?.substring(0,60)}…"${f.note?' → '+f.note:''}`; });
  }
  ctx += '\n--- ENDE ---\nBerücksichtige dieses Lernprofil.';
  return ctx;
}

// ── STATS ─────────────────────────────────────────────────────
export async function incStat(k, n=1) {
  stats[k] = (stats[k]||0) + n;
  await updateUserProfile({ stats });
  updStats();
}

export function updStats() {
  ['wf','posts','imgs'].forEach(k => {
    const e = ge('d-'+k); if (e) e.textContent = stats[k]||0;
  });
  if (ge('d-clients')) ge('d-clients').textContent = clients.length;
  if (ge('d-camps'))   ge('d-camps').textContent   = camps.filter(c=>c.status==='active').length;
  if (ge('d-saved'))   ge('d-saved').textContent   = saved.length;
  if (ge('sb-sc'))     ge('sb-sc').textContent      = saved.length;
}

// ── SAVE/LIBRARY ──────────────────────────────────────────────
export async function saveItem(tag, text) {
  const id = String(Date.now());
  const item = { id, tag, text: text.substring(0,2000), date: new Date().toLocaleDateString('de') };
  await dbSave('saved', id, item);
  toast('⭐ Gespeichert!');
}

export async function deleteItem(id) {
  await dbDelete('saved', String(id));
  toast('🗑️ Gelöscht');
}

export function clrSaved() {
  if (!confirm('Wirklich alle gespeicherten Texte löschen?')) return;
  Promise.all(saved.map(s => dbDelete('saved', s.id))).then(() => toast('🗑️ Alles gelöscht'));
}

export function expData() {
  const blob = new Blob([JSON.stringify(saved, null, 2)], { type:'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'marketmind-export.json'; a.click(); toast('📤 Export gestartet');
}

export function renderSaved() {
  const cnt = saved.length;
  if (ge('sb-sc'))   ge('sb-sc').textContent = cnt;
  if (ge('d-saved')) ge('d-saved').textContent = cnt;
  const out = ge('saved-out'); if (!out) return;
  if (!cnt) {
    out.innerHTML = '<div class="empty"><div class="empty-ico">⭐</div><div class="empty-txt">Noch nichts gespeichert.</div></div>';
    return;
  }
  out.innerHTML = '<div class="rg">' + saved.map(item => {
    const esc = item.text?.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n') || '';
    return `<div class="rc">
      <div class="rh">
        <span class="rt">${item.tag||'–'}</span>
        <div class="ra">
          <span style="font-size:10px;color:var(--mu)">${item.date||''}</span>
          <button class="bg" onclick="window.App.copyText('${esc}')">📋</button>
          <button class="bdanger" onclick="window.App.deleteItem('${item.id}')">🗑️</button>
        </div>
      </div>
      <div class="rb">${(item.text||'').substring(0,260)}${(item.text||'').length>260?'…':''}</div>
    </div>`;
  }).join('') + '</div>';
}

// ── CRM ───────────────────────────────────────────────────────
export async function saveClient() {
  const nm = vl('nc-name'); if (!nm) { toast('Name eingeben', true); return; }
  const id = String(Date.now());
  const cl = {
    id, name: nm, industry: vl('nc-ind'), contact: vl('nc-contact'),
    status: vl('nc-status') || 'active', notes: vl('nc-notes'),
    created: new Date().toLocaleDateString('de')
  };
  await dbSave('clients', id, cl);
  closeMo('mo-newclient');
  ['nc-name','nc-ind','nc-contact','nc-notes'].forEach(i => { if(ge(i)) ge(i).value=''; });
  toast('✅ Kunde gespeichert!');
}

export function renderClients() {
  const cnt = clients.length;
  if (ge('crm-count')) ge('crm-count').textContent = cnt + ' Kunden';
  const list = ge('client-list'); if (!list) return;
  if (!cnt) {
    list.innerHTML = '<div class="empty"><div class="empty-ico">👥</div><div class="empty-txt">Noch keine Kunden.</div></div>';
    return;
  }
  const cols = ['#c8f135','#7c6fff','#2ee8b8','#ff4da6','#ffa845'];
  list.innerHTML = clients.map((c,i) => `
    <div class="client-item ${activeCl===c.id?'on':''}" onclick="window.App.showClientDetail('${c.id}')">
      <div class="cav" style="background:${cols[i%cols.length]}18;border:1px solid ${cols[i%cols.length]}30;color:${cols[i%cols.length]}">${(c.name||'?')[0].toUpperCase()}</div>
      <div style="flex:1;min-width:0">
        <div class="cnm">${c.name||'–'}</div>
        <div class="cind">${c.industry||'–'}</div>
      </div>
      <span class="cst ${c.status||'active'}">${c.status==='active'?'Aktiv':c.status==='lead'?'Lead':'Inaktiv'}</span>
    </div>`).join('');
}

export function showClientDetail(id) {
  activeCl = id;
  renderClients();
  const c = clients.find(x => x.id === id); if (!c) return;
  const clCamps = camps.filter(x => x.clientId === id);
  const det = ge('client-detail'); if (!det) return;
  det.innerHTML = `
    <div class="card">
      <div class="flb" style="margin-bottom:14px">
        <div>
          <div style="font-size:18px;font-weight:800">${c.name}</div>
          <div style="font-size:12px;color:var(--mu)">${c.industry||'–'} · ${c.contact||'–'}</div>
        </div>
        <div class="fl">
          <span class="cst ${c.status}">${c.status==='active'?'Aktiv':c.status==='lead'?'Lead':'Inaktiv'}</span>
          <button class="bdanger" onclick="window.App.deleteClient('${c.id}')">🗑️</button>
        </div>
      </div>
      ${c.notes ? `<div style="font-size:13px;color:var(--tx2);line-height:1.65;padding:10px;background:var(--s2);border-radius:8px;margin-bottom:12px">${c.notes}</div>` : ''}
      <div style="font-size:11px;color:var(--mu)">Erstellt: ${c.created||'–'}</div>
    </div>
    <div class="card">
      <div class="ch">🎯 Kampagnen (${clCamps.length})</div>
      ${clCamps.length
        ? clCamps.map(cp=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--l)"><div><div style="font-size:12px;font-weight:800">${cp.name}</div><div style="font-size:11px;color:var(--mu)">${cp.type||'–'}</div></div><span class="kpi-badge ${cp.status==='active'?'kpi-ok':'kpi-wa'}">${cp.status}</span></div>`).join('')
        : '<div style="font-size:12px;color:var(--mu)">Keine Kampagnen</div>'}
    </div>
    <div class="card">
      <div class="ch">⚡ KI-Aktionen</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button class="bp" style="font-size:11px;padding:7px 13px" onclick="window.App.wfForClient('${c.name.replace(/'/g,"\\'")}')">⚡ Workflow</button>
        <button class="bs" style="font-size:11px" onclick="ge('ap-client').value='${c.id}';window.App.gp('pg-autopilot')">🚀 Autopilot</button>
        <button class="bs" style="font-size:11px" onclick="ge('inv-to').value='${c.name.replace(/'/g,"\\'")}';window.App.gp('pg-invoice')">🧾 Angebot</button>
      </div>
    </div>`;
}

export async function deleteClient(id) {
  if (!confirm('Kunde löschen?')) return;
  await dbDelete('clients', String(id));
  activeCl = null;
  if (ge('client-detail')) ge('client-detail').innerHTML = '<div class="empty"><div class="empty-ico">👆</div><div class="empty-txt">Kunde auswählen.</div></div>';
  toast('🗑️ Gelöscht');
}

export function wfForClient(name) {
  ge('wf-in').value = `Erstelle einen vollständigen Instagram-Post mit Bild und Hashtags für ${name}`;
  gp('pg-wf'); nba(document.querySelector('.nb'));
  sendWf();
}

// ── CAMPAIGNS ────────────────────────────────────────────────
export async function saveCamp() {
  const nm = vl('ncamp-name'); if (!nm) { toast('Name eingeben', true); return; }
  const id = String(Date.now());
  const clVal = ge('ncamp-client')?.value;
  await dbSave('campaigns', id, {
    id, name: nm, type: vl('ncamp-type'),
    clientId: clVal || null,
    budget: vl('ncamp-budget'), start: vl('ncamp-start'),
    status: vl('ncamp-status') || 'draft', kpi: vl('ncamp-kpi'),
    progress: 0
  });
  closeMo('mo-newcamp');
  toast('✅ Kampagne gespeichert!');
}

export function renderCamps() {
  const f    = ge('camp-filter')?.value || 'all';
  const list = ge('camp-list'); if (!list) return;
  const filt = f === 'all' ? camps : camps.filter(c => c.status === f);
  if (!filt.length) {
    list.innerHTML = '<div class="empty"><div class="empty-ico">🎯</div><div class="empty-txt">Keine Kampagnen.</div></div>';
    return;
  }
  list.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px">' + filt.map(c => {
    const cl  = clients.find(x => x.id === c.clientId);
    const stC = c.status==='active'?'kpi-ok':c.status==='done'?'kpi-mu':'kpi-wa';
    return `<div class="camp-row">
      <div>
        <div class="camp-nm">${c.name}</div>
        <div class="camp-meta">${c.type||'–'}${cl?' · '+cl.name:''}${c.start?' · ab '+c.start:''}</div>
        ${c.kpi ? `<div style="font-size:10px;color:var(--mu);margin-top:2px">Ziel: ${c.kpi}</div>` : ''}
        <div class="prog-bar-h" style="width:160px;margin-top:4px"><div class="prog-bar-f" style="width:${c.progress||0}%"></div></div>
      </div>
      <span class="kpi-badge ${stC}">${c.budget?'CHF '+c.budget:''}</span>
      <span class="kpi-badge ${stC}">${c.status==='active'?'Aktiv':c.status==='done'?'Fertig':'Entwurf'}</span>
      <div class="fl" style="gap:5px">
        <button class="bg" onclick="window.App.quickWfForCamp('${c.name.replace(/'/g,"\\'")}')">⚡</button>
        <button class="bdanger" onclick="window.App.deleteCamp('${c.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('') + '</div>';
}

export function quickWfForCamp(name) {
  ge('wf-in').value = `Social-Media-Posts mit Bild für Kampagne: ${name}`;
  gp('pg-wf'); nba(document.querySelector('.nb')); sendWf();
}

export async function deleteCamp(id) {
  if (!confirm('Löschen?')) return;
  await dbDelete('campaigns', String(id));
  toast('🗑️ Gelöscht');
}

// ── TEAM & TASKS ──────────────────────────────────────────────
export async function saveMember() {
  const nm = vl('nm-name'); if (!nm) { toast('Name eingeben', true); return; }
  const id = String(Date.now());
  await dbSave('team', id, { id, name: nm, role: vl('nm-role'), email: vl('nm-email'), rate: vl('nm-rate'), spec: vl('nm-spec') });
  closeMo('mo-newmember');
  toast('✅ Mitglied gespeichert!');
}

export function renderTeam() {
  const cnt  = team.length;
  if (ge('team-count')) ge('team-count').textContent = cnt + ' Mitglied' + (cnt!==1?'er':'');
  const list = ge('team-list'); if (!list) return;
  if (!cnt) { list.innerHTML = '<div class="empty"><div class="empty-ico">👤</div><div class="empty-txt">Noch keine Mitglieder.</div></div>'; return; }
  const roleColors = { Freelancer:['#c8f135','rgba(200,241,53,.09)'], 'Social Media Manager':['#2ee8b8','rgba(46,232,184,.09)'], Designer:['#7c6fff','rgba(124,111,255,.09)'], 'Texter/in':['#ff4da6','rgba(255,77,166,.09)'], 'SEO Experte':['#ffa845','rgba(255,168,69,.09)'], VA:['#9d9bba','rgba(157,155,186,.09)'] };
  list.innerHTML = team.map(m => {
    const [col,bg] = roleColors[m.role] || ['#9d9bba','rgba(157,155,186,.09)'];
    const myT = tasks.filter(t => t.assignId === m.id && t.status !== 'done');
    return `<div style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--l)">
      <div style="width:34px;height:34px;border-radius:50%;background:${bg};border:1px solid ${col}30;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:${col};flex-shrink:0">${(m.name||'?')[0]}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:800">${m.name}</div>
        <div style="font-size:11px;color:var(--mu)">${m.role}${m.rate?' · CHF '+m.rate+'/h':''}${m.spec?' · '+m.spec:''}</div>
      </div>
      ${myT.length ? `<span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:100px;background:var(--ag);color:var(--a)">${myT.length} Tasks</span>` : ''}
      <button class="bdanger" onclick="window.App.deleteMember('${m.id}')">🗑️</button>
    </div>`;
  }).join('');
}

export async function deleteMember(id) {
  if (!confirm('Mitglied löschen?')) return;
  await dbDelete('team', String(id));
}

export async function saveTask() {
  const title = vl('nt-title'); if (!title) { toast('Titel eingeben', true); return; }
  const id = String(Date.now());
  await dbSave('tasks', id, {
    id, title, assignId: ge('nt-assign')?.value || null,
    prio: vl('nt-prio') || 'normal', due: vl('nt-due'),
    clientId: ge('nt-client')?.value || null, desc: vl('nt-desc'),
    status: 'open', created: new Date().toLocaleDateString('de')
  });
  closeMo('mo-newtask'); toast('✅ Aufgabe gespeichert!');
}

export function renderTasks() {
  const f    = ge('task-filter')?.value || 'all';
  const list = ge('task-list'); if (!list) return;
  const filt = f === 'all' ? tasks : tasks.filter(t => t.status === f);
  if (!filt.length) { list.innerHTML = '<div class="empty"><div class="empty-ico">📋</div><div class="empty-txt">Keine Aufgaben.</div></div>'; return; }
  const prioCols = { high:'var(--er)', normal:'var(--a)', low:'var(--mu)' };
  const stCls    = { open:'kpi-wa', progress:'kpi-ok', done:'kpi-mu' };
  const stLbl    = { open:'Offen', progress:'In Arbeit', done:'Erledigt' };
  list.innerHTML = filt.map(t => {
    const assignee = team.find(m => m.id === t.assignId);
    const cl       = clients.find(c => c.id === t.clientId);
    return `<div style="padding:10px 12px;background:var(--s2);border:1px solid var(--l);border-radius:9px;margin-bottom:6px;border-left:3px solid ${prioCols[t.prio]||'var(--mu)'}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:5px">
        <span style="font-size:12px;font-weight:800">${t.title}</span>
        <div style="display:flex;gap:5px;flex-shrink:0">
          <span class="kpi-badge ${stCls[t.status]}" style="cursor:pointer" onclick="window.App.cycleTaskStatus('${t.id}')">${stLbl[t.status]}</span>
          <button class="bdanger" style="padding:3px 7px;font-size:10px" onclick="window.App.deleteTask('${t.id}')">✕</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${assignee ? `<span style="font-size:10px;color:var(--mu)">👤 ${assignee.name}</span>` : ''}
        ${cl       ? `<span style="font-size:10px;color:var(--mu)">🏢 ${cl.name}</span>`        : ''}
        ${t.due    ? `<span style="font-size:10px;color:var(--mu)">📅 ${t.due}</span>`           : ''}
      </div>
    </div>`;
  }).join('');
}

export async function cycleTaskStatus(id) {
  const t = tasks.find(x => x.id === id); if (!t) return;
  const cycle = ['open','progress','done'];
  const next  = cycle[(cycle.indexOf(t.status)+1)%cycle.length];
  await dbSave('tasks', String(id), { status: next });
}

export async function deleteTask(id) {
  await dbDelete('tasks', String(id));
}

export async function genAITasks() {
  const desc = vl('ai-task-desc'); if (!desc) { toast('Projekt beschreiben', true); return; }
  ge('ai-task-btn').disabled = true; ge('ai-task-sp').style.display = 'inline-block';
  try {
    const raw = await callGroq(
      `Erstelle 5-8 Aufgaben für: ${desc}\nTeam: ${team.map(m=>m.name+' ('+m.role+')').join(', ')||'kein Team'}\nJSON:[{"title":"...","assignRole":"...","prio":"high","due":"in X Tagen","desc":"..."}]`
    );
    const items = JSON.parse(raw.replace(/```json|```/g,'').trim());
    for (const item of items) {
      const assignee = team.find(m => m.role === item.assignRole) || null;
      await dbAdd('tasks', { title:item.title, assignId:assignee?.id||null, prio:item.prio||'normal', due:item.due||'', desc:item.desc||'', status:'open', created:new Date().toLocaleDateString('de') });
    }
    toast('⚡ ' + items.length + ' Aufgaben erstellt!');
  } catch(e) { toast('❌ '+e.message, true); }
  ge('ai-task-btn').disabled = false; ge('ai-task-sp').style.display = 'none';
}

// ── SCHEDULE ─────────────────────────────────────────────────
export async function addSchedulePost() {
  const date = vl('sch-date'); if (!date) { toast('Datum eingeben', true); return; }
  const id   = String(Date.now());
  const clId = ge('sch-client')?.value || null;
  const cl   = clients.find(c => c.id === clId);
  await dbSave('schedule', id, {
    id, date, time: vl('sch-time')||'09:00', platform: vl('sch-plat'),
    caption: vl('sch-caption'), clientId: clId, clientName: cl?.name||'Eigenes Business', status:'planned'
  });
  ['sch-date','sch-time','sch-caption'].forEach(i => { if(ge(i)) ge(i).value=''; });
  toast('📆 Post eingeplant!');
}

export function renderSchedule() {
  const cnt  = schedule.length;
  if (ge('sch-count')) ge('sch-count').textContent = cnt + ' Post' + (cnt!==1?'s':'');
  const list = ge('sch-list'); if (!list) return;
  const sorted = [...schedule].sort((a,b) => (a.date||'').localeCompare(b.date||''));
  if (!sorted.length) { list.innerHTML = '<div class="empty"><div class="empty-ico">📆</div><div class="empty-txt">Noch keine geplanten Posts.</div></div>'; return; }
  const ico = { Instagram:'📸', Facebook:'👍', LinkedIn:'💼', 'X/Twitter':'🐦', TikTok:'🎵' };
  const stC = { planned:'kpi-wa', published:'kpi-ok', draft:'kpi-mu' };
  list.innerHTML = '<div style="display:flex;flex-direction:column;gap:6px">' + sorted.map(p => `
    <div style="display:grid;grid-template-columns:90px 36px 1fr auto;gap:10px;align-items:start;padding:11px 13px;background:var(--s2);border:1px solid var(--l);border-radius:9px">
      <div><div style="font-size:11px;font-weight:800;color:var(--a)">${p.date}</div><div style="font-size:10px;color:var(--mu)">${p.time}</div></div>
      <div style="font-size:18px;line-height:1.4">${ico[p.platform]||'📱'}</div>
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--tx2);margin-bottom:2px">${p.platform} · ${p.clientName||'–'}</div>
        <div style="font-size:12px;color:var(--tx);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${p.caption||'Kein Text'}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;align-items:flex-end">
        <span class="kpi-badge ${stC[p.status]}" style="cursor:pointer" onclick="window.App.cycleSchStatus('${p.id}')">${p.status==='planned'?'Geplant':p.status==='published'?'Publiziert':'Entwurf'}</span>
        <button class="bg" style="font-size:10px;padding:2px 7px" onclick="window.App.copyText(${JSON.stringify(p.caption||'')})">📋</button>
        <button class="bdanger" style="font-size:10px;padding:2px 7px" onclick="window.App.deleteSchPost('${p.id}')">✕</button>
      </div>
    </div>`).join('') + '</div>';
}

export async function cycleSchStatus(id) {
  const p = schedule.find(x => x.id === id); if (!p) return;
  const c = ['planned','published','draft'];
  await dbSave('schedule', String(id), { status: c[(c.indexOf(p.status)+1)%c.length] });
}
export async function deleteSchPost(id) { await dbDelete('schedule', String(id)); }
export function clearSchedule() { if(!confirm('Plan leeren?'))return; Promise.all(schedule.map(p=>dbDelete('schedule',p.id))).then(()=>toast('🗑️ Plan geleert')); }
export function exportSchedule() {
  const csv = 'Datum,Uhrzeit,Plattform,Kunde,Caption,Status\n' +
    schedule.map(p=>`"${p.date}","${p.time}","${p.platform}","${p.clientName||''}","${(p.caption||'').replace(/"/g,'""')}","${p.status}"`).join('\n');
  const b = new Blob([csv],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='social-plan.csv'; a.click(); toast('📤 CSV exportiert!');
}

export async function genScheduleCaption() {
  const plat  = vl('sch-plat'), topic = vl('sch-caption');
  if (!topic) { toast('Thema eingeben', true); return; }
  ge('sch-ai-btn').disabled = true; ge('sch-ai-sp').style.display = 'inline-block';
  try {
    const tx = await callGroq(`${plat}-Post Caption: ${topic}${bCtx()}\nNur die Caption.`);
    ge('sch-caption').value = tx; toast('✨ Caption erstellt!');
  } catch(e) { toast('❌ '+e.message, true); }
  ge('sch-ai-btn').disabled = false; ge('sch-ai-sp').style.display = 'none';
}

// ── FEEDBACK ─────────────────────────────────────────────────
export async function saveFeedback() {
  const txt = vl('fb-text'), note = vl('fb-note');
  if (!txt) { toast('Text eingeben', true); return; }
  const clId = ge('fb-client')?.value || null;
  const cl   = clients.find(c => c.id === clId);
  const id   = String(Date.now());
  await dbSave('feedbacks', id, {
    id, text: txt.substring(0,400), rating: _fbRating||5, note,
    type: vl('fb-type'), clientId: clId, clientName: cl?.name||'Allgemein',
    date: new Date().toLocaleDateString('de')
  });
  ['fb-text','fb-note'].forEach(i => { if(ge(i)) ge(i).value=''; });
  toast('✅ Feedback gespeichert! KI lernt daraus.');
}

export async function deleteFeedback(id) { await dbDelete('feedbacks', String(id)); }

export function renderFeedbackList() {
  const cnt  = feedbacks.length;
  if (ge('fb-count')) ge('fb-count').textContent = cnt + ' Einträge';
  const list = ge('fb-list'); if (!list) return;
  if (!cnt) { list.innerHTML = '<div class="empty"><div class="empty-ico">📋</div><div class="empty-txt">Noch kein Feedback.</div></div>'; return; }
  const ico = { 5:'✅', 3:'😐', 1:'❌' };
  list.innerHTML = feedbacks.slice(0,15).map(f => `
    <div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--l)">
      <span style="font-size:16px;flex-shrink:0">${ico[f.rating]||'•'}</span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;gap:6px;margin-bottom:3px;flex-wrap:wrap">
          <span style="font-size:10px;font-weight:800;color:var(--a)">${f.type||'–'}</span>
          <span style="font-size:10px;color:var(--mu)">${f.clientName||'–'} · ${f.date||''}</span>
        </div>
        <div style="font-size:12px;color:var(--tx2)">"${(f.text||'').substring(0,100)}…"</div>
        ${f.note ? `<div style="font-size:11px;color:var(--mu);font-style:italic;margin-top:2px">→ ${f.note}</div>` : ''}
      </div>
      <button class="bdanger" style="padding:2px 7px;font-size:10px" onclick="window.App.deleteFeedback('${f.id}')">✕</button>
    </div>`).join('');
}

export function renderFeedbackProfile() {
  const prof = ge('fb-profile'); if (!prof) return;
  if (!feedbacks.length) { prof.innerHTML = '<div class="empty"><div class="empty-ico">🧠</div><div class="empty-txt">Noch kein Feedback.</div></div>'; return; }
  const good = feedbacks.filter(f => f.rating >= 4);
  const bad  = feedbacks.filter(f => f.rating <= 2);
  const typeStats = {};
  feedbacks.forEach(f => {
    if (!typeStats[f.type]) typeStats[f.type] = {good:0,bad:0};
    if (f.rating >= 4) typeStats[f.type].good++;
    else if (f.rating <= 2) typeStats[f.type].bad++;
  });
  let html = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
    <div style="background:rgba(57,217,138,.08);border:1px solid rgba(57,217,138,.2);border-radius:9px;padding:11px;text-align:center"><div style="font-size:22px;font-weight:800;color:var(--ok)">${good.length}</div><div style="font-size:10px;color:var(--mu);font-weight:700">Positiv</div></div>
    <div style="background:rgba(255,95,109,.07);border:1px solid rgba(255,95,109,.2);border-radius:9px;padding:11px;text-align:center"><div style="font-size:22px;font-weight:800;color:var(--er)">${bad.length}</div><div style="font-size:10px;color:var(--mu);font-weight:700">Negativ</div></div>
    <div style="background:var(--ag);border:1px solid rgba(200,241,53,.2);border-radius:9px;padding:11px;text-align:center"><div style="font-size:22px;font-weight:800;color:var(--a)">${feedbacks.length}</div><div style="font-size:10px;color:var(--mu);font-weight:700">Total</div></div>
  </div>`;
  const goodNotes = good.map(f=>f.note).filter(Boolean).slice(0,4);
  if (goodNotes.length) html += `<div style="margin-bottom:12px"><div style="font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--ok);margin-bottom:6px">✅ Was gut funktioniert</div>${goodNotes.map(n=>`<div style="font-size:12px;color:var(--tx2);padding:4px 0;border-bottom:1px solid var(--l)">• ${n}</div>`).join('')}</div>`;
  const badNotes  = bad.map(f=>f.note).filter(Boolean).slice(0,4);
  if (badNotes.length)  html += `<div style="margin-bottom:12px"><div style="font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--er);margin-bottom:6px">❌ Was vermieden werden soll</div>${badNotes.map(n=>`<div style="font-size:12px;color:var(--tx2);padding:4px 0;border-bottom:1px solid var(--l)">• ${n}</div>`).join('')}</div>`;
  const types = Object.entries(typeStats).sort((a,b)=>(b[1].good-b[1].bad)-(a[1].good-a[1].bad));
  if (types.length) {
    html += `<div><div style="font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--mu);margin-bottom:6px">📊 Nach Content-Typ</div>` +
      types.map(([t,s]) => {
        const sc = s.good+s.bad>0?Math.round(s.good/(s.good+s.bad)*100):50;
        const col = sc>=70?'var(--ok)':sc>=40?'var(--wa)':'var(--er)';
        return `<div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid var(--l)"><span style="font-size:12px;flex:1;font-weight:600">${t}</span><div style="width:80px;height:4px;background:var(--l);border-radius:2px;overflow:hidden"><div style="height:100%;width:${sc}%;background:${col};border-radius:2px"></div></div><span style="font-size:11px;font-weight:800;color:${col};min-width:30px;text-align:right">${sc}%</span></div>`;
      }).join('') + '</div>';
  }
  html += `<div style="margin-top:12px;padding:10px;background:var(--ag);border:1px solid rgba(200,241,53,.2);border-radius:9px"><div style="font-size:10px;font-weight:800;color:var(--a);margin-bottom:4px">⚡ KI-Status</div><div style="font-size:12px;color:var(--tx2)">Alle ${feedbacks.length} Feedbacks werden automatisch in zukünftige Generierungen eingebunden.</div></div>`;
  prof.innerHTML = html;
}

// ── BRAND KIT ─────────────────────────────────────────────────
export async function svBrand() {
  brand = { name:vl('bk-nm'), sl:vl('bk-sl'), mi:vl('bk-mi'), nv:vl('bk-nv'), al:vl('bk-al') };
  await updateUserProfile({ brand });
  toast('✅ Brand-Kit gespeichert!');
}

export function loadBrand() {
  if (brand.name) { const e=ge('bk-nm'); if(e)e.value=brand.name; }
  if (brand.sl)   { const e=ge('bk-sl'); if(e)e.value=brand.sl;   }
  if (brand.mi)   { const e=ge('bk-mi'); if(e)e.value=brand.mi;   }
  if (brand.nv)   { const e=ge('bk-nv'); if(e)e.value=brand.nv;   }
  if (brand.al)   { const e=ge('bk-al'); if(e)e.value=brand.al;   }
}

// ── POPULATE SELECTS ──────────────────────────────────────────
export function populateAllSelects() {
  const clOpts = '<option value="">Eigenes Business</option>' + clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  ['ap-client','ncamp-client','rep-client','sch-client','fb-client','nt-client'].forEach(id => {
    const s = ge(id); if (!s) return;
    const val = s.value;
    s.innerHTML = (id==='nt-client'?'<option value="">Kein Kunde</option>':'<option value="">Eigenes Business</option>') + clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
    if (val) s.value = val;
  });
  const tmOpts = '<option value="">Nicht zugewiesen</option>' + team.map(m=>`<option value="${m.id}">${m.name} (${m.role})</option>`).join('');
  const s = ge('nt-assign'); if (s) s.innerHTML = tmOpts;
}

// ── DASHBOARD ────────────────────────────────────────────────
export function updDash() {
  updStats();
  const dc = ge('dash-clients');
  if (dc) {
    if (!clients.length) { dc.innerHTML='<div class="empty"><div class="empty-ico">👥</div><div class="empty-txt">Noch keine Kunden.</div></div>'; }
    else {
      const cols=['#c8f135','#7c6fff','#2ee8b8','#ff4da6'];
      dc.innerHTML = clients.slice(0,4).map((c,i)=>`
        <div class="fl" style="padding:9px 0;border-bottom:1px solid var(--l);cursor:pointer" onclick="window.App.showClientDetail('${c.id}');window.App.gp('pg-crm')">
          <div style="width:28px;height:28px;border-radius:50%;background:${cols[i%4]}18;font-size:12px;font-weight:800;color:${cols[i%4]};display:flex;align-items:center;justify-content:center;flex-shrink:0">${(c.name||'?')[0]}</div>
          <div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</div><div style="font-size:10px;color:var(--mu)">${c.industry||'–'}</div></div>
          <span class="cst ${c.status}">${c.status==='active'?'Aktiv':c.status==='lead'?'Lead':'–'}</span>
        </div>`).join('');
    }
  }
  const dca = ge('dash-camps');
  if (dca) {
    const ac = camps.filter(c=>c.status==='active');
    if (!ac.length) dca.innerHTML='<div class="empty"><div class="empty-ico">🎯</div><div class="empty-txt">Keine aktiven Kampagnen.</div></div>';
    else dca.innerHTML = ac.slice(0,4).map(c=>`<div style="padding:9px 0;border-bottom:1px solid var(--l)"><div class="flb"><span style="font-size:12px;font-weight:800">${c.name}</span><span class="kpi-badge kpi-ok" style="font-size:9px">Aktiv</span></div><div style="font-size:10px;color:var(--mu);margin-top:2px">${c.type}${c.budget?' · CHF '+c.budget:''}</div></div>`).join('');
  }
}

// ── EXPOSE ALL FUNCTIONS GLOBALLY ────────────────────────────
window.App = {
  gp, nba, hnav, tc, sc2, ge, vl, copyText, toast, load, fp, selMod,
  openMo, closeMo, saveKeys, updStatus,
  doLogin, doRegister, doLogout,
  saveClient, showClientDetail, deleteClient, wfForClient, renderClients,
  saveCamp, renderCamps, deleteCamp, quickWfForCamp,
  saveMember, deleteMember, renderTeam,
  saveTask, renderTasks, cycleTaskStatus, deleteTask, genAITasks,
  addSchedulePost, renderSchedule, cycleSchStatus, deleteSchPost, clearSchedule, exportSchedule, genScheduleCaption,
  saveFeedback, deleteFeedback, renderFeedbackList, renderFeedbackProfile,
  svBrand, saveItem, deleteItem, clrSaved, expData,
  bCtx, buildFeedbackContext, incStat,
  setFbRating: (r) => { _fbRating = r; },
  setSelImgM:  (m) => { selImgM   = m; },
  getSelImgM:  ()  => selImgM,
};

// ── WORKFLOW + GENERATORS re-exported via window.App too ─────
// These are defined in workflow.js and generators.js and appended to window.App there.
