export function speakWord(word: string, onFailure: () => void, rate = 1) {
  try {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      onFailure();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-GB";
    utterance.rate = rate;
    utterance.onerror = (event) => {
      if (event.error !== "canceled" && event.error !== "interrupted") onFailure();
    };
    window.speechSynthesis.speak(utterance);
  } catch {
    onFailure();
  }
}
