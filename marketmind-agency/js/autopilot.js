// autopilot.js - Kunden-Autopilot
import { callGroq, callORImage } from './api.js';
import { ge, vl, qs, tc, toast, bCtx, saveItem, incStat, gp } from './app.js';
import { dbSave } from './firebase.js';

let _schedule = [];
export function setSchedule(s) { _schedule = s; }

export function loadClientBrief() {}
export function populateAutopilotClients() {}

export async function runAutopilot() {
  const month  = vl('ap-month');
  const theme  = vl('ap-theme');
  const freq   = vl('ap-freq');
  const plat   = vl('ap-plat');
  const extra  = vl('ap-extra');
  const clId   = ge('ap-client')?.value || null;
  const tasks  = [...document.querySelectorAll('.apTask.on')].map(c => c.textContent.trim());

  if (!month) { toast('Monat eingeben', true); return; }
  if (!tasks.length) { toast('Mindestens eine Aufgabe wählen', true); return; }

  const fullCtx = bCtx(clId);
  ge('ap-btn').disabled = true; ge('ap-sp').style.display = 'inline-block';
  ge('ap-out').innerHTML = '';
  ge('ap-progress-card').style.display = 'block';

  const STEPS = [];
  if(tasks.find(t=>t.includes('Kalender')))   STEPS.push({id:'cal', icon:'📅',label:'Content-Kalender',type:'calendar'});
  if(tasks.find(t=>t.includes('Posts')))      STEPS.push({id:'posts',icon:'📱',label:'5 Posts',type:'posts'});
  if(tasks.find(t=>t.includes('Bilder')))     STEPS.push({id:'imgs',icon:'🎨',label:'Bilder',type:'images'});
  if(tasks.find(t=>t.includes('Newsletter'))) STEPS.push({id:'mail',icon:'✉️',label:'Newsletter',type:'email'});
  if(tasks.find(t=>t.includes('Hashtags')))   STEPS.push({id:'ht',icon:'#️⃣',label:'Hashtags',type:'hashtags'});
  if(tasks.find(t=>t.includes('Report')))     STEPS.push({id:'rep',icon:'📊',label:'Report-Vorlage',type:'report'});

  ge('ap-progress-steps').innerHTML = STEPS.map(s => `
    <div class="wfs pending" id="ap-s-${s.id}">
      <div class="wfs-ico">${s.icon}</div>
      <div style="flex:1"><div class="wfs-name">${s.label}</div></div>
      <span class="wfs-st" id="ap-ss-${s.id}">⏳</span>
    </div>`).join('');

  const results = {}; const bar = ge('ap-progress-bar');
  const base = `Monat:${month}|Thema:${theme||'allgemein'}|Plattform:${plat}|Zusatz:${extra||'–'}${fullCtx}`;

  for (let i=0; i<STEPS.length; i++) {
    const step = STEPS[i];
    ge(`ap-s-${step.id}`).className='wfs run'; ge(`ap-ss-${step.id}`).textContent='⟳';
    bar.style.width = Math.round((i/STEPS.length)*100)+'%';
    try {
      results[step.id] = await runStep(step, base, plat, freq, theme, month, clId);
      ge(`ap-s-${step.id}`).className='wfs done'; ge(`ap-ss-${step.id}`).textContent='✓';
    } catch(e) {
      ge(`ap-s-${step.id}`).className='wfs err'; ge(`ap-ss-${step.id}`).textContent='✗';
      results[step.id] = { error:e.message };
    }
  }
  bar.style.width='100%';

  // Render
  renderApOutput(results, month, clId);
  incStat('wf', 1);
  toast('🚀 Autopilot fertig!');
  ge('ap-btn').disabled=false; ge('ap-sp').style.display='none';
}

async function runStep(step, base, plat, freq, theme, month, clId) {
  const selM = window.App?.getSelImgM?.() || 'google/gemini-2.5-flash-image-preview';
  switch(step.type) {
    case 'calendar': {
      const raw=await callGroq(`Content-Kalender ${freq} Posts/Woche.\n${base}\nJSON:[{"day":"Mo 2.","platform":"Instagram","topic":"...","format":"Bild","hook":"..."}]`);
      return { type:'calendar', plan:JSON.parse(raw.replace(/```json|```/g,'').trim()) };
    }
    case 'posts': {
      const raw=await callGroq(`5 verschiedene ${plat}-Posts.\n${base}\n[POST: 1]\nCaption\n---\n[POST: 2]\n...\n---`);
      incStat('posts',5); return { type:'posts', raw };
    }
    case 'images': {
      const pr=await callGroq(`Englischer Bildprompt für: ${theme||'business marketing'}. Nur den Prompt.`);
      try { const imgs=await callORImage(pr.trim()+'. Photorealistic marketing quality.', selM); incStat('imgs',1); return {type:'images',urls:imgs,prompt:pr}; }
      catch(e){ return {type:'images',error:e.message,urls:[]}; }
    }
    case 'email': {
      const raw=await callGroq(`Newsletter für ${month}.\n${base}\nBETREFF:...\n---\nE-MAIL:\n[Text]`);
      incStat('posts',1);
      return { type:'email', subject:(raw.match(/BETREFF:\s*(.+)/)||[])[1]||'Newsletter', body:(raw.match(/E-MAIL:\n([\s\S]+?)(?:---|$)/)||[])[1]||raw };
    }
    case 'hashtags': {
      const raw=await callGroq(`3 Hashtag-Sets für ${plat}: "${theme||'business'}".\n[SET: Reichweite]\n#tag...\n---\n[SET: Nische]\n...\n---\n[SET: Lokal]\n...\n---`);
      return { type:'hashtags', raw };
    }
    case 'report': {
      const raw=await callGroq(`Report-Vorlage für ${month}.\n${base}\nStruktur: Executive Summary, KPIs, Empfehlungen.`);
      incStat('posts',1); return { type:'report', raw };
    }
  }
}

function renderApOutput(results, month, clId) {
  const out=ge('ap-out');
  let html=`<div style="margin-top:14px"><div style="background:linear-gradient(135deg,var(--ag),var(--bg3));border:1px solid rgba(200,241,53,.2);border-radius:14px;padding:18px;margin-bottom:14px;display:flex;align-items:center;gap:14px"><div style="font-size:32px">🚀</div><div><div style="font-size:16px;font-weight:800">${month} — Autopilot fertig!</div><div style="font-size:12px;color:var(--tx2);margin-top:3px">${Object.values(results).filter(r=>!r.error).length} von ${Object.keys(results).length} Modulen erfolgreich</div></div></div><div style="display:grid;gap:12px">`;

  if(results.cal?.plan){
    const plan=results.cal.plan; const pe=plan.map(p=>`${p.day}|${p.platform}|${p.topic}`).join('\n').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
    html+=`<div class="rc"><div class="rh"><span class="rt">📅 Kalender · ${plan.length} Posts</span><div class="ra"><button class="bg" onclick="window.App.copyText('${pe}')">📋</button><button class="bg" onclick="window.App.saveItem('Kalender ${month.replace(/'/g,"\\'")}','${pe}')">⭐</button></div></div><div style="overflow-x:auto"><table class="ctbl"><thead><tr><th>Tag</th><th>Plattform</th><th>Thema</th><th>Hook</th></tr></thead><tbody>${plan.map(p=>`<tr><td style="color:var(--a);font-weight:800;white-space:nowrap">${p.day}</td><td style="color:var(--d)">${p.platform}</td><td>${p.topic}</td><td style="color:var(--tx2);font-style:italic;font-size:11px">${p.hook}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  if(results.posts?.raw){
    const blocks=results.posts.raw.split('---').filter(b=>b.trim());
    html+=`<div class="rc"><div class="rh"><span class="rt">📱 5 Posts</span></div><div style="display:grid;gap:7px">`;
    blocks.forEach(block=>{
      const m=block.match(/\[POST:\s*(.+?)\]/);if(!m)return;
      const tx=block.replace(/\[POST:[^\]]+\]/,'').trim();if(!tx)return;
      const e=tx.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
      html+=`<div style="background:var(--s2);border:1px solid var(--l);border-radius:9px;padding:10px"><div class="flb" style="margin-bottom:6px"><span class="tag tag-li" style="font-size:9px">${m[1].trim()}</span><div class="ra"><button class="bg" style="font-size:10px;padding:2px 7px" onclick="window.App.copyText('${e}')">📋</button><button class="bg" style="font-size:10px;padding:2px 7px" onclick="ge('fb-text').value='${e}';window.App.gp('pg-feedback')">🧠</button></div></div><div style="font-size:12px;color:var(--tx2);line-height:1.6;white-space:pre-wrap">${tx}</div></div>`;
    });
    html+=`</div></div>`;
  }

  if(results.imgs?.urls?.length){
    html+=`<div class="rc"><div class="rh"><span class="rt">🎨 Bilder</span></div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">${results.imgs.urls.map(url=>`<div style="border-radius:9px;overflow:hidden;border:1px solid var(--l)"><img src="${url}" style="width:100%;display:block"><div style="padding:7px;text-align:right"><a href="${url}" download class="bg" style="font-size:10px">💾</a></div></div>`).join('')}</div></div>`;
  }

  if(results.mail?.body){
    const se=results.mail.subject.replace(/'/g,"\\'");const be=results.mail.body.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
    html+=`<div class="rc"><div class="rh"><span class="rt">✉️ Newsletter</span><div class="ra"><button class="bg" onclick="window.App.copyText('${se}\\n\\n${be}')">📋</button><button class="bg" onclick="window.App.saveItem('Newsletter ${month.replace(/'/g,"\\'")}','${be}')">⭐</button></div></div><div style="font-size:15px;font-weight:800;margin-bottom:8px">${results.mail.subject}</div><div class="ep"><p>${results.mail.body}</p></div></div>`;
  }

  if(results.rep?.raw){
    const re=results.rep.raw.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n');
    html+=`<div class="rc"><div class="rh"><span class="rt">📊 Report-Vorlage</span><div class="ra"><button class="bg" onclick="window.App.copyText('${re}')">📋</button><button class="bg" onclick="window.App.saveItem('Report ${month.replace(/'/g,"\\'")}','${re}')">⭐</button></div></div><div class="rb">${results.rep.raw.replace(/\n/g,'<br>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')}</div></div>`;
  }

  html+='</div></div>';
  out.innerHTML=html;
}
