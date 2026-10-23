import { CATEGORIES, COLOURS, LOCATIONS } from "@/lib/catalog";
import { inputClass } from "./ui";

type SelectProps = { id: string; value: string; onChange: (value: string) => void; describedBy?: string };

const sortedLocations = [...LOCATIONS].sort((a, b) => a.name.localeCompare(b.name));

export function CategorySelect({ id, value, onChange }: SelectProps) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required className={inputClass}>
      <option value="">Choose a category</option>
      {Object.entries(CATEGORIES).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}

export function ColourSelect({ id, value, onChange }: SelectProps) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required className={inputClass}>
      <option value="">Choose the main colour</option>
      {COLOURS.map((c) => (
        <option key={c} value={c}>
          {c === "multicolour" ? "Multicoloured" : c[0].toUpperCase() + c.slice(1)}
        </option>
      ))}
    </select>
  );
}

export function LocationSelect({ id, value, onChange, describedBy }: SelectProps) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required aria-describedby={describedBy} className={inputClass}>
      <option value="">Choose a place on campus</option>
      {sortedLocations.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );
}
