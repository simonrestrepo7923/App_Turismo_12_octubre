import { useEffect, useState } from 'react';

/** Devuelve si la consulta de medios coincide (p. ej. pantallas de computador). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Pantallas de computador o tableta horizontal (≥ 1024 px). */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
