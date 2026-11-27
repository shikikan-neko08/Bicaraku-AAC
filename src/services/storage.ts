import {
  SymbolItem,
  AACProfile,
  UsageLog,
  AdaptiveSuggestion,
  CustomBoardCategory,
  FitzgeraldCategory,
  FitzgeraldColorKey,
} from '../types';
import { idbGetAllSymbols, idbPutSymbol } from './indexedDb';

const STORAGE_KEYS = {
  PROFILE: 'bicara_ku_profile_v1',
  LOGS: 'bicara_ku_logs_v1',
  CONSENT: 'bicara_ku_consent_v1',
  CATEGORIES: 'bicara_ku_custom_categories_v1',
};

export const PRESET_BOARD_CATEGORIES: CustomBoardCategory[] = [
  { id: 'cat-keluarga', name: 'Anggota Keluarga', colorKey: 'yellow' },
  { id: 'cat-buah', name: 'Buah', colorKey: 'orange' },
  { id: 'cat-sayur', name: 'Sayuran', colorKey: 'orange' },
  { id: 'cat-minuman', name: 'Minuman', colorKey: 'orange' },
  { id: 'cat-hewan', name: 'Hewan', colorKey: 'orange' },
  { id: 'cat-mainan', name: 'Mainan & Hobi', colorKey: 'green' },
  { id: 'cat-pakaian', name: 'Pakaian', colorKey: 'orange' },
  { id: 'cat-transportasi', name: 'Transportasi', colorKey: 'blue' },
];

export function inferFitzgeraldCategory(
  boardCategoryName: string,
  colorKey?: FitzgeraldColorKey
): FitzgeraldCategory {
  const lower = boardCategoryName.toLowerCase();
  if (lower.includes('darurat')) return 'emergency';
  if (lower.includes('keluarga') || lower.includes('orang') || lower.includes('ganti')) return 'people';
  if (lower.includes('kerja') || lower.includes('tindakan')) return 'verbs';
  if (lower.includes('aktivitas') || lower.includes('mainan') || lower.includes('hobi')) return 'activities';
  if (lower.includes('tempat') || lower.includes('sekolah') || lower.includes('rumah')) return 'places';
  if (lower.includes('perasaan') || lower.includes('emosi')) return 'feelings';
  if (lower.includes('sifat') || lower.includes('pertanyaan')) return 'adjectives';
  if (lower.includes('sosial') || lower.includes('komunikasi')) return 'social';
  if (lower.includes('kebutuhan') || lower.includes('medis')) return 'needs';

  if (colorKey === 'yellow') return 'people';
  if (colorKey === 'green') return 'verbs';
  if (colorKey === 'pink') return 'social';
  if (colorKey === 'blue') return 'adjectives';
  if (colorKey === 'white') return 'needs';
  return 'nouns';
}

export function getStoredCustomCategories(): CustomBoardCategory[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error loading custom categories:', e);
    return [];
  }
}

export function saveCustomCategories(categories: CustomBoardCategory[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  } catch (e) {
    console.error('Error saving custom categories:', e);
  }
}

export const DEFAULT_PROFILE: AACProfile = {
  userName: 'Ananda',
  voiceName: '',
  speechRate: 0.9,
  speechPitch: 1.0,
  gridSize: 3, // 3x3 default
  theme: 'sensory-soft',
  singleTapSpeak: false,
  touchDelaySeconds: 0.0,
  showTextOnly: false,
  imageOnly: false,
  pinCode: '1234',
  figurePreference: 'all',
  safeLicenseMode: true,
};

export function getStoredProfile(): AACProfile {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (!stored) {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(DEFAULT_PROFILE));
      return DEFAULT_PROFILE;
    }
    return { ...DEFAULT_PROFILE, ...JSON.parse(stored) };
  } catch (e) {
    console.error('Error loading profile:', e);
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: AACProfile): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  } catch (e) {
    console.error('Error saving profile:', e);
  }
}

export function getStoredLogs(): UsageLog[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LOGS);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (e) {
    console.error('Error loading logs:', e);
    return [];
  }
}

export function addUsageLog(log: Omit<UsageLog, 'id'>): void {
  try {
    const logs = getStoredLogs();
    const newLog: UsageLog = {
      ...log,
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    };
    const updated = [newLog, ...logs].slice(0, 1000);
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(updated));

    // Perbarui frekuensi simbol di IndexedDB secara asinkron
    idbGetAllSymbols()
      .then(symbols => {
        const target = symbols.find(s => s.id === log.symbolId);
        if (target) {
          return idbPutSymbol({
            ...target,
            frequency: (target.frequency || 0) + 1,
            lastUsed: Date.now(),
          });
        }
      })
      .catch(err => console.error('Error updating symbol frequency in IndexedDB:', err));
  } catch (e) {
    console.error('Error adding usage log:', e);
  }
}

export function getStoredConsent(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.CONSENT) === 'true';
  } catch {
    return false;
  }
}

export function setStoredConsent(consent: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONSENT, consent ? 'true' : 'false');
  } catch (e) {
    console.error('Error saving consent:', e);
  }
}

export function generateAdaptiveSuggestions(symbols: SymbolItem[] = []): AdaptiveSuggestion[] {
  const logs = getStoredLogs();
  if (logs.length < 3 || symbols.length === 0) return [];

  const hour = new Date().getHours();
  const timeOfDay = hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';

  const counts: Record<string, number> = {};
  logs.forEach(log => {
    if (log.timeOfDay === timeOfDay) {
      counts[log.symbolId] = (counts[log.symbolId] || 0) + 1;
    }
  });

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const suggestions: AdaptiveSuggestion[] = [];
  sorted.forEach(([symId, count], idx) => {
    const sym = symbols.find(s => s.id === symId);
    if (sym) {
      suggestions.push({
        id: 'sugg-' + idx,
        symbolId: sym.id,
        symbolLabel: sym.label,
        reason: `Sering digunakan pada waktu ${timeOfDay} (${count}x)`,
        suggestedLocation: 'Rumah',
        suggestedTime: timeOfDay,
        score: count,
      });
    }
  });

  return suggestions;
}
