let cachedVoices: SpeechSynthesisVoice[] = [];

export function getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve([]);
      return;
    }
    
    const updateVoices = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    };

    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
    
    // Fallback timeout in case voiceschanged doesn't fire immediately
    setTimeout(() => {
      if (cachedVoices.length === 0) {
        cachedVoices = window.speechSynthesis.getVoices();
        resolve(cachedVoices);
      }
    }, 300);
  });
}

export function speakText(
  text: string, 
  options?: { voiceName?: string; rate?: number; pitch?: number; customAudioUrl?: string }
): Promise<void> {
  return new Promise((resolve) => {
    if (!text && !options?.customAudioUrl) {
      resolve();
      return;
    }

    // If custom audio recording exists, play it
    if (options?.customAudioUrl) {
      const audio = new Audio(options.customAudioUrl);
      audio.onended = () => resolve();
      audio.onerror = () => {
        // Fallback to TTS if audio fails
        fallbackTTS(text, options).then(resolve);
      };
      audio.play().catch(() => {
        fallbackTTS(text, options).then(resolve);
      });
      return;
    }

    fallbackTTS(text, options).then(resolve);
  });
}

async function fallbackTTS(
  text: string,
  options?: { voiceName?: string; rate?: number; pitch?: number }
): Promise<void> {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser.');
    return;
  }

  window.speechSynthesis.cancel(); // Cancel any ongoing speech

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options?.rate ?? 0.9;
  utterance.pitch = options?.pitch ?? 1.0;

  const voices = await getAvailableVoices();
  
  if (options?.voiceName) {
    const selectedVoice = voices.find(v => v.name === options.voiceName);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
  } else {
    // Default to Indonesian voice if available, else first Indonesian or default
    const indonesianVoice = voices.find(v => v.lang.startsWith('id') || v.lang.startsWith('in'));
    if (indonesianVoice) {
      utterance.voice = indonesianVoice;
    } else {
      utterance.lang = 'id-ID';
    }
  }

  return new Promise((resolve) => {
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
