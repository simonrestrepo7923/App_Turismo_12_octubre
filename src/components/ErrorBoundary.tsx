import React from 'react';
import { Icon } from './ui/Icon';

interface State {
  error: Error | null;
}

/** Evita que un error en una pantalla deje la app en blanco. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Error en la interfaz:', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="max-w-md mx-auto px-6 py-16 text-center flex flex-col items-center">
        <Icon name="report" className="text-5xl text-error mb-3" />
        <h1 className="font-serif text-2xl font-bold text-primary mb-2">Algo salió mal</h1>
        <p className="text-sm text-on-surface-variant mb-6">Ocurrió un error inesperado en esta pantalla. Tus datos están a salvo.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => this.setState({ error: null })} className="px-5 py-2.5 rounded-full border border-primary text-primary text-sm font-bold">
            Reintentar
          </button>
          <button type="button" onClick={() => (window.location.hash = '#/inicio')} className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold">
            Ir al inicio
          </button>
        </div>
      </div>
    );
  }
}

export const PageLoader: React.FC<{ label?: string }> = ({ label = 'Cargando…' }) => (
  <div className="flex-1 min-h-[50vh] flex flex-col items-center justify-center gap-3 text-on-surface-variant" role="status">
    <span className="w-9 h-9 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
    <span className="text-sm">{label}</span>
  </div>
);
