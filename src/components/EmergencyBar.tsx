import React from 'react';
import { SymbolItem } from '../types';
import { DEFAULT_SYMBOLS } from '../data/defaultSymbols';
import { AlertCircle, HelpCircle, CheckCircle2, VolumeX, Hand, Home } from 'lucide-react';

interface EmergencyBarProps {
  symbols: SymbolItem[];
  blobUrls: Record<string, string>;
  onSelectEmergency: (symbol: SymbolItem) => void;
}

export const EmergencyBar: React.FC<EmergencyBarProps> = ({
  symbols,
  blobUrls,
  onSelectEmergency,
}) => {
  const emergencySymbols = DEFAULT_SYMBOLS.filter(s => s.isEmergency);

  const iconMap: Record<string, React.ElementType> = {
    AlertCircle,
    HelpCircle,
    CheckCircle2,
    VolumeX,
    Hand,
    Home,
  };

  const findMatchingBlobUrl = (emergencyLabel: string): string | undefined => {
    const target = emergencyLabel.trim().toLowerCase();
    const candidates = symbols.filter(
      s => s.label.trim().toLowerCase() === target && !!blobUrls[s.id]
    );
    if (candidates.length === 0) return undefined;
    const preferred = candidates.find(s => s.isDefault !== false) || candidates[0];
    return blobUrls[preferred.id];
  };

  return (
    <section
      aria-label="Tombol Komunikasi Darurat"
      className="bg-rose-50/80 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-900/70 px-4 sm:px-6 py-2.5"
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 shrink-0 font-bold text-rose-800 dark:text-rose-200 text-xs sm:text-sm pr-1">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="whitespace-nowrap">Darurat:</span>
        </div>

        <div className="flex items-center gap-2">
          {emergencySymbols.map(sym => {
            const Icon = iconMap[sym.iconName] || AlertCircle;
            const matchedImageUrl = findMatchingBlobUrl(sym.label);

            return (
              <button
                key={sym.id}
                onClick={() => onSelectEmergency(sym)}
                className="px-3.5 py-2 bg-rose-700 hover:bg-rose-800 active:scale-[0.97] text-white font-bold rounded-xl shadow-sm flex items-center gap-2 shrink-0 text-sm whitespace-nowrap border border-rose-800 dark:border-rose-600 transition-all min-h-[46px]"
                style={{ touchAction: 'manipulation' }}
              >
                {matchedImageUrl ? (
                  <img
                    src={matchedImageUrl}
                    alt={sym.label}
                    className="w-6 h-6 object-contain rounded bg-white/95 p-0.5 shrink-0"
                  />
                ) : (
                  <Icon className="w-4 h-4 shrink-0" />
                )}
                <span>{sym.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
