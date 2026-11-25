import React, { useState, useRef } from 'react';
import { SymbolItem, AACProfile, UsageLog, FitzgeraldCategory, GridSize, AdaptiveSuggestion } from '../types';
import { CATEGORY_LABELS } from '../data/defaultSymbols';
import { getAvailableVoices } from '../services/tts';
import { encryptPin, decryptPin, EncryptedPinPayload } from '../services/crypto';
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
} from 'lucide-react';

interface CaregiverModeProps {
  symbols: SymbolItem[];
  onSaveSymbols: (symbols: SymbolItem[]) => void;
  profile: AACProfile;
  onSaveProfile: (profile: AACProfile) => void;
  logs: UsageLog[];
  onClose: () => void;
  suggestions: AdaptiveSuggestion[];
}

export const CaregiverMode: React.FC<CaregiverModeProps> = ({
  symbols,
  onSaveSymbols,
  profile,
  onSaveProfile,
  logs,
  onClose,
  suggestions,
}) => {
  const [activeTab, setActiveTab] = useState<'symbols' | 'profile' | 'suggestions' | 'analytics' | 'backup'>('symbols');
  const [editingSymbol, setEditingSymbol] = useState<SymbolItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<AACProfile>(profile);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [symbolSearch, setSymbolSearch] = useState('');
  const [symbolCatFilter, setSymbolCatFilter] = useState<FitzgeraldCategory | 'all'>('all');

  // Form state for symbol add/edit
  const [formLabel, setFormLabel] = useState('');
  const [formSpokenText, setFormSpokenText] = useState('');
  const [formCategory, setFormCategory] = useState<FitzgeraldCategory>('nouns');
  const [formIconName, setFormIconName] = useState('Star');
  const [formCustomImage, setFormCustomImage] = useState<string | undefined>(undefined);

  // Change PIN form state
  const [oldPinInput, setOldPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [showPinDigits, setShowPinDigits] = useState(false);
  const [pinFormError, setPinFormError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    getAvailableVoices().then(v => setVoices(v));
  }, []);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const renderSymbolPreview = (sym: SymbolItem) => {
    if (sym.customImageUrl) {
      return (
        <img
          src={sym.customImageUrl}
          alt={sym.label}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      );
    }
    const iconMap = Icons as unknown as Record<string, React.ElementType>;
    const IconComp = iconMap[sym.iconName];
    if (IconComp) {
      return <IconComp className="w-6 h-6 text-slate-700 dark:text-slate-200" />;
    }
    return <span className="text-lg font-bold text-slate-700 dark:text-slate-200">{sym.iconName || sym.label.slice(0, 2)}</span>;
  };

  // Symbol CRUD handlers
  const handleOpenAdd = () => {
    setEditingSymbol(null);
    setFormLabel('');
    setFormSpokenText('');
    setFormCategory('nouns');
    setFormIconName('Star');
    setFormCustomImage(undefined);
    setIsAddingNew(true);
  };

  const handleOpenEdit = (sym: SymbolItem) => {
    setEditingSymbol(sym);
    setFormLabel(sym.label);
    setFormSpokenText(sym.spokenText || sym.label);
    setFormCategory(sym.category);
    setFormIconName(sym.iconName);
    setFormCustomImage(sym.customImageUrl);
    setIsAddingNew(true);
  };

  const handleSaveSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabel.trim()) return;

    if (editingSymbol) {
      const updated = symbols.map(s =>
        s.id === editingSymbol.id
          ? {
              ...s,
              label: formLabel.trim(),
              spokenText: formSpokenText.trim() || formLabel.trim(),
              category: formCategory,
              iconName: formIconName,
              customImageUrl: formCustomImage,
            }
          : s
      );
      onSaveSymbols(updated);
      showNotification('Simbol berhasil diperbarui.');
    } else {
      const newSym: SymbolItem = {
        id: 'sym-' + Date.now(),
        label: formLabel.trim(),
        spokenText: formSpokenText.trim() || formLabel.trim(),
        category: formCategory,
        iconName: formIconName,
        customImageUrl: formCustomImage,
        isCustom: true,
        frequency: 0,
      };
      onSaveSymbols([newSym, ...symbols]);
      showNotification('Simbol baru berhasil ditambahkan.');
    }
    setIsAddingNew(false);
  };

  const handleDeleteSymbol = (id: string) => {
    const updated = symbols.filter(s => s.id !== id);
    onSaveSymbols(updated);
    showNotification('Simbol dihapus.');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setFormCustomImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
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
  const handleApplySuggestion = (sugg: AdaptiveSuggestion) => {
    const target = symbols.find(s => s.id === sugg.symbolId);
    if (!target) return;
    const reordered = [target, ...symbols.filter(s => s.id !== sugg.symbolId)];
    onSaveSymbols(reordered);
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

  // Backup & Restore (with AES-256-GCM encrypted PIN)
  const handleExportJSON = async () => {
    const { pinCode, ...safeProfile } = currentProfile;
    const encryptedPin = await encryptPin(pinCode || '1234');
    const data = {
      symbols,
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
          onSaveSymbols(parsed.symbols);
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
          showNotification('Cadangan berhasil dipulihkan.');
        }
      } catch {
        showNotification('Format file JSON tidak valid.');
      }
    };
    reader.readAsText(file);
  };

  // Filtered symbols for manager
  const filteredSymbols = symbols.filter(s => {
    const matchCat = symbolCatFilter === 'all' || s.category === symbolCatFilter;
    const matchSearch =
      symbolSearch === '' || s.label.toLowerCase().includes(symbolSearch.toLowerCase());
    return matchCat && matchSearch;
  });

  // Analytics stats
  const totalUses = logs.length;
  const mostUsed = [...symbols].sort((a, b) => (b.frequency || 0) - (a.frequency || 0)).slice(0, 5);
  const maxFreq = Math.max(1, ...mostUsed.map(s => s.frequency || 0));
  const unused = symbols.filter(s => (s.frequency || 0) === 0);

  return (
    <div className="fixed inset-0 z-40 bg-slate-50 dark:bg-slate-950 flex flex-col overflow-y-auto">
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
              { id: 'profile', label: 'Profil & Suara', icon: Settings },
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
                  className={`px-4 py-2 min-h-[42px] rounded-xl font-semibold text-sm flex items-center gap-2 shrink-0 whitespace-nowrap transition-colors ${
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
              <span className="whitespace-nowrap">Otomatis Bicara Saat Ditekan</span>
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
                  Tambah, ubah, atau unggah foto pribadi untuk setiap simbol ({symbols.length} simbol).
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
                onChange={e => setSymbolCatFilter(e.target.value as FitzgeraldCategory | 'all')}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100"
              >
                <option value="all">Semua Kategori</option>
                {Object.entries(CATEGORY_LABELS).map(([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
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
                        <h3 className="font-bold text-slate-900 dark:text-white truncate">
                          {sym.label}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          "{sym.spokenText || sym.label}"
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span className={`w-2 h-2 rounded-full ${catMeta.swatch}`} />
                          <span>{catMeta.label}</span>
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
                        onClick={() => handleDeleteSymbol(sym.id)}
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

        {/* --- TAB 2: PROFILE & SPEECH SETTINGS --- */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mb-1">
              Profil, Suara & Aksesibilitas
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Sesuaikan suara TTS, kecepatan bicara, toleransi sentuhan, dan keamanan PIN.
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
                    Cadangkan simbol, foto, profil, dan riwayat. PIN Caregiver dienkripsi otomatis dengan AES-256-GCM.
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
                  Kategori Fitzgerald
                </label>
                <select
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value as FitzgeraldCategory)}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Foto Pribadi (Opsional)
                </label>
                <div className="flex items-center gap-3">
                  {formCustomImage && (
                    <img
                      src={formCustomImage}
                      alt="Preview"
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    className="text-xs text-slate-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-200"
                  />
                </div>
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
