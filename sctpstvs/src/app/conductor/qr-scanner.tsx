"use client";

import type { IScannerControls } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";

type CameraState = "off" | "starting" | "on" | "error";

/** Camera QR scanner. The zxing library is loaded in the browser only, when the camera is first started. */
export function QrScanner({ onCode, paused }: { onCode: (text: string) => void; paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [state, setState] = useState<CameraState>("off");
  const [error, setError] = useState("");

  // The decode callback outlives renders, so it reads the latest props through refs.
  const onCodeRef = useRef(onCode);
  const pausedRef = useRef(paused);
  useEffect(() => {
    onCodeRef.current = onCode;
    pausedRef.current = paused;
  });

  useEffect(() => () => controlsRef.current?.stop(), []);

  async function start() {
    if (!window.isSecureContext) {
      setState("error");
      setError("The camera only works over HTTPS or on localhost. Type the backup code instead.");
      return;
    }
    setState("starting");
    setError("");
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150 });
      controlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current ?? undefined,
        (result) => {
          if (result && !pausedRef.current) onCodeRef.current(result.getText());
        },
      );
      setState("on");
    } catch (err) {
      const name = (err as Error).name;
      setState("error");
      setError(
        name === "NotAllowedError"
          ? "Camera permission was refused. Allow camera access in your browser, or type the backup code."
          : name === "NotFoundError"
            ? "No camera was found on this device. Type the backup code instead."
            : "The camera could not start. Type the backup code instead.",
      );
    }
  }

  function stop() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setState("off");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-72 w-full shrink-0 overflow-hidden rounded-lg bg-black sm:h-80">
        <video ref={videoRef} muted playsInline aria-label="Camera preview" className="h-full w-full object-cover" />
        {state !== "on" && (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-white">
            {state === "starting" ? "Starting camera…" : "Camera is off"}
          </p>
        )}
        {state === "on" && (
          // Aiming guide only; decoding uses the whole frame.
          <div aria-hidden className="pointer-events-none absolute inset-10 rounded-xl border-4 border-white/80" />
        )}
      </div>
      {state === "on" ? (
        <button type="button" onClick={stop} className="rounded-md border-2 border-border px-4 py-3 font-bold">
          Stop camera
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={state === "starting"}
          className="rounded-md bg-primary px-4 py-3 text-lg font-bold text-primary-fg disabled:opacity-60"
        >
          Start camera scanner
        </button>
      )}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
