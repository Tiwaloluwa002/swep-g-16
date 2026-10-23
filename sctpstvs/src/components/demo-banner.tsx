/** Shown wherever money or fares appear, so nobody mistakes the demo for a real payment system. */
export function DemoBanner({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-warn-fg/40 bg-warn-bg px-3 py-2 text-sm text-warn-fg">
      <strong>Demo:</strong> {children}
    </p>
  );
}
