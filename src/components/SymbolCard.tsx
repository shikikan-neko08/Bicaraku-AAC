import React, { useState, useRef, useEffect } from 'react';
import { SymbolItem, GridSize } from '../types';
import { CATEGORY_LABELS, FITZGERALD_COLOR_STYLES } from '../data/defaultSymbols';
import { Camera, Layers } from 'lucide-react';

interface SymbolCardProps {
  symbol: SymbolItem;
  blobUrl?: string;
  hasVariants?: boolean;
  onSelect: (symbol: SymbolItem) => void;
  onOpenVariants?: (symbol: SymbolItem) => void;
  onAddPhoto?: (symbol: SymbolItem) => void;
  showTextOnly?: boolean;
  imageOnly?: boolean;
  touchDelay?: number; // seconds
  gridSize?: GridSize;
}

export const SymbolCard: React.FC<SymbolCardProps> = ({
  symbol,
  blobUrl,
  hasVariants = false,
  onSelect,
  onOpenVariants,
  onAddPhoto,
  showTextOnly = false,
  imageOnly = false,
  touchDelay = 0,
  gridSize = 3,
}) => {
  const [isPressing, setIsPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const lastClickRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  // Selalu tampilkan gambar dari penyimpanan lokal IndexedDB (blob: URL) atau data:image/ cadangan lokal.
  // Jangan pernah memuat URL eksternal GitHub saat tampilan.
  const resolvedImageSrc =
    blobUrl ||
    (symbol.customImageUrl && symbol.customImageUrl.startsWith('data:image/')
      ? symbol.customImageUrl
      : '');

  const isPlaceholderCard = (!!symbol.isPlaceholder || symbol.source === 'placeholder') && !resolvedImageSrc;
  const isTextFallbackCard = !resolvedImageSrc && !isPlaceholderCard;

  const fitzStyle = symbol.fitzgeraldColor
    ? FITZGERALD_COLOR_STYLES[symbol.fitzgeraldColor.toLowerCase()]
    : undefined;

  const cardStyleClass = isPlaceholderCard
    ? 'bg-slate-100 hover:bg-slate-200/70 text-slate-900 border-dashed border-slate-300 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-100 dark:border-slate-600'
    : fitzStyle
    ? fitzStyle.cardClass
    : CATEGORY_LABELS[symbol.category]?.color ||
      'bg-slate-50 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700';

  const sizeConfig = {
    2: {
      cardMinH: 'min-h-[140px] sm:min-h-[172px]',
      imgSize: 'w-20 h-20 sm:w-24 sm:h-24',
      textSize: 'text-lg sm:text-xl',
    },
    3: {
      cardMinH: 'min-h-[108px] sm:min-h-[132px]',
      imgSize: 'w-16 h-16 sm:w-20 sm:h-20',
      textSize: 'text-base sm:text-lg',
    },
    4: {
      cardMinH: 'min-h-[96px] sm:min-h-[116px]',
      imgSize: 'w-14 h-14 sm:w-16 sm:h-16',
      textSize: 'text-sm sm:text-base',
    },
    5: {
      cardMinH: 'min-h-[84px] sm:min-h-[100px]',
      imgSize: 'w-12 h-12 sm:w-14 sm:h-14',
      textSize: 'text-xs sm:text-sm',
    },
  }[gridSize] || {
    cardMinH: 'min-h-[108px] sm:min-h-[132px]',
    imgSize: 'w-16 h-16 sm:w-20 sm:h-20',
    textSize: 'text-base sm:text-lg',
  };

  const renderVisual = () => {
    if (!resolvedImageSrc) {
      return null;
    }

    return (
      <img
        src={resolvedImageSrc}
        alt={symbol.label}
        className={`${sizeConfig.imgSize} object-contain rounded-xl mx-auto`}
      />
    );
  };

  const triggerSelect = () => {
    const now = Date.now();
    if (now - lastClickRef.current < 300) {
      return;
    }
    lastClickRef.current = now;
    onSelect(symbol);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (touchDelay <= 0) {
      triggerSelect();
    }
  };

  const clearDelayTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPressing(false);
    setProgress(0);
  };

  const handlePressStart = () => {
    if (touchDelay <= 0) return;

    clearDelayTimer();
    setIsPressing(true);
    setProgress(0);
    const intervalTime = 40;
    const steps = Math.max(1, (touchDelay * 1000) / intervalTime);
    let currentStep = 0;

    timerRef.current = window.setInterval(() => {
      currentStep++;
      setProgress(Math.min(100, (currentStep / steps) * 100));
      if (currentStep >= steps) {
        clearDelayTimer();
        triggerSelect();
      }
    }, intervalTime);
  };

  const visualNode = !showTextOnly ? renderVisual() : null;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={handleClick}
        onTouchStart={handlePressStart}
        onTouchEnd={clearDelayTimer}
        onTouchCancel={clearDelayTimer}
        onMouseDown={handlePressStart}
        onMouseUp={clearDelayTimer}
        onMouseLeave={clearDelayTimer}
        className={`w-full ${sizeConfig.cardMinH} px-3 ${
          isPlaceholderCard && onAddPhoto ? 'pt-3.5 pb-11' : 'py-3.5'
        } flex flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-transform duration-150 shadow-xs active:scale-[0.97] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${cardStyleClass}`}
        style={{ touchAction: 'manipulation' }}
      >
        {visualNode && <div className="shrink-0">{visualNode}</div>}

        {(!imageOnly || isPlaceholderCard || isTextFallbackCard || !visualNode) && (
          <span
            className={`font-bold ${
              isPlaceholderCard || isTextFallbackCard
                ? 'text-base sm:text-xl'
                : sizeConfig.textSize
            } text-center leading-snug line-clamp-2`}
          >
            {symbol.label}
          </span>
        )}

        {isPressing && touchDelay > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/15 dark:bg-white/15">
            <div
              className="h-full bg-blue-600 transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </button>

      {hasVariants && onOpenVariants && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onOpenVariants(symbol);
          }}
          title="Varian lain"
          aria-label={`Pilih varian lain untuk ${symbol.label}`}
          className="absolute top-1.5 right-1.5 min-w-[32px] min-h-[32px] px-2 py-1 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 shadow-xs flex items-center gap-1 text-[11px] font-semibold"
          style={{ touchAction: 'manipulation' }}
        >
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Varian</span>
        </button>
      )}

      {isPlaceholderCard && onAddPhoto && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onAddPhoto(symbol);
          }}
          className="absolute inset-x-2 bottom-2 min-h-[30px] px-2.5 py-1 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs"
          style={{ touchAction: 'manipulation' }}
        >
          <Camera className="w-3.5 h-3.5 shrink-0" />
          <span>Tambah foto</span>
        </button>
      )}
    </div>
  );
};
