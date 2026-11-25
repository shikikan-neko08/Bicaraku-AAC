import React from 'react';
import { ShieldCheck, Lock, Smartphone, Check } from 'lucide-react';

interface ConsentModalProps {
  onAccept: () => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({ onAccept }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Persetujuan Wali & Privasi
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              BicaraKu · Aplikasi AAC Lokal
            </p>
          </div>
        </div>

        <div className="space-y-3 my-2 text-sm text-slate-600 dark:text-slate-300">
          <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/70 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-700/70">
            <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 dark:text-white block mb-0.5 font-bold">
                Penyimpanan Lokal di Perangkat
              </strong>
              Semua data simbol, foto pribadi, profil suara, dan riwayat komunikasi disimpan langsung di perangkat Anda.
            </div>
          </div>

          <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/70 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-700/70">
            <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 dark:text-white block mb-0.5 font-bold">
                Tanpa Pelacakan Pihak Ketiga
              </strong>
              Aplikasi tetap bekerja penuh tanpa internet dan tidak mengirimkan data pribadi pengguna ke pelacak pihak ketiga.
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
            Dengan melanjutkan, Anda menyatakan sebagai orang tua, wali, atau terapis yang bertanggung jawab atas pengelolaan konten komunikasi pengguna.
          </p>
        </div>

        <button
          onClick={onAccept}
          className="mt-5 w-full py-3.5 min-h-[52px] bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-sm flex items-center justify-center gap-2 text-base transition-all"
        >
          <Check className="w-5 h-5" />
          <span>Saya Setuju & Mulai Gunakan</span>
        </button>
      </div>
    </div>
  );
};
