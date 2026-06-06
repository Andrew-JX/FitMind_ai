import { describe, expect, it } from "vitest";

import {
  appendSpeechTranscript,
  collectSpeechRecognitionTranscriptSnapshot,
  getSpeechRecognitionErrorMessage,
} from "./speech-recognition-utils";

describe("speech recognition helpers", () => {
  it("maps common browser recognition errors to user-safe messages", () => {
    expect(getSpeechRecognitionErrorMessage("not-allowed")).toContain(
      "麦克风权限",
    );
    expect(getSpeechRecognitionErrorMessage("service-not-allowed")).toContain(
      "麦克风权限",
    );
    expect(getSpeechRecognitionErrorMessage("no-speech")).toContain(
      "没有识别到语音",
    );
    expect(getSpeechRecognitionErrorMessage("audio-capture")).toContain(
      "麦克风不可用",
    );
    expect(getSpeechRecognitionErrorMessage("network")).toContain(
      "语音识别暂时无法联网",
    );
  });

  it("appends transcripts without overwriting editable intake text", () => {
    expect(appendSpeechTranscript("", "杠铃卧推三组 60x10")).toBe(
      "杠铃卧推三组 60x10",
    );
    expect(appendSpeechTranscript("今天练了", "高位下拉两组 45x12")).toBe(
      "今天练了 高位下拉两组 45x12",
    );
    expect(appendSpeechTranscript("今天练了", "   ")).toBe("今天练了");
  });

  it("keeps interim recognition text for live voice preview", () => {
    const results = makeRecognitionResults([
      { isFinal: true, transcript: "今天练了背" },
      { isFinal: false, transcript: "高位下拉三组" },
    ]);

    expect(collectSpeechRecognitionTranscriptSnapshot(results, 0)).toEqual({
      finalTranscript: "今天练了背",
      interimTranscript: "高位下拉三组",
    });
  });
});

function makeRecognitionResults(
  items: Array<{ isFinal: boolean; transcript: string }>,
) {
  return {
    item(index: number) {
      const item = items[index];

      if (!item) {
        throw new Error(`Missing recognition result at index ${index}`);
      }

      return {
        isFinal: item.isFinal,
        item() {
          return { transcript: item.transcript };
        },
        length: 1,
      };
    },
    length: items.length,
  };
}
