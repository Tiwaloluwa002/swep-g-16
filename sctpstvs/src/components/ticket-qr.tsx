"use client";

import { useEffect, useState } from "react";

/** Renders the signed token as a QR code. Dark modules on white, as scanners expect, whatever the theme. */
export function TicketQr({ token, label }: { token: string; label: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let live = true;
    import("qrcode")
      .then((QR) => QR.toString(token, { type: "svg", errorCorrectionLevel: "M", margin: 2 }))
      .then((markup) => live && setSvg(markup));
    return () => {
      live = false;
    };
  }, [token]);

  return (
    <div
      role="img"
      aria-label={label}
      className="aspect-square w-full max-w-80 rounded-lg bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
      // The markup comes from the qrcode library and encodes our own token, not user HTML.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
