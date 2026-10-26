// Builds the AACNRAS SWEP defence slides as a PowerPoint file.
// Usage: NODE_PATH=./node_modules node build-deck.js [output.pptx]   (default: ~/Desktop)
//
// The slides follow Dr Solanke's checklist: names on the cover, a short
// introduction, citations, a one-line caption on every image, mitigation
// for each limitation, and a thank-you slide at the end.
const fs = require("fs");
const os = require("os");
const path = require("path");
const pptxgen = require("pptxgenjs");
const group = require("./group");

const OUT = process.argv[2] ?? path.join(os.homedir(), "Desktop", "AACNRAS Defence Slides - SWEP Group 15.pptx");
const SHOTS = path.join(__dirname, "..", "screenshots");

// pptxgenjs cannot write theme colours, so the pptx skill's helper patches them in afterwards.
function findApplyTheme() {
  if (process.env.APPLY_THEME) return require(process.env.APPLY_THEME).applyTheme;
  const root = path.join(os.homedir(), ".claude", "skills", "synced");
  for (const dir of fs.existsSync(root) ? fs.readdirSync(root) : []) {
    const file = path.join(root, dir, "pptx", "scripts", "apply_theme.js");
    if (fs.existsSync(file)) return require(file).applyTheme;
  }
  return null;
}

const THEME = {
  name: "AACNRAS Forest",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1B2B24", lt1: "FFFFFF", dk2: "1F4D3A", lt2: "EEF3EF",
    accent1: "E8A33D", accent2: "2E7D5B", accent3: "1D4ED8", accent4: "C2410C", accent5: "5F7268", accent6: "B91C1C",
    hlink: "1D4ED8", folHlink: "6B21A8",
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 × 5.625 in
pres.title = "AACNRAS — SWEP Group 15 Project Defence";
pres.author = group.groupName;
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

// ---------- layouts ----------
pres.defineSlideMaster({
  title: "TITLE_DARK",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 1.35, w: 8.8, h: 1.8, fontFace: "Cambria", fontSize: 36, bold: true, color: C.background1, valign: "bottom", align: "left" }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 3.3, w: 8.8, h: 1.2, fontFace: "Calibri", fontSize: 18, color: C.background2, valign: "top" }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.3, w: 9, h: 0.7, fontFace: "Cambria", fontSize: 30, bold: true, color: C.text2, valign: "middle", align: "left", margin: 0 }, text: "" } },
    { text: { text: "AACNRAS · SWEP Group 15 · OAU", options: { x: 0.5, y: 5.2, w: 5, h: 0.3, fontFace: "Calibri", fontSize: 10, color: C.accent5, margin: 0 } } },
  ],
  slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.3, fontFace: "Calibri", fontSize: 10, color: C.accent5, align: "right" },
});
pres.defineSlideMaster({
  title: "STATEMENT_DARK",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.45, w: 8.8, h: 0.8, fontFace: "Cambria", fontSize: 30, bold: true, color: C.background1, valign: "middle", align: "left", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.3, fontFace: "Calibri", fontSize: 10, color: C.background2, align: "right" },
});

// ---------- helpers ----------
const text = (slide, value, opts) => slide.addText(value, { isTextBox: true, fontFace: "Calibri", color: C.text1, margin: 0, valign: "top", ...opts });
const card = (slide, x, y, w, h, name, fill = C.background2) =>
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: fill }, objectName: name });
const pill = (slide, x, y, w, label, fill, color) =>
  slide.addText(label, { isTextBox: true, x, y, w, h: 0.3, fontFace: "Calibri", fontSize: 11, bold: true, color, fill: { color: fill }, align: "center", valign: "middle", margin: 0, rectRadius: 0.15, shape: pres.shapes.ROUNDED_RECTANGLE });
const image = (slide, file, x, y, w, h, alt) =>
  slide.addImage({ path: path.join(SHOTS, file), x, y, w, h, altText: alt, sizing: { type: "contain", w, h } });
// A one-line caption under every image (Dr Solanke: "a really short info on each image").
const caption = (slide, value, x, y, w) => text(slide, value, { x, y, w, h: 0.25, fontSize: 11, italic: true, color: C.accent5 });
// Every slide that uses a fact names its source in the same place.
const source = (slide, value) => text(slide, `Source: ${value}`, { x: 0.5, y: 4.88, w: 9, h: 0.25, fontSize: 10, color: C.accent5 });
const content = (title, section) => {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(title, { placeholder: "title" });
  return s;
};

// ---------- 1. Cover: title and names ----------
pres.addSection({ title: "Introduction" });
{
  const s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "Introduction" });
  pill(s, 0.6, 0.45, 4.2, "SWEP GROUP 15 · OBAFEMI AWOLOWO UNIVERSITY", C.accent1, C.text1);
  text(s, "Accessibility-Aware Campus Navigation and Route Advisory System (AACNRAS)", { x: 0.6, y: 0.9, w: 8.8, h: 1.2, fontFace: "Cambria", fontSize: 28, bold: true, color: C.background1, valign: "bottom" });
  text(s, "Routes across the OAU campus that fit how each person moves", { x: 0.6, y: 2.15, w: 8.8, h: 0.4, fontSize: 16, color: C.background2 });
  text(s, "PRESENTED BY", { x: 0.6, y: 2.75, w: 4, h: 0.25, fontSize: 10, bold: true, color: C.accent1 });
  if (group.hasMembers) {
    // Up to 15 names in three columns.
    const cols = 3, perCol = Math.ceil(group.members.length / cols);
    for (let c = 0; c < cols; c++) {
      const names = group.members.slice(c * perCol, (c + 1) * perCol);
      if (!names.length) continue;
      text(s, names.map((m, i) => ({ text: m.name, options: { breakLine: i < names.length - 1 } })), { x: 0.6 + c * 2.95, y: 3.05, w: 2.85, h: 1.7, fontSize: 11, color: C.background1, paraSpaceAfter: 2 });
    }
  } else {
    text(s, "[Names of group members]", { x: 0.6, y: 3.05, w: 8.8, h: 0.35, fontSize: 14, color: C.background1 });
  }
  const footer = [group.supervisor && `Supervisor: ${group.supervisor}`, `Project defence${group.defenceDate ? `, ${group.defenceDate}` : ""}`].filter(Boolean).join(" · ");
  text(s, footer, { x: 0.6, y: 4.95, w: 8.8, h: 0.3, fontSize: 11, color: C.background2 });
  s.addNotes("Good morning. We are SWEP Group 15. Our project is AACNRAS, the Accessibility-Aware Campus Navigation and Route Advisory System. [Introduce the presenters.]");
}

// ---------- 2. Short introduction ----------
{
  const s = content("About this project", "Introduction");
  text(s, [
    { text: "AACNRAS is a web app that plans routes across the OAU campus for the way each person moves.", options: { breakLine: true } },
    { text: "About 1.3 billion people, 16% of the world, live with a significant disability. On a hilly campus, the usual route can be impossible for some of them.", options: { breakLine: true } },
    { text: "It uses open map data, terrain elevation and an A* route search to find a safer route for each person, and explains every step." },
  ], { x: 0.5, y: 1.25, w: 3.9, h: 3.5, fontSize: 15, paraSpaceAfter: 12 });
  image(s, "route-planner.png", 4.7, 1.25, 4.8, 3.0, "The AACNRAS route planner");
  caption(s, "Figure 1: The route planner, routing from the SUB to the library.", 4.7, 4.32, 4.8);
  source(s, "World Health Organization (2022), Global report on health equity for persons with disabilities.");
  s.addNotes("In short: AACNRAS plans routes across campus for the way each person moves. The World Health Organization estimates 1.3 billion people, about 16 percent of the world, live with a significant disability. On a hilly campus like ours, the usual route can be impossible for some of them. Our app uses open map data, terrain elevation and an A star search to find a better route for each person.");
}

// ---------- 3. Problem ----------
{
  const s = content("One route does not fit everyone", "Introduction");
  const people = [
    ["Wheelchair user", "Sent to a 51-step staircase", "From Moremi Hall to the Senate Building, the usual route climbs 51 steps."],
    ["Student on crutches", "Sent up the steepest hill", "The shortest path is often the steepest, and OAU is a hilly campus."],
    ["Visually impaired student", "Sent along busy roads", "Many routes follow roads with traffic and no dropped kerbs or tactile paving."],
  ];
  people.forEach(([who, head, body], i) => {
    const x = 0.5 + i * 3.1;
    card(s, x, 1.25, 2.8, 2.85, `problem-card-${i + 1}`);
    pill(s, x + 0.25, 1.5, 2.3, who.toUpperCase(), C.text2, C.background1);
    text(s, head, { x: x + 0.25, y: 2.0, w: 2.3, h: 0.8, fontFace: "Cambria", fontSize: 18, bold: true, color: C.text2 });
    text(s, body, { x: x + 0.25, y: 2.85, w: 2.3, h: 1.1, fontSize: 14, color: C.text1 });
  });
  text(s, "General map apps give everyone the same route. They don’t know where the steps are, how steep a road is, or whether a ramp is blocked.", { x: 0.5, y: 4.3, w: 9, h: 0.55, fontSize: 15, italic: true, color: C.text2 });
  source(s, "AACNRAS route analysis of OpenStreetMap data (2026).");
  s.addNotes("For most of us, any route works. But for a wheelchair user, the normal route from Moremi Hall to the Senate Building includes a 51-step staircase. Someone on crutches gets sent up the steepest hill because it is shortest. A visually impaired student gets sent along busy roads with no kerbs or tactile paving. Map apps give everyone the same route.");
}

// ---------- 4. Aim and objectives ----------
{
  const s = content("Aim and objectives", "Introduction");
  card(s, 0.5, 1.25, 3.6, 3.7, "aim-card", C.text2);
  pill(s, 0.8, 1.5, 0.9, "AIM", C.accent1, C.text1);
  text(s, "Design and build a web app that gives accessible routes and route advice across the OAU campus.", { x: 0.8, y: 2.0, w: 3.0, h: 2.6, fontFace: "Cambria", fontSize: 20, color: C.background1 });
  const objectives = [
    "Model campus paths as a graph with slope, steps, surface, lighting and kerbs",
    "Define four travel profiles, each with its own cost function",
    "Find the lowest-cost route with A* search",
    "Turn routes into directions, warnings and route statistics",
    "Show accessibility details for every building",
    "Let users report obstacles, verified by an admin",
    "Make the app itself accessible",
  ];
  objectives.forEach((o, i) => {
    const y = 1.25 + i * 0.53;
    s.addShape(pres.shapes.OVAL, { x: 4.45, y: y + 0.04, w: 0.36, h: 0.36, fill: { color: C.accent2 }, line: { color: C.accent2 }, objectName: `objective-dot-${i + 1}` });
    text(s, String(i + 1), { x: 4.45, y: y + 0.04, w: 0.36, h: 0.36, fontSize: 12, bold: true, color: C.background1, align: "center", valign: "middle" });
    text(s, o, { x: 4.95, y, w: 4.55, h: 0.45, fontSize: 14, valign: "middle" });
  });
  s.addNotes("Our aim was to design and build a web app that gives accessible routes and route advice across the OAU campus. We broke that into seven objectives, from modelling the paths as a graph, through the routing and advice, to obstacle reporting and making the app itself accessible.");
}

// ---------- 5. Existing solutions ----------
{
  const s = content("Existing tools cover only part of the problem", "Introduction");
  const head = (t) => ({ text: t, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 } } });
  const ours = (t) => ({ text: t, options: { bold: true, fill: { color: "FBEFD9" } } });
  s.addTable([
    [head("System"), head("Routes by mobility"), head("Slope-aware"), head("Obstacle reports"), head("Covers OAU")],
    ["AccessMap (Seattle)", "Yes", "Yes", "No", "No"],
    ["Wheelmap", "No, places only", "No", "Ratings only", "A few places"],
    ["Google Maps", "Public transport only", "No", "No", "Roads only"],
    [ours("AACNRAS"), ours("Yes, 4 profiles"), ours("Yes"), ours("Yes, verified"), ours("Yes")],
  ], { x: 0.5, y: 1.3, w: 9, colW: [2.1, 2.0, 1.4, 1.8, 1.7], fontFace: "Calibri", fontSize: 14, color: HEX.dk1, border: { type: "solid", pt: 0.75, color: "C9D3CD" }, rowH: 0.5, valign: "middle" });
  source(s, "Bolten et al. (2017); Sozialhelden e.V., Wheelmap.org; Neis and Zielstra (2014).");
  s.addNotes("We looked at existing tools. AccessMap in Seattle routes by mobility and slope, but only in Seattle. Wheelmap rates places, not routes. Google Maps offers accessible public transport routes, but does not model campus footpaths, steps or slopes. None of them covers OAU with routes, building details and obstacle reports together. That is the gap AACNRAS fills.");
}

// ---------- 6. How it works ----------
pres.addSection({ title: "Design" });
{
  const s = content("How AACNRAS chooses a route", "Design");
  const steps = [
    ["Map data", "OpenStreetMap paths and places, terrain elevation"],
    ["Campus graph", "471 junctions, 577 path segments"],
    ["Cost per profile", "Steps, slope, surface, kerbs, traffic, light"],
    ["A* search", "Lowest-cost route, not just shortest"],
    ["Advice", "Directions, warnings, route details"],
  ];
  steps.forEach(([head, body], i) => {
    const x = 0.5 + i * 1.86;
    card(s, x, 1.55, 1.6, 2.2, `step-${i + 1}`, i === 3 ? C.text2 : C.background2);
    const ink = i === 3 ? C.background1 : C.text2;
    text(s, String(i + 1), { x: x + 0.15, y: 1.7, w: 1.3, h: 0.5, fontFace: "Cambria", fontSize: 26, bold: true, color: i === 3 ? C.accent1 : C.accent2 });
    text(s, head, { x: x + 0.15, y: 2.25, w: 1.3, h: 0.6, fontFace: "Cambria", fontSize: 15, bold: true, color: ink });
    text(s, body, { x: x + 0.15, y: 2.85, w: 1.3, h: 0.85, fontSize: 11.5, color: i === 3 ? C.background1 : C.text1 });
    if (i < steps.length - 1) s.addShape(pres.shapes.ISOSCELES_TRIANGLE, { x: x + 1.63, y: 2.55, w: 0.2, h: 0.18, rotate: 90, fill: { color: C.accent5 }, line: { color: C.accent5 }, objectName: `arrow-${i + 1}` });
  });
  text(s, "Routing runs in the browser in about 0.1 ms; only obstacle reports go to the server.", { x: 0.5, y: 4.15, w: 9, h: 0.4, fontSize: 15, italic: true, color: C.text2 });
  source(s, "OpenStreetMap contributors (2026); Hart, Nilsson and Raphael (1968) for A* search.");
  s.addNotes("We import the campus paths and places from OpenStreetMap, and terrain elevation for slopes. That becomes a graph of 471 junctions and 577 path segments. Each travel profile turns every segment into a cost. The A* search then finds the lowest-cost route, which is not always the shortest. Finally, the route becomes directions, warnings and route details.");
}

// ---------- 7. Data in numbers ----------
{
  const s = content("The OAU campus, in numbers", "Design");
  const stats = [["79", "campus places"], ["577", "path segments"], ["78.6", "km of mapped paths"], ["2,414", "elevation points"]];
  stats.forEach(([big, label], i) => {
    const x = 0.5 + i * 2.3;
    card(s, x, 1.35, 2.1, 1.95, `stat-${i + 1}`);
    text(s, big, { x: x + 0.15, y: 1.6, w: 1.8, h: 0.9, fontFace: "Cambria", fontSize: 40, bold: true, color: C.text2, align: "center", valign: "middle" });
    text(s, label, { x: x + 0.15, y: 2.55, w: 1.8, h: 0.4, fontSize: 15, color: C.text1, align: "center" });
  });
  text(s, [
    { text: "Paths and places: ", options: { bold: true } },
    { text: "OpenStreetMap, imported automatically.", options: { breakLine: true } },
    { text: "Slopes: ", options: { bold: true } },
    { text: "estimated from the Copernicus 90 m terrain model.", options: { breakLine: true } },
    { text: "Building accessibility: ", options: { bold: true } },
    { text: "to be filled in by our on-site survey." },
  ], { x: 0.5, y: 3.55, w: 9, h: 1.1, fontSize: 14, paraSpaceAfter: 4 });
  source(s, "OpenStreetMap contributors (2026); European Space Agency, Copernicus DEM GLO-90, via Open-Meteo.");
  s.addNotes("The system covers 79 campus places and 577 path segments, about 78.6 kilometres of paths. We sampled the terrain elevation at 2,414 points to estimate slopes. Paths and places come from OpenStreetMap. Building accessibility details such as ramps and lifts will come from our on-site survey.");
}

// ---------- 8. Profiles ----------
{
  const s = content("Four travel profiles, four sets of rules", "Design");
  const profiles = [
    ["Standard walking", "4.7 km/h", "Allowed", "Any", "Fastest route"],
    ["Wheelchair user", "3.2 km/h", "Never", "8% (1:12)", "Smooth paved paths, dropped kerbs"],
    ["Visually impaired", "3.6 km/h", "Avoided", "Any", "Tactile paving, away from busy roads"],
    ["Limited mobility", "2.5 km/h", "Strongly avoided", "10%", "Gentle slopes, smooth ground"],
  ];
  profiles.forEach(([name, speed, steps, slope, prefers], i) => {
    const x = 0.5 + i * 2.3;
    const strong = i === 1;
    card(s, x, 1.2, 2.1, 3.5, `profile-${i + 1}`, strong ? C.text2 : C.background2);
    const ink = strong ? C.background1 : C.text1;
    text(s, name, { x: x + 0.15, y: 1.33, w: 1.8, h: 0.55, fontFace: "Cambria", fontSize: 16, bold: true, color: strong ? C.background1 : C.text2 });
    [["Speed", speed], ["Steps", steps], ["Max slope", slope], ["Prefers", prefers]].forEach(([k, v], j) => {
      text(s, k.toUpperCase(), { x: x + 0.15, y: 1.98 + j * 0.66, w: 1.8, h: 0.25, fontSize: 10, bold: true, color: strong ? C.accent1 : C.accent5 });
      text(s, v, { x: x + 0.15, y: 2.21 + j * 0.66, w: 1.8, h: 0.45, fontSize: 13, color: ink });
    });
  });
  source(s, "U.S. Department of Justice (2010), ADA Standards for Accessible Design: ramps at most 1:12.");
  s.addNotes("These are the four profiles. Wheelchair users never get steps and never get slopes above 8 percent, which is the 1 in 12 ramp limit from the ADA standards. Visually impaired users avoid steps and busy roads. Limited mobility users get gentle slopes and smooth ground.");
}

// ---------- 9. Cost function ----------
{
  const s = content("A different cost for each person", "Design");
  card(s, 0.5, 1.3, 9, 1.05, "formula-card", C.text2);
  text(s, "cost = (length ÷ speed) × slope × surface × kerbs × tactile × traffic × light  +  steps", { x: 0.7, y: 1.45, w: 8.6, h: 0.75, fontFace: "Cambria", fontSize: 18, color: C.background1, align: "center", valign: "middle" });
  const points = [
    ["Rule out", "Steps for wheelchair users; slopes above a profile’s limit."],
    ["Penalise", "Unpaved ground costs a wheelchair user 4×, a walker 1.2×."],
    ["Search", "A* expands the cheapest junction first, guided by straight-line distance, so the route it returns is the lowest-cost one."],
  ];
  points.forEach(([head, body], i) => {
    const x = 0.5 + i * 3.1;
    text(s, head, { x, y: 2.65, w: 2.8, h: 0.4, fontFace: "Cambria", fontSize: 17, bold: true, color: C.accent2 });
    text(s, body, { x, y: 3.1, w: 2.8, h: 1.5, fontSize: 14 });
  });
  source(s, "Hart, Nilsson and Raphael (1968), A formal basis for the heuristic determination of minimum cost paths.");
  s.addNotes("Lowest cost does not have to mean shortest. Every segment gets a cost: its walking time, multiplied by penalties for slope, surface, kerbs, tactile paving, traffic and lighting, plus a cost for steps. Some segments are ruled out entirely, like steps for wheelchair users. A star then finds the lowest-cost route, and because its distance estimate never overestimates, that route is guaranteed to be the best one for the profile.");
}

// ---------- 10–13. The system, each screenshot captioned ----------
pres.addSection({ title: "The system" });
const screenSlide = (title, file, alt, figure, side, notes) => {
  const s = content(title, "The system");
  image(s, file, 0.5, 1.15, 6.0, 3.75, alt);
  caption(s, figure, 0.5, 4.93, 6.0);
  text(s, side, { x: 6.8, y: 1.2, w: 2.7, h: 3.7, fontSize: 13, paraSpaceAfter: 8, color: C.text1 });
  s.addNotes(notes);
  return s;
};
screenSlide("Plan a route", "route-planner.png", "Route planner showing a route from the Student Union Building to the library",
  "Figure 2: Route planner. Solid blue is the route; dotted blue is not yet mapped.",
  [
    { text: "1  Choose how you travel", options: { bold: true, breakLine: true } },
    { text: "2  Pick start and destination, or tap the map", options: { bold: true, breakLine: true } },
    { text: "3  Read the route on the map", options: { bold: true, breakLine: true } },
    { text: "Stretches not yet on the map are drawn dotted and flagged in the directions." },
  ],
  "You choose how you travel, pick a start and a destination, and the route appears on the map. Dotted blue is a short stretch not yet on the map, and the directions say so. [Switch to the live demo here if possible.]");
screenSlide("Directions, warnings and route details", "route-details.png", "Directions with warnings, and route details with an elevation profile",
  "Figure 3: Directions with warnings, and the elevation profile for the route.",
  [
    { text: "Every step carries its warnings: ", options: { bold: true } },
    { text: "steps, slopes, rough ground, unlit paths, reports.", options: { breakLine: true } },
    { text: "Route details: ", options: { bold: true } },
    { text: "elevation profile, total climb, steepest part, surfaces, lighting and landmarks.", options: { breakLine: true } },
    { text: "Read aloud ", options: { bold: true } },
    { text: "for users who prefer to listen." },
  ],
  "Each direction carries its warnings. Route details show the elevation profile, total climb, the steepest part, the surfaces, how much is lit, and landmarks you pass. Directions can be read aloud.");
{
  const s = content("Obstacles are reported, verified, then avoided", "The system");
  const flow = [["Reported", "Anyone reports a blocked path, flooding or a broken lift", C.background2], ["Verified", "An admin checks it on the dashboard", C.background2], ["Avoided", "Routes go around the path until it is resolved", C.text2]];
  flow.forEach(([head, body, fill], i) => {
    const y = 1.2 + i * 1.22;
    card(s, 0.5, y, 3.4, 1.05, `report-step-${i + 1}`, fill);
    const dark = fill === C.text2;
    text(s, head, { x: 0.7, y: y + 0.12, w: 3.0, h: 0.35, fontFace: "Cambria", fontSize: 16, bold: true, color: dark ? C.background1 : C.text2 });
    text(s, body, { x: 0.7, y: y + 0.48, w: 3.0, h: 0.5, fontSize: 12, color: dark ? C.background1 : C.text1 });
  });
  image(s, "report-obstacle.png", 4.2, 1.15, 5.3, 3.31, "Report an obstacle form");
  caption(s, "Figure 4: Reporting an obstacle by nearest building or exact spot.", 4.2, 4.52, 5.3);
  s.addNotes("Campus conditions change: flooding, construction, a broken lift. Anyone can report an obstacle by picking the nearest building or the exact spot on the map. It shows as a warning straight away. Once an admin verifies it, routes avoid that path until it is resolved.");
}
screenSlide("The app itself is accessible", "wheelchair-high-contrast.png", "Wheelchair profile in high-contrast mode with large text",
  "Figure 5: Wheelchair profile in high-contrast mode with large text.",
  [
    { text: "High contrast ", options: { bold: true } },
    { text: "and three text sizes", options: { breakLine: true } },
    { text: "Read-aloud ", options: { bold: true } },
    { text: "directions", options: { breakLine: true } },
    { text: "Keyboard and screen reader ", options: { bold: true } },
    { text: "work without the map", options: { breakLine: true } },
    { text: "Atkinson Hyperlegible ", options: { bold: true } },
    { text: "typeface for low vision (Braille Institute, 2019)" },
  ],
  "An accessibility app has to be accessible itself. It has a high-contrast mode and three text sizes, shown here with the wheelchair profile. Directions can be read aloud, everything works with a keyboard and screen reader, and the text uses Atkinson Hyperlegible, a typeface designed for low-vision readers.");

// ---------- 14. Results chart ----------
pres.addSection({ title: "Results" });
{
  const s = content("Every profile reaches most of the campus", "Results");
  s.addChart(pres.charts.BAR, [{ name: "Trips with a route (%)", labels: ["Standard walking", "Visually impaired", "Limited mobility", "Wheelchair user"], values: [100, 100, 93, 85] }], {
    x: 0.5, y: 1.2, w: 5.8, h: 3.4, barDir: "bar",
    chartColors: [HEX.dk2], invertedColors: [HEX.dk2],
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0\"%\"", dataLabelColor: HEX.dk1, dataLabelFontSize: 12, dataLabelFontFace: "+mn-lt",
    catAxisLabelColor: HEX.dk1, catAxisLabelFontSize: 12, catAxisLabelFontFace: "+mn-lt", catAxisOrientation: "maxMin",
    valAxisHidden: true, valAxisMaxVal: 110, valAxisMinVal: 0,
    valGridLine: { style: "none" }, catGridLine: { style: "none" },
    showLegend: false, showTitle: true, title: "Share of 6,162 place-to-place trips with a route", titleFontSize: 13, titleColor: HEX.dk1, titleFontFace: "+mn-lt",
  });
  caption(s, "Figure 6: Every route between the 79 places, computed for each profile.", 0.5, 4.62, 5.8);
  card(s, 6.6, 1.25, 2.9, 3.55, "results-note");
  text(s, "0.1 ms", { x: 6.8, y: 1.45, w: 2.5, h: 0.6, fontFace: "Cambria", fontSize: 30, bold: true, color: C.text2 });
  text(s, "to compute a route", { x: 6.8, y: 2.05, w: 2.5, h: 0.35, fontSize: 13 });
  text(s, "25 / 25", { x: 6.8, y: 2.6, w: 2.5, h: 0.6, fontFace: "Cambria", fontSize: 30, bold: true, color: C.text2 });
  text(s, "automated tests pass", { x: 6.8, y: 3.2, w: 2.5, h: 0.35, fontSize: 13 });
  text(s, "Wheelchair routes never used steps or slopes above 8%.", { x: 6.8, y: 3.75, w: 2.5, h: 0.9, fontSize: 13, italic: true, color: C.text2 });
  s.addNotes("We tested every place-to-place trip: 6,162 of them. Standard walking and visually impaired users get a route for all of them. Limited mobility users for 93 percent, and wheelchair users for 85 percent. Each route takes about a tenth of a millisecond, all 25 automated tests pass, and wheelchair routes never used steps or slopes over 8 percent.");
}

// ---------- 15. Key finding ----------
{
  const s = pres.addSlide({ masterName: "STATEMENT_DARK", sectionTitle: "Results" });
  s.addText("Six places appear unreachable by wheelchair", { placeholder: "title" });
  const places = ["Akingbade Health Bay", "Chemical Engineering Laboratory", "Chemical Engineering Lecture Theatre", "Faculty of Estate Design and Management", "Kufoniyi", "AFRIGIST New Admin Block"];
  places.forEach((p, i) => {
    const x = 0.6 + (i % 2) * 4.5, y = 1.5 + Math.floor(i / 2) * 0.75;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 4.2, h: 0.6, rectRadius: 0.08, fill: { color: "2A5E48" }, line: { color: "2A5E48" }, objectName: `cut-off-${i + 1}` });
    text(s, p, { x: x + 0.2, y, w: 3.8, h: 0.6, fontSize: 15, bold: true, color: C.background1, valign: "middle" });
  });
  text(s, [
    { text: "Every mapped road into them is estimated at 9–12% slope, above the 8% limit. " },
    { text: "Our survey will check them first: if the slopes are real, these are barriers the university should know about.", options: { bold: true, color: HEX.accent1 } },
  ], { x: 0.6, y: 3.9, w: 8.8, h: 1.0, fontSize: 16, color: C.background1 });
  s.addNotes("The most important finding is these six places. Every mapped road into them is estimated at 9 to 12 percent slope, steeper than a wheelchair ramp is allowed to be. These are estimates from a terrain model, so our survey will check them first. If the slopes are real, they are accessibility barriers the university should know about.");
}

// ---------- 16. Same trip, different routes ----------
{
  const s = content("Moremi Hall to the Senate: two routes", "Results");
  const cols = [
    ["Standard walking", [["1,127 m", "distance"], ["15 min", "time"], ["51", "steps"]], C.background2],
    ["Wheelchair user", [["1,235 m", "distance"], ["24 min", "time"], ["0", "steps"]], C.text2],
  ];
  cols.forEach(([name, stats, fill], i) => {
    const x = 0.5 + i * 4.6;
    card(s, x, 1.25, 4.4, 2.8, `compare-${i + 1}`, fill);
    const dark = fill === C.text2;
    text(s, name, { x: x + 0.3, y: 1.4, w: 3.8, h: 0.45, fontFace: "Cambria", fontSize: 18, bold: true, color: dark ? C.background1 : C.text2 });
    const colX = [0, 1.6, 2.85], colW = [1.5, 1.15, 0.9];
    stats.forEach(([big, label], j) => {
      const sx = x + 0.3 + colX[j];
      text(s, big, { x: sx, y: 2.2, w: colW[j], h: 0.7, fontFace: "Cambria", fontSize: 24, bold: true, color: dark ? C.accent1 : C.text2 });
      text(s, label, { x: sx, y: 2.95, w: colW[j], h: 0.35, fontSize: 12, color: dark ? C.background2 : C.text1 });
    });
  });
  text(s, "The wheelchair route goes 108 m further to avoid a 51-step staircase, and the time estimate reflects a slower pace.", { x: 0.5, y: 4.25, w: 9, h: 0.55, fontSize: 15, italic: true, color: C.text2 });
  s.addNotes("A concrete example. From Moremi Hall to the Senate Building, the standard route is 1,127 metres and climbs a 51-step staircase. The wheelchair route goes 108 metres further on step-free roads, with zero steps. The time estimate also reflects a slower pace: 24 minutes instead of 15.");
}

// ---------- 17. Testing ----------
{
  const s = content("How we tested it", "Results");
  card(s, 0.5, 1.25, 4.35, 3.5, "tests-auto");
  text(s, "25 automated tests", { x: 0.75, y: 1.4, w: 3.9, h: 0.45, fontFace: "Cambria", fontSize: 18, bold: true, color: C.text2 });
  text(s, [
    "No steps or steep slopes for wheelchairs", "Blocked paths are avoided", "After-dark mode avoids unlit paths",
    "Only verified reports change routes", "Elevation profiles add up both ways", "Every place connected on real OAU data",
  ].map((t, i, a) => ({ text: t, options: { bullet: true, breakLine: i < a.length - 1 } })), { x: 0.75, y: 1.95, w: 3.9, h: 2.7, fontSize: 13, paraSpaceAfter: 6 });
  card(s, 5.15, 1.25, 4.35, 3.5, "tests-device");
  text(s, "Tested on laptops and phones", { x: 5.4, y: 1.4, w: 3.9, h: 0.45, fontFace: "Cambria", fontSize: 18, bold: true, color: C.text2 });
  text(s, "Found and fixed four faults:", { x: 5.4, y: 1.95, w: 3.9, h: 0.35, fontSize: 13, bold: true });
  text(s, [
    "Map collapsed to zero height on phones", "Long names pushed the page off-screen",
    "Blank space below the page on desktop", "Route line turned grey in high contrast",
  ].map((t, i, a) => ({ text: t, options: { bullet: true, breakLine: i < a.length - 1 } })), { x: 5.4, y: 2.35, w: 3.9, h: 2.3, fontSize: 13, paraSpaceAfter: 6 });
  s.addNotes("We tested in two ways. 25 automated tests check the routing rules on a small test campus where we know the right answers, plus checks on the real OAU data. We also tested on laptops and phones, which found four layout faults that we fixed.");
}

// ---------- 18. Limitations and mitigation ----------
pres.addSection({ title: "Conclusion" });
{
  const s = content("Limitations and how we mitigate them", "Conclusion");
  const head = (t) => ({ text: t, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 } } });
  s.addTable([
    [head("Limitation"), head("Mitigation")],
    ["Building accessibility not yet surveyed", "App shows “not surveyed” instead of guessing; our on-site survey fills it in"],
    ["Slopes estimated from a 90 m terrain grid", "Measure slopes on site, starting with the six cut-off places"],
    ["Some footpaths missing near buildings", "Directions flag unmapped stretches; we map the paths in OpenStreetMap"],
    ["Obstacle reports could be false", "Reports only change routes after an admin verifies them"],
    ["Routes start at buildings, not GPS", "Add GPS start points in the next version"],
  ], { x: 0.5, y: 1.2, w: 9, colW: [3.4, 5.6], fontFace: "Calibri", fontSize: 13, color: HEX.dk1, border: { type: "solid", pt: 0.75, color: "C9D3CD" }, rowH: 0.52, valign: "middle" });
  s.addNotes("Every limitation has a mitigation. Building accessibility isn't surveyed yet, so the app says 'not surveyed' rather than guessing, and our survey fills it in. Slopes are estimates, so we will measure them on site, starting with the six cut-off places. Missing footpaths are flagged in the directions and we will map them. False reports can't change routes until an admin verifies them. And GPS start points come in the next version.");
}

// ---------- 19. References ----------
{
  const s = content("References", "Conclusion");
  const refs = [
    "Bolten, N., et al. (2017). A pedestrian-centered data approach for equitable access to urban infrastructure environments. IBM Journal of Research and Development, 61(6).",
    "Braille Institute (2019). Atkinson Hyperlegible typeface.",
    "European Space Agency. Copernicus Digital Elevation Model, GLO-90 (via Open-Meteo Elevation API).",
    "Hart, P. E., Nilsson, N. J. and Raphael, B. (1968). A formal basis for the heuristic determination of minimum cost paths. IEEE Trans. Systems Science and Cybernetics, 4(2), 100–107.",
    "Neis, P. and Zielstra, D. (2014). Generation of a tailored routing network for disabled people based on collaboratively collected geodata. Applied Geography, 47, 70–77.",
    "OpenStreetMap contributors (2026). OpenStreetMap, retrieved 22 October 2026. Open Database Licence.",
    "Sozialhelden e.V. Wheelmap.org.",
    "U.S. Department of Justice (2010). 2010 ADA Standards for Accessible Design.",
    "World Health Organization (2022). Global report on health equity for persons with disabilities.",
  ];
  const half = Math.ceil(refs.length / 2);
  [refs.slice(0, half), refs.slice(half)].forEach((list, c) => {
    text(s, list.map((r, i) => ({ text: r, options: { breakLine: i < list.length - 1 } })), { x: 0.5 + c * 4.6, y: 1.2, w: 4.3, h: 3.75, fontSize: 11, paraSpaceAfter: 7 });
  });
  s.addNotes("These are the sources we cited. The full reference list is in our report.");
}

// ---------- 20. Thank you ----------
{
  const s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "Conclusion" });
  s.addText("Thank you", { placeholder: "title" });
  s.addText([
    { text: "AACNRAS plans accessible routes across 79 OAU places for four travel profiles, and has already found six places that may need ramps.", options: { breakLine: true } },
    { text: "We welcome your questions.", options: { bold: true, color: HEX.accent1 } },
  ], { placeholder: "body" });
  s.addNotes("To conclude: AACNRAS plans accessible routes across 79 OAU places for four travel profiles, and has already pointed to six places that may need ramps. Thank you for listening. We welcome your questions, and we can show the live app.");
}

pres.writeFile({ fileName: OUT }).then(async () => {
  const applyTheme = findApplyTheme();
  if (applyTheme) await applyTheme(OUT, THEME);
  else console.warn("Theme helper not found: colours fall back to Office defaults. Set APPLY_THEME to its path.");
  console.log("wrote", OUT);
});
