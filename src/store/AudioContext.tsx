import React, { createContext, useCallback, useContext, useState } from 'react';

export interface AudioTrack {
  id: string;
  title: string;
  narrator: string;
  seconds: number;
}

interface AudioValue {
  track: AudioTrack | null;
  play: (track: AudioTrack) => void;
  close: () => void;
}

const AudioCtx = createContext<AudioValue | null>(null);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [track, setTrack] = useState<AudioTrack | null>(null);
  const play = useCallback((t: AudioTrack) => setTrack(t), []);
  const close = useCallback(() => setTrack(null), []);
  return <AudioCtx.Provider value={{ track, play, close }}>{children}</AudioCtx.Provider>;
};

export function useAudio(): AudioValue {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error('useAudio debe usarse dentro de <AudioProvider>');
  return ctx;
}
