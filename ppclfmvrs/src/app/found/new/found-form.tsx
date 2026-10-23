"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { CategorySelect, ColourSelect, LocationSelect } from "@/components/catalog-selects";
import { SensitiveWarning } from "@/components/sensitive-warning";
import { Alert, Button, Card, Field, inputClass, PageShell } from "@/components/ui";
import { api } from "@/lib/api";
import { DESKS, locationName } from "@/lib/catalog";
import { useToday } from "@/lib/use-today";
import type { OwnFound } from "@/lib/public-types";

const EXAMPLE_QUESTIONS = [
  "What sticker or mark is on the back?",
  "What picture is on the lock screen?",
  "What is inside the front pocket?",
  "What colour is the case or cover?",
];

export function FoundForm() {
  const router = useRouter();
  const today = useToday();
  const [form, setForm] = useState({
    category: "",
    colour: "",
    locationId: "",
    foundDate: "",
    description: "",
    custody: "desk" as "desk" | "finder",
    deskId: DESKS[0].id,
    meetLocationId: "",
  });
  const [questions, setQuestions] = useState([
    { question: "", answer: "" },
    { question: "", answer: "" },
    { question: "", answer: "" },
  ]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const setQuestion = (i: number, key: "question" | "answer", value: string) =>
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, [key]: value } : q)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const item = await api<OwnFound>("/api/found", { body: { ...form, foundDate: form.foundDate || today, questions } });
      router.push(`/found/${item.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <PageShell
      title="Report a found item"
      back={{ href: "/dashboard", label: "My reports" }}
      intro="Thank you for handing it in. Describe it generically so only the real owner can prove it is theirs."
    >
      <Alert kind="info">
        Do not post photos or details of this item in WhatsApp groups. Keep what makes it unique (stickers, lock screen,
        contents, names on cards) for your verification questions below.
      </Alert>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="location" label="Where you found it">
              <LocationSelect id="location" value={form.locationId} onChange={set("locationId")} />
            </Field>
            <Field id="foundDate" label="Date found">
              <input id="foundDate" type="date" value={form.foundDate || today} max={today || undefined} onChange={(e) => set("foundDate")(e.target.value)} required className={inputClass} />
            </Field>
          </div>
          <Field id="description" label="Generic description" hint="Good: “black phone in a clear case”. Avoid: brand stickers, names, numbers, what is on the screen.">
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              required
              maxLength={200}
              rows={2}
              aria-describedby="description-hint description-warning"
              className={inputClass}
            />
            <SensitiveWarning id="description-warning" text={form.description} />
          </Field>
        </Card>

        <Card>
          <h2 className="text-lg font-bold">Verification questions</h2>
          <p className="text-sm text-muted">
            Write 2 or 3 questions about things you can see that only the owner would know. Answers are stored as
            one-way hashes; nobody, not even staff, can read them back. Keep answers short (one or two words). Capitals
            and extra spaces are ignored.
          </p>
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold">Example questions</summary>
            <ul className="mt-2 list-disc pl-5">
              {EXAMPLE_QUESTIONS.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </details>
          {questions.map((q, i) => (
            <fieldset key={i} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[2fr_1fr]">
              <legend className="px-1 text-sm font-semibold">
                Question {i + 1}
                {i === 2 && " (optional)"}
              </legend>
              <Field id={`q${i}`} label="Question">
                <input id={`q${i}`} value={q.question} onChange={(e) => setQuestion(i, "question", e.target.value)} required={i < 2} maxLength={150} className={inputClass} />
              </Field>
              <Field id={`a${i}`} label="Answer">
                <input id={`a${i}`} value={q.answer} onChange={(e) => setQuestion(i, "answer", e.target.value)} required={i < 2} maxLength={100} autoComplete="off" className={inputClass} />
              </Field>
            </fieldset>
          ))}
        </Card>

        <Card>
          <fieldset className="flex flex-col gap-3">
            <legend className="text-lg font-bold">Where is the item now?</legend>
            <label className="flex items-start gap-2">
              <input type="radio" name="custody" value="desk" checked={form.custody === "desk"} onChange={() => set("custody")("desk")} className="mt-1.5 size-4" />
              <span>
                <strong>Handed to a collection desk</strong> (recommended). The desk checks the owner&apos;s code.
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="custody" value="finder" checked={form.custody === "finder"} onChange={() => set("custody")("finder")} className="mt-1.5 size-4" />
              <span>
                <strong>I am keeping it</strong> and will meet the verified owner at a public place.
              </span>
            </label>
          </fieldset>
          {form.custody === "desk" ? (
            <Field id="desk" label="Collection desk">
              <select id="desk" value={form.deskId} onChange={(e) => set("deskId")(e.target.value)} className={inputClass}>
                {DESKS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}, {locationName(d.locationId)} ({d.hours})
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field id="meet" label="Public meeting place" hint="Only the verified owner sees this. Choose a busy, well-lit place.">
              <LocationSelect id="meet" value={form.meetLocationId} onChange={set("meetLocationId")} describedBy="meet-hint" />
            </Field>
          )}
        </Card>

        <Alert>{error}</Alert>
        <Button type="submit" disabled={busy} className="self-start">
          {busy ? "Saving…" : "Report found item"}
        </Button>
      </form>
    </PageShell>
  );
}
