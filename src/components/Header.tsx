import React, { useState, useRef, useEffect } from 'react';
import { LocationContextType, GridSize } from '../types';
import { Shield, Home, School, Stethoscope, MapPin, Moon, Sun, MessageSquare, Menu, X } from 'lucide-react';

interface HeaderProps {
  currentLocation: LocationContextType;
  onChangeLocation: (loc: LocationContextType) => void;
  gridSize: GridSize;
  onChangeGridSize: (size: GridSize) => void;
  onOpenCaregiverMode: () => void;
  theme: string;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentLocation,
  onChangeLocation,
  gridSize,
  onChangeGridSize,
  onOpenCaregiverMode,
  theme,
  onToggleTheme,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [mobileMenuOpen]);

  const locations: { id: LocationContextType; label: string; icon: React.ElementType }[] = [
    { id: 'Rumah', label: 'Rumah', icon: Home },
    { id: 'Sekolah', label: 'Sekolah', icon: School },
    { id: 'Terapi', label: 'Terapi', icon: Stethoscope },
    { id: 'Lainnya', label: 'Lainnya', icon: MapPin },
  ];

  const gridSizes: GridSize[] = [2, 3, 4, 5];

  return (
    <header
      ref={menuRef}
      className="relative bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5 sm:gap-4">
        {/* Brand Wordmark */}
        <div className="order-1 flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            <MessageSquare className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            BicaraKu
          </span>
        </div>

        {/* Location Context Segmented Control */}
        <div
          className="order-3 md:order-2 w-full md:w-auto grid grid-cols-4 md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80"
          role="group"
          aria-label="Konteks Lokasi"
        >
          {locations.map(loc => {
            const Icon = loc.icon;
            const isActive = currentLocation === loc.id;
            return (
              <button
                key={loc.id}
                onClick={() => onChangeLocation(loc.id)}
                className={`px-2 md:px-3 py-1.5 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0 transition-colors min-h-[38px] ${
                  isActive
                    ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
                style={{ touchAction: 'manipulation' }}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">{loc.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Controls: Hamburger on Mobile/Tablet, Full Controls on Desktop */}
        <div className="order-2 md:order-3 flex items-center gap-2 shrink-0">
          {/* Mobile & Tablet Hamburger Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 transition-colors"
            aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu pengaturan'}
            aria-expanded={mobileMenuOpen}
            style={{ touchAction: 'manipulation' }}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Desktop Controls: Grid Size, Theme, Caregiver */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <div
              className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80"
              role="group"
              aria-label="Ukuran Grid"
            >
              {gridSizes.map(size => (
                <button
                  key={size}
                  onClick={() => onChangeGridSize(size)}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold text-xs tabular-nums transition-colors min-h-[36px] ${
                    gridSize === size
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {size}×{size}
                </button>
              ))}
            </div>

            <button
              onClick={onToggleTheme}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
              title={theme === 'dark' ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
              aria-label={theme === 'dark' ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>

            <button
              onClick={onOpenCaregiverMode}
              className="px-4 py-2.5 min-h-[44px] bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 active:scale-[0.98] text-white font-semibold rounded-xl shadow-sm flex items-center gap-2 text-sm whitespace-nowrap shrink-0 transition-all"
              style={{ touchAction: 'manipulation' }}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>Mode Caregiver</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile & Tablet Dropdown Menu (Dark Mode & Caregiver Mode) */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute right-4 sm:right-6 top-16 z-40 w-60 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-2 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => {
              onToggleTheme();
              setMobileMenuOpen(false);
            }}
            className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-sm flex items-center gap-3 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-500 shrink-0" />
            ) : (
              <Moon className="w-5 h-5 text-slate-600 dark:text-slate-300 shrink-0" />
            )}
            <span>{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenCaregiverMode();
            }}
            className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white font-semibold text-sm flex items-center gap-3 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <Shield className="w-5 h-5 shrink-0" />
            <span>Mode Caregiver</span>
          </button>
        </div>
      )}
    </header>
  );
};
