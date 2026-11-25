import { SymbolItem, AACProfile, UsageLog, AdaptiveSuggestion } from '../types';
import { DEFAULT_SYMBOLS } from '../data/defaultSymbols';

const STORAGE_KEYS = {
  SYMBOLS: 'bicara_ku_symbols_v1',
  PROFILE: 'bicara_ku_profile_v1',
  LOGS: 'bicara_ku_logs_v1',
  CONSENT: 'bicara_ku_consent_v1',
  CUSTOM_LAYOUT: 'bicara_ku_custom_layout_v1',
};

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
};

export function getStoredSymbols(): SymbolItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SYMBOLS);
    if (!stored) {
      localStorage.setItem(STORAGE_KEYS.SYMBOLS, JSON.stringify(DEFAULT_SYMBOLS));
      return DEFAULT_SYMBOLS;
    }
    return JSON.parse(stored);
  } catch (e) {
    console.error('Error loading symbols:', e);
    return DEFAULT_SYMBOLS;
  }
}

export function saveSymbols(symbols: SymbolItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SYMBOLS, JSON.stringify(symbols));
  } catch (e) {
    console.error('Error saving symbols:', e);
  }
}

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
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    };
    // Keep last 1000 logs
    const updated = [newLog, ...logs].slice(0, 1000);
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(updated));

    // Also update symbol frequency
    const symbols = getStoredSymbols();
    const symIndex = symbols.findIndex(s => s.id === log.symbolId);
    if (symIndex !== -1) {
      symbols[symIndex].frequency = (symbols[symIndex].frequency || 0) + 1;
      symbols[symIndex].lastUsed = Date.now();
      saveSymbols(symbols);
    }
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

export function generateAdaptiveSuggestions(): AdaptiveSuggestion[] {
  const logs = getStoredLogs();
  const symbols = getStoredSymbols();
  if (logs.length < 3) return [];

  const hour = new Date().getHours();
  const timeOfDay = hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';

  // Count usage per symbol in current time of day
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
