"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { CategorySelect, ColourSelect, LocationSelect } from "@/components/catalog-selects";
import { SensitiveWarning } from "@/components/sensitive-warning";
import { Alert, Button, Card, Field, inputClass, PageShell } from "@/components/ui";
import { api } from "@/lib/api";
import { useToday } from "@/lib/use-today";
import type { OwnLost } from "@/lib/public-types";

export function LostForm() {
  const router = useRouter();
  const today = useToday();
  const [form, setForm] = useState({
    category: "",
    colour: "",
    brand: "",
    description: "",
    locationId: "",
    lostDate: "",
    timeFrom: "08:00",
    timeTo: "18:00",
  });
  const [secret, setSecret] = useState({ serialLastDigits: "", lockScreen: "", contents: "", uniqueMarks: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const setPrivate = (key: keyof typeof secret) => (value: string) => setSecret((s) => ({ ...s, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const item = await api<OwnLost>("/api/lost", { body: { ...form, lostDate: form.lostDate || today, privateDetails: secret } });
      router.push(`/lost/${item.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <PageShell
      title="Report a lost item"
      back={{ href: "/dashboard", label: "My reports" }}
      intro="Public details help the system find a match. Private details stay on the server and are never shown to anyone else."
    >
      <form onSubmit={submit} className="flex flex-col gap-6">
        <Card>
          <h2 className="text-lg font-bold">Public details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="category" label="Category">
              <CategorySelect id="category" value={form.category} onChange={set("category")} />
            </Field>
            <Field id="colour" label="Main colour">
              <ColourSelect id="colour" value={form.colour} onChange={set("colour")} />
            </Field>
          </div>
          <Field id="brand" label="Brand (optional)">
            <input id="brand" value={form.brand} onChange={(e) => set("brand")(e.target.value)} maxLength={60} className={inputClass} />
          </Field>
          <Field id="description" label="Short public description" hint="For example: “phone in a clear case” or “brown leather wallet”. No numbers or names.">
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              required
              maxLength={300}
              rows={2}
              aria-describedby="description-hint description-warning"
              className={inputClass}
            />
            <SensitiveWarning id="description-warning" text={`${form.brand} ${form.description}`} />
          </Field>
          <Field id="location" label="Where you last had it">
            <LocationSelect id="location" value={form.locationId} onChange={set("locationId")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="lostDate" label="Date">
              <input id="lostDate" type="date" value={form.lostDate || today} max={today || undefined} onChange={(e) => set("lostDate")(e.target.value)} required className={inputClass} />
            </Field>
            <Field id="timeFrom" label="Between">
              <input id="timeFrom" type="time" value={form.timeFrom} onChange={(e) => set("timeFrom")(e.target.value)} className={inputClass} />
            </Field>
            <Field id="timeTo" label="And">
              <input id="timeTo" type="time" value={form.timeTo} onChange={(e) => set("timeTo")(e.target.value)} className={inputClass} />
            </Field>
          </div>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <h2 className="text-lg font-bold">Private identifying details</h2>
          <p className="text-sm text-muted">
            Only you can see these. They are never shown to finders, desks or the public, and are not used for matching.
            They help you remember what to answer, and staff can use them if a dispute reaches the desk.
          </p>
          <Field id="serial" label="Last digits of serial or IMEI number (optional)">
            <input id="serial" value={secret.serialLastDigits} onChange={(e) => setPrivate("serialLastDigits")(e.target.value)} maxLength={20} className={inputClass} />
          </Field>
          <Field id="lockScreen" label="Lock-screen picture (optional)">
            <input id="lockScreen" value={secret.lockScreen} onChange={(e) => setPrivate("lockScreen")(e.target.value)} maxLength={200} className={inputClass} />
          </Field>
          <Field id="contents" label="Contents (optional)" hint="What was inside the bag, wallet or case.">
            <textarea id="contents" value={secret.contents} onChange={(e) => setPrivate("contents")(e.target.value)} maxLength={200} rows={2} aria-describedby="contents-hint" className={inputClass} />
          </Field>
          <Field id="marks" label="Unique marks (optional)" hint="Stickers, scratches, engravings, a cracked corner…">
            <textarea id="marks" value={secret.uniqueMarks} onChange={(e) => setPrivate("uniqueMarks")(e.target.value)} maxLength={200} rows={2} aria-describedby="marks-hint" className={inputClass} />
          </Field>
        </Card>

        <Alert>{error}</Alert>
        <Button type="submit" disabled={busy} className="self-start">
          {busy ? "Saving…" : "Report lost item"}
        </Button>
      </form>
    </PageShell>
  );
}
