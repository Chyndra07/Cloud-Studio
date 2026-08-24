import React, { ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Camera } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F9FC] text-[#111827] flex items-center justify-center p-6 text-center font-sans">
          <div className="max-w-md w-full bg-[#FFFFFF] border border-[#E5EAF0] p-8 rounded-[24px] shadow-lg shadow-slate-900/5 space-y-4 animate-in fade-in duration-200">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#E8F7F6] text-[#0796A6] flex items-center justify-center border border-[#0796A6]/20">
              <Camera className="w-7 h-7 text-[#0796A6]" />
            </div>
            <h2 className="text-xl font-bold text-[#0B1830] font-serif">
              {this.props.fallbackTitle || 'Galeri Sedang Dimuat Ulang'}
            </h2>
            <p className="text-xs text-[#64748B] leading-relaxed">
              {this.props.fallbackMessage ||
                'Terjadi sedikit kendala saat menampilkan visual galeri. Silakan tekan tombol di bawah untuk memuat ulang.'}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0B1830] to-[#0796A6] text-white text-xs font-semibold hover:opacity-95 transition flex items-center justify-center gap-2 cursor-pointer shadow-sm mx-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Muat Ulang Halaman</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

