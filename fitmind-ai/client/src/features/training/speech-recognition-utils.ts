export type SpeechRecognitionErrorCode =
  | "aborted"
  | "audio-capture"
  | "bad-grammar"
  | "language-not-supported"
  | "network"
  | "no-speech"
  | "not-allowed"
  | "service-not-allowed";

export function getSpeechRecognitionErrorMessage(
  errorCode: SpeechRecognitionErrorCode | string,
): string {
  if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
    return "Microphone permission was denied. You can continue using text input.";
  }

  if (errorCode === "no-speech") {
    return "No speech was detected. Try again or continue with text input.";
  }

  if (errorCode === "audio-capture") {
    return "The microphone is unavailable. Check your device and try again.";
  }

  if (errorCode === "network") {
    return "Speech recognition is unavailable because of a network issue.";
  }

  if (errorCode === "language-not-supported") {
    return "This browser does not support the selected recognition language.";
  }

  return "Speech recognition stopped before a transcript was captured.";
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
