"use client";

import { type FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { Alert, Button, Field, inputClass } from "./ui";

type Detector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type DetectorClass = new (options: { formats: string[] }) => Detector;

const getDetector = () => (globalThis as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
const noop = () => () => {};

/**
 * Enter a handover code, or scan the owner's QR where the browser supports
 * the BarcodeDetector API (Chrome on Android, for example).
 */
export function CodeEntry({ onConfirmed }: { onConfirmed: (item: string) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canScan = useSyncExternalStore(noop, () => Boolean(getDetector() && navigator.mediaDevices), () => false);

  async function confirm(value: string) {
    setError("");
    setDone("");
    try {
      const result = await api<{ item: string }>("/api/handover", { body: { code: value } });
      setDone(`Handover confirmed: ${result.item}. The code can no longer be used.`);
      setCode("");
      onConfirmed(result.item);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void confirm(code);
  }

  useEffect(() => {
    if (!scanning) return;
    const Detector = getDetector();
    if (!Detector) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    const detector = new Detector({ formats: ["qr_code"] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        const video = videoRef.current!;
        video.srcObject = s;
        return video.play();
      })
      .then(() => {
        timer = setInterval(async () => {
          const found = await detector.detect(videoRef.current!).catch(() => []);
          if (found[0]) {
            setScanning(false);
            setCode(found[0].rawValue);
          }
        }, 400);
      })
      .catch(() => {
        setError("Could not open the camera. Type the code instead.");
        setScanning(false);
      });
    return () => {
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning]);

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-64">
          <Field id="handover-code" label="Owner's handover code">
            <input
              id="handover-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABCD-2345"
              autoComplete="off"
              autoCapitalize="characters"
              required
              className={`${inputClass} font-mono uppercase tracking-widest`}
            />
          </Field>
        </div>
        <Button type="submit">Confirm handover</Button>
        {canScan && (
          <Button variant="secondary" onClick={() => setScanning((s) => !s)}>
            {scanning ? "Stop camera" : "Scan QR code"}
          </Button>
        )}
      </form>
      {scanning && <video ref={videoRef} muted playsInline className="h-56 w-full max-w-sm shrink-0 rounded-md bg-black object-cover" aria-label="Camera preview for scanning the QR code" />}
      <Alert>{error}</Alert>
      <Alert kind="ok">{done}</Alert>
      <p className="text-sm text-muted">Hand the item over only after the code is confirmed here. Each code works once.</p>
    </div>
  );
}
