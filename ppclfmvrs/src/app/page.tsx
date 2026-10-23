import { FoundBoard } from "@/components/found-board";
import { ButtonLink, Card } from "@/components/ui";

const STEPS = [
  {
    title: "Report what you lost or found",
    body: "Owners add the public basics plus private details only they know. Finders describe the item generically and set 2–3 questions only the owner can answer.",
  },
  {
    title: "The system finds likely matches",
    body: "Each lost report is scored against found items by category, colour, place, date and description words. Both sides are notified in the app.",
  },
  {
    title: "Prove it, then collect it",
    body: "The owner answers the finder's questions. Answers are checked against salted hashes, with strict attempt limits. A correct claim gets a one-time handover code.",
  },
];

export default function Home() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8">
      <section className="flex flex-col gap-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Obafemi Awolowo University, Ile-Ife</p>
        <h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">
          Get lost items back without posting anyone&apos;s details in a WhatsApp group
        </h1>
        <p className="max-w-2xl text-lg">
          Lost and found reports are matched automatically. An item is handed over only after the owner proves it is
          theirs. No photos, phone numbers or names are shared with the other side.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/lost/new">I lost something</ButtonLink>
          <ButtonLink href="/found/new" variant="secondary">
            I found something
          </ButtonLink>
        </div>
      </section>

      <section aria-labelledby="how" className="flex flex-col gap-4">
        <h2 id="how" className="text-xl font-bold">
          How it works
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <Card as="li" key={step.title}>
              <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-primary font-bold text-primary-fg">
                {i + 1}
              </span>
              <h3 className="font-bold">{step.title}</h3>
              <p className="text-sm">{step.body}</p>
            </Card>
          ))}
        </ol>
      </section>

      <section aria-labelledby="board" className="flex flex-col gap-4">
        <div>
          <h2 id="board" className="text-xl font-bold">
            Recently found on campus
          </h2>
          <p className="text-muted">
            Generic descriptions only. If one looks like yours, report it as lost. The match and the questions do the rest.
          </p>
        </div>
        <FoundBoard />
      </section>
    </main>
  );
}
