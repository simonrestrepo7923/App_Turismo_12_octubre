import { useEffect, useState } from 'react';

/**
 * Enrutador mínimo basado en el hash de la URL (#/ruta?param=valor).
 * Permite usar el botón «atrás» del navegador/celular y abrir enlaces directos
 * (por ejemplo, los códigos QR apuntan a #/qr/<código>).
 */

export interface Route {
  path: string;
  segments: string[];
  query: URLSearchParams;
}

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = '/' + pathPart.split('/').filter(Boolean).join('/');
  return {
    path,
    segments: path.split('/').filter(Boolean).map(decodeURIComponent),
    query: new URLSearchParams(queryPart),
  };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

/** Profundidad de navegación dentro de la app (se guarda en history.state). */
function currentDepth(): number {
  const state = window.history.state as { depth?: number } | null;
  return typeof state?.depth === 'number' ? state.depth : 0;
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  const hash = '#' + (to.startsWith('/') ? to : '/' + to);
  const url = window.location.pathname + window.location.search + hash;
  if (options.replace) {
    window.history.replaceState({ depth: currentDepth() }, '', url);
  } else if (window.location.hash !== hash) {
    window.history.pushState({ depth: currentDepth() + 1 }, '', url);
  }
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Vuelve a la pantalla anterior; si se entró directo por un enlace, va a `fallback`. */
export function goBack(fallback = '/inicio'): void {
  if (currentDepth() > 0) window.history.back();
  else navigate(fallback, { replace: true });
}

export function buildPath(path: string, params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}

/** URL absoluta de una ruta interna (para compartir o codificar en un QR). */
export function absoluteUrl(path: string): string {
  return `${window.location.origin}${window.location.pathname}#${path}`;
}
