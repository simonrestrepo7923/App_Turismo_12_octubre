import React, { useEffect, useState } from 'react';
import type { CategoryId, CommunityProposal } from '../types';
import { CATEGORIES } from '../data/categories';
import { useAppStore } from '../store/AppStore';
import { Modal } from './ui/Modal';
import { Icon } from './ui/Icon';

interface ProposePointModalProps {
  open: boolean;
  onClose: () => void;
}

const EMPTY: CommunityProposal = { name: '', contact: '', location: '', title: '', story: '', category: 'historico' };

const inputCls =
  'w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none';

/** Formulario para que la comunidad proponga nuevos puntos de memoria. */
export const ProposePointModal: React.FC<ProposePointModalProps> = ({ open, onClose }) => {
  const { currentUser } = useAppStore();
  const [form, setForm] = useState<CommunityProposal>(EMPTY);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, name: currentUser?.name ?? '', contact: currentUser?.email ?? '' });
      setSent(false);
      setSending(false);
    }
  }, [open, currentUser]);

  const set = <K extends keyof CommunityProposal>(key: K, value: CommunityProposal[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    window.setTimeout(() => {
      setSending(false);
      setSent(true);
    }, 600);
  };

  return (
    <Modal open={open} onClose={onClose} title="Proponer punto de memoria" icon="record_voice_over" maxWidth="max-w-lg">
      {sent ? (
        <div className="p-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-primary-fixed flex items-center justify-center text-primary mb-3">
            <Icon name="verified" className="text-3xl" />
          </div>
          <h3 className="font-serif text-2xl font-bold text-primary mb-1">¡Relato recibido con gratitud!</h3>
          <p className="text-sm text-on-surface-variant max-w-sm mb-5">
            La Mesa de Cultura Comunitaria revisará «{form.title}» para incluirla en la próxima edición de la cartografía barrial.
          </p>
          <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-full bg-primary text-white text-sm font-bold">
            Cerrar
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="p-5 space-y-4">
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Las memorias vivas de la Comuna 6 se construyen colectivamente. Cuéntanos sobre una esquina, persona fundadora, lavadero, huerta o mural
            que guarde una historia digna de caminarse.
          </p>
          <div>
            <label htmlFor="pp-title" className="block text-xs font-bold text-on-surface mb-1">Título del lugar o relato *</label>
            <input id="pp-title" required value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Ej. El primer convite de la Carrera 82" className={inputCls} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="pp-cat" className="block text-xs font-bold text-on-surface mb-1">Categoría</label>
              <select id="pp-cat" value={form.category} onChange={(e) => set('category', e.target.value as CategoryId)} className={inputCls}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pp-loc" className="block text-xs font-bold text-on-surface mb-1">Ubicación aproximada *</label>
              <input id="pp-loc" required value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Calle o punto de referencia" className={inputCls} />
            </div>
          </div>
          <div>
            <label htmlFor="pp-story" className="block text-xs font-bold text-on-surface mb-1">Relato o memoria oral *</label>
            <textarea id="pp-story" required rows={3} value={form.story} onChange={(e) => set('story', e.target.value)} placeholder="¿Qué ocurrió aquí? ¿Quiénes son los protagonistas?" className={`${inputCls} resize-none`} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="pp-name" className="block text-xs font-bold text-on-surface mb-1">Tu nombre o colectivo *</label>
              <input id="pp-name" required value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="pp-contact" className="block text-xs font-bold text-on-surface mb-1">Contacto (teléfono o correo)</label>
              <input id="pp-contact" value={form.contact} onChange={(e) => set('contact', e.target.value)} placeholder="Para verificar el relato" className={inputCls} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/50">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-on-surface-variant hover:text-primary font-semibold">Cancelar</button>
            <button type="submit" disabled={sending} className="px-6 py-2.5 rounded-full bg-primary text-white text-sm font-bold hover:bg-primary-container active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70">
              {sending ? 'Enviando…' : (<>Enviar a curaduría <Icon name="send" className="text-[18px]" /></>)}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
