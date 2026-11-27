import React, { useState, useRef, useEffect } from 'react';
import {
  SymbolItem,
  AACProfile,
  UsageLog,
  FitzgeraldCategory,
  GridSize,
  AdaptiveSuggestion,
  FigurePreference,
  ManifestMeta,
  LicenseDocs,
  SymbolUpdateDiffItem,
  SyncSummary,
  SyncDiagnostics,
  CustomBoardCategory,
  FitzgeraldColorKey,
} from '../types';
import { MANIFEST_URL, BUNDLED_SYMBOLS_VERSION } from '../config/symbolSource';
import { CATEGORY_LABELS, FITZGERALD_COLOR_STYLES } from '../data/defaultSymbols';
import { PRESET_BOARD_CATEGORIES, inferFitzgeraldCategory } from '../services/storage';
import { getAvailableVoices } from '../services/tts';
import { encryptPin, decryptPin, EncryptedPinPayload } from '../services/crypto';
import { sanitizeSvgText, MAX_SYMBOL_FILE_BYTES } from '../services/svgSanitizer';
import { getLicenseDocs } from '../services/indexedDb';
import {
  checkForManifestUpdates,
  applyManifestUpdates,
  fetchAndStoreLicenseDocs,
  ParsedManifestResult,
} from '../services/symbolSync';
import * as Icons from 'lucide-react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Settings,
  BarChart3,
  Sparkles,
  Download,
  Upload,
  Image as ImageIcon,
  Shield,
  Search,
  FileSpreadsheet,
  Check,
  X,
  Volume2,
  KeyRound,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  FileText,
  Camera,
  AlertCircle,
  Activity,
  RotateCcw,
  Tag,
  CheckSquare,
  Square,
} from 'lucide-react';

interface CaregiverModeProps {
  symbols: SymbolItem[];
  blobUrls: Record<string, string>;
  onSaveSymbols: (symbols: SymbolItem[]) => Promise<void> | void;
  onSaveSymbolPhoto: (symbolId: string, blob: Blob, markModified?: boolean) => Promise<void>;
  onDeleteSymbol: (symbolId: string) => Promise<void>;
  onSyncCompleted: (symbols: SymbolItem[], meta: ManifestMeta) => Promise<void>;
  onRestartDownload: () => Promise<void> | void;
  onResetBundledSymbols: (keepCaregiverSymbols: boolean) => Promise<void> | void;
  profile: AACProfile;
  onSaveProfile: (profile: AACProfile) => void;
  customCategories: CustomBoardCategory[];
  onSaveCustomCategories: (categories: CustomBoardCategory[]) => void;
  logs: UsageLog[];
  onClose: () => void;
  suggestions: AdaptiveSuggestion[];
  manifestMeta: ManifestMeta | null;
  diagnostics: SyncDiagnostics | null;
  initialEditSymbolId?: string | null;
  onClearInitialEditSymbol?: () => void;
}

async function prepareLocalImageBlob(file: File): Promise<{ ok: true; blob: Blob } | { ok: false; error: string }> {
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  if (isSvg) {
    const rawText = await file.text();
    const sanitized = sanitizeSvgText(rawText);
    if (!sanitized.ok) {
      return { ok: false, error: sanitized.error };
    }
    return { ok: true, blob: sanitized.blob };
  }

  const allowedRaster = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
  if (!allowedRaster.includes(file.type) && !/\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
    return { ok: false, error: 'Gunakan berkas gambar PNG, JPG, WebP, GIF, atau SVG.' };
  }

  if (file.size <= MAX_SYMBOL_FILE_BYTES) {
    return { ok: true, blob: file };
  }

  // Kompres gambar besar agar muat di bawah batas 500 KB saat disimpan di IndexedDB
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 512;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ ok: false, error: 'Gagal memproses gambar.' });
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        blob => {
          if (!blob) {
            resolve({ ok: false, error: 'Gagal mengonversi gambar.' });
            return;
          }
          resolve({ ok: true, blob });
        },
        'image/webp',
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ ok: false, error: 'Berkas gambar tidak dapat dibaca.' });
    };
    img.src = url;
  });
}

export const CaregiverMode: React.FC<CaregiverModeProps> = ({
  symbols,
  blobUrls,
  onSaveSymbols,
  onSaveSymbolPhoto,
  onDeleteSymbol,
  onSyncCompleted,
  onRestartDownload,
  onResetBundledSymbols,
  profile,
  onSaveProfile,
  customCategories,
  onSaveCustomCategories,
  logs,
  onClose,
  suggestions,
  manifestMeta,
  diagnostics,
  initialEditSymbolId,
  onClearInitialEditSymbol,
}) => {
  const [activeTab, setActiveTab] = useState<
    'symbols' | 'categories' | 'updates' | 'diagnostics' | 'profile' | 'licenses' | 'suggestions' | 'analytics' | 'backup'
  >('symbols');
  const [editingSymbol, setEditingSymbol] = useState<SymbolItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<AACProfile>(profile);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [symbolCatFilter, setSymbolCatFilter] = useState<string>('all');
  const [onlyNeedPhoto, setOnlyNeedPhoto] = useState(false);

  // Form state for symbol add/edit
  const [formLabel, setFormLabel] = useState('');
  const [formSpokenText, setFormSpokenText] = useState('');
  const [formCategory, setFormCategory] = useState<FitzgeraldCategory>('nouns');
  const [formBoardCategory, setFormBoardCategory] = useState('Benda');
  const [formCustomCategoryInput, setFormCustomCategoryInput] = useState('');
  const [formFitzgeraldColor, setFormFitzgeraldColor] = useState<FitzgeraldColorKey>('orange');
  const [formIconName, setFormIconName] = useState('Star');
  const [formCustomImagePreview, setFormCustomImagePreview] = useState<string | undefined>(undefined);
  const [pendingPhotoBlob, setPendingPhotoBlob] = useState<Blob | null>(null);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);

  // Category manager state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState<FitzgeraldColorKey>('yellow');
  const [catManagerSearch, setCatManagerSearch] = useState('');
  const [catManagerFilter, setCatManagerFilter] = useState<string>('all');
  const [selectedSymbolIds, setSelectedSymbolIds] = useState<string[]>([]);
  const [bulkTargetCategory, setBulkTargetCategory] = useState<string>('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [editingCatColor, setEditingCatColor] = useState<FitzgeraldColorKey>('orange');

  // Quick photo upload target (untuk kartu "Perlu foto/simbol")
  const quickPhotoInputRef = useRef<HTMLInputElement>(null);
  const quickPhotoTargetRef = useRef<string | null>(null);

  // Change PIN form state
  const [oldPinInput, setOldPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [showPinDigits, setShowPinDigits] = useState(false);
  const [pinFormError, setPinFormError] = useState<string | null>(null);

  // Manifest update checker state
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isApplyingUpdates, setIsApplyingUpdates] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [checkedManifest, setCheckedManifest] = useState<ParsedManifestResult | null>(null);
  const [updateDiffs, setUpdateDiffs] = useState<SymbolUpdateDiffItem[]>([]);
  const [updateCheckedOnce, setUpdateCheckedOnce] = useState(false);
  const [lastAppliedSummary, setLastAppliedSummary] = useState<SyncSummary | null>(null);

  // Diagnostics panel state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isRunningDiagAction, setIsRunningDiagAction] = useState(false);

  // License & Credits state
  const [licenseDocs, setLicenseDocs] = useState<LicenseDocs | null>(null);
  const [isRefreshingDocs, setIsRefreshingDocs] = useState(false);
  const [auditFilter, setAuditFilter] = useState<'all' | 'restricted' | 'attribution'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAvailableVoices().then(v => setVoices(v));
    getLicenseDocs().then(docs => setLicenseDocs(docs));
  }, []);

  useEffect(() => {
    if (initialEditSymbolId) {
      const target = symbols.find(s => s.id === initialEditSymbolId);
      if (target) {
        setActiveTab('symbols');
        handleOpenEdit(target);
      }
      onClearInitialEditSymbol?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEditSymbolId]);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const renderSymbolPreview = (sym: SymbolItem) => {
    const src = blobUrls[sym.id] || sym.customImageUrl;
    if (src) {
      return <img src={src} alt={sym.label} className="w-full h-full object-contain p-1" />;
    }
    if (sym.isPlaceholder) {
      return <Camera className="w-5 h-5 text-slate-400 dark:text-slate-500" />;
    }
    const iconMap = Icons as unknown as Record<string, React.ElementType>;
    const IconComp = iconMap[sym.iconName];
    if (IconComp) {
      return <IconComp className="w-6 h-6 text-slate-700 dark:text-slate-200" />;
    }
    return (
      <span className="text-lg font-bold text-slate-700 dark:text-slate-200">
        {sym.label.slice(0, 2)}
      </span>
    );
  };

  // Symbol CRUD handlers
  const handleOpenAdd = () => {
    setEditingSymbol(null);
    setFormLabel('');
    setFormSpokenText('');
    setFormCategory('nouns');
    setFormBoardCategory(customCategories[0]?.name || 'Benda');
    setFormCustomCategoryInput('');
    setFormFitzgeraldColor(customCategories[0]?.colorKey || 'orange');
    setFormIconName('Star');
    setFormCustomImagePreview(undefined);
    setPendingPhotoBlob(null);
    setPhotoUploadError(null);
    setIsAddingNew(true);
  };

  const handleOpenEdit = (sym: SymbolItem) => {
    const currentFolder = sym.boardCategory?.trim() || CATEGORY_LABELS[sym.category]?.label || 'Benda';
    const currentColor = (sym.fitzgeraldColor?.toLowerCase() as FitzgeraldColorKey) || 'orange';
    setEditingSymbol(sym);
    setFormLabel(sym.label);
    setFormSpokenText(sym.spokenText || sym.speechText || sym.label);
    setFormCategory(sym.category);
    setFormBoardCategory(currentFolder);
    setFormCustomCategoryInput('');
    setFormFitzgeraldColor(
      FITZGERALD_COLOR_STYLES[currentColor] ? currentColor : 'orange'
    );
    setFormIconName(sym.iconName);
    setFormCustomImagePreview(blobUrls[sym.id] || sym.customImageUrl);
    setPendingPhotoBlob(null);
    setPhotoUploadError(null);
    setIsAddingNew(true);
  };

  const ensureCategoryRegistered = (categoryName: string, colorKey: FitzgeraldColorKey) => {
    const trimmed = categoryName.trim();
    if (!trimmed) return;
    const existsInCustom = customCategories.some(
      c => c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    const existsInSymbols = symbols.some(
      s => (s.boardCategory?.trim() || CATEGORY_LABELS[s.category]?.label || '').toLowerCase() === trimmed.toLowerCase()
    );
    if (!existsInCustom && !existsInSymbols) {
      onSaveCustomCategories([
        ...customCategories,
        { id: 'cat-' + Date.now(), name: trimmed, colorKey },
      ]);
    }
  };

  const handleSaveSymbolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabel.trim()) return;

    const cleanLabel = formLabel.trim();
    const cleanSpoken = formSpokenText.trim() || cleanLabel;
    const resolvedBoardCategory =
      formBoardCategory === '__custom__'
        ? formCustomCategoryInput.trim() || CATEGORY_LABELS[formCategory]?.label || 'Lainnya'
        : formBoardCategory.trim() || CATEGORY_LABELS[formCategory]?.label || 'Lainnya';

    if (formBoardCategory === '__custom__' && formCustomCategoryInput.trim()) {
      ensureCategoryRegistered(resolvedBoardCategory, formFitzgeraldColor);
    }

    const nextFitzCategory = inferFitzgeraldCategory(resolvedBoardCategory, formFitzgeraldColor);

    if (editingSymbol) {
      const updatedSym: SymbolItem = {
        ...editingSymbol,
        label: cleanLabel,
        spokenText: cleanSpoken,
        speechText: cleanSpoken,
        category: nextFitzCategory,
        boardCategory: resolvedBoardCategory,
        fitzgeraldColor: formFitzgeraldColor,
        iconName: formIconName,
        userModified: true,
        isPlaceholder: pendingPhotoBlob ? false : editingSymbol.isPlaceholder && !blobUrls[editingSymbol.id] && !editingSymbol.customImageUrl,
        hasImageBlob: pendingPhotoBlob ? true : editingSymbol.hasImageBlob,
        downloadStatus: pendingPhotoBlob ? 'done' : editingSymbol.downloadStatus,
      };
      const updatedList = symbols.map(s => (s.id === editingSymbol.id ? updatedSym : s));
      await onSaveSymbols(updatedList);
      if (pendingPhotoBlob) {
        await onSaveSymbolPhoto(editingSymbol.id, pendingPhotoBlob, true);
      }
      showNotification('Simbol diperbarui dan ditandai sebagai perubahan caregiver.');
    } else {
      const newId = 'sym-' + Date.now();
      const newSym: SymbolItem = {
        id: newId,
        filename: null,
        label: cleanLabel,
        spokenText: cleanSpoken,
        speechText: cleanSpoken,
        category: nextFitzCategory,
        boardCategory: resolvedBoardCategory,
        fitzgeraldColor: formFitzgeraldColor,
        iconName: formIconName,
        isCustom: true,
        isDefault: true,
        isPlaceholder: !pendingPhotoBlob,
        hasImageBlob: !!pendingPhotoBlob,
        downloadStatus: pendingPhotoBlob ? 'done' : 'placeholder',
        userModified: true,
        source: pendingPhotoBlob ? 'custom-photo' : 'custom',
        license: 'Pribadi (Lokal)',
        author: currentProfile.userName || 'Caregiver',
        commercialOk: true,
        attributionRequired: false,
        frequency: 0,
      };
      await onSaveSymbols([newSym, ...symbols]);
      if (pendingPhotoBlob) {
        await onSaveSymbolPhoto(newId, pendingPhotoBlob, true);
      }
      showNotification('Simbol baru disimpan secara lokal.');
    }

    setPendingPhotoBlob(null);
    setIsAddingNew(false);
  };

  const handleDeleteSymbolClick = async (id: string) => {
    await onDeleteSymbol(id);
    showNotification('Simbol dihapus dari penyimpanan lokal.');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploadError(null);
    const prepared = await prepareLocalImageBlob(file);
    if (!prepared.ok) {
      setPhotoUploadError(prepared.error);
      return;
    }
    setPendingPhotoBlob(prepared.blob);
    const previewUrl = URL.createObjectURL(prepared.blob);
    setFormCustomImagePreview(previewUrl);
  };

  const triggerQuickPhotoUpload = (symbolId: string) => {
    quickPhotoTargetRef.current = symbolId;
    quickPhotoInputRef.current?.click();
  };

  const handleQuickPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = quickPhotoTargetRef.current;
    e.target.value = '';
    if (!file || !targetId) return;

    const prepared = await prepareLocalImageBlob(file);
    if (!prepared.ok) {
      showNotification(prepared.error);
      return;
    }

    await onSaveSymbolPhoto(targetId, prepared.blob, true);
    showNotification('Foto pribadi disimpan lokal di perangkat (tidak diunggah ke internet).');
  };

  // Profile Save
  const handleSaveProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile(currentProfile);
    showNotification('Pengaturan profil dan suara disimpan.');
  };

  // Immediate toggle switch for Auto-Speak on tap
  const handleToggleAutoSpeak = () => {
    const nextValue = !currentProfile.singleTapSpeak;
    const updated = { ...currentProfile, singleTapSpeak: nextValue };
    setCurrentProfile(updated);
    onSaveProfile(updated);
    showNotification(
      nextValue
        ? 'Saklar aktif: simbol langsung berbicara saat ditekan.'
        : 'Saklar nonaktif: gunakan tombol Ucapkan untuk berbicara.'
    );
  };

  // Apply adaptive suggestion (move symbol to front of board)
  const handleApplySuggestion = async (sugg: AdaptiveSuggestion) => {
    const target = symbols.find(s => s.id === sugg.symbolId);
    if (!target) return;
    const reordered = [target, ...symbols.filter(s => s.id !== sugg.symbolId)];
    await onSaveSymbols(reordered);
    showNotification(`Simbol "${sugg.symbolLabel}" dipindahkan ke posisi utama.`);
  };

  // Change PIN handler
  const handleChangePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinFormError(null);

    const activePin = profile.pinCode || '1234';
    if (oldPinInput !== activePin) {
      setPinFormError('PIN saat ini tidak sesuai.');
      return;
    }
    if (!/^\d{4}$/.test(newPinInput)) {
      setPinFormError('PIN baru harus terdiri dari 4 angka.');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setPinFormError('Konfirmasi PIN baru tidak cocok.');
      return;
    }

    const updated = { ...currentProfile, pinCode: newPinInput };
    setCurrentProfile(updated);
    onSaveProfile(updated);
    setOldPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    showNotification('PIN Caregiver berhasil diperbarui.');
  };

  // Manifest Update Check & Apply
  const handleCheckUpdates = async () => {
    setIsCheckingUpdates(true);
    setUpdateError(null);
    setLastAppliedSummary(null);
    try {
      const res = await checkForManifestUpdates(symbols);
      setCheckedManifest(res.manifest);
      setUpdateDiffs(res.diffs);
      setUpdateCheckedOnce(true);
    } catch (err: unknown) {
      setUpdateError(
        err instanceof Error
          ? err.message
          : 'Gagal memeriksa pembaruan dari repositori simbol.'
      );
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleSetDiffResolution = (id: string, resolution: 'keep_mine' | 'use_new') => {
    setUpdateDiffs(prev =>
      prev.map(d => (d.id === id ? { ...d, resolution } : d))
    );
  };

  const handleConfirmApplyUpdates = async () => {
    if (!checkedManifest) return;
    setIsApplyingUpdates(true);
    setUpdateError(null);
    try {
      const result = await applyManifestUpdates(
        updateDiffs,
        {
          version: checkedManifest.version,
          hash: checkedManifest.hash,
          usedMirror: checkedManifest.usedMirror,
        },
        symbols
      );
      const docs = await getLicenseDocs();
      setLicenseDocs(docs);
      await onSyncCompleted(result.symbols, {
        version: checkedManifest.version,
        hash: checkedManifest.hash,
        downloadedAt: Date.now(),
        completedInit: true,
        offlineTextFallback: false,
        lastSummary: result.summary,
      });
      setLastAppliedSummary(result.summary);
      setUpdateDiffs([]);
      setCheckedManifest(null);
      setUpdateCheckedOnce(false);
      showNotification('Pembaruan simbol berhasil diterapkan secara lokal.');
    } catch (err: unknown) {
      setUpdateError(err instanceof Error ? err.message : 'Gagal menerapkan pembaruan simbol.');
    } finally {
      setIsApplyingUpdates(false);
    }
  };

  const handleRefreshLicenseDocs = async () => {
    setIsRefreshingDocs(true);
    try {
      const docs = await fetchAndStoreLicenseDocs();
      setLicenseDocs(docs);
      showNotification('Dokumen LICENSE-MULBERRY.txt dan CREDITS.md diperbarui.');
    } catch {
      showNotification('Gagal mengunduh dokumen lisensi. Pastikan internet aktif.');
    } finally {
      setIsRefreshingDocs(false);
    }
  };

  // Backup & Restore (with AES-256-GCM encrypted PIN)
  const handleExportJSON = async () => {
    const { pinCode, ...safeProfile } = currentProfile;
    const encryptedPin = await encryptPin(pinCode || '1234');
    const data = {
      symbols,
      customCategories,
      profile: {
        ...safeProfile,
        encryptedPin,
      },
      logs,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bicaraku-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Cadangan JSON diunduh (PIN terenkripsi AES-256-GCM).');
  };

  const handleExportCSV = () => {
    const headers = ['Waktu', 'Simbol', 'Kategori', 'Lokasi', 'Periode'];
    const rows = logs.map(l => [
      new Date(l.timestamp).toLocaleString('id-ID'),
      `"${(l.symbolLabel || '').replace(/"/g, '""')}"`,
      l.category,
      l.location,
      l.timeOfDay,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bicaraku-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Riwayat CSV untuk terapis berhasil diunduh.');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.symbols && Array.isArray(parsed.symbols)) {
          await onSaveSymbols(parsed.symbols);
          if (Array.isArray(parsed.customCategories)) {
            onSaveCustomCategories(parsed.customCategories);
          }
          if (parsed.profile) {
            const { encryptedPin, ...restProfile } = parsed.profile as Partial<AACProfile> & {
              encryptedPin?: EncryptedPinPayload;
            };
            let restoredPin = currentProfile.pinCode || '1234';
            if (encryptedPin) {
              const decrypted = await decryptPin(encryptedPin);
              if (decrypted) {
                restoredPin = decrypted;
              }
            } else if (typeof restProfile.pinCode === 'string' && /^\d{4}$/.test(restProfile.pinCode)) {
              restoredPin = restProfile.pinCode;
            }
            const nextProfile: AACProfile = {
              ...currentProfile,
              ...restProfile,
              pinCode: restoredPin,
            };
            setCurrentProfile(nextProfile);
            onSaveProfile(nextProfile);
          }
          showNotification('Cadangan berhasil dipulihkan ke IndexedDB.');
        }
      } catch {
        showNotification('Format file JSON tidak valid.');
      }
    };
    reader.readAsText(file);
  };

  // Daftar semua kategori papan (gabungan kategori kustom caregiver + kategori manifest)
  const symbolFolderNames = symbols.map(
    s => s.boardCategory?.trim() || CATEGORY_LABELS[s.category]?.label || s.category
  );
  const availableFolderNames = Array.from(
    new Set([
      ...customCategories.map(c => c.name.trim()).filter(Boolean),
      ...symbolFolderNames.filter(Boolean),
    ])
  );

  // Handlers untuk pengaturan Kategori Tombol
  const handleAddCustomCategory = (name: string, colorKey: FitzgeraldColorKey) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const duplicate = availableFolderNames.some(
      existing => existing.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      showNotification(`Kategori "${trimmed}" sudah tersedia.`);
      return;
    }
    const nextList: CustomBoardCategory[] = [
      ...customCategories,
      { id: 'cat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5), name: trimmed, colorKey },
    ];
    onSaveCustomCategories(nextList);
    setNewCategoryName('');
    showNotification(`Kategori "${trimmed}" ditambahkan. Sekarang Anda dapat memasukkan tombol ke dalamnya.`);
  };

  const handleSaveEditedCategory = async (cat: CustomBoardCategory) => {
    const nextName = editingCatName.trim();
    if (!nextName) return;
    const prevName = cat.name.trim();
    const updatedCats = customCategories.map(c =>
      c.id === cat.id ? { ...c, name: nextName, colorKey: editingCatColor } : c
    );
    onSaveCustomCategories(updatedCats);

    // Perbarui semua simbol yang berada di kategori ini jika nama atau warna berubah
    const affected = symbols.some(
      s => (s.boardCategory?.trim() || '').toLowerCase() === prevName.toLowerCase()
    );
    if (affected) {
      const nextSymbols = symbols.map(s => {
        if ((s.boardCategory?.trim() || '').toLowerCase() !== prevName.toLowerCase()) return s;
        return {
          ...s,
          boardCategory: nextName,
          fitzgeraldColor: editingCatColor,
          category: inferFitzgeraldCategory(nextName, editingCatColor),
          userModified: true,
        };
      });
      await onSaveSymbols(nextSymbols);
    }

    setEditingCatId(null);
    showNotification(`Kategori "${nextName}" diperbarui.`);
  };

  const handleDeleteCustomCategory = (catId: string) => {
    const target = customCategories.find(c => c.id === catId);
    onSaveCustomCategories(customCategories.filter(c => c.id !== catId));
    if (target) {
      showNotification(`Kategori "${target.name}" dihapus dari daftar kustom (simbol tetap aman).`);
    }
  };

  const resolveCategoryColor = (folderName: string): FitzgeraldColorKey | undefined => {
    const custom = customCategories.find(
      c => c.name.trim().toLowerCase() === folderName.trim().toLowerCase()
    );
    if (custom) return custom.colorKey;
    const sample = symbols.find(
      s => (s.boardCategory?.trim() || CATEGORY_LABELS[s.category]?.label || s.category).toLowerCase() === folderName.trim().toLowerCase() && s.fitzgeraldColor
    );
    const key = sample?.fitzgeraldColor?.toLowerCase() as FitzgeraldColorKey | undefined;
    return key && FITZGERALD_COLOR_STYLES[key] ? key : undefined;
  };

  const handleAssignSymbolCategory = async (symbolIds: string[], targetFolderName: string) => {
    const trimmed = targetFolderName.trim();
    if (!trimmed || symbolIds.length === 0) return;
    const idSet = new Set(symbolIds);
    const colorKey = resolveCategoryColor(trimmed);
    const nextFitzCat = inferFitzgeraldCategory(trimmed, colorKey);

    const updatedSymbols = symbols.map(s => {
      if (!idSet.has(s.id)) return s;
      return {
        ...s,
        boardCategory: trimmed,
        fitzgeraldColor: colorKey || s.fitzgeraldColor,
        category: nextFitzCat,
        userModified: true,
      };
    });

    await onSaveSymbols(updatedSymbols);
    setSelectedSymbolIds([]);
    showNotification(
      symbolIds.length === 1
        ? `Tombol dipindahkan ke kategori "${trimmed}".`
        : `${symbolIds.length} tombol dipindahkan ke kategori "${trimmed}".`
    );
  };

  // Symbols needing photos (placeholder atau gambar belum terunduh)
  const needPhotoSymbols = symbols.filter(
    s =>
      s.isPlaceholder ||
      s.source === 'placeholder' ||
      (!blobUrls[s.id] && !s.customImageUrl && s.source !== 'builtin-offline')
  );

  // Filtered symbols for manager
  const filteredSymbols = symbols.filter(s => {
    const folderName = s.boardCategory?.trim() || CATEGORY_LABELS[s.category]?.label || s.category;
    const matchCat = symbolCatFilter === 'all' || folderName === symbolCatFilter;
    const matchSearch =
      symbolSearch === '' ||
      s.label.toLowerCase().includes(symbolSearch.toLowerCase()) ||
      (s.speechText || '').toLowerCase().includes(symbolSearch.toLowerCase());
    const matchNeedPhoto =
      !onlyNeedPhoto ||
      s.isPlaceholder ||
      s.source === 'placeholder' ||
      (!blobUrls[s.id] && !s.customImageUrl && s.source !== 'builtin-offline');
    return matchCat && matchSearch && matchNeedPhoto;
  });

  // Analytics stats
  const totalUses = logs.length;
  const mostUsed = [...symbols].sort((a, b) => (b.frequency || 0) - (a.frequency || 0)).slice(0, 5);
  const maxFreq = Math.max(1, ...mostUsed.map(s => s.frequency || 0));
  const unused = symbols.filter(s => (s.frequency || 0) === 0);

  // License audit stats (placeholder tidak dihitung sebagai terbatas komersial)
  const commercialCount = symbols.filter(s => s.commercialOk !== false).length;
  const restrictedCount = symbols.filter(
    s => s.commercialOk === false || (!s.license && !s.isPlaceholder && s.source !== 'placeholder' && !s.isCustom)
  ).length;
  const attributionCount = symbols.filter(s => s.attributionRequired === true).length;
  const auditedSymbols = symbols.filter(s => {
    if (auditFilter === 'restricted') {
      return s.commercialOk === false || (!s.license && !s.isPlaceholder && s.source !== 'placeholder' && !s.isCustom);
    }
    if (auditFilter === 'attribution') return s.attributionRequired === true;
    return true;
  });

  return (
    <div className="fixed inset-0 z-40 bg-slate-50 dark:bg-slate-950 flex flex-col overflow-y-auto">
      {/* Hidden Quick Photo Input for "Perlu foto/simbol" */}
      <input
        ref={quickPhotoInputRef}
        type="file"
        accept="image/*,.svg"
        onChange={handleQuickPhotoSelected}
        className="hidden"
      />

      {/* Caregiver Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-3.5 py-2 min-h-[42px] rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 transition-colors flex items-center gap-2 font-semibold text-sm whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Mode Pengguna</span>
            </button>
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                Panel Caregiver
              </h1>
            </div>
          </div>

          {successMessage && (
            <div className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm flex items-center gap-1.5">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>
      </header>

      {/* Tabs Navigation + Quick Auto-Speak Switch */}
      <nav
        className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-2.5"
        aria-label="Menu Caregiver"
      >
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'symbols', label: 'Kelola Simbol', icon: ImageIcon },
              { id: 'categories', label: 'Kategori Tombol', icon: Tag },
              { id: 'updates', label: 'Pembaruan Simbol', icon: RefreshCw },
              { id: 'diagnostics', label: 'Diagnostik', icon: Activity },
              { id: 'profile', label: 'Profil & Suara', icon: Settings },
              { id: 'licenses', label: 'Tentang & Lisensi', icon: FileText },
              { id: 'suggestions', label: 'Saran Adaptif', icon: Sparkles },
              { id: 'analytics', label: 'Analitik', icon: BarChart3 },
              { id: 'backup', label: 'Cadangan & Ekspor', icon: Download },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-3.5 py-2 min-h-[42px] rounded-xl font-semibold text-sm flex items-center gap-2 shrink-0 whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Toggle Switch: Otomatis Berbicara Saat Ditekan */}
          <div className="flex items-center justify-between lg:justify-end gap-3 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shrink-0">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="whitespace-nowrap">Otomatis Bicara</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={currentProfile.singleTapSpeak}
              aria-label="Saklar mode otomatis berbicara saat simbol ditekan"
              onClick={handleToggleAutoSpeak}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                currentProfile.singleTapSpeak
                  ? 'bg-emerald-600'
                  : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                  currentProfile.singleTapSpeak ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex-1">
        {/* --- TAB 1: SYMBOLS MANAGER --- */}
        {activeTab === 'symbols' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                  Kelola Papan Simbol
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Foto pribadi disimpan hanya di perangkat Anda (IndexedDB) dan tidak pernah diunggah ke GitHub ({symbols.length} simbol).
                </p>
              </div>
              <button
                onClick={handleOpenAdd}
                className="px-5 py-2.5 min-h-[46px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 text-sm whitespace-nowrap transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Simbol</span>
              </button>
            </div>

            {/* Daftar "Perlu foto/simbol" */}
            {needPhotoSymbols.length > 0 && (
              <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/70 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-amber-950 dark:text-amber-100 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                      <span>Perlu foto/simbol ({needPhotoSymbols.length})</span>
                    </h3>
                    <p className="text-xs text-amber-800 dark:text-amber-200/80 mt-0.5">
                      Entri placeholder atau simbol yang belum memiliki gambar. Anda dapat menambahkan foto lokal kapan saja.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOnlyNeedPhoto(v => !v)}
                    className={`px-3.5 py-2 min-h-[38px] rounded-xl text-xs font-semibold border shrink-0 transition-colors ${
                      onlyNeedPhoto
                        ? 'bg-amber-700 text-white border-transparent'
                        : 'bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-800'
                    }`}
                  >
                    {onlyNeedPhoto ? 'Tampilkan Semua Simbol' : 'Filter Hanya Perlu Foto'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {needPhotoSymbols.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2.5 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-900/50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.label}
                        </p>
                        {item.placeholderNote && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {item.placeholderNote}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => triggerQuickPhotoUpload(item.id)}
                        className="px-2.5 py-1.5 min-h-[34px] rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Tambah foto</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search & Category Filter */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari simbol..."
                  value={symbolSearch}
                  onChange={e => setSymbolSearch(e.target.value)}
                  className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <select
                value={symbolCatFilter}
                onChange={e => setSymbolCatFilter(e.target.value)}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100"
              >
                <option value="all">Semua Kategori</option>
                {availableFolderNames.map(folder => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
              </select>
            </div>

            {/* Symbols Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filteredSymbols.map(sym => {
                const catMeta = CATEGORY_LABELS[sym.category] || {
                  label: sym.category,
                  swatch: 'bg-slate-400',
                };
                const folderDisplay = sym.boardCategory?.trim() || catMeta.label;
                return (
                  <div
                    key={sym.id}
                    className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3.5"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-13 h-13 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                        {renderSymbolPreview(sym)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-slate-900 dark:text-white truncate">
                            {sym.label}
                          </h3>
                          {sym.userModified && (
                            <span
                              title="Diubah oleh caregiver — terlindungi dari timpa otomatis"
                              className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 shrink-0"
                            >
                              (Diedit)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          "{sym.spokenText || sym.speechText || sym.label}"
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span className={`w-2 h-2 rounded-full ${catMeta.swatch}`} />
                          <span className="truncate">{folderDisplay}</span>
                          {sym.isDefault === false && (
                            <span className="text-[11px] text-slate-400 shrink-0">· Varian</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => handleOpenEdit(sym)}
                        className="px-3 py-1.5 min-h-[36px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Ubah
                      </button>
                      <button
                        onClick={() => handleDeleteSymbolClick(sym.id)}
                        className="px-3 py-1.5 min-h-[36px] bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- TAB 2: KATEGORI TOMBOL --- */}
        {activeTab === 'categories' && (() => {
          const availablePresets = PRESET_BOARD_CATEGORIES.filter(
            preset =>
              !availableFolderNames.some(
                existing => existing.toLowerCase() === preset.name.toLowerCase()
              )
          );

          const folderCounts = new Map<string, number>();
          for (const sym of symbols) {
            const name = sym.boardCategory?.trim() || CATEGORY_LABELS[sym.category]?.label || sym.category;
            folderCounts.set(name, (folderCounts.get(name) || 0) + 1);
          }

          const categoryFilteredSymbols = symbols.filter(s => {
            const folderName = s.boardCategory?.trim() || CATEGORY_LABELS[s.category]?.label || s.category;
            const matchFolder = catManagerFilter === 'all' || folderName === catManagerFilter;
            const q = catManagerSearch.trim().toLowerCase();
            const matchSearch =
              q === '' ||
              s.label.toLowerCase().includes(q) ||
              (s.speechText || '').toLowerCase().includes(q) ||
              (s.tagsEn || []).some(t => t.toLowerCase().includes(q));
            return matchFolder && matchSearch;
          });

          const effectiveBulkTarget =
            bulkTargetCategory || availableFolderNames[0] || '';

          const allVisibleIds = categoryFilteredSymbols.map(s => s.id);
          const selectedVisibleCount = allVisibleIds.filter(id => selectedSymbolIds.includes(id)).length;
          const allVisibleSelected =
            allVisibleIds.length > 0 && selectedVisibleCount === allVisibleIds.length;

          return (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                  Pengaturan Kategori Tombol
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Buat kategori khusus seperti Anggota Keluarga, Buah, atau lainnya, lalu kelompokkan tombol agar mudah ditemukan di papan utama.
                </p>
              </div>

              {/* 1. Tambah Kategori Baru & Preset Cepat */}
              <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Buat Kategori Baru
                </h3>

                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleAddCustomCategory(newCategoryName, newCategoryColor);
                  }}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                >
                  <div className="sm:col-span-6">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Nama Kategori
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Anggota Keluarga, Buah, Hewan..."
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Warna Kartu (Fitzgerald Key)
                    </label>
                    <select
                      value={newCategoryColor}
                      onChange={e => setNewCategoryColor(e.target.value as FitzgeraldColorKey)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white"
                    >
                      {Object.entries(FITZGERALD_COLOR_STYLES).map(([key, style]) => (
                        <option key={key} value={key}>
                          {style.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={!newCategoryName.trim()}
                      className="w-full min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah</span>
                    </button>
                  </div>
                </form>

                {availablePresets.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                      Tambah cepat kategori populer:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {availablePresets.map(preset => {
                        const swatch = FITZGERALD_COLOR_STYLES[preset.colorKey]?.swatch || 'bg-slate-400';
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => handleAddCustomCategory(preset.name, preset.colorKey)}
                            className="px-3 py-1.5 min-h-[36px] rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 transition-colors"
                          >
                            <span className={`w-2.5 h-2.5 rounded-full ${swatch}`} />
                            <span>+ {preset.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Daftar Kategori Tersedia */}
              <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Daftar Kategori ({availableFolderNames.length})
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Tab kategori tampil otomatis di papan bila berisi minimal 1 tombol.
                  </span>
                </div>

                {customCategories.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Kategori Buatan Caregiver
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {customCategories.map(cat => {
                        const count = folderCounts.get(cat.name) || 0;
                        const swatch = FITZGERALD_COLOR_STYLES[cat.colorKey]?.swatch || 'bg-slate-400';
                        const isEditingThis = editingCatId === cat.id;

                        return (
                          <div
                            key={cat.id}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex flex-col gap-2"
                          >
                            {isEditingThis ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="text"
                                  value={editingCatName}
                                  onChange={e => setEditingCatName(e.target.value)}
                                  className="flex-1 min-w-[140px] min-h-[36px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-900 dark:text-white"
                                />
                                <select
                                  value={editingCatColor}
                                  onChange={e => setEditingCatColor(e.target.value as FitzgeraldColorKey)}
                                  className="min-h-[36px] px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs text-slate-900 dark:text-white"
                                >
                                  {Object.entries(FITZGERALD_COLOR_STYLES).map(([k, v]) => (
                                    <option key={k} value={k}>
                                      {v.label}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditedCategory(cat)}
                                  className="px-3 py-1.5 min-h-[34px] rounded-lg bg-emerald-600 text-white text-xs font-bold"
                                >
                                  Simpan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCatId(null)}
                                  className="px-2.5 py-1.5 min-h-[34px] rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${swatch}`} />
                                  <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                    {cat.name}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                                    ({count} tombol)
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCatId(cat.id);
                                      setEditingCatName(cat.name);
                                      setEditingCatColor(cat.colorKey);
                                    }}
                                    className="px-2.5 py-1 min-h-[32px] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                                  >
                                    Ubah
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCustomCategory(cat.id)}
                                    className="px-2.5 py-1 min-h-[32px] rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300"
                                  >
                                    Hapus
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {availableFolderNames.map(folder => {
                    const count = folderCounts.get(folder) || 0;
                    const colorKey = resolveCategoryColor(folder);
                    const swatch = colorKey ? FITZGERALD_COLOR_STYLES[colorKey].swatch : 'bg-slate-400';
                    return (
                      <button
                        key={folder}
                        type="button"
                        onClick={() => setCatManagerFilter(prev => (prev === folder ? 'all' : folder))}
                        className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-semibold border flex items-center gap-2 transition-colors ${
                          catManagerFilter === folder
                            ? 'bg-slate-900 dark:bg-emerald-600 text-white border-transparent'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${swatch}`} />
                        <span>{folder}</span>
                        <span className="opacity-70 tabular-nums">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Kelola & Pindahkan Tombol ke Kategori */}
              <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      Kategorikan Tombol Simbol ({categoryFilteredSymbols.length})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Ubah kategori langsung pada setiap tombol atau centang beberapa tombol sekaligus untuk dipindahkan massal.
                    </p>
                  </div>
                </div>

                {/* Search & Filter */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari tombol (mis. ibu, ayah, apel, pisang, susu)..."
                      value={catManagerSearch}
                      onChange={e => setCatManagerSearch(e.target.value)}
                      className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <select
                    value={catManagerFilter}
                    onChange={e => setCatManagerFilter(e.target.value)}
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100"
                  >
                    <option value="all">Semua Kategori</option>
                    {availableFolderNames.map(folder => (
                      <option key={folder} value={folder}>
                        {folder}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Bulk Selection & Move Toolbar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        if (allVisibleSelected) {
                          setSelectedSymbolIds(prev => prev.filter(id => !allVisibleIds.includes(id)));
                        } else {
                          setSelectedSymbolIds(Array.from(new Set([...selectedSymbolIds, ...allVisibleIds])));
                        }
                      }}
                      className="px-3 py-1.5 min-h-[36px] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5"
                    >
                      {allVisibleSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                      <span>{allVisibleSelected ? 'Batal pilih semua' : 'Pilih semua tampil'}</span>
                    </button>

                    {selectedSymbolIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedSymbolIds([])}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white underline"
                      >
                        Bersihkan pilihan ({selectedSymbolIds.length})
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Pindahkan {selectedSymbolIds.length} tombol ke:
                    </span>
                    <select
                      value={effectiveBulkTarget}
                      onChange={e => setBulkTargetCategory(e.target.value)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-900 dark:text-white"
                    >
                      {availableFolderNames.map(folder => (
                        <option key={folder} value={folder}>
                          {folder}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={selectedSymbolIds.length === 0 || !effectiveBulkTarget}
                      onClick={() => handleAssignSymbolCategory(selectedSymbolIds, effectiveBulkTarget)}
                      className="px-4 py-1.5 min-h-[38px] rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white text-xs font-bold transition-colors"
                    >
                      Terapkan Kategori
                    </button>
                  </div>
                </div>

                {/* Symbol Categorization List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[520px] overflow-y-auto pr-1">
                  {categoryFilteredSymbols.map(sym => {
                    const currentFolder =
                      sym.boardCategory?.trim() || CATEGORY_LABELS[sym.category]?.label || sym.category;
                    const isChecked = selectedSymbolIds.includes(sym.id);
                    return (
                      <div
                        key={sym.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                          isChecked
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700'
                            : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedSymbolIds(prev =>
                                prev.includes(sym.id) ? prev.filter(id => id !== sym.id) : [...prev, sym.id]
                              )
                            }
                            aria-label={`Pilih ${sym.label}`}
                            className="p-1 shrink-0 text-slate-600 dark:text-slate-300"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-400" />
                            )}
                          </button>

                          <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                            {renderSymbolPreview(sym)}
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {sym.label}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {currentFolder}
                            </p>
                          </div>
                        </div>

                        <select
                          aria-label={`Kategori untuk ${sym.label}`}
                          value={currentFolder}
                          onChange={e => handleAssignSymbolCategory([sym.id], e.target.value)}
                          className="max-w-[165px] min-h-[38px] px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-900 dark:text-white shrink-0"
                        >
                          {availableFolderNames.map(folder => (
                            <option key={folder} value={folder}>
                              {folder}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* --- TAB: SYMBOL UPDATES --- */}
        {activeTab === 'updates' && (
          <div className="space-y-5 max-w-3xl">
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    Perbarui Simbol Bawaan
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Aplikasi tidak memanggil GitHub otomatis setelah sinkronisasi awal. Tekan tombol di bawah untuk memeriksa pembaruan manifest secara manual.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isCheckingUpdates}
                  onClick={handleCheckUpdates}
                  className="px-5 py-2.5 min-h-[46px] bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shrink-0 whitespace-nowrap transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{isCheckingUpdates ? 'Memeriksa...' : 'Periksa pembaruan simbol'}</span>
                </button>
              </div>

              {manifestMeta && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Hash Manifest Tersimpan</span>
                    <span className="font-bold text-slate-900 dark:text-white tabular-nums font-mono">
                      {manifestMeta.hash ? manifestMeta.hash.slice(0, 12) : manifestMeta.version || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Terakhir Diunduh</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {manifestMeta.downloadedAt
                        ? new Date(manifestMeta.downloadedAt).toLocaleString('id-ID')
                        : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">Status Lokal</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">
                      {manifestMeta.completedInit ? 'Siap Offline (IndexedDB)' : 'Mode Teks Offline'}
                    </span>
                  </div>
                </div>
              )}

              {updateError && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-200 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{updateError}</span>
                </div>
              )}

              {lastAppliedSummary && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-200">
                  Pembaruan selesai: {lastAppliedSummary.succeeded} gambar berhasil diunduh,{' '}
                  {lastAppliedSummary.failed} gagal, {lastAppliedSummary.placeholders} placeholder.
                </div>
              )}

              {updateCheckedOnce && updateDiffs.length === 0 && (
                <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200">
                  Semua simbol sudah sama dengan manifest terbaru di repositori (hash:{' '}
                  <span className="font-mono font-semibold">{checkedManifest?.hash.slice(0, 12)}</span>).
                </div>
              )}

              {updateDiffs.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      Daftar Perubahan ({updateDiffs.length})
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Simbol yang diubah caregiver default dipertahankan.
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {updateDiffs.map(diff => (
                      <div
                        key={diff.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-bold ${
                                diff.type === 'added'
                                  ? 'text-emerald-700 dark:text-emerald-300'
                                  : diff.type === 'removed'
                                  ? 'text-rose-700 dark:text-rose-300'
                                  : 'text-blue-700 dark:text-blue-300'
                              }`}
                            >
                              {diff.type === 'added'
                                ? '[BARU]'
                                : diff.type === 'removed'
                                ? '[DIHAPUS]'
                                : '[BERUBAH]'}
                            </span>
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {diff.label}
                            </span>
                            {diff.userModified && (
                              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                · Diubah caregiver
                              </span>
                            )}
                          </div>
                          {diff.type === 'changed' && diff.incoming && diff.existing && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Versi Anda: "{diff.existing.label}" → Versi Baru: "{diff.incoming.label}"
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {diff.userModified ? (
                            <span className="px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 flex items-center">
                              Dilindungi (Pertahankan versi saya)
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSetDiffResolution(diff.id, 'keep_mine')}
                                className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold border transition-colors ${
                                  diff.resolution === 'keep_mine'
                                    ? 'bg-slate-900 dark:bg-slate-700 text-white border-transparent'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                Pertahankan versi saya
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetDiffResolution(diff.id, 'use_new')}
                                className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold border transition-colors ${
                                  diff.resolution === 'use_new'
                                    ? 'bg-emerald-600 text-white border-transparent'
                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                {diff.type === 'removed' ? 'Hapus sesuai manifest' : 'Pakai versi baru'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={isApplyingUpdates}
                    onClick={handleConfirmApplyUpdates}
                    className="w-full min-h-[48px] py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition-colors"
                  >
                    {isApplyingUpdates ? 'Menerapkan pembaruan...' : 'Konfirmasi & Terapkan Pembaruan'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB: PANEL DIAGNOSTIK --- */}
        {activeTab === 'diagnostics' && (() => {
          const liveSucceeded = symbols.filter(
            s => !s.isPlaceholder && s.source !== 'legacy-seed' && (s.downloadStatus === 'done' || !!blobUrls[s.id])
          ).length;
          const liveFailed = symbols.filter(
            s => !s.isPlaceholder && s.downloadStatus === 'failed'
          ).length;
          const livePlaceholders = symbols.filter(
            s => s.isPlaceholder || !s.filename
          ).length;

          const diagStatus = diagnostics?.status || (manifestMeta?.completedInit ? 'completed' : 'idle');
          const statusLabels: Record<string, { text: string; cls: string }> = {
            idle: {
              text: 'Belum mulai',
              cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
            },
            running: {
              text: 'Berjalan',
              cls: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-200 border-blue-200 dark:border-blue-800',
            },
            completed: {
              text: 'Selesai',
              cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800',
            },
            failed: {
              text: 'Gagal',
              cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200 border-rose-200 dark:border-rose-800',
            },
          };
          const statusMeta = statusLabels[diagStatus] || statusLabels.idle;
          const errorList = diagnostics?.errors || [];

          return (
            <div className="space-y-5 max-w-4xl">
              <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                      Panel Diagnostik Sinkronisasi Simbol
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      Pantau sumber manifest GitHub, status penyimpanan IndexedDB, dan log galat unduhan.
                    </p>
                  </div>
                  <span
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border self-start sm:self-auto ${statusMeta.cls}`}
                  >
                    Status: {statusMeta.text}
                  </span>
                </div>

                {/* Manifest URL & Schema Version */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-semibold block">
                      MANIFEST_URL
                    </span>
                    <code className="font-mono text-slate-900 dark:text-slate-100 break-all">
                      {diagnostics?.manifestUrl || MANIFEST_URL}
                    </code>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Versi Bundel Simbol</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {manifestMeta?.bundledSymbolsVersion || 'Belum bermigrasi'} (target: {BUNDLED_SYMBOLS_VERSION})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Hash Manifest</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {manifestMeta?.hash ? manifestMeta.hash.slice(0, 12) : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Pembaruan Terakhir</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {diagnostics?.updatedAt
                          ? new Date(diagnostics.updatedAt).toLocaleString('id-ID')
                          : manifestMeta?.downloadedAt
                          ? new Date(manifestMeta.downloadedAt).toLocaleString('id-ID')
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Counts */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70">
                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 block">
                      Gambar Tersimpan
                    </span>
                    <span className="text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-200">
                      {liveSucceeded}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70">
                    <span className="text-xs font-semibold text-rose-800 dark:text-rose-300 block">
                      Gagal
                    </span>
                    <span className="text-2xl font-extrabold tabular-nums text-rose-700 dark:text-rose-200">
                      {liveFailed}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                      Placeholder
                    </span>
                    <span className="text-2xl font-extrabold tabular-nums text-slate-800 dark:text-slate-100">
                      {livePlaceholders}
                    </span>
                  </div>
                </div>

                {diagnostics?.lastErrorMessage && (
                  <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs sm:text-sm text-rose-700 dark:text-rose-200 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{diagnostics.lastErrorMessage}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    disabled={isRunningDiagAction}
                    onClick={async () => {
                      setIsRunningDiagAction(true);
                      try {
                        await onRestartDownload();
                      } finally {
                        setIsRunningDiagAction(false);
                      }
                    }}
                    className="flex-1 min-h-[46px] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Mulai ulang unduhan</span>
                  </button>

                  <button
                    type="button"
                    disabled={isRunningDiagAction}
                    onClick={() => setShowResetConfirm(true)}
                    className="flex-1 min-h-[46px] px-5 py-2.5 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-200 border border-rose-200 dark:border-rose-800 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reset simbol bawaan</span>
                  </button>
                </div>

                {showResetConfirm && (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-3">
                    <p className="text-sm font-bold text-amber-950 dark:text-amber-100">
                      Konfirmasi Reset Simbol Bawaan
                    </p>
                    <p className="text-xs text-amber-900 dark:text-amber-200/90">
                      Seluruh cache simbol bawaan di IndexedDB akan dihapus dan diunduh ulang dari MANIFEST_URL. Foto pribadi dan label yang Anda ubah sebagai caregiver tetap dipertahankan.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isRunningDiagAction}
                        onClick={async () => {
                          setIsRunningDiagAction(true);
                          setShowResetConfirm(false);
                          try {
                            await onResetBundledSymbols(true);
                          } finally {
                            setIsRunningDiagAction(false);
                          }
                        }}
                        className="px-4 py-2 min-h-[38px] bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        Ya, Reset & Unduh Ulang
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowResetConfirm(false)}
                        className="px-4 py-2 min-h-[38px] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                {/* Error & Attempted URL List */}
                <div className="space-y-2.5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Daftar Galat & URL yang Dicoba ({errorList.length})
                  </h3>
                  {errorList.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                      Tidak ada galat unduhan. Detail setiap permintaan jaringan juga dicatat di Console browser (`[BicaraKu Sync]`).
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                      {errorList.map((err, i) => (
                        <div
                          key={`${err.id}-${i}`}
                          className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/70 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {err.label}
                            </span>
                            <span className="text-rose-700 dark:text-rose-300 font-semibold">
                              {err.reason}
                            </span>
                          </div>
                          {err.attemptedUrl && (
                            <p className="font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all">
                              URL: {err.attemptedUrl}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* --- TAB 2: PROFILE & SPEECH SETTINGS --- */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mb-1">
              Profil, Suara & Aksesibilitas
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Sesuaikan suara TTS, preferensi figur, mode lisensi aman, dan keamanan PIN.
            </p>

            <form onSubmit={handleSaveProfileSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Nama Pengguna AAC
                </label>
                <input
                  type="text"
                  value={currentProfile.userName}
                  onChange={e => setCurrentProfile({ ...currentProfile, userName: e.target.value })}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Preferensi Figur Simbol
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  Memilih varian figur wanita atau pria secara otomatis bila tersedia di grup varian simbol.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'all', label: 'Default / Semua' },
                      { id: 'female', label: 'Figur Wanita' },
                      { id: 'male', label: 'Figur Pria' },
                    ] as const
                  ).map(opt => (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() =>
                        setCurrentProfile({
                          ...currentProfile,
                          figurePreference: opt.id as FigurePreference,
                        })
                      }
                      className={`px-3 py-2.5 min-h-[42px] rounded-xl text-xs sm:text-sm font-semibold border transition-colors ${
                        (currentProfile.figurePreference || 'all') === opt.id
                          ? 'bg-slate-900 dark:bg-emerald-600 text-white border-transparent'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <div className="space-y-0.5">
                  <span className="font-bold text-sm text-slate-900 dark:text-white block">
                    Mode Lisensi Aman
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    Menyembunyikan simbol yang dibatasi non-komersial atau tanpa keterangan lisensi jelas.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={currentProfile.safeLicenseMode}
                  onClick={() =>
                    setCurrentProfile({
                      ...currentProfile,
                      safeLicenseMode: !currentProfile.safeLicenseMode,
                    })
                  }
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ${
                    currentProfile.safeLicenseMode
                      ? 'bg-emerald-600'
                      : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                      currentProfile.safeLicenseMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Pilihan Suara (Web Speech)
                </label>
                <select
                  value={currentProfile.voiceName}
                  onChange={e => setCurrentProfile({ ...currentProfile, voiceName: e.target.value })}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                >
                  <option value="">Default Otomatis (Bahasa Indonesia)</option>
                  {voices.map(v => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5 tabular-nums">
                    Kecepatan ({currentProfile.speechRate.toFixed(1)}×)
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={currentProfile.speechRate}
                    onChange={e =>
                      setCurrentProfile({ ...currentProfile, speechRate: parseFloat(e.target.value) })
                    }
                    className="w-full accent-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5 tabular-nums">
                    Nada ({currentProfile.speechPitch.toFixed(1)})
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={currentProfile.speechPitch}
                    onChange={e =>
                      setCurrentProfile({ ...currentProfile, speechPitch: parseFloat(e.target.value) })
                    }
                    className="w-full accent-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5 tabular-nums">
                    Delay Sentuh ({currentProfile.touchDelaySeconds.toFixed(1)} dtk)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={currentProfile.touchDelaySeconds}
                    onChange={e =>
                      setCurrentProfile({
                        ...currentProfile,
                        touchDelaySeconds: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                  Ukuran Grid Utama
                </label>
                <select
                  value={currentProfile.gridSize}
                  onChange={e =>
                    setCurrentProfile({
                      ...currentProfile,
                      gridSize: parseInt(e.target.value) as GridSize,
                    })
                  }
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                >
                  <option value={2}>2 × 2 (Sangat Besar)</option>
                  <option value={3}>3 × 3 (Standar)</option>
                  <option value={4}>4 × 4 (Luas)</option>
                  <option value={5}>5 × 5 (Padat)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  Mode Tampilan Kartu Simbol
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'both', label: 'Gambar + Teks', textOnly: false, imageOnly: false },
                    { id: 'image', label: 'Hanya Gambar', textOnly: false, imageOnly: true },
                    { id: 'text', label: 'Hanya Teks', textOnly: true, imageOnly: false },
                  ].map(opt => {
                    const active =
                      currentProfile.showTextOnly === opt.textOnly &&
                      currentProfile.imageOnly === opt.imageOnly;
                    return (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() =>
                          setCurrentProfile({
                            ...currentProfile,
                            showTextOnly: opt.textOnly,
                            imageOnly: opt.imageOnly,
                          })
                        }
                        className={`px-3 py-2.5 min-h-[42px] rounded-xl text-xs sm:text-sm font-semibold border transition-colors ${
                          active
                            ? 'bg-slate-900 dark:bg-emerald-600 text-white border-transparent'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <div className="space-y-0.5">
                  <span className="font-bold text-sm text-slate-900 dark:text-white block">
                    Mode Otomatis Bicara Saat Ditekan
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">
                    {currentProfile.singleTapSpeak
                      ? 'Aktif: setiap simbol yang ditekan langsung bersuara otomatis.'
                      : 'Nonaktif: simbol dirangkai dulu lalu diucapkan via tombol Ucapkan.'}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={currentProfile.singleTapSpeak}
                  aria-label="Aktifkan otomatis berbicara saat simbol ditekan"
                  onClick={handleToggleAutoSpeak}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                    currentProfile.singleTapSpeak
                      ? 'bg-emerald-600'
                      : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                      currentProfile.singleTapSpeak ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 min-h-[48px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors"
              >
                Simpan Perubahan Profil
              </button>
            </form>

            {/* Dedicated Change PIN Section */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      Ganti PIN Mode Caregiver
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      PIN selalu disimpan aman dan dienkripsi saat ekspor cadangan JSON.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPinDigits(v => !v)}
                  className="px-3 py-1.5 min-h-[36px] rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {showPinDigits ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPinDigits ? 'Sembunyikan' : 'Tampilkan'}</span>
                </button>
              </div>

              <form onSubmit={handleChangePinSubmit} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      PIN Saat Ini
                    </label>
                    <input
                      type={showPinDigits ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="••••"
                      value={oldPinInput}
                      onChange={e => {
                        setPinFormError(null);
                        setOldPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                      }}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm tabular-nums tracking-widest text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      PIN Baru (4 Digit)
                    </label>
                    <input
                      type={showPinDigits ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="••••"
                      value={newPinInput}
                      onChange={e => {
                        setPinFormError(null);
                        setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                      }}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm tabular-nums tracking-widest text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Konfirmasi PIN Baru
                    </label>
                    <input
                      type={showPinDigits ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="••••"
                      value={confirmPinInput}
                      onChange={e => {
                        setPinFormError(null);
                        setConfirmPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                      }}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm tabular-nums tracking-widest text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {pinFormError && (
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {pinFormError}
                  </p>
                )}

                <button
                  type="submit"
                  className="px-5 py-2.5 min-h-[44px] bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white font-semibold rounded-xl text-sm flex items-center gap-2 transition-colors"
                >
                  <Lock className="w-4 h-4" />
                  <span>Perbarui PIN Caregiver</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* --- TAB: TENTANG, KREDIT & AUDIT LISENSI --- */}
        {activeTab === 'licenses' && (
          <div className="space-y-6 max-w-4xl">
            {/* Tentang & Kredit */}
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    Tentang & Kredit Simbol
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    BicaraKu (GPLv3) menggunakan simbol bawaan Mulberry Symbols — Steve Lee (mulberrysymbols.org), berlisensi CC BY-SA 4.0.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isRefreshingDocs}
                  onClick={handleRefreshLicenseDocs}
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center gap-2 shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isRefreshingDocs ? 'Memuat...' : 'Muat ulang dokumen lisensi'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    LICENSE-MULBERRY.txt
                  </h3>
                  <pre className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap max-h-56 overflow-y-auto font-mono">
                    {licenseDocs?.licenseMulberryText ||
                      'Mulberry Symbols — Copyright Steve Lee (mulberrysymbols.org).\nCreative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0).'}
                  </pre>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    CREDITS.md
                  </h3>
                  <pre className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap max-h-56 overflow-y-auto font-mono">
                    {licenseDocs?.creditsMdText ||
                      'Kredit Simbol:\n- Mulberry Symbols oleh Steve Lee (https://mulberrysymbols.org) — CC BY-SA 4.0.'}
                  </pre>
                </div>
              </div>
            </div>

            {/* Audit Lisensi */}
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    Audit Lisensi Simbol
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Mode Lisensi Aman saat ini:{' '}
                    <span className="font-bold text-slate-900 dark:text-white">
                      {currentProfile.safeLicenseMode ? 'Aktif (simbol terbatas disembunyikan)' : 'Nonaktif'}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {[
                    { id: 'all', label: `Semua (${symbols.length})` },
                    { id: 'attribution', label: `Atribusi (${attributionCount})` },
                    { id: 'restricted', label: `Terbatas (${restrictedCount})` },
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setAuditFilter(f.id as typeof auditFilter)}
                      className={`px-3 py-1.5 min-h-[36px] rounded-xl text-xs font-semibold ${
                        auditFilter === f.id
                          ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Komersial OK</span>
                  <span className="text-xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {commercialCount}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Butuh Atribusi</span>
                  <span className="text-xl font-extrabold tabular-nums text-blue-600 dark:text-blue-400">
                    {attributionCount}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Non-Komersial / Kosong</span>
                  <span className="text-xl font-extrabold tabular-nums text-amber-600 dark:text-amber-400">
                    {restrictedCount}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Simbol</th>
                      <th className="py-2.5 px-3 font-semibold">Sumber</th>
                      <th className="py-2.5 px-3 font-semibold">Lisensi</th>
                      <th className="py-2.5 px-3 font-semibold">Pembuat</th>
                      <th className="py-2.5 px-3 font-semibold">Komersial</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {auditedSymbols.slice(0, 120).map(sym => (
                      <tr key={sym.id} className="bg-white dark:bg-slate-900">
                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                          {sym.label}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                          {sym.source || 'mulberry'}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                          {sym.license || '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                          {sym.author || '-'}
                        </td>
                        <td className="py-2 px-3">
                          {sym.commercialOk === false ? (
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">Tidak</span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Ya</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 3: ADAPTIVE SUGGESTIONS --- */}
        {activeTab === 'suggestions' && (
          <div className="space-y-5 max-w-3xl">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                Saran Layout Adaptif
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Posisi simbol tetap stabil demi motor planning. Perubahan hanya diterapkan setelah Anda menyetujuinya.
              </p>
            </div>

            {suggestions.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center">
                <Sparkles className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="font-bold text-slate-700 dark:text-slate-300">
                  Belum cukup data riwayat penggunaan.
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Gunakan Mode Pengguna beberapa kali agar sistem dapat menyarankan simbol prioritas berdasarkan waktu dan lokasi.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestions.map(sugg => (
                  <div
                    key={sugg.id}
                    className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-white">
                          Prioritaskan Simbol: {sugg.symbolLabel}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {sugg.reason}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleApplySuggestion(sugg)}
                      className="px-4 py-2.5 min-h-[42px] bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shrink-0 transition-colors"
                    >
                      Setujui & Pindahkan
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- TAB 4: ANALYTICS --- */}
        {activeTab === 'analytics' && (
          <div className="space-y-5 max-w-4xl">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                Dashboard Analitik Penggunaan
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ringkasan statistik lokal untuk membantu evaluasi orang tua dan terapis.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block mb-1">
                  Total Simbol Digunakan
                </span>
                <span className="text-3xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {totalUses}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block mb-1">
                  Simbol Aktif Tersedia
                </span>
                <span className="text-3xl font-extrabold tabular-nums text-blue-600 dark:text-blue-400">
                  {symbols.length}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block mb-1">
                  Simbol Belum Dipakai
                </span>
                <span className="text-3xl font-extrabold tabular-nums text-amber-600 dark:text-amber-400">
                  {unused.length}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white mb-4">
                Simbol Paling Sering Digunakan
              </h3>
              <div className="space-y-3">
                {mostUsed.map((sym, idx) => {
                  const freq = sym.frequency || 0;
                  const pct = Math.round((freq / maxFreq) * 100);
                  return (
                    <div key={sym.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-bold tabular-nums text-slate-400 w-5">
                            {idx + 1}.
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {sym.label}
                          </span>
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                          {freq} kali
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full"
                          style={{ width: `${freq > 0 ? Math.max(4, pct) : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 5: BACKUP & DATA --- */}
        {activeTab === 'backup' && (
          <div className="space-y-5 max-w-2xl">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                Cadangan & Ekspor Data
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ekspor riwayat untuk terapis atau cadangkan seluruh papan simbol secara lokal.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Ekspor Log Terapis (CSV)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Unduh catatan penggunaan simbol beserta waktu dan lokasi dalam format tabel CSV.
                  </p>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="px-4 py-2.5 min-h-[42px] bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shrink-0 text-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Unduh CSV
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Ekspor Papan Simbol (JSON)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Cadangkan simbol, profil, dan riwayat. PIN Caregiver dienkripsi otomatis dengan AES-256-GCM.
                  </p>
                </div>
                <button
                  onClick={handleExportJSON}
                  className="px-4 py-2.5 min-h-[42px] bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shrink-0 text-sm"
                >
                  <Download className="w-4 h-4" /> Unduh JSON
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Impor Cadangan (Restore)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Pulihkan papan simbol dan pengaturan dari file JSON cadangan sebelumnya.
                  </p>
                </div>
                <label className="px-4 py-2.5 min-h-[42px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shrink-0 text-sm cursor-pointer">
                  <Upload className="w-4 h-4" /> Unggah JSON
                  <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Symbol Add/Edit Modal */}
      {isAddingNew && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {editingSymbol ? 'Ubah Simbol' : 'Tambah Simbol Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSymbolSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Label Tampilan
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Susu Dingin"
                  value={formLabel}
                  onChange={e => setFormLabel(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Teks Suara (TTS)
                </label>
                <input
                  type="text"
                  placeholder="Kosongkan jika sama dengan label"
                  value={formSpokenText}
                  onChange={e => setFormSpokenText(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Kategori Tombol (Folder Papan)
                </label>
                <select
                  value={formBoardCategory}
                  onChange={e => {
                    const nextVal = e.target.value;
                    setFormBoardCategory(nextVal);
                    if (nextVal !== '__custom__') {
                      const matchedColor = resolveCategoryColor(nextVal);
                      if (matchedColor) setFormFitzgeraldColor(matchedColor);
                    }
                  }}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                >
                  {availableFolderNames.map(folder => (
                    <option key={folder} value={folder}>
                      {folder}
                    </option>
                  ))}
                  <option value="__custom__">+ Buat kategori baru...</option>
                </select>

                {formBoardCategory === '__custom__' && (
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Anggota Keluarga, Buah, Hewan..."
                    value={formCustomCategoryInput}
                    onChange={e => setFormCustomCategoryInput(e.target.value)}
                    className="mt-2 w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Warna Kartu (Fitzgerald Key)
                </label>
                <select
                  value={formFitzgeraldColor}
                  onChange={e => setFormFitzgeraldColor(e.target.value as FitzgeraldColorKey)}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                >
                  {Object.entries(FITZGERALD_COLOR_STYLES).map(([key, style]) => (
                    <option key={key} value={key}>
                      {style.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Foto Pribadi Lokal (Disimpan di IndexedDB, tidak pernah diunggah)
                </label>
                <div className="flex items-center gap-3">
                  {formCustomImagePreview && (
                    <img
                      src={formCustomImagePreview}
                      alt="Preview"
                      className="w-12 h-12 object-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*,.svg"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    className="text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-200"
                  />
                </div>
                {photoUploadError && (
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1.5">
                    {photoUploadError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-4 py-2.5 min-h-[42px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 min-h-[42px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm"
                >
                  Simpan Simbol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
