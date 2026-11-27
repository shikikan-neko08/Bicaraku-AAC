export type FitzgeraldCategory =
  | 'people'      /* Orang (Pink/Magenta) */
  | 'verbs'       /* Kata Kerja (Green) */
  | 'nouns'       /* Benda (Orange/Yellow) */
  | 'adjectives'  /* Sifat (Blue) */
  | 'feelings'    /* Perasaan (Yellow/Green) */
  | 'social'      /* Sosial (Orange) */
  | 'needs'       /* Kebutuhan / Toilet / Istirahat (Red/White) */
  | 'places'      /* Tempat (Purple) */
  | 'activities'  /* Aktivitas (Cyan) */
  | 'emergency';  /* Darurat (Red bold) */

export type FitzgeraldColorKey = 'pink' | 'green' | 'orange' | 'blue' | 'yellow' | 'white';

export interface CustomBoardCategory {
  id: string;
  name: string;
  colorKey: FitzgeraldColorKey;
}

export type SymbolDownloadStatus = 'pending' | 'done' | 'failed' | 'placeholder';

export type FigurePreference = 'all' | 'female' | 'male';

export interface ManifestEntry {
  id?: string;
  filename: string | null;
  image?: string | null;
  label: string;
  speechText: string;
  category?: string;
  fitzgeraldColor?: string;
  tagsEn?: string | string[];
  source?: string;
  license?: string | null;
  author?: string | null;
  commercialOk?: boolean;
  attributionRequired?: boolean;
  variantGroup?: string | null;
  isDefault?: boolean;
  variantNote?: string;
  notes?: string;
  placeholderNote?: string | null;
}

export interface SymbolItem {
  id: string;
  filename?: string | null;
  label: string;
  spokenText?: string; // Single source of truth for speech (synced with speechText)
  speechText?: string; // Alias from manifest
  category: FitzgeraldCategory;
  boardCategory?: string; // Nama folder kategori persis dari manifest (mis. "Sosial & Komunikasi")
  fitzgeraldColor?: string; // Warna Fitzgerald dari manifest (pink, green, orange, blue, yellow, white)
  iconName: string; // Fallback Lucide icon name (tanpa emoji)
  customImageUrl?: string; // Legacy data URL saat impor cadangan lama (dipindah ke IndexedDB Blob)
  hasImageBlob?: boolean; // True when image Blob is saved in IndexedDB
  customAudioUrl?: string; // Base64 recorded audio
  isEmergency?: boolean;
  isCustom?: boolean;
  isPlaceholder?: boolean;
  userModified?: boolean; // True when edited by caregiver — never auto-overwritten
  downloadStatus?: SymbolDownloadStatus;
  downloadError?: string;
  contentHash?: string;
  // Manifest & License metadata
  tagsEn?: string[];
  source?: string;
  license?: string;
  author?: string;
  commercialOk?: boolean;
  attributionRequired?: boolean;
  variantGroup?: string | null;
  isDefault?: boolean;
  variantNote?: string;
  notes?: string;
  placeholderNote?: string;
  frequency?: number;
  lastUsed?: number;
}

export type LocationContextType = 'Rumah' | 'Sekolah' | 'Terapi' | 'Lainnya';

export type GridSize = 2 | 3 | 4 | 5; // 2x2, 3x3, 4x4, 5x5

export interface AACProfile {
  userName: string;
  voiceName: string;
  speechRate: number; // 0.5 to 1.5
  speechPitch: number; // 0.5 to 1.5
  gridSize: GridSize;
  theme: 'sensory-soft' | 'high-contrast' | 'dark';
  singleTapSpeak: boolean; // Ucapkan langsung saat disentuh
  touchDelaySeconds: number; // 0 to 1s
  showTextOnly: boolean; // false = image + text, true = text only
  imageOnly: boolean; // false = image + text, true = image only
  pinCode: string; // Default '1234'
  figurePreference: FigurePreference; // Preferensi figur: all / female / male
  safeLicenseMode: boolean; // Mode Lisensi Aman
}

export interface UsageLog {
  id: string;
  symbolId: string;
  symbolLabel: string;
  category: FitzgeraldCategory;
  timestamp: number;
  location: LocationContextType;
  timeOfDay: 'pagi' | 'siang' | 'sore' | 'malam';
}

export interface SentenceItem {
  id: string;
  symbolId: string;
  label: string;
  spokenText: string;
}

export interface AdaptiveSuggestion {
  id: string;
  symbolId: string;
  symbolLabel: string;
  reason: string;
  suggestedLocation: LocationContextType;
  suggestedTime: string;
  score: number;
}

export interface SyncErrorItem {
  id: string;
  label: string;
  filename: string | null;
  attemptedUrl?: string;
  reason: string;
  timestamp?: number;
}

export interface SyncSummary {
  total: number;
  succeeded: number;
  mulberrySucceeded?: number;
  customSucceeded?: number;
  failed: number;
  placeholders: number;
  errors: SyncErrorItem[];
  usedMirror: boolean;
  finishedAt: number;
}

export type SyncStatusState = 'idle' | 'running' | 'completed' | 'failed';

export interface SyncDiagnostics {
  manifestUrl: string;
  status: SyncStatusState;
  succeeded: number;
  failed: number;
  placeholders: number;
  errors: SyncErrorItem[];
  usedMirror: boolean;
  lastErrorMessage?: string;
  updatedAt: number;
}

export interface ManifestMeta {
  version: string;
  bundledSymbolsVersion?: string;
  hash: string;
  downloadedAt: number;
  completedInit: boolean;
  offlineTextFallback?: boolean;
  lastSummary?: SyncSummary;
}

export interface LicenseDocs {
  licenseMulberryText: string;
  creditsMdText: string;
  fetchedAt: number;
}

export interface SymbolUpdateDiffItem {
  id: string;
  label: string;
  type: 'added' | 'changed' | 'removed';
  incoming?: SymbolItem;
  existing?: SymbolItem;
  userModified: boolean;
  resolution: 'keep_mine' | 'use_new';
}
