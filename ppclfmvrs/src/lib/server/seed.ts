import { type Db, one } from "./db";
import { createFound, createLost } from "./items";
import { matchNewFound } from "./matches";
import { createUser } from "./users";

/** Demo accounts, documented in the README. Contact details are fake and exist to prove they never leak. */
export const DEMO_USERS = [
  { ident: "CSC/2021/045", name: "Tolu Adeyemi", role: "member", password: "owner-pass-1", phone: "08030000001", email: "tolu@student.oauife.edu.ng" },
  { ident: "EEG/2020/118", name: "Chinedu Eze", role: "member", password: "finder-pass-1", phone: "08030000002", email: "chinedu@student.oauife.edu.ng" },
  { ident: "ECN/2022/077", name: "Halima Bello", role: "member", password: "member-pass-1", phone: "08030000003", email: "halima@student.oauife.edu.ng" },
  { ident: "SEC/0042", name: "Security Unit Officer", role: "desk", deskId: "security", password: "desk-pass-1" },
  { ident: "SUB/0007", name: "SUB Desk Officer", role: "desk", deskId: "sub", password: "desk-pass-2" },
  { ident: "ADM/0001", name: "Lost-and-Found Admin", role: "admin", password: "admin-pass-1" },
] as const;

function dateDaysAgo(now: Date, days: number): string {
  const d = new Date(now.getTime() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Fills an empty database with demo users and reports that match each other. */
export function seedIfEmpty(db: Db, now = new Date()): void {
  if (one(db, "SELECT 1 FROM users LIMIT 1")) return;
  const users = Object.fromEntries(DEMO_USERS.map((u) => [u.ident, createUser(db, u, now)]));
  const tolu = users["CSC/2021/045"];
  const chinedu = users["EEG/2020/118"];
  const halima = users["ECN/2022/077"];
  const securityOfficer = users["SEC/0042"];

  createLost(db, tolu.id, {
    category: "phone",
    colour: "black",
    brand: "Tecno",
    description: "Tecno Camon phone in a clear case, left on a reading table",
    locationId: "library",
    lostDate: dateDaysAgo(now, 2),
    timeFrom: "10:00",
    timeTo: "13:00",
    privateDetails: {
      serialLastDigits: "4417",
      lockScreen: "Photo of a cat on a red sofa",
      uniqueMarks: "Blue star sticker on the back, small crack at the top left",
    },
  }, now);

  createLost(db, halima.id, {
    category: "wallet",
    colour: "brown",
    brand: "",
    description: "Brown leather wallet with a zip coin pocket",
    locationId: "sub",
    lostDate: dateDaysAgo(now, 1),
    timeFrom: "15:00",
    timeTo: "17:30",
    privateDetails: { contents: "GTBank debit card, ₦2,000 cash and a small brass key" },
  }, now);

  createLost(db, tolu.id, {
    category: "keys",
    colour: "silver",
    brand: "",
    description: "Two keys on a red lanyard",
    locationId: "fajuyi",
    lostDate: dateDaysAgo(now, 3),
    timeFrom: "18:00",
    timeTo: "21:00",
    privateDetails: { uniqueMarks: "Lanyard says SWEP 2026" },
  }, now);

  const found = [
    createFound(db, chinedu.id, {
      category: "phone",
      colour: "black",
      locationId: "library",
      foundDate: dateDaysAgo(now, 2),
      description: "Black phone in a clear case, found on a reading table",
      custody: "desk",
      deskId: "security",
      meetLocationId: null,
      questions: [
        { question: "What sticker is on the back of the case?", answer: "Blue star" },
        { question: "What picture is on the lock screen?", answer: "Cat" },
      ],
    }, now),
    createFound(db, chinedu.id, {
      category: "wallet",
      colour: "brown",
      locationId: "sub",
      foundDate: dateDaysAgo(now, 1),
      description: "Brown wallet with a zip pocket, near the SUB car park",
      custody: "finder",
      deskId: null,
      meetLocationId: "sub",
      questions: [
        { question: "Which bank's card is inside?", answer: "GTBank" },
        { question: "What small metal item is in the coin pocket?", answer: "Key" },
        { question: "Roughly how much cash is inside, in naira?", answer: "2000" },
      ],
    }, now),
    createFound(db, halima.id, {
      category: "phone",
      colour: "white",
      locationId: "moremi",
      foundDate: dateDaysAgo(now, 1),
      description: "White phone with a cracked screen",
      custody: "desk",
      deskId: "sub",
      meetLocationId: null,
      questions: [
        { question: "What colour is the phone case?", answer: "Pink" },
        { question: "What app is on the home screen dock?", answer: "WhatsApp" },
      ],
    }, now),
    createFound(db, securityOfficer.id, {
      category: "id-card",
      colour: "blue",
      locationId: "tech",
      foundDate: dateDaysAgo(now, 4),
      description: "Student ID card in a blue holder",
      custody: "desk",
      deskId: "security",
      meetLocationId: null,
      questions: [
        { question: "What department is printed on the card?", answer: "Mechanical Engineering" },
        { question: "What is clipped to the holder?", answer: "A USB drive" },
      ],
    }, now),
  ];
  for (const f of found) matchNewFound(db, f, now);
}
