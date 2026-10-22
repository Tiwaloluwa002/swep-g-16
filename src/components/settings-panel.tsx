"use client";

import { type TextSize, updateSettings, useSettings } from "@/lib/settings";
import { useSpeechSupported } from "@/lib/speech";

const TEXT_SIZES: { value: TextSize; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
  { value: "x-large", label: "Extra large" },
];

export function SettingsPanel() {
  const settings = useSettings();
  const canSpeak = useSpeechSupported();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="mb-1 w-full text-sm font-semibold sm:mb-0 sm:mr-2 sm:w-auto">Text size</legend>
        {TEXT_SIZES.map((size) => (
          <label
            key={size.value}
            className="cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-fg"
          >
            <input
              type="radio"
              name="text-size"
              value={size.value}
              checked={settings.textSize === size.value}
              onChange={() => updateSettings({ textSize: size.value })}
              className="sr-only"
            />
            {size.label}
          </label>
        ))}
      </fieldset>

      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={settings.highContrast}
          onChange={(e) => updateSettings({ highContrast: e.target.checked })}
          className="size-5 accent-primary"
        />
        High contrast
      </label>

      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={settings.voice}
          disabled={!canSpeak}
          onChange={(e) => updateSettings({ voice: e.target.checked })}
          className="size-5 accent-primary"
        />
        Read directions aloud automatically
      </label>
    </div>
  );
}
