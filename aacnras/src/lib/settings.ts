"use client";

import { useSyncExternalStore } from "react";
import type { ProfileId } from "./types";

export type TextSize = "normal" | "large" | "x-large";

export type Settings = {
  profile: ProfileId;
  textSize: TextSize;
  highContrast: boolean;
  voice: boolean;
};

const KEY = "aacnras-settings";
const DEFAULTS: Settings = { profile: "standard", textSize: "normal", highContrast: false, voice: false };

let cache: Settings | null = null;
const listeners = new Set<() => void>();

function read(): Settings {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    cache = DEFAULTS;
  }
  return cache!;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Per-device preferences, remembered in localStorage. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, read, () => DEFAULTS);
}

export function updateSettings(patch: Partial<Settings>) {
  cache = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage can be unavailable (private mode); settings still apply for this visit.
  }
  listeners.forEach((l) => l());
}
