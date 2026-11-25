import React, { useState } from 'react';
import { Shield, Delete, X } from 'lucide-react';

interface PinModalProps {
  correctPin: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const PinModal: React.FC<PinModalProps> = ({ correctPin, onSuccess, onClose }) => {
  const [enteredPin, setEnteredPin] = useState('');
  const [error, setError] = useState(false);

  const handlePress = (num: string) => {
    if (enteredPin.length < 4) {
      const next = enteredPin + num;
      setEnteredPin(next);
      setError(false);
      if (next.length === 4) {
        if (next === correctPin) {
          onSuccess();
        } else {
          setError(true);
          setTimeout(() => {
            setEnteredPin('');
            setError(false);
          }, 800);
        }
      }
    }
  };

  const handleDelete = () => {
    setEnteredPin(prev => prev.slice(0, -1));
    setError(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mb-4">
          <Shield className="w-6 h-6" />
        </div>

        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mb-1.5 text-center">
          Mode Caregiver
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
          {correctPin === '1234'
            ? 'Masukkan PIN 4 digit untuk membuka pengaturan (default: 1234)'
            : 'Masukkan PIN 4 digit untuk membuka pengaturan Caregiver'}
        </p>

        {/* PIN Dots */}
        <div className="flex items-center gap-3.5 mb-6" aria-label="Indikator PIN">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-colors ${
                error
                  ? 'bg-rose-600 border-rose-600'
                  : i < enteredPin.length
                  ? 'bg-emerald-600 border-emerald-600'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
              }`}
            />
          ))}
        </div>

        <div className="h-5 mb-3 flex items-center justify-center">
          {error && (
            <p className="text-rose-600 dark:text-rose-400 font-semibold text-xs">
              PIN tidak sesuai. Silakan coba lagi.
            </p>
          )}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((item, idx) => {
            if (item === '') return <div key={idx} />;
            if (item === 'del') {
              return (
                <button
                  key={idx}
                  onClick={handleDelete}
                  className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 font-semibold active:scale-95 transition-all"
                  aria-label="Hapus angka"
                >
                  <Delete className="w-5 h-5" />
                </button>
              );
            }
            return (
              <button
                key={idx}
                onClick={() => handlePress(item)}
                className="h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-center text-slate-900 dark:text-white font-bold text-xl tabular-nums active:scale-95 transition-all"
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
