"use client";

import { useEffect } from "react";
import { useSettings } from "@/lib/settings";

/** Mirrors display settings onto <html> so the CSS tokens can react to them. */
export function SettingsEffect() {
  const { textSize, highContrast } = useSettings();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.text = textSize;
    root.dataset.contrast = highContrast ? "high" : "normal";
  }, [textSize, highContrast]);
  return null;
}
