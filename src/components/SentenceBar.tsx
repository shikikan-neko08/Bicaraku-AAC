import React from 'react';
import { SentenceItem } from '../types';
import { Volume2, Trash2, Delete, Sparkles, Copy, Check, X } from 'lucide-react';

interface SentenceBarProps {
  sentence: SentenceItem[];
  onSpeak: () => void;
  onClear: () => void;
  onRemoveLast: () => void;
  onRemoveItem: (index: number) => void;
  suggestions: string[];
  onSelectSuggestion: (text: string) => void;
  isLoadingAI?: boolean;
}

export const SentenceBar: React.FC<SentenceBarProps> = ({
  sentence,
  onSpeak,
  onClear,
  onRemoveLast,
  onRemoveItem,
  suggestions,
  onSelectSuggestion,
  isLoadingAI = false,
}) => {
  const [copied, setCopied] = React.useState(false);

  const fullSentenceText = sentence.map(s => s.spokenText || s.label).join(' ');

  const handleCopy = () => {
    if (!fullSentenceText) return;
    navigator.clipboard.writeText(fullSentenceText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      aria-label="Bar Kalimat Komunikasi"
      className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 shadow-sm sticky top-0 z-20"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-2.5">
        {/* Main Sentence Display and Control Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="flex-1 min-h-[64px] bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-2xl px-4 py-2.5 flex items-center flex-wrap gap-2">
            {sentence.length === 0 ? (
              <span className="text-slate-400 dark:text-slate-500 text-base sm:text-lg font-medium">
                Ketuk simbol di bawah untuk merangkai kalimat...
              </span>
            ) : (
              sentence.map((item, index) => (
                <button
                  key={item.id + index}
                  onClick={() => onRemoveItem(index)}
                  className="bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3.5 py-2 rounded-xl font-bold text-base sm:text-xl border border-slate-200 dark:border-slate-600 flex items-center gap-2 shadow-xs hover:bg-rose-50 hover:text-rose-800 hover:border-rose-200 dark:hover:bg-rose-950/60 dark:hover:text-rose-200 transition-colors min-h-[44px]"
                  title="Ketuk untuk menghapus kata ini"
                >
                  <span>{item.label}</span>
                  <X className="w-4 h-4 opacity-55" />
                </button>
              ))
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              onClick={onRemoveLast}
              disabled={sentence.length === 0}
              className="min-w-[48px] min-h-[54px] px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 rounded-xl font-semibold transition-colors border border-slate-200 dark:border-slate-700 flex items-center justify-center"
              title="Hapus kata terakhir"
              aria-label="Hapus kata terakhir"
            >
              <Delete className="w-5 h-5" />
            </button>

            <button
              onClick={onClear}
              disabled={sentence.length === 0}
              className="min-w-[48px] min-h-[54px] px-3 bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-800 dark:hover:text-amber-200 disabled:opacity-40 text-slate-700 dark:text-slate-200 rounded-xl font-semibold transition-colors border border-slate-200 dark:border-slate-700 flex items-center justify-center"
              title="Bersihkan kalimat"
              aria-label="Bersihkan kalimat"
            >
              <Trash2 className="w-5 h-5" />
            </button>

            <button
              onClick={handleCopy}
              disabled={sentence.length === 0}
              className="min-w-[48px] min-h-[54px] px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 rounded-xl font-semibold transition-colors border border-slate-200 dark:border-slate-700 flex items-center justify-center"
              title="Salin kalimat"
              aria-label="Salin kalimat"
            >
              {copied ? <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-5 h-5" />}
            </button>

            <button
              onClick={onSpeak}
              disabled={sentence.length === 0}
              className="flex-1 sm:flex-initial px-6 py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:opacity-40 text-white font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 text-lg sm:text-xl min-h-[54px] whitespace-nowrap transition-all"
              style={{ touchAction: 'manipulation' }}
            >
              <Volume2 className="w-5 h-5 shrink-0" />
              <span>Ucapkan</span>
            </button>
          </div>
        </div>

        {/* AI / Offline Suggestions Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-sm sm:text-base">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-semibold shrink-0 pr-1">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Saran kata:</span>
          </div>
          {isLoadingAI ? (
            <span className="text-slate-400 dark:text-slate-500 text-sm px-1">Menyiapkan saran...</span>
          ) : (
            suggestions.map((sugg, idx) => (
              <button
                key={idx}
                onClick={() => onSelectSuggestion(sugg)}
                className="px-4 py-1.5 min-h-[40px] bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-900 dark:text-blue-200 rounded-xl font-semibold border border-blue-200/80 dark:border-blue-800/80 transition-colors shrink-0 whitespace-nowrap"
              >
                + {sugg}
              </button>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
