import { describe, expect, it } from "vitest";

import {
  appendSpeechTranscript,
  getSpeechRecognitionErrorMessage,
} from "./speech-recognition-utils";

describe("speech recognition helpers", () => {
  it("maps common browser recognition errors to user-safe messages", () => {
    expect(getSpeechRecognitionErrorMessage("not-allowed")).toContain(
      "Microphone permission was denied",
    );
    expect(getSpeechRecognitionErrorMessage("service-not-allowed")).toContain(
      "Microphone permission was denied",
    );
    expect(getSpeechRecognitionErrorMessage("no-speech")).toContain(
      "No speech was detected",
    );
    expect(getSpeechRecognitionErrorMessage("audio-capture")).toContain(
      "microphone is unavailable",
    );
    expect(getSpeechRecognitionErrorMessage("network")).toContain(
      "Speech recognition is unavailable",
    );
  });

  it("appends transcripts without overwriting editable intake text", () => {
    expect(appendSpeechTranscript("", "杠铃卧推三组 60x10")).toBe(
      "杠铃卧推三组 60x10",
    );
    expect(
      appendSpeechTranscript("今天练了", "高位下拉两组 45x12"),
    ).toBe("今天练了 高位下拉两组 45x12");
    expect(appendSpeechTranscript("今天练了", "   ")).toBe("今天练了");
  });
});
