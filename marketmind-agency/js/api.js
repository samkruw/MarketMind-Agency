// ============================================================
//  api.js  –  Groq (Text) + OpenRouter (Bilder)
// ============================================================
import { Keys } from './firebase.js';

const GROQ_URL  = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MOD  = 'llama-3.3-70b-versatile';
const OR_URL    = 'https://openrouter.ai/api/v1/chat/completions';

// ── GROQ TEXT ─────────────────────────────────────────────────
export async function callGroq(
  prompt,
  system = 'Du bist ein hilfreicher Marketing-Assistent für deutschsprachige KMUs. Antworte auf Deutsch.',
  maxTokens = 1500
) {
  const key = Keys.groq.get();
  if (!key) throw new Error('Groq API Key fehlt – bitte in Einstellungen eingeben.');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + key
    },
    body: JSON.stringify({
      model: GROQ_MOD,
      max_tokens: maxTokens,
      temperature: 0.72,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: prompt  }
      ]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Groq Fehler ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ── OPENROUTER IMAGE ──────────────────────────────────────────
export async function callORImage(prompt, model = 'google/gemini-2.5-flash-image-preview') {
  const key = Keys.openrouter.get();
  if (!key) throw new Error('OpenRouter API Key fehlt – bitte in Einstellungen eingeben.');

  const res = await fetch(OR_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + key,
      'HTTP-Referer':  'https://marketmind-agency.github.io',
      'X-Title':       'MarketMind Agency'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text']
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenRouter Fehler ${res.status}`);
  }

  const data  = await res.json();
  const imgs  = [];
  const cont  = data.choices?.[0]?.message?.content;

  if (Array.isArray(cont)) {
    cont.forEach(b => {
      if (b.type === 'image_url')                               imgs.push(b.image_url?.url);
      if (b.type === 'text' && b.text?.startsWith('data:image')) imgs.push(b.text.trim());
    });
  }
  // Some models return images in a dedicated field
  const mi = data.choices?.[0]?.message?.images;
  if (mi?.length) mi.forEach(i => imgs.push(i));

  return imgs;
}

// ── WORKFLOW SYSTEM PROMPT ────────────────────────────────────
export const WF_SYSTEM = `Du bist ein Marketing-Workflow-Agent für eine professionelle Schweizer Marketingagentur.
Analysiere die Anfrage und erstelle einen strukturierten Workflow-Plan als JSON.
Antworte NUR mit JSON (kein Text davor/danach):
{
  "goal": "Kurzbeschreibung",
  "steps": [
    {"id":"s1","type":"generate_post","name":"Post erstellen","desc":"Caption","platform":"Instagram","tone":"Freundlich"},
    {"id":"s2","type":"generate_image","name":"Bild generieren","desc":"Visual","imagePrompt":"English detailed prompt"},
    {"id":"s3","type":"generate_hashtags","name":"Hashtags","desc":"Reichweite","platform":"Instagram"},
    {"id":"s4","type":"generate_email","name":"E-Mail","desc":"Newsletter"},
    {"id":"s5","type":"generate_ads","name":"Ads","desc":"Werbetexte"},
    {"id":"s6","type":"generate_seo","name":"SEO","desc":"Meta+Keywords","keyword":"Keyword"},
    {"id":"s7","type":"generate_invoice","name":"Angebot","desc":"Erstellen"}
  ]
}
Wähle 2-5 Steps die für die konkrete Anfrage sinnvoll sind.`;
