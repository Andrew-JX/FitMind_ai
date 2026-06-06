import { useEffect, useRef, useState } from "react";

import {
  appendSpeechTranscript,
  collectSpeechRecognitionTranscriptSnapshot,
  getSpeechRecognitionErrorMessage,
  type SpeechRecognitionErrorCode,
} from "./speech-recognition-utils";

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
}

interface BrowserSpeechRecognitionResult {
  isFinal: boolean;
  item(index: number): BrowserSpeechRecognitionAlternative;
  length: number;
}

interface BrowserSpeechRecognitionResultList {
  item(index: number): BrowserSpeechRecognitionResult;
  length: number;
}

interface BrowserSpeechRecognitionResultEvent {
  resultIndex: number;
  results: BrowserSpeechRecognitionResultList;
}

interface BrowserSpeechRecognitionErrorEvent {
  error: SpeechRecognitionErrorCode | string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionResultEvent) => void) | null;
  onstart: (() => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor | undefined;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor | undefined;
}

export interface UseSpeechRecognitionResult {
  errorMessage: string | null;
  interimTranscript: string;
  isListening: boolean;
  isSupported: boolean;
  resetTranscript: () => void;
  startListening: () => void;
  stopListening: () => void;
  transcript: string;
}

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(
    () => getSpeechRecognitionConstructor() !== null,
  );
  const transcript = appendSpeechTranscript(finalTranscript, interimTranscript);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  function startListening() {
    const RecognitionConstructor = getSpeechRecognitionConstructor();

    if (!RecognitionConstructor) {
      setErrorMessage("当前浏览器暂不支持语音识别，可以继续使用文本输入。");
      return;
    }

    recognitionRef.current?.abort();

    const recognition = new RecognitionConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "zh-CN";
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setErrorMessage(null);
      setIsListening(true);
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognition.onerror = (event) => {
      setErrorMessage(getSpeechRecognitionErrorMessage(event.error));
      setIsListening(false);
    };
    recognition.onresult = (event) => {
      const snapshot = collectSpeechRecognitionTranscriptSnapshot(
        event.results,
        event.resultIndex,
      );

      if (snapshot.finalTranscript) {
        setFinalTranscript((currentTranscript) =>
          appendSpeechTranscript(currentTranscript, snapshot.finalTranscript),
        );
      }

      setInterimTranscript(snapshot.interimTranscript);
    };

    recognitionRef.current = recognition;
    setErrorMessage(null);
    resetTranscript();

    try {
      recognition.start();
    } catch {
      setErrorMessage("语音识别无法启动，请稍后重试。");
      setIsListening(false);
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function resetTranscript() {
    setFinalTranscript("");
    setInterimTranscript("");
  }

  return {
    errorMessage,
    interimTranscript,
    isListening,
    isSupported,
    resetTranscript,
    startListening,
    stopListening,
    transcript,
  };
}

function getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const speechWindow = window as SpeechRecognitionWindow;

  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  );
}
