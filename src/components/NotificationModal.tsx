import React, { useEffect, useRef } from 'react';
import type { Announcement } from '../types';
import { useAppStore } from '../store/AppStore';
import { navigate } from '../lib/router';
import { Modal } from './ui/Modal';
import { Icon } from './ui/Icon';

interface NotificationModalProps {
  open: boolean;
  onClose: () => void;
  announcements: Announcement[];
}

const ICON: Record<Announcement['type'], string> = { ruta: 'route', evento: 'event', pasaporte: 'local_activity' };

export const NotificationModal: React.FC<NotificationModalProps> = ({ open, onClose, announcements }) => {
  const { readAnnouncementIds, markAnnouncementsRead } = useAppStore();
  const unread = new Set(announcements.filter((a) => !readAnnouncementIds.includes(a.id)).map((a) => a.id));

  // Al cerrar el panel, todos los avisos quedan leídos.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) markAnnouncementsRead(announcements.map((a) => a.id));
    wasOpen.current = open;
  }, [open, announcements, markAnnouncementsRead]);

  return (
    <Modal open={open} onClose={onClose} title="Avisos comunitarios" icon="notifications_active" tone="light" maxWidth="max-w-sm">
      <div className="p-3 space-y-2.5">
        {announcements.map((item) => {
          const tourId = item.type === 'ruta' ? item.tourId : undefined;
          const body = (
            <>
              <span className="w-9 h-9 rounded-full bg-surface-container-lowest border border-outline-variant/50 text-secondary flex items-center justify-center shrink-0">
                <Icon name={ICON[item.type]} className="text-[18px]" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm font-bold text-primary leading-snug">{item.title}</span>
                  <span className="text-[10px] text-outline shrink-0 mt-0.5">{item.time}</span>
                </span>
                <span className="block text-xs text-on-surface-variant leading-relaxed mt-0.5">{item.description}</span>
                {tourId && (
                  <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-secondary">
                    Ver recorrido <Icon name="arrow_forward" className="text-[14px]" />
                  </span>
                )}
              </span>
            </>
          );
          const cls = `w-full text-left p-3 rounded-2xl border flex gap-3 transition-all ${
            unread.has(item.id) ? 'bg-secondary-fixed/25 border-secondary/30' : 'bg-surface border-outline-variant/40'
          }`;
          return tourId ? (
            <button
              key={item.id}
              type="button"
              className={`${cls} hover:border-secondary`}
              onClick={() => {
                onClose();
                navigate(`/recorrido/${tourId}`);
              }}
            >
              {body}
            </button>
          ) : (
            <div key={item.id} className={cls}>
              {body}
            </div>
          );
        })}
      </div>
    </Modal>
  );
};
