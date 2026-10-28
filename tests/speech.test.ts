import { afterEach, describe, expect, it, vi } from "vitest";
import { speakWord } from "../src/speech";

afterEach(() => vi.unstubAllGlobals());

describe("speech playback", () => {
  it("reports unavailable speech and synchronous failures", () => {
    const failure = vi.fn();
    vi.stubGlobal("window", {});
    speakWord("word", failure);
    expect(failure).toHaveBeenCalledOnce();
    vi.stubGlobal("window", { speechSynthesis: { cancel: () => { throw new Error(); } }, SpeechSynthesisUtterance: class {} });
    speakWord("word", failure);
    expect(failure).toHaveBeenCalledTimes(2);
  });

  it("reports playback errors but ignores normal interruption", () => {
    const failure = vi.fn();
    let utterance: { onerror?: (event: { error: string }) => void } | undefined;
    class Utterance { lang = ""; rate = 1; onerror?: (event: { error: string }) => void; }
    vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
    vi.stubGlobal("window", { SpeechSynthesisUtterance: Utterance, speechSynthesis: { cancel() {}, speak(value: Utterance) { utterance = value; } } });
    speakWord("word", failure);
    utterance?.onerror?.({ error: "interrupted" });
    expect(failure).not.toHaveBeenCalled();
    utterance?.onerror?.({ error: "audio-busy" });
    expect(failure).toHaveBeenCalledOnce();
  });
});
