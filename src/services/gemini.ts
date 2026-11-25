export async function getAISentenceSuggestions(currentSentence: string[]): Promise<string[]> {
  try {
    const response = await fetch('/api/ai-suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ currentSentence }),
    });

    if (!response.ok) {
      return getOfflineSuggestions(currentSentence);
    }

    const data = await response.json();
    if (data && Array.isArray(data.suggestions)) {
      return data.suggestions;
    }
    return getOfflineSuggestions(currentSentence);
  } catch (e) {
    console.warn('AI suggestions request failed, using offline fallback:', e);
    return getOfflineSuggestions(currentSentence);
  }
}

function getOfflineSuggestions(currentSentence: string[]): string[] {
  if (currentSentence.length === 0) {
    return ['Saya', 'Mau', 'Tolong', 'Sakit'];
  }
  const last = currentSentence[currentSentence.length - 1].toLowerCase();
  if (last === 'mau') {
    return ['Makan', 'Minum', 'Toilet', 'Main'];
  }
  if (last === 'saya') {
    return ['Mau', 'Suka', 'Lelah', 'Senang'];
  }
  return ['Terima Kasih', 'Selesai', 'Bagus', 'Tolong'];
}
