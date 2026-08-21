// test/mcp.test.js — MCP sunucusunun protokol el sikismasi ve araclari.
// Gercek data/data.json'u OKUR (yazmaz); baglam_yaz testi gecici bir kopyada calisir.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let sunucu, tampon = '', bekleyen = new Map(), sayac = 0;

function cagir(method, params) {
  const id = ++sayac;
  return new Promise((coz, red) => {
    bekleyen.set(id, { coz, red });
    sunucu.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    setTimeout(() => red(new Error(`zaman asimi: ${method}`)), 10000);
  });
}
const metin = (r) => r.content.map(c => c.text).join('\n');

before(async () => {
  sunucu = spawn('node', [path.join(PROJE, 'scripts', 'mcp.js')], { stdio: ['pipe', 'pipe', 'pipe'] });
  sunucu.stdout.on('data', (d) => {
    tampon += d.toString();
    let n;
    while ((n = tampon.indexOf('\n')) >= 0) {
      const satir = tampon.slice(0, n).trim(); tampon = tampon.slice(n + 1);
      if (!satir) continue;
      const m = JSON.parse(satir);
      const b = bekleyen.get(m.id);
      if (b) { bekleyen.delete(m.id); m.error ? b.red(new Error(m.error.message)) : b.coz(m.result); }
    }
  });
  await cagir('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
});

after(() => sunucu?.kill());

test('initialize: sunucu kendini tanitir ve tools yetenegi bildirir', async () => {
  const r = await cagir('ping', {});
  assert.deepEqual(r, {});
});

test('tools/list: her aracin adi, aciklamasi ve sema si var', async () => {
  const { tools } = await cagir('tools/list', {});
  assert.ok(tools.length >= 9, `beklenenden az arac: ${tools.length}`);
  for (const t of tools) {
    assert.ok(t.name && t.description, `eksik alan: ${JSON.stringify(t)}`);
    assert.equal(t.inputSchema.type, 'object', `${t.name}: inputSchema object olmali`);
  }
  const adlar = tools.map(t => t.name);
  for (const gerekli of ['siteler_listele', 'sorunlar', 'oneriler', 'site_detay', 'saglik', 'baglam_oku', 'baglam_yaz']) {
    assert.ok(adlar.includes(gerekli), `eksik arac: ${gerekli}`);
  }
});

test('siteler_listele: gercek data.json okunur', async () => {
  const r = await cagir('tools/call', { name: 'siteler_listele', arguments: {} });
  const t = metin(r);
  assert.match(t, /Ortalama SEO puani/);
  assert.match(t, /\/100/);
});

test('saglik: mutabakat satirini yazar', async () => {
  const { tools } = await cagir('tools/list', {});
  assert.ok(tools.length);
  const liste = metin(await cagir('tools/call', { name: 'siteler_listele', arguments: {} }));
  const ilkId = liste.split('\n').find(l => /\/100/.test(l) && !/Ortalama/.test(l))?.trim().split(/\s+/)[0];
  assert.ok(ilkId, 'listeden site id cikarilamadi');
  const t = metin(await cagir('tools/call', { name: 'saglik', arguments: { site: ilkId } }));
  assert.match(t, /kategori cezalari toplami/);
  assert.match(t, /Puani etkileyen kategoriler/);
});

test('bilinmeyen site: protokol hatasi degil, okunabilir arac hatasi doner', async () => {
  const r = await cagir('tools/call', { name: 'site_detay', arguments: { site: 'boyle-bir-site-yok' } });
  assert.equal(r.isError, true);
  assert.match(metin(r), /site bulunamadi/);
  assert.match(metin(r), /Mevcut:/, 'hata mesaji gecerli secenekleri de soylemeli');
});

test('bilinmeyen arac: JSON-RPC hatasi doner', async () => {
  await assert.rejects(() => cagir('tools/call', { name: 'olmayan_arac', arguments: {} }), /bilinmeyen arac/);
});
