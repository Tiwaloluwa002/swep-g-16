import { findSensitiveText, SENSITIVE_MESSAGES } from "@/lib/text";

/** Live hint under public text fields; the server enforces the same rule. */
export function SensitiveWarning({ id, text }: { id: string; text: string }) {
  const found = findSensitiveText(text);
  return (
    <p id={id} role="status" className="text-sm text-danger">
      {found.length > 0 && `This text is public. ${found.map((f) => SENSITIVE_MESSAGES[f]).join(" ")}`}
    </p>
  );
}
