// ============================================================
//  generators.js  –  Alle KI-Generierungsfunktionen
// ============================================================
import { callGroq, callORImage, WF_SYSTEM } from './api.js';
import {
  ge, qs, vl, tc, sc2, toast, load, copyText, saveItem, incStat, bCtx,
  buildFeedbackContext, gp, nba, updDash
} from './app.js';
import { dbSave, dbAdd } from './firebase.js';

// ── HELPER ────────────────────────────────────────────────────
function mkCard(tag, text, delay=0) {
  const d = document.createElement('div');
  d.className = 'rc'; d.style.animationDelay = delay + 's';
  const esc  = text.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
  const tagE = tag.replace(/'/g,"\\'");
  d.innerHTML = `
    <div class="rh">
      <span class="rt">${tag}</span>
      <div class="ra">
        <button class="bg" onclick="window.App.copyText('${esc}')">📋</button>
        <button class="bg" onclick="window.App.saveItem('${tagE}','${esc}')">⭐</button>
      </div>
    </div>
    <div class="rb">${text}</div>`;
  return d;
}

// ── SOCIAL MEDIA ──────────────────────────────────────────────
export async function genSocial() {
  const br    = vl('s-brand') || 'Unternehmen';
  const tp    = vl('s-topic');
  const plats = [...document.querySelectorAll('#pg-social .chip.li.on')].map(c => c.textContent.trim());
  const tone  = qs('.sTone.on')?.textContent || 'Professionell';
  if (!tp)          { toast('⚠️ Thema eingeben', true); return; }
  if (!plats.length){ toast('⚠️ Plattform wählen', true); return; }

  load('s-prog','s-btn','s-sp', true);
  ge('s-out').innerHTML = '';
  try {
    const raw = await callGroq(
      `Social Posts für: ${plats.join(', ')}\nMarke:${br} Thema:${tp} Ton:${tone}\n${vl('s-extra')||''}${bCtx()}\n[POST: Plattform]\nText\n---`
    );
    raw.split('---').filter(b => b.trim()).forEach((block, i) => {
      const m  = block.match(/\[POST:\s*(.+?)\]/); if (!m) return;
      const tx = block.replace(/\[POST:[^\]]+\]/, '').trim(); if (!tx) return;
      ge('s-out').appendChild(mkCard(m[1].trim(), tx, i * .07));
    });
    incStat('posts', 1); toast('✨ Posts erstellt!');
  } catch(e) { toast('❌ '+e.message, true); }
  load('s-prog','s-btn','s-sp', false);
}

// ── BILD-STUDIO ───────────────────────────────────────────────
export async function genImg() {
  const pr  = vl('img-p');
  const cnt = parseInt(vl('img-n')) || 1;
  if (!pr) { toast('⚠️ Prompt eingeben', true); return; }
  const sm = {
    'Fotorealistisch': 'photorealistic professional photography',
    'Illustration':    'digital illustration vibrant colors',
    'Minimalistisch':  'minimalist clean white background',
    'Warm & gemütlich':'warm cozy soft lighting atmosphere'
  };
  const full = `${pr}. Style: ${sm[qs('.imgSt.on')?.textContent]||'photorealistic'}. Marketing quality, high resolution.`;

  load('img-prog','img-btn','img-sp', true);
  const out = ge('img-out'); out.innerHTML = '';

  for (let i = 0; i < cnt; i++) {
    const ph = document.createElement('div');
    ph.id = `iph-${i}`;
    ph.style.cssText = 'border-radius:10px;overflow:hidden;border:1px solid var(--l);background:var(--s)';
    ph.innerHTML = `<div style="width:100%;aspect-ratio:1;background:var(--s2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px"><div class="spin" style="width:22px;height:22px;border-width:3px;display:block!important;border-color:rgba(200,241,53,.2);border-top-color:var(--a)"></div><div style="font-size:11px;color:var(--mu)">Generiert…</div></div>`;
    out.appendChild(ph);
  }

  let ok = 0;
  const selM = window.App?.getSelImgM?.() || 'google/gemini-2.5-flash-image-preview';
  for (let i = 0; i < cnt; i++) {
    try {
      const imgs = await callORImage(full, selM);
      const ph   = ge(`iph-${i}`);
      if (imgs[0]) {
        ph.innerHTML = `<img src="${imgs[0]}" style="width:100%;display:block" alt="KI Bild"><div style="padding:8px;display:flex;gap:5px"><span style="flex:1;font-size:10px;color:var(--mu);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${pr}</span><a href="${imgs[0]}" download="bild.png" class="bg">💾</a></div>`;
        ok++;
      }
    } catch(e) {
      ge(`iph-${i}`).innerHTML = `<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:var(--s2);border-radius:10px;text-align:center;padding:16px"><div style="font-size:12px;color:var(--mu)">❌ ${e.message}</div></div>`;
    }
  }
  ge('img-cnt-lbl').textContent = ok + ' Bild' + (ok!==1?'er':'');
  if (ok > 0) { incStat('imgs', ok); toast(`🎨 ${ok} Bild${ok!==1?'er':''} generiert!`); }
  load('img-prog','img-btn','img-sp', false);
}

// ── IDEAS ─────────────────────────────────────────────────────
export async function genIdeas() {
  load('i-prog','i-btn','i-sp', true);
  ge('i-out').innerHTML = '';
  try {
    const raw   = await callGroq(`Content-Ideen: Branche:${vl('i-ind')||'allgemein'} Anlass:${vl('i-per')||'allgemein'} Zielgruppe:${vl('i-aud')||'allgemein'} Anzahl:${vl('i-cnt')} Format:${vl('i-fmt')}${bCtx()}\nJSON:[{"icon":"emoji","title":"...","desc":"...","format":"..."}]`);
    const ideas = JSON.parse(raw.replace(/```json|```/g,'').trim());
    ideas.forEach((idea, i) => {
      const c   = document.createElement('div'); c.className='ic'; c.style.animationDelay=i*.05+'s';
      const esc = (idea.title+'\n\n'+idea.desc).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
      c.innerHTML = `<div class="ic-ico">${idea.icon}</div><div class="ic-t">${idea.title}</div><div class="ic-d">${idea.desc}</div><div style="margin-top:7px;display:flex;gap:4px"><span style="font-size:9px;padding:2px 6px;border-radius:100px;background:var(--s2);color:var(--mu)">${idea.format||''}</span><button class="bg" style="font-size:10px;padding:2px 7px" onclick="event.stopPropagation();window.App.copyText('${esc}')">📋</button><button class="bg" style="font-size:10px;padding:2px 7px" onclick="event.stopPropagation();window.App.saveItem('Idee','${esc}')">⭐</button></div>`;
      ge('i-out').appendChild(c);
    });
    incStat('posts', 1); toast(`💡 ${ideas.length} Ideen!`);
  } catch(e) { toast('❌ '+e.message, true); }
  load('i-prog','i-btn','i-sp', false);
}

// ── ADS ───────────────────────────────────────────────────────
export async function genAds() {
  const prod = vl('a-prod'); if (!prod) { toast('⚠️ Produkt eingeben', true); return; }
  load('a-prog','a-btn','a-sp', true); ge('a-out').innerHTML = '';
  try {
    const raw = await callGroq(`Werbetexte 3 Varianten (emotional/rational/Dringlichkeit):\nProdukt:${prod} USP:${vl('a-usp')} Plattform:${vl('a-plat')} CTA:${vl('a-cta')||'Jetzt anfragen'} Preis:${vl('a-price')} Zielgruppe:${vl('a-tgt')}${bCtx()}\n[AD: Emotional]\nHeadline:...\nBody:...\nCTA:...\n---\n[AD: Rational]\n...\n---\n[AD: Dringlichkeit]\n...\n---`);
    raw.split('---').filter(b=>b.trim()).forEach((block,i) => {
      const m  = block.match(/\[AD:\s*(.+?)\]/); if (!m) return;
      const tx = block.replace(/\[AD:[^\]]+\]/,'').trim(); if (!tx) return;
      ge('a-out').appendChild(mkCard(vl('a-plat')+' – '+m[1].trim(), tx, i*.1));
    });
    incStat('posts', 3); toast('📣 Werbetexte erstellt!');
  } catch(e) { toast('❌ '+e.message, true); }
  load('a-prog','a-btn','a-sp', false);
}

// ── EMAIL ─────────────────────────────────────────────────────
export async function genEmail() {
  const tp = vl('em-topic'); if (!tp) { toast('⚠️ Thema eingeben', true); return; }
  load('em-prog','em-btn','em-sp', true); ge('em-out').innerHTML = '';
  try {
    const raw  = await callGroq(`E-Mail: Typ:${vl('em-type')} Marke:${vl('em-brand')||'Unternehmen'} Thema:${tp} CTA:${vl('em-cta')||'Jetzt'} Empfänger:${vl('em-aud')||'Kunden'}${bCtx()}\nBETREFF: ...\nPREVIEW: ...\n---\nE-MAIL:\n[Text]`);
    const sub  = (raw.match(/BETREFF:\s*(.+)/)  || [])[1] || 'Betreff';
    const body = (raw.match(/E-MAIL:\n([\s\S]+?)(?:---|$)/) || [])[1] || raw;
    const se   = sub.replace(/'/g,"\\'");
    const be   = body.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
    ge('em-out').innerHTML = `<div class="rc" style="animation:ci .4s var(--ease)"><div class="rh"><span class="rt">✉️ ${vl('em-type')}</span><div class="ra"><button class="bg" onclick="window.App.copyText('${se}\\n\\n${be}')">📋</button><button class="bg" onclick="window.App.saveItem('E-Mail: ${vl('em-type').replace(/'/g,"\\'")}','${be}')">⭐</button></div></div><div style="margin-bottom:10px"><div style="font-size:9px;color:var(--mu);font-weight:800;letter-spacing:1px;margin-bottom:3px">BETREFF</div><div style="font-size:15px;font-weight:800">${sub}</div></div><div class="ep"><p>${body}</p><a class="ep-cta" href="#">${vl('em-cta')||'Entdecken'} →</a></div></div>`;
    incStat('posts', 1); toast('✉️ E-Mail erstellt!');
  } catch(e) { toast('❌ '+e.message, true); }
  load('em-prog','em-btn','em-sp', false);
}

// ── HASHTAGS ─────────────────────────────────────────────────
export async function genHashtags() {
  const tp = vl('h-topic'); if (!tp) { toast('⚠️ Thema eingeben', true); return; }
  load('h-prog','h-btn','h-sp', true); ge('h-out').innerHTML = '';
  try {
    const raw = await callGroq(`Hashtags für ${vl('h-plat')} zu "${tp}" (${vl('h-ind')||'allgemein'},${vl('h-lang')}).\n3 Sets: [SET: Reichweite]\n#tag...\n---\n[SET: Nische]\n...\n---\n[SET: Lokal]\n...\n---`);
    raw.split('---').filter(b=>b.trim()).forEach((block,bi) => {
      const m    = block.match(/\[SET:\s*(.+?)\]/); if (!m) return;
      const tags = (block.replace(/\[SET:[^\]]+\]/,'').match(/#\S+/g)||[]);
      const all  = tags.join(' '); const e = all.replace(/'/g,"\\'");
      const c    = document.createElement('div'); c.className='rc'; c.style.animationDelay=bi*.1+'s';
      c.innerHTML = `<div class="rh"><span class="rt">${m[1].trim()} (${tags.length})</span><div class="ra"><button class="bg" onclick="window.App.copyText('${e}')">📋 Alle</button><button class="bg" onclick="window.App.saveItem('Hashtags: ${m[1].trim().replace(/'/g,"\\'")}','${e}')">⭐</button></div></div><div class="hc">${tags.map(t=>`<span class="ht2" onclick="window.App.copyText('${t}')">${t}</span>`).join('')}</div>`;
      ge('h-out').appendChild(c);
    });
    incStat('posts', 1); toast('#️⃣ Hashtags generiert!');
  } catch(e) { toast('❌ '+e.message, true); }
  load('h-prog','h-btn','h-sp', false);
}

// ── KALENDER ─────────────────────────────────────────────────
export async function genCal() {
  load('cal-prog','cal-btn','cal-sp', true); ge('cal-out').innerHTML = '';
  try {
    const raw  = await callGroq(`Monatsplan: Unternehmen:${vl('cal-b')||'allgemein'} Monat:${vl('cal-m')||'nächster Monat'} Posts/Woche:${vl('cal-f')}${bCtx()}\nJSON:[{"day":"Mo 1.","platform":"Instagram","topic":"...","format":"Bild","hook":"..."}]`);
    const plan = JSON.parse(raw.replace(/```json|```/g,'').trim());
    const pe   = plan.map(p=>`${p.day}|${p.platform}|${p.topic}`).join('\n').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
    ge('cal-out').innerHTML = `<div class="rc" style="animation:ci .4s var(--ease)"><div class="rh"><span class="rt">📅 ${vl('cal-m')||'Plan'}</span><div class="ra"><button class="bg" onclick="window.App.copyText('${pe}')">📋</button><button class="bg" onclick="window.App.saveItem('Kalender','${pe}')">⭐</button></div></div><div style="overflow-x:auto"><table class="ctbl"><thead><tr><th>Tag</th><th>Plattform</th><th>Thema</th><th>Format</th><th>Hook</th></tr></thead><tbody>${plan.map(p=>`<tr><td style="color:var(--a);font-weight:800">${p.day}</td><td style="color:var(--d)">${p.platform}</td><td>${p.topic}</td><td><span class="tag tag-vi" style="font-size:9px">${p.format}</span></td><td style="color:var(--tx2);font-style:italic;font-size:11px">${p.hook}</td></tr>`).join('')}</tbody></table></div></div>`;
    incStat('posts', 1); toast('📅 Kalender erstellt!');
  } catch(e) { toast('❌ '+e.message, true); }
  load('cal-prog','cal-btn','cal-sp', false);
}

// ── MITBEWERBER ───────────────────────────────────────────────
export async function genComp() {
  load('co-prog','co-btn','co-sp', true); ge('co-out').innerHTML = '';
  try {
    const raw = await callGroq(`Mitbewerber-Analyse: ${vl('co-own')||'allgemein'} Markt:${vl('co-mkt')} Mitbewerber:${vl('co-comps')||'typische'}\nJSON:{"positioning":"...","own":{"strengths":["..."],"opportunities":["..."]},"competitors":[{"name":"...","strength":"...","weakness":"...","score":70}],"recommendations":["..."]}`);
    const d   = JSON.parse(raw.replace(/```json|```/g,'').trim());
    const re  = (d.recommendations||[]).join('\n').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
    ge('co-out').innerHTML = `
      <div class="rc" style="animation:ci .4s var(--ease)"><div class="rh"><span class="rt">🎯 Positionierung</span></div><div style="font-size:14px;color:var(--tx);line-height:1.72;margin-bottom:12px">${d.positioning}</div><div class="g2"><div><div style="font-size:9px;color:var(--ok);font-weight:800;letter-spacing:1px;margin-bottom:7px">✅ STÄRKEN</div>${(d.own?.strengths||[]).map(s=>`<div style="font-size:12px;color:var(--tx2);padding:4px 0;border-bottom:1px solid var(--l)">• ${s}</div>`).join('')}</div><div><div style="font-size:9px;color:var(--d);font-weight:800;letter-spacing:1px;margin-bottom:7px">🚀 CHANCEN</div>${(d.own?.opportunities||[]).map(s=>`<div style="font-size:12px;color:var(--tx2);padding:4px 0;border-bottom:1px solid var(--l)">• ${s}</div>`).join('')}</div></div></div>
      <div class="rc" style="animation:ci .4s .1s var(--ease) both"><div class="rh"><span class="rt">🔍 Mitbewerber</span></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${(d.competitors||[]).map(c=>`<div style="background:var(--s2);border:1px solid var(--l);border-radius:9px;padding:12px"><div style="font-size:12px;font-weight:800;margin-bottom:7px">${c.name}</div><div style="font-size:9px;color:var(--mu);margin-bottom:3px">Marktpräsenz</div><div style="height:5px;background:var(--l);border-radius:3px;overflow:hidden;margin-bottom:7px"><div style="height:100%;width:${c.score||50}%;background:linear-gradient(90deg,var(--a),var(--d));border-radius:3px"></div></div><div style="font-size:11px;color:var(--ok);margin-bottom:3px">✅ ${c.strength}</div><div style="font-size:11px;color:var(--er)">⚠️ ${c.weakness}</div></div>`).join('')}</div></div>
      <div class="rc" style="animation:ci .4s .2s var(--ease) both"><div class="rh"><span class="rt">💡 Empfehlungen</span><button class="bg" onclick="window.App.saveItem('Mitbewerber-Analyse','${re}')">⭐</button></div>${(d.recommendations||[]).map((r,i)=>`<div style="display:flex;gap:9px;padding:8px 0;border-bottom:1px solid var(--l)"><span style="font-size:14px;flex-shrink:0">${['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣'][i]||'•'}</span><span style="font-size:12px;color:var(--tx2);line-height:1.65">${r}</span></div>`).join('')}</div>`;
    incStat('posts', 1); toast('🔍 Analyse fertig!');
  } catch(e) { toast('❌ '+e.message, true); }
  load('co-prog','co-btn','co-sp', false);
}

// ── SEO ───────────────────────────────────────────────────────
export async function genSEO() {
  const kw = vl('seo-kw') || vl('seo-site');
  if (!kw) { toast('Keyword eingeben', true); return; }
  load('seo-prog','seo-btn','seo-sp', true); ge('seo-out').innerHTML = '';
  const tasks2 = [...document.querySelectorAll('.seoTask.on')].map(c => c.textContent.trim());
  try {
    const raw = await callGroq(`SEO für: ${vl('seo-site')||kw}\nKeyword: ${kw}\nBranche: ${vl('seo-ind')||'allgemein'}\nAufgaben: ${tasks2.length?tasks2.join(', '):'Alles'}${bCtx()}\n\nFormat:\nMETA-TITEL: ...\nMETA-DESC: ...\nSCORE: 75\nKEYWORDS: kw1, kw2, kw3, kw4, kw5\nBLOG: thema1|thema2|thema3\nTIPPS:\n- Tipp 1\n- Tipp 2\n- Tipp 3`);
    const mt   = (raw.match(/META-TITEL:\s*(.+)/)  || [])[1] || '';
    const md   = (raw.match(/META-DESC:\s*(.+)/)   || [])[1] || '';
    const sc   = parseInt((raw.match(/SCORE:\s*(\d+)/)     || [])[1]) || 72;
    const kws  = ((raw.match(/KEYWORDS:\s*(.+)/)   || [])[1] || '').split(',').map(k=>k.trim()).filter(Boolean);
    const blogs= ((raw.match(/BLOG:\s*(.+)/)        || [])[1] || '').split('|').map(b=>b.trim()).filter(Boolean);
    const tips = [...raw.matchAll(/^- (.+)$/gm)].map(m=>m[1]);
    const r    = 44, ci = 2*Math.PI*r, off = ci*(1-Math.min(100,sc)/100);
    const allE = raw.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
    ge('seo-out').innerHTML = `
      <div class="rc" style="animation:ci .4s var(--ease)">
        <div class="rh"><span class="rt">🔎 SEO · ${kw}</span><div class="ra"><button class="bg" onclick="window.App.copyText('${allE}')">📋</button><button class="bg" onclick="window.App.saveItem('SEO: ${kw.replace(/'/g,"\\'")}','${allE}')">⭐</button></div></div>
        <div class="seo-score">
          <div class="seo-ring"><svg width="60" height="60" viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--l2)" stroke-width="10"/><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--a)" stroke-width="10" stroke-dasharray="${ci.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" stroke-linecap="round"/></svg><div class="seo-ring-lbl">${Math.min(100,sc)}</div></div>
          <div><div style="font-size:16px;font-weight:800;margin-bottom:4px">SEO-Score: ${Math.min(100,sc)}/100</div><div style="font-size:12px;color:var(--mu)">${sc>=75?'✅ Gut':sc>=50?'⚠️ Mittel':'❌ Optimierung nötig'}</div></div>
        </div>
        ${mt?`<div style="margin-bottom:10px"><div style="font-size:9px;color:var(--mu);font-weight:800;letter-spacing:1px;margin-bottom:3px">META-TITEL (${mt.length} Z.)</div><div style="font-size:14px;font-weight:800;color:var(--tx)">${mt}</div></div>`:''}
        ${md?`<div style="margin-bottom:10px"><div style="font-size:9px;color:var(--mu);font-weight:800;letter-spacing:1px;margin-bottom:3px">META-DESCRIPTION (${md.length} Z.)</div><div style="font-size:13px;color:var(--tx2)">${md}</div></div>`:''}
        ${kws.length?`<div style="margin-bottom:10px"><div style="font-size:9px;color:var(--mu);font-weight:800;letter-spacing:1px;margin-bottom:5px">KEYWORDS</div><div style="display:flex;gap:5px;flex-wrap:wrap">${kws.map(k=>`<span class="tag tag-li" style="cursor:pointer" onclick="window.App.copyText('${k}')">${k}</span>`).join('')}</div></div>`:''}
        ${blogs.length?`<div style="margin-bottom:10px"><div style="font-size:9px;color:var(--mu);font-weight:800;letter-spacing:1px;margin-bottom:5px">BLOG-IDEEN</div>${blogs.map(b=>`<div style="font-size:12px;color:var(--tx2);padding:5px 0;border-bottom:1px solid var(--l)">📝 ${b}</div>`).join('')}</div>`:''}
        ${tips.length?`<div><div style="font-size:9px;color:var(--mu);font-weight:800;letter-spacing:1px;margin-bottom:5px">TIPPS</div>${tips.slice(0,5).map((t,i)=>`<div style="display:flex;gap:9px;padding:8px 0;border-bottom:1px solid var(--l)"><span style="font-size:13px;flex-shrink:0">${['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣'][i]}</span><span style="font-size:12px;color:var(--tx2)">${t}</span></div>`).join('')}</div>`:''}
      </div>`;
    incStat('posts', 1); toast('🔎 SEO-Analyse fertig!');
  } catch(e) { toast('❌ '+e.message, true); }
  load('seo-prog','seo-btn','seo-sp', false);
}

// ── INVOICE ───────────────────────────────────────────────────
export async function genInvoice() {
  const to = vl('inv-to'); if (!to) { toast('Empfänger eingeben', true); return; }
  const amt = parseFloat(vl('inv-amount').replace(/[^0-9.]/g,'')) || 0;
  const vat = parseFloat(vl('inv-vat')) || 8.1;
  const frm = vl('inv-from') || 'MarketMind Agency';
  const typ = vl('inv-type');
  const days= vl('inv-days') || '30';
  load('inv-prog','inv-btn','inv-sp', true);
  try {
    const rawDesc = vl('inv-desc');
    let desc = rawDesc;
    if (rawDesc) {
      desc = await callGroq(`Schreibe eine professionelle Leistungsbeschreibung für eine ${typ} auf Deutsch.\nEingabe: ${rawDesc}\nNur die polierte Beschreibung, max 3 Sätze.`);
    }
    const vatAmt = amt*(vat/100), total = amt+vatAmt;
    const today  = new Date(); const dueDate = new Date(today); dueDate.setDate(dueDate.getDate()+parseInt(days));
    const fmt    = d => d.toLocaleDateString('de-CH');
    const prefix = typ==='Rechnung'?'RE':typ==='Angebot'?'AN':'PF';
    const invNr  = `${prefix}-${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}${String(Math.floor(Math.random()*99)+1).padStart(2,'0')}`;
    ge('inv-out').innerHTML = `
      <div class="rc" style="animation:ci .4s var(--ease)">
        <div class="rh"><span class="rt">🧾 ${typ} ${invNr}</span><div class="ra"><button class="bg" onclick="window.print()">🖨️ Drucken</button><button class="bg" onclick="window.App.saveItem('${typ} ${invNr}','${(invNr+' '+to+' CHF '+total.toFixed(2)).replace(/'/g,"\\'")}')" >⭐</button></div></div>
        <div class="inv-preview">
          <div class="inv-hdr"><div><div class="inv-logo">${frm}</div><div style="font-size:12px;color:#888;margin-top:4px">Marketing Agentur</div></div><div class="inv-nr"><div style="font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#888;margin-bottom:4px">${typ}</div><div class="nr">${invNr}</div><div class="dt">Datum: ${fmt(today)}</div></div></div>
          <div class="inv-parties"><div class="inv-party"><h4>Von</h4><p><strong>${frm}</strong><br>Schweiz</p></div><div class="inv-party"><h4>An</h4><p><strong>${to}</strong></p></div></div>
          <table class="inv-table"><thead><tr><th>Pos.</th><th>Leistung</th><th style="text-align:right">Betrag</th></tr></thead><tbody><tr><td>1</td><td>${desc||rawDesc||'Marketing-Dienstleistungen'}</td><td style="text-align:right">CHF ${amt.toFixed(2)}</td></tr></tbody></table>
          <div class="inv-total"><div class="inv-total-row"><span>Netto</span><span>CHF ${amt.toFixed(2)}</span></div><div class="inv-total-row"><span>MwSt. ${vat}%</span><span>CHF ${vatAmt.toFixed(2)}</span></div><div class="inv-total-row grand"><span>Total</span><span>CHF ${total.toFixed(2)}</span></div></div>
          <div class="inv-footer">${typ==='Rechnung'?`Zahlbar innert ${days} Tagen · Fällig: ${fmt(dueDate)}`:`Angebot gültig 30 Tage · ${fmt(today)}`}<br>Vielen Dank!</div>
        </div>
      </div>`;
    incStat('posts', 1); toast('🧾 '+typ+' erstellt!');
  } catch(e) { toast('❌ '+e.message, true); }
  load('inv-prog','inv-btn','inv-sp', false);
}

// ── REPORTING ─────────────────────────────────────────────────
export async function genReport() {
  const period = vl('rep-period'), data2 = vl('rep-data');
  const focus  = qs('.repFocus.on')?.textContent || 'Komplett-Report';
  load('rep-prog','rep-btn','rep-sp', true); ge('rep-out').innerHTML = '';
  try {
    const raw  = await callGroq(`Professioneller Marketing-${focus}:\nZeitraum: ${period}\nDaten: ${data2||'Keine Rohdaten – erstelle Beispiel-Empfehlungen.'}${bCtx()}\n\nStrukturiere professionell mit Highlights und konkreten nächsten Schritten.`);
    const resc = raw.replace(/'/g,"\\'").replace(/\n/g,'\\n');
    ge('rep-out').innerHTML = `<div class="rc" style="animation:ci .4s var(--ease)"><div class="rh"><span class="rt">📊 ${focus}</span><div class="ra"><button class="bg" onclick="window.App.copyText('${resc}')">📋</button><button class="bg" onclick="window.App.saveItem('Report: ${focus.replace(/'/g,"\\'")}','${resc}')">⭐</button></div></div><div class="rb">${raw.replace(/\n/g,'<br>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')}</div></div>`;
    incStat('posts', 1); toast('📊 Report generiert!');
  } catch(e) { toast('❌ '+e.message, true); }
  load('rep-prog','rep-btn','rep-sp', false);
}

// ── WEB PUBLISH ───────────────────────────────────────────────
export function updatePubFields() {}

export async function genPublish() {
  const typ = vl('pub-type'), topic = vl('pub-topic');
  if (!topic) { toast('Thema eingeben', true); return; }
  load('pub-prog','pub-btn','pub-sp', true); ge('pub-out').innerHTML = '';
  const lenMap = { kurz:'~300 Wörter', mittel:'~600 Wörter', lang:'~1000 Wörter' };
  const typMap = { blogpost:'Blog-Artikel mit H1/H2/H3', landingpage:'Landing-Page-Abschnitt mit Headline + CTA', about:'Über-uns-Text', service:'Leistungsbeschreibung', pressrelease:'Pressemitteilung', newsletter_html:'Newsletter-Text' };
  try {
    const raw  = await callGroq(`Erstelle ${typMap[typ]||typ} auf Deutsch.\nThema: ${topic}\nZielgruppe: ${vl('pub-audience')||'allgemein'}\nKeywords: ${vl('pub-kw')||'–'}\nLänge: ${lenMap[vl('pub-len')]||'mittel'}\nZusatz: ${vl('pub-extra')||'–'}${bCtx()}\n\nVerwende ** für Fettschrift und ## für Überschriften.`);
    const fmtd = raw.replace(/^## (.+)$/gm,'<h2 style="font-size:18px;font-weight:800;color:var(--tx);margin:16px 0 8px">$1</h2>').replace(/^# (.+)$/gm,'<h1 style="font-size:22px;font-weight:800;color:var(--tx);margin:0 0 14px">$1</h1>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n\n/g,'</p><p style="margin:0 0 10px;line-height:1.75;color:var(--tx2)">');
    const rawE = raw.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
    const typeLabel = {blogpost:'Blog',landingpage:'Landing Page',about:'Über uns',service:'Leistung',pressrelease:'Pressemitteilung',newsletter_html:'Newsletter'}[typ]||typ;
    const cleanHtml = `<!DOCTYPE html>\n<html lang="de">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<meta name="description" content="${topic.substring(0,155)}">\n${vl('pub-kw')?`<meta name="keywords" content="${vl('pub-kw')}">`:'  '}\n<title>${topic}</title>\n<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.7;color:#333}h1{font-size:2em;margin-bottom:.5em}h2{font-size:1.5em;margin:1.5em 0 .5em}p{margin:0 0 1em}ul{margin:0 0 1em;padding-left:1.5em}li{margin:.3em 0}</style>\n</head>\n<body>\n<article><p>${raw.replace(/^## (.+)$/gm,'</p><h2>$1</h2><p>').replace(/^# (.+)$/gm,'</p><h1>$1</h1><p>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>')}</p></article>\n</body>\n</html>`;
    window._lastPubHtml = cleanHtml;
    ge('pub-out').innerHTML = `
      <div class="rc" style="animation:ci .4s var(--ease)">
        <div class="rh"><span class="rt">🌐 ${typeLabel}</span><div class="ra"><button class="bg" onclick="window.App.copyText('${rawE}')">📋 Text</button><button class="bg" onclick="window.App.copyText(window._lastPubHtml)">💻 HTML</button><button class="bg" onclick="window.App.downloadHtml()">💾 Download</button><button class="bg" onclick="window.App.saveItem('Web: ${typeLabel}','${rawE}')">⭐</button></div></div>
        <div style="background:var(--s2);border:1px solid var(--l);border-radius:10px;padding:18px;margin-bottom:12px"><p style="margin:0 0 10px;line-height:1.75;color:var(--tx2)">${fmtd}</p></div>
        <div style="background:var(--bg1);border:1px solid var(--l);border-radius:10px;padding:12px"><div style="font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--mu);margin-bottom:6px">HTML-CODE</div><div style="font-size:11px;color:var(--d);font-family:monospace;white-space:pre-wrap;max-height:180px;overflow-y:auto;background:var(--bg);padding:10px;border-radius:7px">${cleanHtml.replace(/</g,'&lt;').replace(/>/g,'&gt;').substring(0,800)}…</div></div>
      </div>`;
    incStat('posts', 1); toast('🌐 Content generiert!');
  } catch(e) { toast('❌ '+e.message, true); }
  load('pub-prog','pub-btn','pub-sp', false);
}

// ── WORKFLOW ENGINE ───────────────────────────────────────────
let _wfClients = [];

export function setWfClients(c) { _wfClients = c; }

export async function sendWf() {
  const inp = ge('wf-in'), msg = inp.value.trim();
  if (!msg) return;
  inp.value = '';
  addWfMsg('u', msg);
  ge('wf-btn').disabled = true; ge('wf-sp').style.display = 'inline-block';

  try {
    addWfMsg('a', '🧠 <strong>Analysiere und erstelle Workflow-Plan…</strong>');
    const raw = await callGroq(msg + bCtx() + '\n\nErstelle den Workflow-Plan als JSON.', WF_SYSTEM);
    const jm  = raw.match(/\{[\s\S]*\}/);
    let plan;
    try { plan = JSON.parse(jm ? jm[0] : raw); }
    catch { throw new Error('Plan-Erstellung fehlgeschlagen. Erneut versuchen.'); }

    updateLastWfMsg(`✅ <strong>Plan:</strong> ${plan.goal}<br><br>Starte ${plan.steps.length} Schritte…`);
    showWfPlan(plan.steps);

    const results = {};
    for (const step of plan.steps) {
      setWfStepSt(step.id, 'run', '⟳ Läuft…');
      try {
        results[step.id] = await execWfStep(step, msg);
        setWfStepSt(step.id, 'done', '✓ Fertig');
      } catch(e) {
        setWfStepSt(step.id, 'err', '✗ Fehler');
        results[step.id] = { error: e.message };
      }
    }
    renderWfOutput(plan, results);
    incStat('wf', 1);
    addWfMsg('a', `✅ <strong>Fertig!</strong> ${Object.values(results).filter(r=>!r.error).length}/${plan.steps.length} Schritte erfolgreich.<br><br>Noch etwas anpassen?`);
    toast('⚡ Workflow fertig!');
  } catch(e) {
    updateLastWfMsg('❌ <strong>Fehler:</strong> ' + e.message);
    toast('❌ '+e.message, true);
  }
  ge('wf-btn').disabled = false; ge('wf-sp').style.display = 'none';
}

async function execWfStep(step, msg) {
  switch(step.type) {
    case 'generate_post': {
      const tx = await callGroq(`${step.platform||'Instagram'}-Post:\n${msg}\nTon:${step.tone||'Freundlich'}${bCtx()}\nNur Text.`);
      incStat('posts', 1); return { type:'text', platform:step.platform||'Social', text:tx };
    }
    case 'generate_image': {
      const selM = window.App?.getSelImgM?.() || 'google/gemini-2.5-flash-image-preview';
      try { const imgs=await callORImage(`${step.imagePrompt||step.desc}. Photorealistic, marketing quality.`, selM); incStat('imgs',1); return { type:'image', url:imgs[0]||null }; }
      catch(e){ return { type:'image', error:e.message, url:null }; }
    }
    case 'generate_hashtags': {
      const tx = await callGroq(`20 Hashtags für ${step.platform||'Instagram'}: ${msg}. Nur Hashtags.`);
      return { type:'hashtags', tags:(tx.match(/#\S+/g)||[]).slice(0,20) };
    }
    case 'generate_email': {
      const raw=await callGroq(`E-Mail:\n${msg}${bCtx()}\nBETREFF:...\n---\nE-MAIL:\n[Text]`);
      incStat('posts',1); return { type:'email', subject:(raw.match(/BETREFF:\s*(.+)/)||[])[1]||'Betreff', body:(raw.match(/E-MAIL:\n([\s\S]+?)(?:---|$)/)||[])[1]||raw };
    }
    case 'generate_ads': {
      const raw=await callGroq(`2 Ads:\n${msg}${bCtx()}\n[AD: Emotional]\nText\n---\n[AD: Rational]\nText`);
      incStat('posts',1); return { type:'ads', raw };
    }
    case 'generate_seo': {
      const kw=step.keyword||msg;
      const raw=await callGroq(`SEO für "${kw}"${bCtx()}\nMETA-TITEL:...\nMETA-DESC:...\nKEYWORDS: kw1,kw2...\nBLOG: thema1|thema2`);
      incStat('posts',1); return { type:'seo', raw };
    }
    case 'generate_invoice': {
      const tx=await callGroq(`Angebotstext für Marketing:\n${msg}${bCtx()}\nNur Angebotstext.`);
      incStat('posts',1); return { type:'invoice_text', text:tx };
    }
    default: return { type:'skip' };
  }
}

function addWfMsg(role, html) {
  const msgs = ge('wf-msgs');
  const d = document.createElement('div'); d.className=`wfm ${role}`;
  d.innerHTML = `<div class="wfb">${html}</div>`;
  msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
}
function updateLastWfMsg(html) {
  const ms = ge('wf-msgs').querySelectorAll('.wfm.a');
  const l  = ms[ms.length-1]; if(l) l.querySelector('.wfb').innerHTML = html;
}
function showWfPlan(steps) {
  const p = ge('wf-plan'); p.style.display = 'block';
  const ico = { generate_post:'📝',generate_image:'🎨',generate_hashtags:'#️⃣',generate_email:'✉️',generate_ads:'📣',generate_seo:'🔎',generate_invoice:'🧾',compose:'🔗' };
  ge('wf-steps').innerHTML = steps.map(s=>`<div class="wfs pending" id="wf-s-${s.id}"><div class="wfs-ico">${ico[s.type]||'⚙️'}</div><div style="flex:1"><div class="wfs-name">${s.name}</div><div class="wfs-sub">${s.desc}</div></div><span class="wfs-st" id="wf-ss-${s.id}">⏳</span></div>`).join('');
}
function setWfStepSt(id, cls, txt) {
  const e=ge(`wf-s-${id}`), s=ge(`wf-ss-${id}`);
  if(e) e.className=`wfs ${cls}`; if(s) s.textContent=txt;
}
function renderWfOutput(plan, results) {
  const out=ge('wf-out'); const tr=Object.values(results).find(r=>r.type==='text'); const ir=Object.values(results).find(r=>r.type==='image'); const hr=Object.values(results).find(r=>r.type==='hashtags'); const er=Object.values(results).find(r=>r.type==='email'); const ar=Object.values(results).find(r=>r.type==='ads'); const sr=Object.values(results).find(r=>r.type==='seo');
  let html='<div style="display:grid;gap:12px;margin-top:14px">';
  if(tr||ir){
    const plat=tr?.platform||'Social'; const cap=tr?.text||''; const ht=[...(cap.match(/#\S+/g)||[]),...(hr?.tags||[])].slice(0,20);
    const nmB=typeof bCtx==='function'?'':plan.goal; const capE=cap.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n'); const htE=ht.join(' ').replace(/'/g,"\\'");
    html+=`<div class="pp"><div class="pph"><div class="ppav">M</div><div><div class="ppnm">${plan.goal.substring(0,30)}</div><div class="pppl">${plat}</div></div></div>`;
    if(ir?.url) html+=`<div class="ppimg"><img src="${ir.url}" alt="KI Bild"><div class="ppbrand"><div><div class="ppbrand-nm">${plan.goal.substring(0,20)}</div></div><a href="${ir.url}" download="post.png" style="font-size:10px;font-weight:800;color:var(--a);text-decoration:none;padding:4px 9px;background:var(--ag);border-radius:100px;border:1px solid rgba(200,241,53,.2)">💾</a></div></div>`;
    html+=`<div class="ppbody"><div class="ppcap">${cap.replace(/#\S+/g,'').trim().replace(/</g,'&lt;')}</div>${ht.length?`<div class="pphts">${ht.map(t=>`<span class="ppht" onclick="window.App.copyText('${t}')">${t}</span>`).join('')}</div>`:''}</div><div class="ppact"><button class="bp" style="font-size:11px;padding:7px 13px" onclick="window.App.copyText('${capE}\\n\\n${htE}')">📋 Kopieren</button><button class="bs" style="font-size:11px" onclick="window.App.saveItem('Post','${capE}')">⭐</button></div></div>`;
  }
  if(er){const se=er.subject.replace(/'/g,"\\'");const be=er.body.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');html+=`<div class="rc" style="animation:ci .4s .1s var(--ease) both"><div class="rh"><span class="rt">✉️ E-Mail</span><div class="ra"><button class="bg" onclick="window.App.copyText('${se}\\n\\n${be}')">📋</button><button class="bg" onclick="window.App.saveItem('E-Mail','${be}')">⭐</button></div></div><div style="margin-bottom:10px"><div style="font-size:9px;color:var(--mu);font-weight:800;letter-spacing:1px;margin-bottom:3px">BETREFF</div><div style="font-size:15px;font-weight:800">${er.subject}</div></div><div class="ep"><p>${er.body}</p></div></div>`;}
  if(ar){ar.raw.split('---').filter(b=>b.trim()).forEach((block,i)=>{const m=block.match(/\[AD:\s*(.+?)\]/);if(!m)return;const tx=block.replace(/\[AD:[^\]]+\]/,'').trim();if(!tx)return;const e=tx.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');html+=`<div class="rc" style="animation:ci .4s ${0.15+i*.1}s var(--ease) both"><div class="rh"><span class="rt">📣 ${m[1].trim()}</span><div class="ra"><button class="bg" onclick="window.App.copyText('${e}')">📋</button><button class="bg" onclick="window.App.saveItem('Ad','${e}')">⭐</button></div></div><div class="rb">${tx}</div></div>`;});}
  if(sr){const mt=(sr.raw.match(/META-TITEL:\s*(.+)/)||[])[1]||'';const kws=((sr.raw.match(/KEYWORDS:\s*(.+)/)||[])[1]||'').split(',').map(k=>k.trim());const e=sr.raw.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');html+=`<div class="rc" style="animation:ci .4s .2s var(--ease) both"><div class="rh"><span class="rt">🔎 SEO</span><div class="ra"><button class="bg" onclick="window.App.copyText('${e}')">📋</button><button class="bg" onclick="window.App.saveItem('SEO','${e}')">⭐</button></div></div>${mt?`<div style="font-size:14px;font-weight:800;margin-bottom:8px">${mt}</div>`:''}<div style="display:flex;gap:5px;flex-wrap:wrap">${kws.map(k=>`<span class="tag tag-li">${k}</span>`).join('')}</div></div>`;}
  html+='</div>'; out.innerHTML=html;
}

// ── AUTOPILOT (re-export from inline logic) ───────────────────
export { runAutopilot, loadClientBrief, populateAutopilotClients } from './autopilot.js';

// ── IMPROVE TEXT ──────────────────────────────────────────────
export async function improveText() {
  const txt = vl('imp-text'); if (!txt) { toast('Text eingeben', true); return; }
  const focus = qs('.impFocus.on')?.textContent || 'Tonalität anpassen';
  load('imp-prog','imp-btn','imp-sp', true); ge('imp-out').innerHTML = '';
  try {
    const raw = await callGroq(`Verbessere diesen Marketing-Text:\n"${txt}"\n\nFokus: ${focus}${bCtx()}\n\nNur den verbesserten Text.`);
    const esc = raw.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
    ge('imp-out').innerHTML = `<div class="rc" style="animation:ci .35s var(--ease)"><div class="rh"><span class="rt">✨ Verbessert · ${focus}</span><div class="ra"><button class="bg" onclick="window.App.copyText('${esc}')">📋</button><button class="bg" onclick="ge('fb-text').value='${esc}';window.App.toast('In Feedback geladen')">📝 Bewerten</button><button class="bg" onclick="window.App.saveItem('Verbesserter Text','${esc}')">⭐</button></div></div><div class="rb">${raw}</div></div>`;
    toast('✨ Text verbessert!');
  } catch(e) { toast('❌ '+e.message, true); }
  load('imp-prog','imp-btn','imp-sp', false);
}

// Export html download helper
export function downloadHtml() {
  if (!window._lastPubHtml) { toast('Erst generieren', true); return; }
  const b=new Blob([window._lastPubHtml],{type:'text/html;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='content.html'; a.click(); toast('💾 HTML heruntergeladen!');
}

// Export presets
export const PRESETS = [
  {ico:'📸',nm:'Instagram Post + Bild',sub:'Caption + KI-Bild + Hashtags',tags:['Text','Bild','#️⃣'],col:'li',p:'Erstelle einen vollständigen Instagram-Post mit Caption, Bild und Hashtags.'},
  {ico:'💼',nm:'LinkedIn B2B Post',sub:'Professionell + Bild',tags:['LinkedIn','Bild'],col:'vi',p:'Erstelle professionellen LinkedIn-Post mit Bild und Hashtags für B2B.'},
  {ico:'🛍️',nm:'Produkt-Launch',sub:'Post + Ads + Bild',tags:['Post','Ads','Bild'],col:'te',p:'Erstelle eine Produkt-Launch-Kampagne: Instagram-Post, Google Ads und Bild.'},
  {ico:'📧',nm:'E-Mail + Social',sub:'Newsletter + Posts',tags:['E-Mail','Social'],col:'vi',p:'Erstelle E-Mail-Kampagne und passende Social-Posts für dieselbe Aktion.'},
  {ico:'🔎',nm:'SEO-Paket',sub:'Meta + Keywords + Blog',tags:['SEO','Content'],col:'te',p:'Erstelle SEO-Paket: Meta-Titel, Description, Keywords und Blog-Ideen.'},
  {ico:'📅',nm:'Wochenplan',sub:'7 Posts mit Bildern',tags:['Kalender','Bilder'],col:'li',p:'Plane 7 Social-Media-Posts für nächste Woche mit Bildern.'},
  {ico:'🎯',nm:'Werbekampagne',sub:'Google + Meta Ads',tags:['Google','Meta'],col:'vi',p:'Erstelle Werbekampagne mit Google Ads und Facebook Ads, je 3 Varianten.'},
  {ico:'🧾',nm:'Kunden-Angebot',sub:'Angebot + Begleitmail',tags:['Angebot','E-Mail'],col:'te',p:'Erstelle professionelles Marketing-Angebot mit Begleit-E-Mail.'},
];

export function renderPresets() {
  const g = ge('preset-grid'); if(!g) return;
  g.innerHTML = PRESETS.map((p,i) => `
    <div class="pcard" onclick="window.App.usePreset(${i})">
      <div class="pico">${p.ico}</div>
      <div class="pnm">${p.nm}</div>
      <div class="psub">${p.sub}</div>
      <div class="ptags">${p.tags.map((t,j)=>`<span class="ptag ${j===0?p.col:''}">${t}</span>`).join('')}</div>
    </div>`).join('');
}

export function usePreset(i) {
  ge('wf-in').value = PRESETS[i].p;
  sendWf();
}
