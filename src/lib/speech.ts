"use client";

import { useSyncExternalStore } from "react";

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Reads text aloud, interrupting anything already being spoken. */
export function speak(text: string) {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-NG";
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}

const noSubscribe = () => () => {};

/** Hydration-safe check for speech support. */
export function useSpeechSupported() {
  return useSyncExternalStore(noSubscribe, speechSupported, () => true);
}
