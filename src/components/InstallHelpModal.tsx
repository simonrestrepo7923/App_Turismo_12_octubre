import React from 'react';
import { usePwa } from '../lib/pwa';
import { Modal } from './ui/Modal';
import { Icon } from './ui/Icon';

/** Instrucciones para instalar la app cuando el navegador no ofrece el botón (iPhone/iPad). */
export const InstallHelpModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { isIos } = usePwa();
  const steps = isIos
    ? [
        ['ios_share', 'Abre la app en Safari y toca el botón Compartir.'],
        ['add_box', 'Elige «Agregar a pantalla de inicio».'],
        ['check_circle', 'Toca «Agregar». La app quedará con su ícono, como cualquier otra.'],
      ]
    : [
        ['more_vert', 'Abre el menú del navegador (⋮ en Chrome o Edge).'],
        ['mobile_arrow_down', 'Elige «Instalar aplicación» o «Agregar a la pantalla principal».'],
        ['check_circle', 'Confirma. La app se abrirá en su propia ventana y funcionará sin conexión.'],
      ];
  return (
    <Modal open={open} onClose={onClose} title="Instalar la app" icon="mobile_arrow_down" tone="light" maxWidth="max-w-sm">
      <ol className="p-5 space-y-4">
        {steps.map(([icon, text], i) => (
          <li key={icon} className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-full bg-primary-fixed text-primary flex items-center justify-center shrink-0">
              <Icon name={icon} className="text-[20px]" />
            </span>
            <span className="text-sm text-on-surface pt-1.5">
              <strong>{i + 1}.</strong> {text}
            </span>
          </li>
        ))}
      </ol>
      <p className="px-5 pb-5 text-xs text-on-surface-variant">La instalación requiere que la app esté publicada con HTTPS (o abierta en localhost).</p>
    </Modal>
  );
};
