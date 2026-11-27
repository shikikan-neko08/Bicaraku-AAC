import React, { useState, useEffect, useCallback } from 'react';
import {
  SymbolItem,
  AACProfile,
  UsageLog,
  SentenceItem,
  LocationContextType,
  GridSize,
  ManifestMeta,
  SyncSummary,
  SyncDiagnostics,
  AdaptiveSuggestion,
} from './types';
import { BUNDLED_SYMBOLS_VERSION } from './config/symbolSource';
import {
  getStoredProfile,
  saveProfile,
  getStoredLogs,
  addUsageLog,
  getStoredConsent,
  setStoredConsent,
  generateAdaptiveSuggestions,
} from './services/storage';
import {
  idbGetAllSymbols,
  idbPreloadAllBlobUrls,
  idbReplaceAllSymbols,
  idbPutBlob,
  idbPutSymbol,
  idbDeleteSymbol,
  getManifestMeta,
  getSyncDiagnostics,
} from './services/indexedDb';
import {
  runInitialOrResumeSync,
  activateOfflineTextFallback,
  prepareRestartSymbolDownload,
  prepareResetBundledSymbols,
  SyncProgress,
} from './services/symbolSync';
import { speakText } from './services/tts';
import { getAISentenceSuggestions } from './services/gemini';
import { Header } from './components/Header';
import { EmergencyBar } from './components/EmergencyBar';
import { SentenceBar } from './components/SentenceBar';
import { UserMode } from './components/UserMode';
import { CaregiverMode } from './components/CaregiverMode';
import { SymbolSetupScreen } from './components/SymbolSetupScreen';
import { PinModal } from './components/PinModal';
import { ConsentModal } from './components/ConsentModal';

type SetupPhase = 'bootstrapping' | 'syncing' | 'error' | 'summary' | 'ready';

export default function App() {
  const [symbols, setSymbols] = useState<SymbolItem[]>([]);
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const [manifestMeta, setManifestMeta] = useState<ManifestMeta | null>(null);
  const [diagnostics, setDiagnostics] = useState<SyncDiagnostics | null>(null);

  const [setupPhase, setSetupPhase] = useState<SetupPhase>('bootstrapping');
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    phase: 'manifest',
    completed: 0,
    total: 1,
  });
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);

  const [profile, setProfile] = useState<AACProfile>(getStoredProfile());
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LocationContextType>('Rumah');
  const [sentence, setSentence] = useState<SentenceItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>(['Saya', 'Mau', 'Tolong', 'Sakit']);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  // Modes & Modals
  const [isCaregiverMode, setIsCaregiverMode] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingEditSymbolId, setPendingEditSymbolId] = useState<string | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [adaptiveSuggestions, setAdaptiveSuggestions] = useState<AdaptiveSuggestion[]>([]);

  const startSyncFlow = useCallback(async () => {
    setSetupPhase('syncing');
    setSyncError(null);
    setSyncProgress({ phase: 'manifest', completed: 0, total: 1 });

    try {
      const result = await runInitialOrResumeSync(progress => {
        setSyncProgress(progress);
      });
      const [preloadedUrls, freshMeta] = await Promise.all([
        idbPreloadAllBlobUrls(),
        getManifestMeta(),
      ]);
      setSymbols(result.symbols);
      setBlobUrls(preloadedUrls);
      setManifestMeta(freshMeta);
      setDiagnostics(result.diagnostics);
      setSyncSummary(result.summary);
      setAdaptiveSuggestions(generateAdaptiveSuggestions(result.symbols));
      setSetupPhase('summary');
    } catch (err: unknown) {
      const freshDiag = await getSyncDiagnostics().catch(() => null);
      if (freshDiag) setDiagnostics(freshDiag);
      setSyncError(
        err instanceof Error
          ? err.message
          : 'Gagal mengunduh simbol dari repositori GitHub maupun cermin CDN.'
      );
      setSetupPhase('error');
    }
  }, []);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      setLogs(getStoredLogs());

      try {
        const [meta, storedSymbols, urls, diag] = await Promise.all([
          getManifestMeta(),
          idbGetAllSymbols(),
          idbPreloadAllBlobUrls(),
          getSyncDiagnostics(),
        ]);

        if (!active) return;

        setManifestMeta(meta);
        setBlobUrls(urls);
        setDiagnostics(diag);

        const hasLegacySeed = storedSymbols.some(
          s => s.source === 'legacy-seed' || s.source === 'builtin-offline'
        );
        const isBundledVersionCurrent =
          meta?.completedInit === true &&
          meta?.bundledSymbolsVersion === BUNDLED_SYMBOLS_VERSION &&
          !meta?.offlineTextFallback &&
          storedSymbols.length > 0 &&
          !hasLegacySeed;

        // Hanya lewati pengunduhan jika versi skema/bundel sudah cocok, selesai penuh,
        // dan tidak lagi memakai seed lama.
        if (isBundledVersionCurrent) {
          setSymbols(storedSymbols);
          setAdaptiveSuggestions(generateAdaptiveSuggestions(storedSymbols));
          setSetupPhase('ready');
          if (!getStoredConsent()) {
            setShowConsentModal(true);
          }
          return;
        }

        // Jalankan migrasi seed lama + unduh manifest & gambar simbol dari MANIFEST_URL
        await startSyncFlow();
      } catch (err) {
        console.error('Bootstrap IndexedDB error:', err);
        if (active) {
          await startSyncFlow();
        }
      }
    };

    bootstrap();

    return () => {
      active = false;
    };
  }, [startSyncFlow]);

  useEffect(() => {
    if (profile.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [profile.theme]);

  // Update AI/offline next-word suggestions when sentence changes
  useEffect(() => {
    let isMounted = true;
    setIsLoadingAI(true);
    const currentLabels = sentence.map(s => s.label);

    getAISentenceSuggestions(currentLabels).then(res => {
      if (isMounted) {
        setSuggestions(res);
        setIsLoadingAI(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [sentence]);

  const handleSelectSymbol = async (symbol: SymbolItem) => {
    const spoken = symbol.spokenText || symbol.speechText || symbol.label;
    const newItem: SentenceItem = {
      id: 'sent-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      symbolId: symbol.id,
      label: symbol.label,
      spokenText: spoken,
    };
    setSentence(prev => [...prev, newItem]);

    const hour = new Date().getHours();
    const timeOfDay = hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';
    addUsageLog({
      symbolId: symbol.id,
      symbolLabel: symbol.label,
      category: symbol.category,
      timestamp: Date.now(),
      location: currentLocation,
      timeOfDay,
    });
    setLogs(getStoredLogs());
    setAdaptiveSuggestions(generateAdaptiveSuggestions(symbols));

    if (profile.singleTapSpeak || symbol.isEmergency) {
      await speakText(spoken, {
        voiceName: profile.voiceName,
        rate: profile.speechRate,
        pitch: profile.speechPitch,
        customAudioUrl: symbol.customAudioUrl,
      });
    }
  };

  const handleSpeakSentence = async () => {
    if (sentence.length === 0) return;
    const fullText = sentence.map(s => s.spokenText || s.label).join(' ');
    await speakText(fullText, {
      voiceName: profile.voiceName,
      rate: profile.speechRate,
      pitch: profile.speechPitch,
    });
  };

  const handleClearSentence = () => setSentence([]);
  const handleRemoveLast = () => setSentence(prev => prev.slice(0, -1));
  const handleRemoveItem = (index: number) => {
    setSentence(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectSuggestion = async (text: string) => {
    const singleWord = text.trim().split(/\s+/)[0] || text;
    const newItem: SentenceItem = {
      id: 'sent-' + Date.now(),
      symbolId: 'sugg-' + Date.now(),
      label: singleWord,
      spokenText: singleWord,
    };
    setSentence(prev => [...prev, newItem]);

    if (profile.singleTapSpeak) {
      await speakText(singleWord, {
        voiceName: profile.voiceName,
        rate: profile.speechRate,
        pitch: profile.speechPitch,
      });
    }
  };

  const handleSaveSymbols = async (newSymbols: SymbolItem[]) => {
    // Jika ada cadangan lama yang menyertakan customImageUrl data URL, pindahkan ke store blobs IndexedDB
    const normalized = await Promise.all(
      newSymbols.map(async sym => {
        if (sym.customImageUrl && sym.customImageUrl.startsWith('data:image/')) {
          try {
            const res = await fetch(sym.customImageUrl);
            const blob = await res.blob();
            await idbPutBlob(sym.id, blob, blob.type);
            const { customImageUrl: _removed, ...rest } = sym;
            return {
              ...rest,
              hasImageBlob: true,
              isPlaceholder: false,
              downloadStatus: 'done' as const,
            };
          } catch {
            return sym;
          }
        }
        return sym;
      })
    );

    await idbReplaceAllSymbols(normalized);
    const urls = await idbPreloadAllBlobUrls();
    setSymbols(normalized);
    setBlobUrls(urls);
    setAdaptiveSuggestions(generateAdaptiveSuggestions(normalized));
  };

  const handleSaveSymbolPhoto = async (
    symbolId: string,
    blob: Blob,
    markModified = true
  ) => {
    await idbPutBlob(symbolId, blob, blob.type);
    const currentList = await idbGetAllSymbols();
    const updatedList = currentList.map(s =>
      s.id === symbolId
        ? {
            ...s,
            hasImageBlob: true,
            isPlaceholder: false,
            downloadStatus: 'done' as const,
            source: s.isCustom || s.source === 'custom-photo' ? 'custom-photo' : s.source,
            userModified: markModified ? true : s.userModified,
          }
        : s
    );
    const target = updatedList.find(s => s.id === symbolId);
    if (target) {
      await idbPutSymbol(target);
    }
    const urls = await idbPreloadAllBlobUrls();
    setSymbols(updatedList);
    setBlobUrls(urls);
  };

  const handleDeleteSymbol = async (symbolId: string) => {
    await idbDeleteSymbol(symbolId);
    const updatedList = symbols.filter(s => s.id !== symbolId);
    setSymbols(updatedList);
    setBlobUrls(prev => {
      const next = { ...prev };
      delete next[symbolId];
      return next;
    });
  };

  const handleSyncCompleted = async (updatedSymbols: SymbolItem[], meta: ManifestMeta) => {
    const [urls, diag] = await Promise.all([idbPreloadAllBlobUrls(), getSyncDiagnostics()]);
    setSymbols(updatedSymbols);
    setBlobUrls(urls);
    setManifestMeta(meta);
    if (diag) setDiagnostics(diag);
    setAdaptiveSuggestions(generateAdaptiveSuggestions(updatedSymbols));
  };

  const handleRestartDownload = async () => {
    await prepareRestartSymbolDownload();
    setIsCaregiverMode(false);
    await startSyncFlow();
  };

  const handleResetBundledSymbols = async (keepCaregiverSymbols = true) => {
    await prepareResetBundledSymbols(keepCaregiverSymbols);
    setIsCaregiverMode(false);
    await startSyncFlow();
  };

  const handleSaveProfile = (newProfile: AACProfile) => {
    setProfile(newProfile);
    saveProfile(newProfile);
  };

  const handleContinueOfflineText = async () => {
    const fallbackSymbols = await activateOfflineTextFallback();
    const [urls, meta] = await Promise.all([idbPreloadAllBlobUrls(), getManifestMeta()]);
    setSymbols(fallbackSymbols);
    setBlobUrls(urls);
    setManifestMeta(meta);
    setAdaptiveSuggestions(generateAdaptiveSuggestions(fallbackSymbols));
    setSetupPhase('ready');
    if (!getStoredConsent()) {
      setShowConsentModal(true);
    }
  };

  const handleFinishSummary = () => {
    setSetupPhase('ready');
    if (!getStoredConsent()) {
      setShowConsentModal(true);
    }
  };

  const handleRequestAddPhoto = (sym: SymbolItem) => {
    setPendingEditSymbolId(sym.id);
    setShowPinModal(true);
  };

  if (setupPhase === 'bootstrapping') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <p className="text-base font-semibold text-slate-600 dark:text-slate-300">
          Memuat BicaraKu...
        </p>
      </div>
    );
  }

  if (setupPhase === 'syncing' || setupPhase === 'error' || setupPhase === 'summary') {
    return (
      <SymbolSetupScreen
        status={setupPhase}
        progress={syncProgress}
        errorMessage={syncError}
        summary={syncSummary}
        onRetry={startSyncFlow}
        onContinueOfflineText={handleContinueOfflineText}
        onFinishSummary={handleFinishSummary}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Consent Modal */}
      {showConsentModal && (
        <ConsentModal
          onAccept={() => {
            setStoredConsent(true);
            setShowConsentModal(false);
          }}
        />
      )}

      {/* PIN Verification Modal */}
      {showPinModal && (
        <PinModal
          correctPin={profile.pinCode || '1234'}
          onSuccess={() => {
            setShowPinModal(false);
            setIsCaregiverMode(true);
          }}
          onClose={() => {
            setShowPinModal(false);
            setPendingEditSymbolId(null);
          }}
        />
      )}

      {/* Caregiver Mode Fullscreen */}
      {isCaregiverMode ? (
        <CaregiverMode
          symbols={symbols}
          blobUrls={blobUrls}
          onSaveSymbols={handleSaveSymbols}
          onSaveSymbolPhoto={handleSaveSymbolPhoto}
          onDeleteSymbol={handleDeleteSymbol}
          onSyncCompleted={handleSyncCompleted}
          onRestartDownload={handleRestartDownload}
          onResetBundledSymbols={handleResetBundledSymbols}
          profile={profile}
          onSaveProfile={handleSaveProfile}
          logs={logs}
          onClose={() => {
            setIsCaregiverMode(false);
            setPendingEditSymbolId(null);
          }}
          suggestions={adaptiveSuggestions}
          manifestMeta={manifestMeta}
          diagnostics={diagnostics}
          initialEditSymbolId={pendingEditSymbolId}
          onClearInitialEditSymbol={() => setPendingEditSymbolId(null)}
        />
      ) : (
        <>
          {/* Header */}
          <Header
            currentLocation={currentLocation}
            onChangeLocation={setCurrentLocation}
            gridSize={profile.gridSize}
            onChangeGridSize={(size: GridSize) => handleSaveProfile({ ...profile, gridSize: size })}
            onOpenCaregiverMode={() => setShowPinModal(true)}
            theme={profile.theme}
            onToggleTheme={() =>
              handleSaveProfile({
                ...profile,
                theme: profile.theme === 'dark' ? 'sensory-soft' : 'dark',
              })
            }
          />

          {/* Emergency Bar */}
          <EmergencyBar
            symbols={symbols}
            blobUrls={blobUrls}
            onSelectEmergency={handleSelectSymbol}
          />

          {/* Sentence Bar */}
          <SentenceBar
            sentence={sentence}
            onSpeak={handleSpeakSentence}
            onClear={handleClearSentence}
            onRemoveLast={handleRemoveLast}
            onRemoveItem={handleRemoveItem}
            suggestions={suggestions}
            onSelectSuggestion={handleSelectSuggestion}
            isLoadingAI={isLoadingAI}
          />

          {/* Main User Communication Grid */}
          <UserMode
            symbols={symbols}
            blobUrls={blobUrls}
            figurePreference={profile.figurePreference || 'all'}
            safeLicenseMode={profile.safeLicenseMode !== false}
            onSelectSymbol={handleSelectSymbol}
            onAddPhoto={handleRequestAddPhoto}
            gridSize={profile.gridSize}
            onChangeGridSize={(size: GridSize) => handleSaveProfile({ ...profile, gridSize: size })}
            showTextOnly={profile.showTextOnly}
            imageOnly={profile.imageOnly}
            touchDelay={profile.touchDelaySeconds}
          />
        </>
      )}
    </div>
  );
}
