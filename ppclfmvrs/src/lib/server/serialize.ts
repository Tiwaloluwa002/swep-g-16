import { getDesk, locationName } from "@/lib/catalog";
import type { HandoverInfo, OwnFound, OwnLost, PublicFound, PublicLost, SessionUser } from "@/lib/public-types";
import type { FoundItem, LostItem, User } from "@/lib/types";

/*
 * Every API response is built from these allowlists. Each function copies
 * named fields only; spreading a database row into a response is never
 * allowed.
 */

export function publicFound(item: FoundItem): PublicFound {
  return {
    id: item.id,
    category: item.category,
    colour: item.colour,
    locationId: item.locationId,
    locationName: locationName(item.locationId),
    foundDate: item.foundDate,
    description: item.description,
    custody: item.custody,
    status: item.status,
    createdAt: item.createdAt,
  };
}

export function publicLost(item: LostItem): PublicLost {
  return {
    id: item.id,
    category: item.category,
    colour: item.colour,
    brand: item.brand,
    description: item.description,
    locationId: item.locationId,
    locationName: locationName(item.locationId),
    lostDate: item.lostDate,
    timeFrom: item.timeFrom,
    timeTo: item.timeTo,
    status: item.status,
    createdAt: item.createdAt,
  };
}

export function ownLost(item: LostItem): OwnLost {
  const { serialLastDigits, lockScreen, contents, uniqueMarks } = item.privateDetails;
  return { ...publicLost(item), privateDetails: { serialLastDigits, lockScreen, contents, uniqueMarks } };
}

export function handoverInfo(item: FoundItem, viewer: "owner" | "finder" | "desk"): HandoverInfo {
  const desk = getDesk(item.deskId);
  if (item.custody === "desk" && desk) {
    const place = `${desk.name}, ${locationName(desk.locationId)} (${desk.hours})`;
    return {
      place,
      instructions:
        viewer === "owner"
          ? "Go to the desk and show your handover code. Bring your student or staff ID card."
          : "The owner will collect the item at the desk with a one-time code.",
    };
  }
  const place = locationName(item.meetLocationId);
  return {
    place,
    instructions:
      viewer === "owner"
        ? "Meet the finder at this public place. The finder checks your handover code before giving you the item."
        : "Meet the owner at this public place. Enter or scan their handover code on this page before you hand the item over.",
  };
}

export function ownFound(item: FoundItem, questions: string[], pending: boolean): OwnFound {
  const desk = getDesk(item.deskId);
  return {
    ...publicFound(item),
    questions,
    deskName: desk?.name ?? null,
    meetLocationName: item.meetLocationId ? locationName(item.meetLocationId) : null,
    receivedAt: item.receivedAt,
    pendingHandover: pending ? handoverInfo(item, "finder") : null,
  };
}

export function sessionUser(user: User): SessionUser {
  return {
    id: user.id,
    ident: user.ident,
    name: user.name,
    role: user.role,
    deskName: getDesk(user.deskId)?.name ?? null,
  };
}

/** Keys that must never appear in any response, whoever asks. */
const ALWAYS_FORBIDDEN = new Set([
  "answerHash",
  "answer_hash",
  "answer",
  "answers",
  "salt",
  "passwordHash",
  "password_hash",
  "password",
  "phone",
  "email",
  "ownerId",
  "owner_id",
  "finderId",
  "finder_id",
  "claimantId",
  "claimant_id",
  "codeHash",
  "code_hash",
  "tokenHash",
  "token_hash",
  "private_json",
]);

/** Allowed only in the owner's view of their own lost report. */
const PRIVATE_KEYS = new Set(["privateDetails"]);

export class PrivacyLeakError extends Error {}

/**
 * A last line of defence behind the serializers: walks a response and throws
 * if it contains a forbidden key, so a mistake fails loudly in tests and in
 * development instead of leaking.
 */
export function assertNoLeaks(value: unknown, options: { allowPrivateDetails?: boolean } = {}, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoLeaks(v, options, `${path}[${i}]`));
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, child] of Object.entries(value)) {
    if (ALWAYS_FORBIDDEN.has(key) || (!options.allowPrivateDetails && PRIVATE_KEYS.has(key))) {
      throw new PrivacyLeakError(`Response field ${path}.${key} is not allowed.`);
    }
    assertNoLeaks(child, options, `${path}.${key}`);
  }
}
