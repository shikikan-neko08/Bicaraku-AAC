import React, { useState, useMemo } from 'react';
import { SymbolItem, GridSize, FigurePreference } from '../types';
import { CATEGORY_LABELS, FITZGERALD_COLOR_STYLES } from '../data/defaultSymbols';
import { SymbolCard } from './SymbolCard';
import { Search, X, Layers } from 'lucide-react';

interface UserModeProps {
  symbols: SymbolItem[];
  blobUrls: Record<string, string>;
  figurePreference: FigurePreference;
  safeLicenseMode: boolean;
  onSelectSymbol: (symbol: SymbolItem) => void;
  onAddPhoto: (symbol: SymbolItem) => void;
  gridSize: GridSize;
  onChangeGridSize: (size: GridSize) => void;
  showTextOnly: boolean;
  imageOnly: boolean;
  touchDelay: number;
}

function isSafeForBoard(sym: SymbolItem, safeLicenseMode: boolean): boolean {
  if (!safeLicenseMode) return true;
  if (
    sym.isCustom ||
    sym.source === 'custom-photo' ||
    sym.source === 'builtin-offline' ||
    sym.source === 'legacy-seed' ||
    sym.isPlaceholder ||
    sym.source === 'placeholder'
  ) {
    return sym.commercialOk !== false;
  }
  return sym.commercialOk === true;
}

function matchesFigurePreference(sym: SymbolItem, pref: FigurePreference): boolean {
  if (pref === 'all') return false;
  const haystack = [
    sym.filename || '',
    sym.label || '',
    sym.variantNote || '',
    sym.notes || '',
    ...(sym.tagsEn || []),
  ]
    .join(' ')
    .toLowerCase();

  if (pref === 'female') {
    return /(?:^|[\s_\-/.,()])(woman|women|female|girl|lady|ladies|mother|mom|wanita|perempuan|ibu|putri|cewek)(?:$|[\s_\-/.,()])/i.test(
      haystack
    );
  }
  if (pref === 'male') {
    return /(?:^|[\s_\-/.,()])(man|men|male|boy|gentleman|father|dad|pria|laki|ayah|putra|cowok|mans)(?:$|[\s_\-/.,()])/i.test(
      haystack
    );
  }
  return false;
}

function getSymbolFolderLabel(sym: SymbolItem): string {
  if (sym.boardCategory && sym.boardCategory.trim()) {
    return sym.boardCategory.trim();
  }
  return CATEGORY_LABELS[sym.category]?.label || sym.category || 'Lainnya';
}

function getFolderSwatch(sym: SymbolItem): string {
  if (sym.fitzgeraldColor && FITZGERALD_COLOR_STYLES[sym.fitzgeraldColor.toLowerCase()]) {
    return FITZGERALD_COLOR_STYLES[sym.fitzgeraldColor.toLowerCase()].swatch;
  }
  return CATEGORY_LABELS[sym.category]?.swatch || 'bg-slate-400';
}

export const UserMode: React.FC<UserModeProps> = ({
  symbols,
  blobUrls,
  figurePreference,
  safeLicenseMode,
  onSelectSymbol,
  onAddPhoto,
  gridSize,
  onChangeGridSize,
  showTextOnly,
  imageOnly,
  touchDelay,
}) => {
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [variantPickerGroup, setVariantPickerGroup] = useState<{
    groupName: string;
    title: string;
    variants: SymbolItem[];
  } | null>(null);

  // Kelompokkan seluruh simbol aman berdasarkan variantGroup untuk Symbol Picker & Preferensi Figur
  const { boardEntries, variantsByGroup, folderTabs } = useMemo(() => {
    const safePool = symbols.filter(sym => isSafeForBoard(sym, safeLicenseMode));
    const groupMap = new Map<string, SymbolItem[]>();

    for (const sym of safePool) {
      if (sym.variantGroup) {
        const list = groupMap.get(sym.variantGroup) || [];
        list.push(sym);
        groupMap.set(sym.variantGroup, list);
      }
    }

    // Hanya entri isDefault = true yang tampil di papan utama
    const defaultsOnly = safePool.filter(sym => sym.isDefault !== false);

    // Jika ada preferensi figur (wanita/pria), pilih varian dari grup yang sama bila tersedia
    const resolved = defaultsOnly.map(sym => {
      if (!sym.variantGroup) return sym;
      const groupVariants = groupMap.get(sym.variantGroup) || [];
      if (groupVariants.length <= 1 || figurePreference === 'all') {
        return sym;
      }
      const preferred = groupVariants.find(v => matchesFigurePreference(v, figurePreference));
      return preferred || sym;
    });

    // Kumpulkan folder kategori dari manifest (category) beserta warna Fitzgerald representatifnya
    const folderMap = new Map<string, string>();
    for (const sym of resolved) {
      const folderName = getSymbolFolderLabel(sym);
      if (!folderMap.has(folderName)) {
        folderMap.set(folderName, getFolderSwatch(sym));
      }
    }
    const tabs = Array.from(folderMap.entries()).map(([name, swatch]) => ({ name, swatch }));

    return { boardEntries: resolved, variantsByGroup: groupMap, folderTabs: tabs };
  }, [symbols, safeLicenseMode, figurePreference]);

  const effectiveSelectedFolder =
    selectedFolder === 'all' || folderTabs.some(t => t.name === selectedFolder)
      ? selectedFolder
      : 'all';

  const filteredSymbols = boardEntries.filter(sym => {
    const folderName = getSymbolFolderLabel(sym);
    const matchesCategory = effectiveSelectedFolder === 'all' || folderName === effectiveSelectedFolder;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      query === '' ||
      sym.label.toLowerCase().includes(query) ||
      (sym.speechText || '').toLowerCase().includes(query) ||
      (sym.variantNote || '').toLowerCase().includes(query) ||
      (sym.tagsEn || []).some(t => t.toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  });

  const gridColsClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
    5: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5',
  }[gridSize] || 'grid-cols-3';

  const handleOpenVariants = (sym: SymbolItem) => {
    if (!sym.variantGroup) return;
    const variants = variantsByGroup.get(sym.variantGroup) || [sym];
    setVariantPickerGroup({
      groupName: sym.variantGroup,
      title: sym.label,
      variants,
    });
  };

  return (
    <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-4 sm:gap-5">
      {/* Category Folders & Search Toolbar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Category Folder Tabs */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 lg:pb-0"
          role="tablist"
          aria-label="Folder Kategori Simbol"
        >
          <button
            role="tab"
            aria-selected={effectiveSelectedFolder === 'all'}
            onClick={() => setSelectedFolder('all')}
            className={`px-3.5 py-2 min-h-[42px] rounded-xl font-semibold text-sm shrink-0 whitespace-nowrap flex items-center gap-2 transition-colors ${
              effectiveSelectedFolder === 'all'
                ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            style={{ touchAction: 'manipulation' }}
          >
            <span>Semua Simbol</span>
          </button>

          {folderTabs.map(folder => {
            const isActive = effectiveSelectedFolder === folder.name;
            return (
              <button
                key={folder.name}
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedFolder(folder.name)}
                className={`px-3.5 py-2 min-h-[42px] rounded-xl font-semibold text-sm shrink-0 whitespace-nowrap flex items-center gap-2 transition-colors ${
                  isActive
                    ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
                style={{ touchAction: 'manipulation' }}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${folder.swatch}`}
                  aria-hidden="true"
                />
                <span>{folder.name}</span>
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
              Coba pilih folder lain atau hapus kata kunci pencarian.
            </p>
          </div>
        ) : (
          filteredSymbols.map(sym => {
            const groupList = sym.variantGroup ? variantsByGroup.get(sym.variantGroup) : undefined;
            const hasVariants = !!groupList && groupList.length > 1;
            return (
              <SymbolCard
                key={sym.id}
                symbol={sym}
                blobUrl={blobUrls[sym.id]}
                hasVariants={hasVariants}
                onSelect={onSelectSymbol}
                onOpenVariants={handleOpenVariants}
                onAddPhoto={onAddPhoto}
                showTextOnly={showTextOnly}
                imageOnly={imageOnly}
                touchDelay={touchDelay}
                gridSize={gridSize}
              />
            );
          })
        )}
      </div>

      {/* Symbol Picker Modal: Varian Lain */}
      {variantPickerGroup && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setVariantPickerGroup(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 max-w-lg w-full shadow-xl border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Varian lain: {variantPickerGroup.title}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pilih varian simbol untuk langsung dimasukkan ke kalimat.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVariantPickerGroup(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                aria-label="Tutup pilihan varian"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto pr-1">
              {variantPickerGroup.variants.map(variant => (
                <div key={variant.id} className="flex flex-col gap-1">
                  <SymbolCard
                    symbol={variant}
                    blobUrl={blobUrls[variant.id]}
                    onSelect={chosen => {
                      onSelectSymbol(chosen);
                      setVariantPickerGroup(null);
                    }}
                    onAddPhoto={
                      variant.isPlaceholder
                        ? target => {
                            setVariantPickerGroup(null);
                            onAddPhoto(target);
                          }
                        : undefined
                    }
                    gridSize={3}
                  />
                  {variant.variantNote && (
                    <span className="text-[11px] text-center text-slate-500 dark:text-slate-400 line-clamp-1 px-1">
                      {variant.variantNote}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
