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

export interface SymbolItem {
  id: string;
  label: string;
  spokenText?: string; // What TTS says if different from label
  category: FitzgeraldCategory;
  iconName: string; // Lucide icon name or emoji or image URL
  customImageUrl?: string; // Base64 or URL uploaded by caregiver
  customAudioUrl?: string; // Base64 recorded audio
  isEmergency?: boolean;
  isCustom?: boolean;
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
