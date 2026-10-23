import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
// Fallback for private windows where localStorage throws: remembered until reload.
const memory = new Map<string, string>();

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? "";
  } catch {
    return memory.get(key) ?? "";
  }
}

/** A string remembered in localStorage on this device (e.g. the conductor's vehicle). */
export function useLocalSetting(key: string): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => read(key),
    () => "",
  );
  const set = useCallback(
    (next: string) => {
      memory.set(key, next);
      try {
        localStorage.setItem(key, next);
      } catch {
        // Kept in memory only.
      }
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [value, set];
}
