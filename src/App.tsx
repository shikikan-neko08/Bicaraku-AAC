import React, { useState, useEffect } from 'react';
import { SymbolItem, AACProfile, UsageLog, SentenceItem, LocationContextType, GridSize } from './types';
import { 
  getStoredSymbols, saveSymbols, getStoredProfile, saveProfile, 
  getStoredLogs, addUsageLog, getStoredConsent, setStoredConsent, generateAdaptiveSuggestions 
} from './services/storage';
import { speakText } from './services/tts';
import { getAISentenceSuggestions } from './services/gemini';
import { Header } from './components/Header';
import { EmergencyBar } from './components/EmergencyBar';
import { SentenceBar } from './components/SentenceBar';
import { UserMode } from './components/UserMode';
import { CaregiverMode } from './components/CaregiverMode';
import { PinModal } from './components/PinModal';
import { ConsentModal } from './components/ConsentModal';

export default function App() {
  const [symbols, setSymbols] = useState<SymbolItem[]>([]);
  const [profile, setProfile] = useState<AACProfile>(getStoredProfile());
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LocationContextType>('Rumah');
  const [sentence, setSentence] = useState<SentenceItem[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>(['Saya', 'Mau', 'Tolong', 'Sakit']);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  // Modes & Modals
  const [isCaregiverMode, setIsCaregiverMode] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [adaptiveSuggestions, setAdaptiveSuggestions] = useState<any[]>([]);

  useEffect(() => {
    setSymbols(getStoredSymbols());
    setLogs(getStoredLogs());
    const hasConsent = getStoredConsent();
    if (!hasConsent) {
      setShowConsentModal(true);
    }
    setAdaptiveSuggestions(generateAdaptiveSuggestions());
  }, []);

  useEffect(() => {
    if (profile.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [profile.theme]);

  // Update suggestions when sentence changes
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
    // Add to sentence
    const newItem: SentenceItem = {
      id: 'sent-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      symbolId: symbol.id,
      label: symbol.label,
      spokenText: symbol.spokenText || symbol.label,
    };
    setSentence(prev => [...prev, newItem]);

    // Log usage
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
    setAdaptiveSuggestions(generateAdaptiveSuggestions());

    // If single tap speak is enabled or it's an emergency symbol, speak immediately
    if (profile.singleTapSpeak || symbol.isEmergency) {
      await speakText(symbol.spokenText || symbol.label, {
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

  const handleSaveSymbols = (newSymbols: SymbolItem[]) => {
    setSymbols(newSymbols);
    saveSymbols(newSymbols);
  };

  const handleSaveProfile = (newProfile: AACProfile) => {
    setProfile(newProfile);
    saveProfile(newProfile);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Consent Modal on First Launch */}
      {showConsentModal && (
        <ConsentModal onAccept={() => {
          setStoredConsent(true);
          setShowConsentModal(false);
        }} />
      )}

      {/* PIN Verification Modal */}
      {showPinModal && (
        <PinModal
          correctPin={profile.pinCode || '1234'}
          onSuccess={() => {
            setShowPinModal(false);
            setIsCaregiverMode(true);
          }}
          onClose={() => setShowPinModal(false)}
        />
      )}

      {/* Caregiver Mode Fullscreen */}
      {isCaregiverMode ? (
        <CaregiverMode
          symbols={symbols}
          onSaveSymbols={handleSaveSymbols}
          profile={profile}
          onSaveProfile={handleSaveProfile}
          logs={logs}
          onClose={() => setIsCaregiverMode(false)}
          suggestions={adaptiveSuggestions}
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
            onToggleTheme={() => handleSaveProfile({ ...profile, theme: profile.theme === 'dark' ? 'sensory-soft' : 'dark' })}
          />

          {/* Emergency Bar */}
          <EmergencyBar onSelectEmergency={handleSelectSymbol} />

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
            onSelectSymbol={handleSelectSymbol}
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
