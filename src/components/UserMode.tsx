import React, { useState } from 'react';
import { SymbolItem, FitzgeraldCategory, GridSize } from '../types';
import { CATEGORY_LABELS } from '../data/defaultSymbols';
import { SymbolCard } from './SymbolCard';
import { Search, X } from 'lucide-react';

interface UserModeProps {
  symbols: SymbolItem[];
  onSelectSymbol: (symbol: SymbolItem) => void;
  gridSize: GridSize;
  onChangeGridSize: (size: GridSize) => void;
  showTextOnly: boolean;
  imageOnly: boolean;
  touchDelay: number;
}

export const UserMode: React.FC<UserModeProps> = ({
  symbols,
  onSelectSymbol,
  gridSize,
  onChangeGridSize,
  showTextOnly,
  imageOnly,
  touchDelay,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<FitzgeraldCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories: (FitzgeraldCategory | 'all')[] = [
    'all',
    'needs',
    'feelings',
    'verbs',
    'nouns',
    'people',
    'adjectives',
    'social',
    'places',
    'activities',
    'emergency',
  ];

  const filteredSymbols = symbols.filter(sym => {
    const matchesCategory = selectedCategory === 'all' || sym.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' || sym.label.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const gridColsClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
    5: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5',
  }[gridSize] || 'grid-cols-3';

  return (
    <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-4 sm:gap-5">
      {/* Category Tabs & Search Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Category Filter Tabs */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 lg:pb-0"
          role="tablist"
          aria-label="Kategori Simbol"
        >
          {categories.map(cat => {
            const isAll = cat === 'all';
            const meta = CATEGORY_LABELS[cat];
            const isActive = selectedCategory === cat;

            return (
              <button
                key={cat}
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 min-h-[42px] rounded-xl font-semibold text-sm shrink-0 whitespace-nowrap flex items-center gap-2 transition-colors ${
                  isActive
                    ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                style={{ touchAction: 'manipulation' }}
              >
                {!isAll && meta && (
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.swatch}`}
                    aria-hidden="true"
                  />
                )}
                <span>{isAll ? 'Semua Simbol' : meta?.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search & Mobile Grid Size */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative flex-1 lg:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari simbol..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full min-h-[42px] pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                aria-label="Hapus pencarian"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div
            className="flex lg:hidden items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0"
            role="group"
            aria-label="Ukuran Grid"
          >
            {([2, 3, 4, 5] as GridSize[]).map(size => (
              <button
                key={size}
                onClick={() => onChangeGridSize(size)}
                className={`min-w-[34px] min-h-[34px] px-1.5 rounded-lg font-semibold text-xs tabular-nums ${
                  gridSize === size
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {size}×{size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Symbol Grid (Motor planning stable layout) */}
      <div className={`grid ${gridColsClass} gap-3 sm:gap-4 pb-12`}>
        {filteredSymbols.length === 0 ? (
          <div className="col-span-full py-16 px-4 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <p className="text-base font-semibold text-slate-600 dark:text-slate-300">
              Tidak ada simbol ditemukan.
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              Coba pilih kategori lain atau hapus kata kunci pencarian.
            </p>
          </div>
        ) : (
          filteredSymbols.map(sym => (
            <SymbolCard
              key={sym.id}
              symbol={sym}
              onSelect={onSelectSymbol}
              showTextOnly={showTextOnly}
              imageOnly={imageOnly}
              touchDelay={touchDelay}
              gridSize={gridSize}
            />
          ))
        )}
      </div>
    </main>
  );
};
