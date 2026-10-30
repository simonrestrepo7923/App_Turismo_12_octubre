/// <reference types="vitest/config" />
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Íconos de Material Symbols: en vez de descargar la fuente completa (~3,7 MB),
 * se pide a Google Fonts solo el subconjunto de íconos que usa el código.
 */
function iconNamesInSource(): string[] {
  const valid = new Set(fs.readFileSync(path.resolve(import.meta.dirname, 'node_modules/material-symbols/index.d.ts'), 'utf8').match(/"[a-z0-9_]+"/g)!.map((s) => s.slice(1, -1)));
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.(tsx?|ts)$/.test(e.name) && !e.name.endsWith('.test.ts')) {
        for (const m of fs.readFileSync(f, 'utf8').matchAll(/['"`>]([a-z][a-z0-9_]{1,40})['"`<]/g)) if (valid.has(m[1])) found.add(m[1]);
      }
    }
  };
  walk(path.resolve(import.meta.dirname, 'src'));
  return [...found].sort();
}

/** Avisa al compilar si algún <Icon name="…"> no existe en Material Symbols (se vería como texto). */
function warnUnknownIcons(): void {
  const valid = new Set(fs.readFileSync(path.resolve(import.meta.dirname, 'node_modules/material-symbols/index.d.ts'), 'utf8').match(/"[a-z0-9_]+"/g)!.map((s) => s.slice(1, -1)));
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.tsx') ? [path.join(dir, e.name)] : []));
  for (const f of walk(path.resolve(import.meta.dirname, 'src'))) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/(?:name|icon)="([a-z0-9_]+)"/g)) {
      if (!valid.has(m[1])) console.warn(`[íconos] «${m[1]}» no existe en Material Symbols (${path.relative(import.meta.dirname, f)})`);
    }
  }
}

export const iconFontUrl = () =>
  `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400..500,0..1,0&icon_names=${iconNamesInSource().join(',')}&display=block`;

function materialSymbolsSubset(): Plugin {
  return {
    name: 'ruta12-material-symbols-subset',
    buildStart() {
      warnUnknownIcons();
    },
    transformIndexHtml(html) {
      return html.replace(/https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols\+Outlined[^"]*/, iconFontUrl());
    },
  };
}

/**
 * Genera dist/sw.js con la lista de archivos de la compilación para que la app
 * se pueda abrir sin conexión e instalar en el celular (PWA).
 */
function serviceWorker(): Plugin {
  return {
    name: 'ruta12-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      // Las librerías del PDF solo se descargan si el administrador exporta un reporte.
      const lazyOnly = /jspdf|html2canvas|purify|index\.es/;
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map') && !lazyOnly.test(f));
      const publicDir = path.resolve(import.meta.dirname, 'public');
      const walk = (dir: string): string[] =>
        fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
      const statics = fs.existsSync(publicDir) ? walk(publicDir).map((f) => path.relative(publicDir, f).split(path.sep).join('/')) : [];
      const assets = ['./', './index.html', ...[...statics, ...built].map((f) => `./${f}`)];
      const version = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 10);
      // Hojas de estilo de las fuentes: el service worker las guarda al instalarse
      // para que los íconos y tipografías funcionen sin conexión desde la primera visita.
      const html = fs.readFileSync(path.resolve(import.meta.dirname, 'index.html'), 'utf8');
      const fontCss = [...html.matchAll(/href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"/g)]
        .map((m) => m[1].replace(/&amp;/g, '&'))
        .map((u) => (u.includes('Material+Symbols') ? iconFontUrl() : u));
      const template = fs.readFileSync(path.resolve(import.meta.dirname, 'pwa/sw-template.js'), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace('__VERSION__', version)
          .replace('__ASSETS__', JSON.stringify(assets, null, 2))
          .replace('__FONT_CSS__', JSON.stringify(fontCss, null, 2)),
      });
    },
  };
}

export default defineConfig({
  // Rutas relativas: la app funciona en cualquier carpeta (por ejemplo GitHub Pages).
  base: './',
  plugins: [react(), tailwindcss(), materialSymbolsSubset(), serviceWorker()],
  build: {
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
