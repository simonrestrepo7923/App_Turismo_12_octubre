import { useCallback } from 'react';
import { useToast } from '../components/ui/Toast';
import { buildPath, navigate } from '../lib/router';

/** Muestra un aviso para iniciar sesión cuando una acción requiere cuenta. */
export function useAuthPrompt() {
  const toast = useToast();
  return useCallback(
    (message = 'Inicia sesión para guardar tu actividad.') => {
      toast(message, {
        action: {
          label: 'Iniciar sesión',
          onClick: () => navigate(buildPath('/auth', { volver: window.location.hash.replace(/^#/, '') })),
        },
      });
    },
    [toast],
  );
}
