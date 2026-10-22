import type { Metadata } from "next";
import Link from "next/link";
import { campus, DATA_VERIFIED } from "@/data/campus";
import { formatDistance } from "@/lib/advisory";
import { PROFILE_LIST } from "@/lib/profiles";

export const metadata: Metadata = { title: "About · AACNRAS" };

/** Group members, as they should appear on the page. */
const TEAM: string[] = [];

const mappedMetres = [...campus.edges.values()].reduce((sum, e) => sum + e.length, 0);
const STATS = [
  { label: "Places", value: String(campus.places.size) },
  { label: "Path segments", value: String(campus.edges.size) },
  { label: "Mapped paths", value: formatDistance(mappedMetres) },
  { label: "Travel profiles", value: String(PROFILE_LIST.length) },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function AboutPage() {
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-8">
      <div className="flex flex-col gap-3">
        <Link href="/" className="self-start text-sm underline">
          ← Back to the route planner
        </Link>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">SWEP Group 15 · Obafemi Awolowo University</p>
        <h1 className="text-3xl font-bold leading-tight">Accessibility-Aware Campus Navigation and Route Advisory System</h1>
        <p className="text-lg">
          AACNRAS plans routes across the OAU campus for the way each person actually moves, and warns them about
          what lies ahead.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-md border border-border bg-surface p-3">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="text-2xl font-bold">{s.value}</dd>
          </div>
        ))}
      </dl>

      <Section title="The problem">
        <p>
          The OAU campus is large and hilly. Many routes include steps, steep roads, uneven ground or poorly lit
          stretches. Ordinary map apps send everyone the same way, which can leave wheelchair users at the bottom of a
          staircase, send someone on crutches up a long hill, or guide a visually impaired student along a busy road
          with no kerbs.
        </p>
      </Section>

      <Section title="How it works">
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>
            <strong>The campus as a network.</strong> Every walkway, road and staircase is a segment between two
            junctions, with its length, slope, surface, steps, lighting, kerbs and tactile paving.
          </li>
          <li>
            <strong>A cost for each person.</strong> Your travel profile turns each segment into a cost. Segments you
            cannot use (steps for a wheelchair, slopes above 8%) are ruled out. Others cost more when they are steep,
            rough, unlit or busy.
          </li>
          <li>
            <strong>The A* search.</strong> The app searches the network for the route with the lowest total cost, not
            simply the shortest one. It uses the straight-line distance to the destination as a guide, so the search
            stays fast.
          </li>
          <li>
            <strong>Advice, not just a line.</strong> The route becomes turn-by-turn directions with warnings, an
            elevation profile, places to rest and the destination&apos;s accessibility features. Directions can be read
            aloud.
          </li>
          <li>
            <strong>Reports keep it current.</strong> Anyone can report a blocked path, flooding or a broken lift. It
            shows as a warning straight away, and once an admin verifies it, routes avoid it.
          </li>
        </ol>
      </Section>

      <Section title="Travel profiles">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-semibold">Profile</th>
                <th className="py-2 pr-3 font-semibold">Steps</th>
                <th className="py-2 pr-3 font-semibold">Max slope</th>
                <th className="py-2 pr-3 font-semibold">Speed</th>
                <th className="py-2 font-semibold">Prefers</th>
              </tr>
            </thead>
            <tbody>
              {PROFILE_LIST.map((p) => (
                <tr key={p.id} className="border-b border-border align-top">
                  <td className="py-2 pr-3 font-semibold">{p.label}</td>
                  <td className="py-2 pr-3">{p.allowSteps ? (p.stepPenalty > 1 ? "Avoided" : "Allowed") : "Never"}</td>
                  <td className="py-2 pr-3">{Number.isFinite(p.maxSlopePercent) ? `${p.maxSlopePercent}%` : "Any"}</td>
                  <td className="py-2 pr-3">{(p.speed * 3.6).toFixed(1)} km/h</td>
                  <td className="py-2">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Accessibility of the app itself">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>High-contrast mode and three text sizes, remembered on your device</li>
          <li>Directions read aloud, using your device&apos;s speech</li>
          <li>Works fully with a keyboard and screen readers; the map is optional</li>
          <li>Set in Atkinson Hyperlegible, a typeface designed for low-vision readers</li>
          <li>Map lines use dash patterns as well as colour, so they read without colour vision</li>
        </ul>
      </Section>

      <Section title="Data and its limits">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            Paths, buildings and details like opening hours come from{" "}
            <a href="https://www.openstreetmap.org/copyright" className="underline">
              OpenStreetMap
            </a>{" "}
            (© OpenStreetMap contributors, ODbL).
          </li>
          <li>
            Slopes and the elevation profile are estimated from the Copernicus 90 m terrain model via Open-Meteo, so
            short steep sections can be missed.
          </li>
          <li>
            {DATA_VERIFIED
              ? "Building accessibility features and path details have been checked on site by the group."
              : "Building accessibility features (ramps, lifts, toilets) are being surveyed on site by the group; until then they show as “not surveyed”."}
          </li>
          <li>Some footpaths near buildings are not mapped yet; directions flag these stretches.</li>
        </ul>
      </Section>

      <Section title="The team">
        <p>
          Built by SWEP Group 15, Obafemi Awolowo University, Ile-Ife, as part of the Students&apos; Work Experience
          Programme.
        </p>
        {TEAM.length > 0 && (
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {TEAM.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted">
          Built with Next.js, React, TypeScript, Tailwind CSS and Leaflet.
        </p>
      </Section>
    </main>
  );
}
