import React, { useState, useRef, useEffect } from 'react';
import { SymbolItem, GridSize } from '../types';
import { CATEGORY_LABELS } from '../data/defaultSymbols';
import * as Icons from 'lucide-react';

interface SymbolCardProps {
  symbol: SymbolItem;
  onSelect: (symbol: SymbolItem) => void;
  showTextOnly?: boolean;
  imageOnly?: boolean;
  touchDelay?: number; // seconds
  gridSize?: GridSize;
}

export const SymbolCard: React.FC<SymbolCardProps> = ({
  symbol,
  onSelect,
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

  const catMeta = CATEGORY_LABELS[symbol.category] || {
    color: 'bg-slate-50 text-slate-900 border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700',
    badgeColor: 'bg-slate-100 text-slate-800',
    swatch: 'bg-slate-400',
  };

  const sizeConfig = {
    2: {
      cardMinH: 'min-h-[140px] sm:min-h-[172px]',
      iconSize: 'w-14 h-14 sm:w-20 sm:h-20',
      imgSize: 'w-20 h-20 sm:w-24 sm:h-24',
      textSize: 'text-lg sm:text-xl',
    },
    3: {
      cardMinH: 'min-h-[108px] sm:min-h-[132px]',
      iconSize: 'w-11 h-11 sm:w-14 sm:h-14',
      imgSize: 'w-16 h-16 sm:w-20 sm:h-20',
      textSize: 'text-base sm:text-lg',
    },
    4: {
      cardMinH: 'min-h-[96px] sm:min-h-[116px]',
      iconSize: 'w-9 h-9 sm:w-11 sm:h-11',
      imgSize: 'w-14 h-14 sm:w-16 sm:h-16',
      textSize: 'text-sm sm:text-base',
    },
    5: {
      cardMinH: 'min-h-[84px] sm:min-h-[100px]',
      iconSize: 'w-8 h-8 sm:w-10 sm:h-10',
      imgSize: 'w-12 h-12 sm:w-14 sm:h-14',
      textSize: 'text-xs sm:text-sm',
    },
  }[gridSize] || {
    cardMinH: 'min-h-[108px] sm:min-h-[132px]',
    iconSize: 'w-11 h-11 sm:w-14 sm:h-14',
    imgSize: 'w-16 h-16 sm:w-20 sm:h-20',
    textSize: 'text-base sm:text-lg',
  };

  const renderIcon = () => {
    if (symbol.customImageUrl) {
      return (
        <img
          src={symbol.customImageUrl}
          alt={symbol.label}
          referrerPolicy="no-referrer"
          className={`${sizeConfig.imgSize} object-cover rounded-xl mx-auto border border-black/10 dark:border-white/10`}
        />
      );
    }

    const iconMap = Icons as unknown as Record<string, React.ElementType>;
    const IconComponent = iconMap[symbol.iconName];
    if (IconComponent) {
      return <IconComponent className={`${sizeConfig.iconSize} mx-auto stroke-[1.75]`} />;
    }

    return <span className="text-4xl sm:text-5xl leading-none">{symbol.iconName || '⭐'}</span>;
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
        className={`w-full ${sizeConfig.cardMinH} px-3 py-3.5 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-transform duration-150 shadow-xs active:scale-[0.97] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${catMeta.color}`}
        style={{ touchAction: 'manipulation' }}
      >
        {!showTextOnly && <div className="shrink-0">{renderIcon()}</div>}
        {!imageOnly && (
          <span className={`font-bold ${sizeConfig.textSize} text-center leading-snug line-clamp-2`}>
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
    </div>
  );
};
