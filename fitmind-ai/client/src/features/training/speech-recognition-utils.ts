export type SpeechRecognitionErrorCode =
  | "aborted"
  | "audio-capture"
  | "bad-grammar"
  | "language-not-supported"
  | "network"
  | "no-speech"
  | "not-allowed"
  | "service-not-allowed";

export interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  item(index: number): SpeechRecognitionAlternativeLike;
  length: number;
}

export interface SpeechRecognitionResultListLike {
  item(index: number): SpeechRecognitionResultLike;
  length: number;
}

export interface SpeechRecognitionTranscriptSnapshot {
  finalTranscript: string;
  interimTranscript: string;
}

export function getSpeechRecognitionErrorMessage(
  errorCode: SpeechRecognitionErrorCode | string,
): string {
  if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
    return "麦克风权限未开启，可以继续使用文本输入。";
  }

  if (errorCode === "no-speech") {
    return "没有识别到语音，可以重试或改用文本输入。";
  }

  if (errorCode === "audio-capture") {
    return "当前麦克风不可用，请检查设备后重试。";
  }

  if (errorCode === "network") {
    return "语音识别暂时无法联网，请稍后重试。";
  }

  if (errorCode === "language-not-supported") {
    return "当前浏览器不支持所选语音识别语言。";
  }

  return "语音识别已停止，暂未获得可用文本。";
}

export function appendSpeechTranscript(
  currentText: string,
  transcript: string,
): string {
  const trimmedTranscript = transcript.trim();

  if (!trimmedTranscript) {
    return currentText;
  }

  const trimmedCurrentText = currentText.trim();

  if (!trimmedCurrentText) {
    return trimmedTranscript;
  }

  return `${trimmedCurrentText} ${trimmedTranscript}`;
}

export function collectSpeechRecognitionTranscriptSnapshot(
  results: SpeechRecognitionResultListLike,
  resultIndex: number,
): SpeechRecognitionTranscriptSnapshot {
  const finalParts: string[] = [];
  const interimParts: string[] = [];

  for (let index = resultIndex; index < results.length; index += 1) {
    const result = results.item(index);

    if (result.length <= 0) {
      continue;
    }

    const transcript = result.item(0).transcript.trim();

    if (!transcript) {
      continue;
    }

    if (result.isFinal) {
      finalParts.push(transcript);
    } else {
      interimParts.push(transcript);
    }
  }

  return {
    finalTranscript: finalParts.join(" ").trim(),
    interimTranscript: interimParts.join(" ").trim(),
  };
}
