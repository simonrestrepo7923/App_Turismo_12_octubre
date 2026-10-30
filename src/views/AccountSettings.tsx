import React, { useState } from 'react';
import { useAppStore } from '../store/AppStore';
import { useLocation } from '../store/LocationContext';
import { promptInstall, usePwa } from '../lib/pwa';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { Icon } from '../components/ui/Icon';
import { AuthField, PasswordField, authInputCls } from '../components/PasswordField';
import { DemoMailbox } from '../components/DemoMailbox';

/** Ajustes de la cuenta: datos personales, contraseña, correos, ubicación e instalación. */
export const AccountSettings: React.FC<{ onShowInstallHelp: () => void }> = ({ onShowInstallHelp }) => {
  const { currentUser, outbox, updateProfile, remote } = useAppStore();
  const location = useLocation();
  const pwa = usePwa();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [mailbox, setMailbox] = useState(false);
  if (!currentUser) return null;
  const unread = outbox.filter((m) => m.to === currentUser.email && !m.read).length;

  return (
    <section className="space-y-3 max-w-2xl">
      <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/60">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-outline">Datos personales</p>
            {!editing && (
              <>
                <p className="text-sm font-bold text-on-surface truncate">{currentUser.name}</p>
                <p className="text-xs text-on-surface-variant truncate">{currentUser.email}</p>
              </>
            )}
          </div>
          {!editing && (
            <button type="button" onClick={() => { setName(currentUser.name); setEditing(true); }} className="px-3 py-2 rounded-full border border-outline-variant text-xs font-bold text-primary flex items-center gap-1 shrink-0">
              <Icon name="edit" className="text-[16px]" /> Editar
            </button>
          )}
        </div>
        {editing && (
          <form
            className="mt-3 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!(await updateProfile(name))) {
                setNameError('Escribe tu nombre completo (mínimo 3 caracteres).');
                return;
              }
              setEditing(false);
              setNameError(null);
              toast('Datos actualizados.', { tone: 'success' });
            }}
          >
            <AuthField id="acc-name" label="Nombre completo" icon="badge" error={nameError ?? undefined}>
              <input id="acc-name" value={name} onChange={(e) => { setName(e.target.value); setNameError(null); }} autoComplete="name" className={authInputCls(!!nameError)} />
            </AuthField>
            <p className="text-[11px] text-on-surface-variant">El correo identifica tu cuenta y no se puede cambiar.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 rounded-full text-sm font-semibold text-on-surface-variant hover:bg-surface-container">Cancelar</button>
              <button type="submit" className="px-5 py-2 rounded-full bg-primary text-on-primary text-sm font-bold">Guardar</button>
            </div>
          </form>
        )}
      </div>

      <SettingRow icon="lock_reset" title="Contraseña" text="Cámbiala cuando quieras; necesitas la actual." action="Cambiar" onClick={() => setPasswordOpen(true)} />
      {!remote && <SettingRow
        icon="mail"
        title="Correos de la cuenta"
        text={unread > 0 ? `${unread} correo${unread > 1 ? 's' : ''} sin leer en el buzón de demostración.` : 'Bienvenida, códigos de recuperación y avisos de seguridad.'}
        action="Abrir buzón"
        onClick={() => setMailbox(true)}
      />}
      <SettingRow
        icon={location.status === 'active' ? 'my_location' : 'location_disabled'}
        title="Ubicación (GPS)"
        text={location.status === 'active' ? 'Activa: se usa para «cerca de ti» y la navegación.' : 'Apagada: la app usa una ubicación simulada en el barrio.'}
        action={location.status === 'active' ? 'Apagar' : 'Activar'}
        onClick={location.status === 'active' ? location.disableGps : location.enableGps}
      />
      {!pwa.installed && (
        <SettingRow
          icon="mobile_arrow_down"
          title="Instalar la app"
          text="Agrégala a la pantalla de inicio y úsala sin conexión."
          action="Instalar"
          onClick={() => (pwa.canInstall ? void promptInstall() : onShowInstallHelp())}
        />
      )}

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <DemoMailbox open={mailbox} onClose={() => setMailbox(false)} email={currentUser.email} />
    </section>
  );
};

const SettingRow: React.FC<{ icon: string; title: string; text: string; action: string; onClick: () => void }> = ({ icon, title, text, action, onClick }) => (
  <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/60 flex items-center gap-3">
    <span className="w-10 h-10 rounded-full bg-primary-fixed/60 text-primary flex items-center justify-center shrink-0">
      <Icon name={icon} className="text-[20px]" />
    </span>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-on-surface">{title}</p>
      <p className="text-xs text-on-surface-variant">{text}</p>
    </div>
    <button type="button" onClick={onClick} className="px-3 py-2 rounded-full border border-outline-variant text-xs font-bold text-primary shrink-0 hover:bg-surface-container">
      {action}
    </button>
  </div>
);

const ChangePasswordModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { changePassword } = useAppStore();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<{ field: 'current' | 'next' | 'confirm'; message: string } | null>(null);

  const close = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title="Cambiar contraseña" icon="lock_reset" tone="light" maxWidth="max-w-sm">
      <form
        className="p-5 space-y-4"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await changePassword(current, next, confirm);
          if (!r.ok) {
            setError({ field: r.field, message: r.message });
            return;
          }
          toast('Contraseña actualizada.', { tone: 'success' });
          close();
        }}
      >
        <PasswordField id="cp-current" label="Contraseña actual" value={current} onChange={(v) => { setCurrent(v); setError(null); }} autoComplete="current-password" error={error?.field === 'current' ? error.message : undefined} />
        <PasswordField id="cp-next" label="Nueva contraseña" value={next} onChange={(v) => { setNext(v); setError(null); }} autoComplete="new-password" showRules error={error?.field === 'next' ? error.message : undefined} />
        <PasswordField id="cp-confirm" label="Confirmar nueva contraseña" value={confirm} onChange={(v) => { setConfirm(v); setError(null); }} autoComplete="new-password" error={error?.field === 'confirm' ? error.message : undefined} />
        <button type="submit" className="w-full h-11 rounded-full bg-primary text-on-primary text-sm font-bold">Guardar nueva contraseña</button>
      </form>
    </Modal>
  );
};
