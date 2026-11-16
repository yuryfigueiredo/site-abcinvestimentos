import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// O Google só aceita raster no pipeline de favicon (BMP/GIF/ICO/PNG/JPEG/PPM/TIFF) e um
// data: URI não tem URL para o Googlebot-Image buscar — por isso o site aparecia com o
// ícone errado no Search mesmo "tendo" um favicon. Nada disso era coberto por teste: a
// régua aqui é byte de arquivo, não string de markup, para o dia em que alguém trocar
// o PNG e esquecer o sizes= ou o logo do schema voltar a apontar para SVG.

const layout = readFileSync(join('src', 'layouts', 'BaseLayout.astro'), 'utf8');
const publicDir = join(process.cwd(), 'public');

function iconLinks(source: string) {
  return [...source.matchAll(/<link\b[^>]*rel="([^"]*icon[^"]*)"[^>]*>/g)].map((m) => {
    const tag = m[0];
    const attr = (name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
    return { rel: m[1], href: attr('href'), type: attr('type'), sizes: attr('sizes') };
  });
}

function pngSize(buf: Buffer) {
  const signature = buf.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function icoEntries(buf: Buffer) {
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return null;
  const count = buf.readUInt16LE(4);
  const entries: Array<{ width: number; height: number; size: number; offset: number; png: { width: number; height: number } | null }> = [];
  for (let i = 0; i < count; i += 1) {
    const base = 6 + i * 16;
    const size = buf.readUInt32LE(base + 8);
    const offset = buf.readUInt32LE(base + 12);
    entries.push({
      width: buf.readUInt8(base) || 256,
      height: buf.readUInt8(base + 1) || 256,
      size,
      offset,
      png: pngSize(buf.subarray(offset, offset + size)),
    });
  }
  return { count, entries };
}

function readAsset(href: string | undefined) {
  if (!href) return null;
  const file = join(publicDir, href.replace(/^\//, ''));
  return existsSync(file) ? readFileSync(file) : null;
}

describe('pipeline de icone do Google', () => {
  const links = iconLinks(layout);

  it('declara ao menos um raster com arquivo real atras', () => {
    const rasters = links.filter((l) => l.rel.includes('icon') && /png|ico/.test(l.type ?? ''));
    expect(rasters.length).toBeGreaterThanOrEqual(2);
    for (const link of rasters) {
      expect(readAsset(link.href), `falta ${link.href} em public/`).not.toBeNull();
    }
  });

  it('o sizes declarado nao mente sobre os pixels do PNG', () => {
    const png = links.find((l) => l.type === 'image/png' && l.sizes);
    expect(png).toBeTruthy();
    const [w, h] = png!.sizes!.split('x').map(Number);
    const real = pngSize(readAsset(png!.href!)!);
    expect(real).toEqual({ width: w, height: h });
  });

  it('nenhum icone e um data: URI — Googlebot-Image precisa de URL', () => {
    for (const link of links) {
      expect(link.href?.startsWith('data:'), `${link.rel} ainda embute o SVG`).toBe(false);
    }
  });

  it('apple-touch-icon existe e e quadrado cheio de 180px', () => {
    const apple = links.find((l) => l.rel === 'apple-touch-icon');
    expect(apple, 'sem apple-touch-icon: um dos rel que o Google consulta').toBeTruthy();
    const real = pngSize(readAsset(apple!.href!)!);
    expect(real).toEqual({ width: 180, height: 180 });
  });

  it('o .ico traz entradas pequenas e o container fecha no proprio tamanho', () => {
    const buf = readAsset('/favicon.ico');
    expect(buf, 'falta public/favicon.ico').not.toBeNull();
    const ico = icoEntries(buf!);
    expect(ico, '.ico nao e um container de icones valido').not.toBeNull();
    expect(ico!.count).toBeGreaterThanOrEqual(3);
    const larguras = ico!.entries.map((e) => e.width);
    for (const need of [16, 32, 48]) expect(larguras, `sem entrada ${need}px`).toContain(need);
    for (const entry of ico!.entries) {
      expect(entry.png, `entrada ${entry.width}px sem PNG valido`).not.toBeNull();
      expect(entry.png).toEqual({ width: entry.width, height: entry.height });
      expect(entry.offset + entry.size).toBeLessThanOrEqual(buf!.length);
    }
    const ultima = ico!.entries[ico!.entries.length - 1];
    expect(ultima.offset + ultima.size).toBe(buf!.length);
  });

  it('o logo do JSON-LD e raster e atinge o minimo de 112px do Google', () => {
    const logo = layout.match(/logo:\s*new URL\('([^']+)',/)?.[1];
    expect(logo, 'logo do schema sumiu do BaseLayout').toBeTruthy();
    expect(logo!.endsWith('.svg'), `logo ainda aponta para vetorial (${logo})`).toBe(false);
    const real = pngSize(readAsset(logo)!);
    expect(real, `${logo} nao e um PNG legivel`).not.toBeNull();
    expect(Math.min(real!.width, real!.height)).toBeGreaterThanOrEqual(112);
  });
});
