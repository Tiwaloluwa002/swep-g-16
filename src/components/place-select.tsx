"use client";

import { campus } from "@/data/campus";
import { groupPlaces } from "@/lib/places";

const groups = groupPlaces(campus);

type Props = {
  id: string;
  value: string;
  onChange: (placeId: string) => void;
  /** Label for an empty first option; omit to require a choice. */
  placeholder?: string;
};

/** Building picker grouped by category, so 80-odd places stay scannable. */
export function PlaceSelect({ id, value, onChange, placeholder }: Props) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full min-w-0 rounded-md border border-border bg-surface px-3 py-2"
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {groups.map((group) => (
        <optgroup key={group.category} label={group.label}>
          {group.places.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
