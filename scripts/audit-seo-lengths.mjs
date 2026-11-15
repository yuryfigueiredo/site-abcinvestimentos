import fs from 'node:fs';
import path from 'node:path';

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) files.push(p);
  }
})('dist');

const pick = (html, re) => {
  const m = html.match(re);
  return m ? m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'") : null;
};

const rows = files.map((f) => {
  const html = fs.readFileSync(f, 'utf8');
  const title = pick(html, /<title>([\s\S]*?)<\/title>/) || '';
  const desc = pick(html, /<meta name="description" content="([^"]*)"/) || '';
  const rel = '/' + path.relative('dist', f).split(path.sep).join('/').replace(/\/index\.html$/, '').replace(/\.html$/, '');
  return { rel, title, desc, tl: title.length, dl: desc.length };
});

// Mesmo teto usado na geração (60/158): folga no portão escondia estouro real.
const bad = rows.filter((r) => r.tl > 60 || r.dl > 158);
console.log('paginas:', rows.length, '| fora do limite:', bad.length);
for (const r of bad.slice(0, 10)) console.log('  ESTOURADO', r.tl, r.dl, r.rel, '::', r.title);

const qr = rows.filter((r) => r.rel.startsWith('/quanto-rende'));
console.log('\n--- cluster quanto-rende: ' + qr.length + ' paginas ---');
for (const r of qr.sort((a, b) => b.tl - a.tl).slice(0, 8)) console.log(String(r.tl).padStart(3), r.title);
console.log('\n--- descriptions (3 exemplos) ---');
for (const r of qr.slice(0, 3)) console.log(r.dl, '|', r.desc);
console.log('\n--- hub ---');
for (const r of rows.filter((x) => x.rel === '/calculadoras' || x.rel === '/calculadoras/')) console.log(r.tl, r.title, '||', r.dl, r.desc);

const maxT = rows.reduce((a, b) => (b.tl > a.tl ? b : a));
const maxD = rows.reduce((a, b) => (b.dl > a.dl ? b : a));
console.log('\nmaior title:', maxT.tl, maxT.rel);
console.log('maior desc :', maxD.dl, maxD.rel);
