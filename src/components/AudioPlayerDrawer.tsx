import React, { useEffect, useState } from 'react';
import { useAudio } from '../store/AudioContext';
import { formatClock } from '../lib/format';
import { Icon } from './ui/Icon';

/**
 * Reproductor de la audioguía. Los relatos sonoros aún no están grabados, por lo
 * que la reproducción es simulada (avanza el tiempo y la barra de progreso).
 */
export const AudioPlayerDrawer: React.FC<{ placement: 'bottom' | 'top' }> = ({ placement }) => {
  const { track, close } = useAudio();
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);

  // Reinicia al cambiar de pista y arranca la reproducción.
  useEffect(() => {
    setElapsed(0);
    setPlaying(!!track);
  }, [track?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing || !track) return;
    const id = window.setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= track.seconds) {
          setPlaying(false);
          return track.seconds;
        }
        return prev + 1;
      });
    }, 1000 / speed);
    return () => window.clearInterval(id);
  }, [playing, speed, track]);

  if (!track) return null;
  const progress = Math.min(100, (elapsed / track.seconds) * 100);

  return (
    <div
      className={`fixed left-3 right-3 max-w-xl mx-auto z-40 animate-fade-in lg:left-auto lg:right-6 lg:mx-0 lg:w-[420px] lg:top-auto lg:bottom-6 ${
        placement === 'top' ? 'top-[150px]' : 'bottom-[80px]'
      }`}
    >
      <div className="bg-primary-container text-on-primary rounded-2xl shadow-xl border border-on-primary-container/30 p-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (elapsed >= track.seconds) setElapsed(0);
              setPlaying((p) => !p);
            }}
            aria-label={playing ? 'Pausar audio' : 'Reproducir audio'}
            className="w-11 h-11 rounded-full bg-secondary text-on-secondary flex items-center justify-center shadow-md active:scale-95 transition-transform shrink-0 hover:bg-secondary-container"
          >
            <Icon name={playing ? 'pause' : 'play_arrow'} className="text-[26px]" fill />
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-fixed">Audioguía comunitaria</p>
            <h4 className="font-semibold text-sm truncate text-white">{track.title}</h4>
            <p className="text-xs text-on-primary-container truncate">{track.narrator}</p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setSpeed((s) => (s === 1 ? 1.25 : s === 1.25 ? 1.5 : 1))}
              className="text-[11px] font-bold px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-secondary-fixed"
              aria-label="Cambiar velocidad de reproducción"
            >
              {speed}x
            </button>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Activar sonido' : 'Silenciar'}
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-primary-container hover:text-white hover:bg-white/10"
            >
              <Icon name={muted ? 'volume_off' : 'volume_up'} className="text-[20px]" />
            </button>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar reproductor"
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-primary-container hover:text-white hover:bg-white/10"
            >
              <Icon name="close" className="text-[18px]" />
            </button>
          </div>
        </div>

        <div className="mt-2.5">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Progreso del audio"
            aria-valuemin={0}
            aria-valuemax={track.seconds}
            aria-valuenow={elapsed}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              setElapsed(Math.round(pct * track.seconds));
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') setElapsed((v) => Math.min(track.seconds, v + 10));
              if (e.key === 'ArrowLeft') setElapsed((v) => Math.max(0, v - 10));
            }}
            className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer"
          >
            <div className="h-full bg-secondary rounded-full transition-[width] duration-200" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between text-[10px] text-on-primary-container font-mono mt-1">
            <span>{formatClock(elapsed)}</span>
            <span>{formatClock(track.seconds)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
