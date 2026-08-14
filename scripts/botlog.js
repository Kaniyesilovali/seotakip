// scripts/botlog.js
// Sunucu erisim logundan (Apache/Nginx combined) AI botlarinin ziyaretlerini sayar.
// Sadece data.json'daki ilgili sitenin "aiBotlar" alanini doldurur (UI'a dokunmaz).
//
// Log nereden: hosting cPanel -> "Raw Access" / "Metrics -> Raw Access Logs" -> indir.
//
// Kullanim:  node scripts/botlog.js <siteId> <logDosyasi> [gunSayisi]
//   ornek:   node scripts/botlog.js animare ~/Downloads/animare.vet-access.log 30

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KOK = path.resolve(__dirname, '..');
const veriYolu = path.join(KOK, 'data', 'data.json');

const [siteId, logPath, gunArg] = process.argv.slice(2);
if (!siteId || !logPath) { console.error('Kullanim: node scripts/botlog.js <siteId> <logDosyasi> [gunSayisi]'); process.exit(1); }
if (!fs.existsSync(logPath)) { console.error(`✕ log dosyasi yok: ${logPath}`); process.exit(1); }
const gun = Number(gunArg) || 30;
const esik = Date.now() - gun * 86400000;

// AI bot aileleri (user-agent kaliplari)
const BOTLAR = {
  gptbot: /GPTBot|OAI-SearchBot|ChatGPT-User/i,       // OpenAI
  claudebot: /ClaudeBot|Claude-Web|anthropic-ai/i,     // Anthropic
  perplexitybot: /PerplexityBot/i,                     // Perplexity
  google: /Google-Extended/i,                          // Google AI (Gemini)
};

const AYLAR = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
function tarihCoz(s) { // [10/Aug/2026:13:55:36 +0000]
  const m = s.match(/(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return Date.UTC(+m[3], AYLAR[m[2]] ?? 0, +m[1], +m[4], +m[5], +m[6]);
}

const sayac = { gptbot: 0, claudebot: 0, perplexitybot: 0, google: 0 };
let sonZiyaret = 0, toplamSatir = 0, aiSatir = 0;

const satirlar = fs.readFileSync(logPath, 'utf8').split('\n');
for (const satir of satirlar) {
  if (!satir.trim()) continue;
  toplamSatir++;
  const ua = (satir.match(/"([^"]*)"\s*$/) || [])[1] || satir; // son tirnakli alan = user-agent
  let eslesti = false;
  for (const [ad, re] of Object.entries(BOTLAR)) {
    if (re.test(ua)) {
      const t = tarihCoz(satir);
      if (t != null && t < esik) continue; // gunSayisi disindaysa sayma
      sayac[ad]++; eslesti = true;
      if (t != null && t > sonZiyaret) sonZiyaret = t;
    }
  }
  if (eslesti) aiSatir++;
}

const veri = JSON.parse(fs.readFileSync(veriYolu, 'utf8'));
const site = veri.siteler.find(s => s.id === siteId);
if (!site) { console.error(`✕ site bulunamadi: ${siteId} (data.json'da yok, once tara)`); process.exit(1); }

site.aiBotlar = {
  gptbot: sayac.gptbot, claudebot: sayac.claudebot, perplexitybot: sayac.perplexitybot, google: sayac.google,
  sonZiyaret: sonZiyaret ? new Date(sonZiyaret).toISOString().slice(0, 10) : null,
};
site._botGercek = true;

veri.guncelleme = new Date().toISOString();
fs.writeFileSync(veriYolu, JSON.stringify(veri, null, 2));
fs.writeFileSync(path.join(KOK, 'assets', 'fallback-data.js'), 'window.SEO_FALLBACK = ' + JSON.stringify(veri) + ';\n');

console.log(`✓ ${site.ad} — son ${gun} gun (${toplamSatir} log satiri, ${aiSatir} AI bot ziyareti):`);
console.log(`   GPTBot ${sayac.gptbot} · ClaudeBot ${sayac.claudebot} · PerplexityBot ${sayac.perplexitybot} · Google-Extended ${sayac.google}`);
console.log(`   son ziyaret: ${site.aiBotlar.sonZiyaret || '—'}`);
if (aiSatir === 0) console.log('   (Hic AI bot gorulmedi — site yeni olabilir ya da log kisa olabilir.)');
