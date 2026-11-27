import React, { useState } from 'react';
import { SyncProgress } from '../services/symbolSync';
import { SyncSummary } from '../types';
import { DownloadCloud, CheckCircle2, AlertTriangle, RefreshCw, Type, ChevronDown, ChevronUp } from 'lucide-react';

interface SymbolSetupScreenProps {
  status: 'syncing' | 'error' | 'summary';
  progress: SyncProgress;
  errorMessage: string | null;
  summary: SyncSummary | null;
  onRetry: () => void;
  onContinueOfflineText: () => void;
  onFinishSummary: () => void;
}

export const SymbolSetupScreen: React.FC<SymbolSetupScreenProps> = ({
  status,
  progress,
  errorMessage,
  summary,
  onRetry,
  onContinueOfflineText,
  onFinishSummary,
}) => {
  const [showErrors, setShowErrors] = useState(false);

  const pct =
    progress.total > 0
      ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
      : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-lg border border-slate-200 dark:border-slate-800">
        {status === 'syncing' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                <DownloadCloud className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Menyiapkan simbol...
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Simbol disimpan lokal agar dapat dipakai tanpa internet.
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-200">
                <span>
                  {progress.phase === 'manifest' && 'Mengunduh daftar simbol...'}
                  {progress.phase === 'images' &&
                    (progress.currentLabel ? `Memproses: ${progress.currentLabel}` : 'Mengunduh gambar simbol...')}
                  {progress.phase === 'licenses' && 'Menyimpan dokumen lisensi & kredit...'}
                  {progress.phase === 'done' && 'Selesai menyiapkan simbol'}
                </span>
                <span className="tabular-nums text-blue-700 dark:text-blue-300">
                  {progress.phase === 'images'
                    ? `${progress.completed} dari ${progress.total}`
                    : `${pct}%`}
                </span>
              </div>

              <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200/70 dark:border-slate-700/70">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-200"
                  style={{ width: `${progress.phase === 'manifest' ? 12 : Math.max(8, pct)}%` }}
                />
              </div>

              {progress.usedMirror && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Menggunakan cermin jaringan cdn.jsdelivr.net untuk kelancaran unduhan.
                </p>
              )}
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Gagal Mengunduh Simbol dari Manifest
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed break-words">
                  {errorMessage ||
                    'Tidak dapat terhubung ke repositori simbol (GitHub & cermin CDN). Periksa koneksi internet Anda.'}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-1.5">
              <p>
                Aplikasi memerlukan unduhan simbol awal agar gambar dapat tampil offline. Periksa koneksi internet atau cek rincian di Panel Diagnostik Caregiver.
              </p>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 break-all">
                Sumber: https://raw.githubusercontent.com/shikikan-neko08/mulberry-symbols/main/symbols.json
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={onRetry}
                className="flex-1 min-h-[48px] px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Coba lagi</span>
              </button>

              <button
                type="button"
                onClick={onContinueOfflineText}
                className="flex-1 min-h-[48px] px-5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold rounded-xl flex items-center justify-center gap-2 text-sm border border-slate-200 dark:border-slate-700 transition-colors"
              >
                <Type className="w-4 h-4" />
                <span>Mode Teks Sementara</span>
              </button>
            </div>
          </div>
        )}

        {status === 'summary' && summary && (
          <div className="space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Simbol Siap Digunakan Offline
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Ringkasan unduhan lokal ke perangkat Anda
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/70 text-center">
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 block">
                  Berhasil
                </span>
                <span className="text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-200">
                  {summary.succeeded}
                </span>
                {typeof summary.mulberrySucceeded === 'number' && (
                  <span className="text-[11px] text-emerald-700/90 dark:text-emerald-300/90 block mt-0.5 tabular-nums">
                    {summary.mulberrySucceeded} Mulberry + {summary.customSucceeded || 0} custom
                  </span>
                )}
              </div>
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/70 text-center">
                <span className="text-xs font-semibold text-rose-800 dark:text-rose-300 block">
                  Gagal
                </span>
                <span className="text-2xl font-extrabold tabular-nums text-rose-700 dark:text-rose-200">
                  {summary.failed}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                  Placeholder
                </span>
                <span className="text-2xl font-extrabold tabular-nums text-slate-800 dark:text-slate-100">
                  {summary.placeholders}
                </span>
              </div>
            </div>

            {summary.errors.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowErrors(v => !v)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/70 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between"
                >
                  <span>Catatan berkas gagal ({summary.errors.length}) — tetap bisa dipakai sebagai tombol teks</span>
                  {showErrors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showErrors && (
                  <div className="max-h-36 overflow-y-auto p-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900">
                    {summary.errors.map((err, i) => (
                      <div key={err.id + i} className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-1 last:border-0">
                        <span className="font-semibold">{err.label}</span>
                        <span className="text-rose-600 dark:text-rose-400 text-right">{err.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onFinishSummary}
              className="w-full min-h-[50px] py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs text-base transition-colors"
            >
              Mulai Menggunakan BicaraKu
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
