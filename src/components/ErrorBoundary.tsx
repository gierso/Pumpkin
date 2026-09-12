import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturó un error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignore storage errors
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isWebGLError =
        this.state.error?.message?.toLowerCase().includes('webgl') ||
        this.state.error?.message?.toLowerCase().includes('canvas') ||
        this.state.error?.message?.toLowerCase().includes('context');

      return (
        <div className="min-h-screen w-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 select-none">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-950/80 border border-orange-500/50 flex items-center justify-center text-orange-400 shrink-0 shadow-lg shadow-orange-950/50">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">
                  {isWebGLError ? 'Problema con Aceleración Gráfica (WebGL)' : 'Error al Cargar la Aplicación 3D'}
                </h2>
                <p className="text-xs text-slate-400">
                  {isWebGLError
                    ? 'Tu navegador no pudo iniciar el contexto 3D WebGL.'
                    : 'Se detectó un conflicto inesperado durante la ejecución.'}
                </p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 text-xs space-y-2">
              <div className="font-semibold text-slate-300">
                {isWebGLError ? 'Recomendaciones:' : 'Detalle del Error:'}
              </div>
              {isWebGLError ? (
                <ul className="list-disc list-inside text-slate-400 space-y-1">
                  <li>Activa la aceleración por hardware en los ajustes del navegador.</li>
                  <li>Actualiza los controladores gráficos de tu tarjeta o navegador.</li>
                  <li>Intenta abrir la página en modo incógnito sin extensiones.</li>
                </ul>
              ) : (
                <pre className="font-mono text-[11px] text-red-400 overflow-x-auto whitespace-pre-wrap max-h-32">
                  {this.state.error?.message || 'Error desconocido'}
                </pre>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-semibold text-xs shadow-lg shadow-orange-950/50 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recargar Aplicación</span>
              </button>

              <button
                onClick={() => {
                  window.location.href = window.location.pathname;
                }}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700/60 flex items-center justify-center gap-2 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
