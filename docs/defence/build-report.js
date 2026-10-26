// Builds the AACNRAS SWEP defence report as a Word document.
// Usage: node build-report.js [output.docx]   (default: ~/Desktop)
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, ImageRun, LevelFormat, Packer,
  PageNumber, Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableOfContents, TableRow, TextRun, WidthType,
} = require("docx");
const group = require("./group");

const OUT = process.argv[2] ?? path.join(os.homedir(), "Desktop", "AACNRAS Project Report - SWEP Group 15.docx");
const SHOTS = path.join(__dirname, "..", "screenshots");
const ASSETS = path.join(__dirname, "assets");
const FONT = "Times New Roman";
const CONTENT_WIDTH = 9026; // A4 width 11906 minus two 1440 margins, in DXA
const BLANK = "______________________________";

// ---------- inline text: **bold**, *italic*, `code` ----------
function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }));
    else if (t.startsWith("`")) out.push(new TextRun({ text: t.slice(1, -1), font: "Courier New", size: 20, ...base }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}

const P = (text, opts = {}) => new Paragraph({ children: runs(text), spacing: { after: 160 }, alignment: AlignmentType.JUSTIFIED, ...opts });
const center = (text, opts = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, ...opts, children: runs(text, opts.run) });
const H1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(text)] });
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });

let listInstance = 0;
const bullets = (items) => items.map((t) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80 }, children: runs(t) }));
const numbered = (items) => {
  const instance = ++listInstance;
  return items.map((t) => new Paragraph({ numbering: { reference: "numbers", level: 0, instance }, spacing: { after: 80 }, children: runs(t) }));
};

const border = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
const borders = { top: border, bottom: border, left: border, right: border };
function table(header, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const scaled = widths.map((w) => Math.round((w / total) * CONTENT_WIDTH));
  scaled[scaled.length - 1] += CONTENT_WIDTH - scaled.reduce((a, b) => a + b, 0);
  // keepNext on every row but the last keeps a table on one page.
  const cell = (text, i, head, last) =>
    new TableCell({
      borders,
      width: { size: scaled[i], type: WidthType.DXA },
      shading: head ? { fill: "D9E2F3", type: ShadingType.CLEAR, color: "auto" } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ keepNext: !last, spacing: { after: 0, line: 276 }, children: runs(text, { size: 22, bold: head || undefined }) })],
    });
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: scaled,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: header.map((h, i) => cell(h, i, true, false)) }),
      ...rows.map((r, j) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false, j === rows.length - 1)) })),
    ],
  });
}
const caption = (text) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 240 }, children: runs(text, { italics: true, size: 22 }) });

function figure(file, w, h, text) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      spacing: { before: 120, after: 0 },
      children: [new ImageRun({ type: "png", data: fs.readFileSync(file), transformation: { width: w, height: h }, altText: { title: text, description: text, name: path.basename(file) } })],
    }),
    caption(text),
  ];
}
const shot = (name, text) => figure(path.join(SHOTS, name), 600, 375, text);

// ---------- content ----------
const memberRows = group.hasMembers
  ? group.members.map((m, i) => [String(i + 1), m.name, m.matric, m.department])
  : [1, 2, 3, 4, 5, 6].map((n) => [String(n), "", "", ""]);

const titlePage = [
  new Paragraph({ spacing: { before: 600 } }),
  center("**ACCESSIBILITY-AWARE CAMPUS NAVIGATION AND ROUTE ADVISORY SYSTEM (AACNRAS)**", { run: { size: 32 } }),
  new Paragraph({ spacing: { after: 300 } }),
  center("A report submitted in fulfilment of the requirements of the Students’ Work Experience Programme (SWEP)"),
  new Paragraph({ spacing: { after: 300 } }),
  center(`**By ${group.groupName}**`, { run: { size: 28 } }),
  table(["S/N", "Name", "Matriculation number", "Department"], memberRows, [8, 40, 24, 28]),
  new Paragraph({ spacing: { after: 300 } }),
  ...(group.faculty ? [center(group.faculty)] : []),
  center(group.university),
  new Paragraph({ spacing: { after: 300 } }),
  center(`Supervisor: ${group.supervisor || BLANK}`),
  center(`Date: ${group.defenceDate || BLANK}`),
];

const certification = [
  H1("Certification"),
  P(`This is to certify that this project, *Accessibility-Aware Campus Navigation and Route Advisory System*, was carried out by ${group.groupName} under my supervision during the Students’ Work Experience Programme at Obafemi Awolowo University, Ile-Ife.`),
  new Paragraph({ spacing: { before: 800 } }),
  P(BLANK),
  P(group.supervisor ? `${group.supervisor} (signature)` : "Supervisor’s name and signature"),
  new Paragraph({ spacing: { before: 400 } }),
  P(BLANK),
  P("Date"),
];

const acknowledgement = [
  H1("Acknowledgement"),
  P("We thank God for the strength and opportunity to complete this project. We are grateful to our SWEP supervisor and the SWEP coordinators for their guidance. We also thank the OpenStreetMap community, whose freely available map of the OAU campus made this work possible, and every student who shared their experience of moving around campus."),
];

const abstract = [
  H1("Abstract"),
  P("This project designed and built AACNRAS, a web application that plans walking routes across the Obafemi Awolowo University (OAU) campus to suit how each person moves. The OAU campus is large and hilly, and general map apps send every user the same way, regardless of steps, steep roads, rough ground or poor lighting."),
  P("The campus was modelled as a graph of 471 junctions and 577 path segments (78.6 km of paths), imported from OpenStreetMap. Each segment was given a slope estimated from the Copernicus 90 m terrain model, plus its surface, steps, lighting and kerb information. Four travel profiles (standard walking, wheelchair user, visually impaired and limited mobility) turn each segment into a cost, and an A* search finds the lowest-cost route for that profile. The route is turned into turn-by-turn directions with accessibility warnings, an elevation profile, route statistics and details about the destination building. Users can report obstacles; once an administrator verifies a report, routing avoids the affected path."),
  P("The system covers 79 campus places. In testing, standard walking found a route for all 6,162 place-to-place trips, and the wheelchair profile for 85% of them. The six places cut off for wheelchair users sit on access roads estimated at 9% to 12% slope. Wheelchair routes never used steps or slopes above 8%, and all 25 automated tests passed. The main limitations are unsurveyed building accessibility data, coarse slope estimates and footpaths missing from OpenStreetMap near some buildings; each has a planned mitigation, led by an on-site survey."),
  P("**Keywords:** accessibility, campus navigation, route planning, A* search, OpenStreetMap, assistive technology"),
];

const contents = [
  H1("Table of Contents"),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  P("*If the table above is empty, right-click it in Word and choose Update Field.*"),
];

const chapter1 = [
  H1("Chapter 1: Introduction"),
  H2("1.1 Background"),
  P("The World Health Organization estimates that about 1.3 billion people, or 16% of the world’s population, live with a significant disability (WHO, 2022). In Nigeria, the Discrimination Against Persons with Disabilities (Prohibition) Act 2018 requires public buildings and facilities to be made accessible. Universities are among the public spaces this covers."),
  P("OAU’s main campus in Ile-Ife is large and hilly. Lecture theatres, faculties, halls of residence, banks and the Health Centre are spread over several kilometres of roads and footpaths. Many routes include steps, steep gradients, unpaved shortcuts and stretches that are dark at night. For a wheelchair user, a student on crutches or a visually impaired student, the “normal” route can be unsafe or impossible."),
  P("General-purpose map apps give everyone the same route. They do not know where the steps are, how steep a road is, or whether a ramp is blocked this week."),
  H2("1.2 Problem statement"),
  P("Students, staff and visitors with mobility, visual or temporary impairments have no reliable way to:"),
  ...numbered([
    "find a route across the OAU campus that suits how they move;",
    "know in advance about steps, steep slopes, rough ground or unlit paths on that route;",
    "find out whether a building has a step-free entrance, ramp, lift or accessible toilet; and",
    "learn about temporary obstacles such as flooding, construction or a broken lift.",
  ]),
  H2("1.3 Aim and objectives"),
  P("The aim is to design and build a web-based navigation system that gives accessible routes and route advice for the OAU campus. The objectives are to:"),
  ...numbered([
    "model the OAU walking network as a graph with accessibility attributes (slope, steps, surface, lighting, kerbs);",
    "define travel profiles for different mobility needs and a cost function for each;",
    "implement an A* route search that finds the lowest-cost route for a chosen profile;",
    "turn routes into turn-by-turn directions with accessibility warnings and route statistics;",
    "provide accessibility details for campus buildings;",
    "let users report obstacles and let administrators verify them, so routes avoid verified obstacles; and",
    "make the application itself accessible (high contrast, large text, read-aloud, keyboard and screen-reader support).",
  ]),
  H2("1.4 Scope"),
  P("The system covers the main OAU campus in Ile-Ife: 79 named places and 577 path segments. It plans walking and wheelchair routes between named places. It runs in any modern web browser on phones and computers. Out of scope for this phase: live GPS turn-by-turn guidance, indoor navigation inside buildings, and vehicle or shuttle routing."),
  H2("1.5 Significance"),
  ...bullets([
    "**For students and staff with disabilities:** safer, more independent movement around campus.",
    "**For the university:** a record of where accessibility is lacking, which can guide repairs and new ramps.",
    "**For everyone:** after-dark routing and obstacle reports help all users, including visitors who don’t know the campus.",
    "**For the wider community:** paths the group maps during the survey go into OpenStreetMap, where every map app can use them.",
  ]),
];

const chapter2 = [
  H1("Chapter 2: Literature Review"),
  P("Accessible routing combines three established ideas: shortest-path search on a graph, open map data, and per-user cost models. Existing tools cover parts of this, but none covers the OAU campus with building-level accessibility information."),
  H2("2.1 Shortest-path algorithms"),
  P("Dijkstra (1959) gave the classic method for finding the lowest-cost path in a graph with non-negative edge costs. It grows outward from the start, always settling the cheapest unvisited node. Hart, Nilsson and Raphael (1968) extended this with A*, which adds a heuristic estimate of the remaining cost to the goal. If the heuristic never overestimates the true cost (it is *admissible*), A* still finds the optimal path while exploring far fewer nodes. Straight-line distance divided by walking speed is a standard admissible heuristic for walking routes, and it is the one AACNRAS uses."),
  P("The key point for accessibility is that “lowest cost” does not have to mean “shortest”. If the cost of a segment reflects how hard it is for a particular person, the same algorithm returns a different, better route for each person."),
  H2("2.2 Accessible routing systems"),
  ...bullets([
    "**AccessMap** (Bolten et al., 2017), from the University of Washington, plans pedestrian routes in Seattle using sidewalk data. Users set their maximum uphill and downhill incline and whether they can use kerbs without ramps.",
    "**Wheelmap.org**, run by Sozialhelden e.V., is a crowdsourced map that marks places as fully, partly or not wheelchair accessible. It stores these ratings in OpenStreetMap’s `wheelchair` tag, which AACNRAS also reads.",
    "**Neis and Zielstra (2014)** showed that a routing network tailored to people with disabilities can be generated from collaboratively collected OpenStreetMap data, and that data completeness is the main limit.",
    "**Mainstream map apps** such as Google Maps offer wheelchair-accessible public transport routes and accessibility information for some places, mainly in large cities. They do not model campus footpaths, steps or slopes at OAU.",
  ]),
  table(
    ["System", "Route by mobility profile", "Slope-aware", "Obstacle reports", "Covers OAU"],
    [
      ["AccessMap", "Yes", "Yes", "No", "No"],
      ["Wheelmap", "No (places only)", "No", "Ratings only", "Partly (few places)"],
      ["Google Maps", "Transit only", "No", "No", "Roads only"],
      ["**AACNRAS**", "**Yes, 4 profiles**", "**Yes**", "**Yes, verified**", "**Yes**"],
    ],
    [18, 22, 16, 20, 24],
  ),
  caption("Table 2.1: Comparison of existing systems with AACNRAS"),
  H2("2.3 OpenStreetMap as a data source"),
  P("OpenStreetMap (OSM) is a free, editable map of the world built by volunteers (Haklay and Weber, 2008). It records roads, footpaths, steps and buildings, with tags such as `surface`, `lit`, `step_count`, `kerb`, `tactile_paving` and `wheelchair`. Its data is free to use under the Open Database Licence. Its coverage of the OAU campus is good for roads and building outlines but thinner for footpaths and accessibility tags, which is why the project includes a survey step."),
  H2("2.4 Accessibility standards"),
  ...bullets([
    "**Ramp gradient:** the 2010 ADA Standards for Accessible Design limit ramp running slopes to 1:12 (about 8.33%). AACNRAS uses 8% as the wheelchair profile’s limit.",
    "**Web accessibility:** the Web Content Accessibility Guidelines (WCAG) 2.2 (W3C, 2023) set out how web content should work for people with disabilities, including contrast, resizable text and keyboard operation. AACNRAS follows these in its own interface.",
    "**Legibility:** the Atkinson Hyperlegible typeface was designed by the Braille Institute (2019) to make letters easier to tell apart for low-vision readers.",
  ]),
  H2("2.5 The gap this project fills"),
  P("No existing tool gives OAU students a route that accounts for steps, slopes and surfaces on campus, together with building accessibility details and a way to report obstacles. AACNRAS combines these, using open data so it can be maintained and extended."),
];

const chapter3 = [
  H1("Chapter 3: Methodology and System Design"),
  P("The system was built in short iterations: model the data, build and test the routing engine, then build the interface on top, checking each step with automated tests and on real phones."),
  H2("3.1 Requirements"),
  P("**Functional requirements.** The system shall:"),
  ...numbered([
    "let the user choose a travel profile, a start and a destination;",
    "compute the lowest-cost route for that profile, or report that none exists;",
    "give turn-by-turn directions with warnings for steps, slopes, surfaces, kerbs, lighting and reported obstacles;",
    "show route statistics: distance, time, climb, descent, steepest section, steps, surfaces, lighting and landmarks;",
    "show accessibility and other details for each building;",
    "accept obstacle reports from any user and let an administrator verify, reject or resolve them; and",
    "avoid paths blocked by verified reports.",
  ]),
  P("**Non-functional requirements.** The system shall work on phones and computers in a web browser; meet WCAG 2.2 practices (contrast, resizable text, keyboard and screen-reader use); compute a route in well under a second; and need no paid services."),
  H2("3.2 Data collection"),
  table(
    ["Data", "Source", "Method"],
    [
      ["Roads, footpaths, steps", "OpenStreetMap (Overpass API)", "Automated import script"],
      ["Elevation", "Copernicus DEM GLO-90 (Open-Meteo API)", "Sampled at every path point"],
      ["Places and details (opening hours, floors, phone)", "OpenStreetMap", "Automated import, then curated"],
      ["Building accessibility, path corrections, rest points", "On-site survey by the group", "Checklist, entered into the data file"],
    ],
    [34, 36, 30],
  ),
  caption("Table 3.1: Data sources"),
  P("The import script downloads every walkable way inside the campus area (latitude 7.505° to 7.530° N, longitude 4.505° to 4.540° E). It splits ways into segments at junctions and fetches the elevation of each of the 2,414 path points. Each segment’s slope is the steepest gradient over stretches of at least 90 m, because the terrain model has 90 m cells and shorter stretches would only measure noise."),
  H2("3.3 Graph model"),
  P("The campus is a graph G = (V, E). V is the set of 471 junctions and path ends, and E is the set of 577 two-way path segments. Each segment carries the attributes in Table 3.2. Each of the 79 places is attached to its nearest junction in the main connected network, so every place is reachable."),
  table(
    ["Attribute", "Meaning"],
    [
      ["Length", "Metres along the path"],
      ["Slope", "Steepest gradient, %"],
      ["Steps", "Number of steps (0 = step-free)"],
      ["Surface", "Paved, rough or unpaved"],
      ["Path type", "Footway, steps, service road, main road, etc."],
      ["Lighting, tactile paving, dropped kerbs", "Yes, no or not recorded"],
    ],
    [40, 60],
  ),
  caption("Table 3.2: Path segment attributes"),
  H2("3.4 Travel profiles"),
  table(
    ["Profile", "Speed", "Steps", "Max slope", "Main preferences"],
    [
      ["Standard walking", "4.7 km/h", "Allowed", "Any", "Fastest route"],
      ["Wheelchair user", "3.2 km/h", "Never", "8%", "Smooth paved paths, dropped kerbs"],
      ["Visually impaired", "3.6 km/h", "Avoided", "Any", "Tactile paving, even surfaces, away from busy roads"],
      ["Limited mobility", "2.5 km/h", "Strongly avoided", "10%", "Gentle slopes, smooth ground"],
    ],
    [20, 12, 16, 12, 40],
  ),
  caption("Table 3.3: Travel profiles"),
  H2("3.5 Cost function"),
  P("A segment is unusable for a profile if it has steps and the profile forbids them, or if its slope exceeds the profile’s maximum. Otherwise its cost, in effective seconds, is:"),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 200 },
    children: [new TextRun({ text: "C(e) = (L ÷ v) × (1 + s × kₛ) × p(surface) × p(kerb) × p(tactile) × p(road) × p(light) + n × c(step)", italics: true, font: "Cambria Math" })],
  }),
  P("Here L is the length, v the profile’s speed, s the slope in percent, kₛ the profile’s slope factor, each p a penalty of 1 or more set by the profile, n the number of steps and c(step) the profile’s cost per step. For example, a wheelchair user’s penalty for unpaved ground is 4, against 1.2 for standard walking. Because every penalty is at least 1, a segment never costs less than the time it takes to walk it."),
  H2("3.6 Route search (A*)"),
  ...numbered([
    "Put the start junction in an open set with cost 0.",
    "Take the open junction with the lowest *cost so far + estimate to goal*. The estimate is the straight-line distance to the goal divided by the profile’s speed.",
    "If it is the goal, trace back the path and stop.",
    "Otherwise, for each neighbouring segment that is usable and not blocked by a verified report, compute the new cost. Keep it if it is lower than any found before.",
    "Repeat from step 2. If the open set empties, no route exists for this profile.",
  ]),
  P("Because the estimate never exceeds the true cost, the route found is the lowest-cost route."),
  H2("3.7 Route advisory"),
  P("The chosen path is turned into advice. Consecutive segments of the same path merge into one instruction. Turns come from the change in heading: under 30° is “continue”, 30° to 60° “bear”, 60° to 150° “turn”. Warnings are added for steps, slopes of 5% or more, rough or unpaved ground, missing dropped kerbs, unlit paths after dark, and reports. A walking leg is added where a building is more than 25 m from the mapped paths. Travel time uses the profile’s speed, plus 3% per percent of slope and a time per step."),
  H2("3.8 Obstacle report workflow"),
  P("A new report is *pending*: it shows as a warning on routes but does not change them. An administrator can mark it *verified*, *rejected* or *resolved*. A verified report of a blocked path, construction, flooding or a damaged ramp removes that path from routing until it is resolved. Reports of broken lifts and other hazards stay as warnings."),
  H2("3.9 System architecture"),
  ...figure(path.join(ASSETS, "architecture.png"), 600, 442, "Figure 3.1: System architecture. Map data is prepared offline; routes are computed in the browser; only reports go to the server."),
  P("Map data is prepared offline by the import script and shipped with the app. All route calculation happens in the user’s browser, so routes appear instantly. Only obstacle reports and admin actions go to the server, which keeps them in one file. The app is built with Next.js 16, React 19, TypeScript, Tailwind CSS and Leaflet, with Vitest for tests."),
];

const chapter4 = [
  H1("Chapter 4: Implementation, Testing and Results"),
  P("All seven objectives were implemented and tested. The working system plans routes for four profiles across 79 places, and 25 automated tests pass."),
  H2("4.1 Implementation"),
  table(
    ["Module", "What it does"],
    [
      ["Import script", "Downloads paths, places and elevations; estimates slopes"],
      ["Graph builder", "Builds the network and attaches each place to its nearest junction"],
      ["Routing engine", "Profile cost function and A* search"],
      ["Advisory", "Turn-by-turn directions, warnings and travel time"],
      ["Route details", "Elevation profile, climb, surfaces, lighting, landmarks"],
      ["Route planner page", "Profiles, place pickers, directions, map, building details"],
      ["Report form and admin dashboard", "Obstacle reporting and verification"],
      ["Reports API", "Stores reports and checks the admin passcode"],
    ],
    [32, 68],
  ),
  caption("Table 4.1: System modules"),
  H2("4.2 Screens"),
  ...shot("route-planner.png", "Figure 4.1: Route planner. The user picks a profile, start and destination; the route is drawn in blue, and dotted blue marks stretches not yet mapped."),
  ...shot("route-details.png", "Figure 4.2: Directions with a warning on each step, and route details with the elevation profile, surfaces, lighting and landmarks."),
  ...shot("report-obstacle.png", "Figure 4.3: Reporting an obstacle, by nearest building or by the exact spot on the map."),
  ...shot("wheelchair-high-contrast.png", "Figure 4.4: Wheelchair profile in high-contrast mode with large text; the base map is greyed so the route stays clear."),
  H2("4.3 Testing"),
  P("**Automated tests.** 25 unit tests run with Vitest. Routing tests use a small hand-made test campus with known stairs, hills and unlit paths, so the right answer is clear in advance. They check that:"),
  ...bullets([
    "wheelchair routes never use steps or slopes above 8%;",
    "blocked paths are avoided, and a blocked only-way-in gives “no route”;",
    "after-dark mode avoids unlit paths;",
    "verified reports block a path, while pending reports only warn;",
    "elevation profiles add up correctly in both directions of travel; and",
    "directions, rest points, landmarks and destination warnings appear as expected.",
  ]),
  P("Further tests run on the real OAU data, checking that every pair of places is connected for standard walking and that every profile can travel between the main faculties. Type checking, linting and a production build also pass."),
  P("**Device testing.** The app was tested on a laptop and on phones over the local network. This found four faults, all fixed: the map collapsed to zero height on phones, long building names pushed the page wider than the screen, blank space appeared below the page on desktop, and high-contrast mode turned the route line grey along with the map."),
  H2("4.4 Results"),
  P("**Coverage.** The system covers 79 places, 471 junctions and 577 path segments (78.6 km). A route takes about 0.1 ms to compute."),
  table(
    ["Profile", "Trips with a route (of 6,162)", "Share"],
    [
      ["Standard walking", "6,162", "100%"],
      ["Visually impaired", "6,162", "100%"],
      ["Limited mobility", "5,702", "93%"],
      ["Wheelchair user", "5,260", "85%"],
    ],
    [40, 40, 20],
  ),
  caption("Table 4.2: Trips with a route, by profile"),
  P("Six places cannot be reached by wheelchair: Akingbade Health Bay, the Chemical Engineering Laboratory and Lecture Theatre, the Faculty of Estate Design and Management, Kufoniyi and the AFRIGIST New Admin Block. Every mapped road into them is estimated at 9% to 12% slope, above the 8% limit. These are the first places the survey should check: if the slopes are real, they are accessibility barriers the university should know about."),
  P("**Routes differ by profile.** The same trip gives different routes and times for different people:"),
  table(
    ["Trip", "Profile", "Distance", "Time", "Steps", "Steepest"],
    [
      ["Moremi Hall to Senate Building", "Standard walking", "1,127 m", "15 min", "51", "6.7%"],
      ["Moremi Hall to Senate Building", "Wheelchair user", "1,235 m", "24 min", "0", "6.9%"],
      ["Angola Hall to First Bank Lecture Theatre", "Standard walking", "1,849 m", "26 min", "51", "6.8%"],
      ["Angola Hall to First Bank Lecture Theatre", "Wheelchair user", "2,205 m", "44 min", "0", "6.9%"],
      ["SUB to Faculty of Technology", "Standard walking", "847 m", "11 min", "0", "4.6%"],
      ["SUB to Faculty of Technology", "Limited mobility", "940 m", "23 min", "0", "5.6%"],
    ],
    [32, 20, 13, 11, 10, 14],
  ),
  caption("Table 4.3: The same trips under different profiles"),
  P("On the Moremi Hall trip, the standard route uses a 51-step staircase. The wheelchair route avoids it by going 108 m further on step-free roads."),
];

const chapter5 = [
  H1("Chapter 5: Conclusion and Recommendations"),
  H2("5.1 Conclusion"),
  P("AACNRAS shows that a free, open-data web app can give OAU students routes that fit how they move. It turns 78.6 km of campus paths into a graph, scores each segment for four travel profiles, and uses A* to find the best route for each. Every route comes with directions, warnings, an elevation profile and building details, and users can report obstacles that change routing once verified. All seven objectives in Section 1.3 were met."),
  P("The project also produced a useful finding: six campus places appear to be unreachable by wheelchair because their only access roads are steeper than 1:12. If the survey confirms this, the university has a clear list of places that need ramps or alternative access."),
  H2("5.2 Limitations and mitigation"),
  P("Each known limitation has a mitigation, either already in the system or planned:"),
  table(
    ["Limitation", "Mitigation"],
    [
      ["Building accessibility (ramps, lifts, toilets) is not yet surveyed", "The app shows “not surveyed” instead of guessing; the group’s on-site survey fills the data in (Appendix C)"],
      ["Slopes are estimated from a 90 m terrain model and can miss short steep sections", "Measure slopes on site, starting with the six places cut off for wheelchair users, and record corrections in the data file"],
      ["Some footpaths near buildings are missing from OpenStreetMap", "Directions flag each unmapped stretch; the group maps the missing paths in OpenStreetMap and re-imports"],
      ["Obstacle reports could be false or malicious", "Reports only change routes after an administrator verifies them; until then they show as warnings"],
      ["Routes start at buildings, not at the user’s position", "Add GPS start points in the next version"],
      ["Reports are stored in one file with a shared admin passcode", "Suitable for the demonstration; move to a database with individual admin accounts before public release"],
    ],
    [45, 55],
  ),
  caption("Table 5.1: Limitations and how each is mitigated"),
  H2("5.3 Recommendations"),
  ...numbered([
    "**Complete the on-site survey** of building accessibility, path slopes, kerbs and rest points, starting with the six places cut off for wheelchair users.",
    "**Map the missing footpaths** in OpenStreetMap so routes reach building entrances.",
    "**Share the findings with the university’s Physical Planning and Works departments** to guide ramp and pavement work.",
    "**Add GPS start points and live spoken guidance** for users walking a route.",
    "**Treat uphill and downhill differently** in the cost function, since climbing is much harder than descending for wheelchair users.",
    "**Move reports to a database with individual admin accounts** before wider release.",
    "**Test with students who have disabilities** and tune each profile’s penalties from their feedback.",
    "**Add Yoruba** to the interface and voice guidance.",
  ]),
];

const references = [
  H1("References"),
  ...[
    "Bolten, N., Mukherjee, S., Sipeeva, V., Tanweer, A., & Caspi, A. (2017). A pedestrian-centered data approach for equitable access to urban infrastructure environments. *IBM Journal of Research and Development, 61*(6). https://ieeexplore.ieee.org/document/8167728",
    "Braille Institute. (2019). *Atkinson Hyperlegible typeface*. https://www.brailleinstitute.org/freefont/",
    "Dijkstra, E. W. (1959). A note on two problems in connexion with graphs. *Numerische Mathematik, 1*, 269–271.",
    "European Space Agency. *Copernicus Digital Elevation Model, GLO-90*. https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model",
    "Federal Republic of Nigeria. (2018). *Discrimination Against Persons with Disabilities (Prohibition) Act*. Signed into law in January 2019.",
    "Haklay, M., & Weber, P. (2008). OpenStreetMap: User-generated street maps. *IEEE Pervasive Computing, 7*(4), 12–18.",
    "Hart, P. E., Nilsson, N. J., & Raphael, B. (1968). A formal basis for the heuristic determination of minimum cost paths. *IEEE Transactions on Systems Science and Cybernetics, 4*(2), 100–107.",
    "Neis, P., & Zielstra, D. (2014). Generation of a tailored routing network for disabled people based on collaboratively collected geodata. *Applied Geography, 47*, 70–77.",
    "Open-Meteo. *Elevation API*. https://open-meteo.com/en/docs/elevation-api",
    "OpenStreetMap contributors. (2026). *OpenStreetMap* [Data set, retrieved 22 October 2026]. Open Database Licence. https://www.openstreetmap.org/copyright",
    "Sozialhelden e.V. *Wheelmap.org*. https://wheelmap.org",
    "U.S. Department of Justice. (2010). *2010 ADA Standards for Accessible Design*. https://www.ada.gov/law-and-regs/design-standards/2010-stds/",
    "World Health Organization. (2022). *Global report on health equity for persons with disabilities*. Geneva: WHO. https://www.who.int/publications/i/item/9789240063600",
    "World Wide Web Consortium. (2023). *Web Content Accessibility Guidelines (WCAG) 2.2*. https://www.w3.org/TR/WCAG22/",
  ].map((r) => new Paragraph({ children: runs(r), spacing: { after: 160 }, indent: { left: 720, hanging: 720 } })),
];

const appendices = [
  H1("Appendix A: User Guide"),
  ...numbered([
    "Open the app in a web browser on a phone or computer.",
    "Under **How are you travelling?**, choose standard walking, wheelchair user, visually impaired or limited mobility.",
    "Choose **From** and **To**, or tap a building on the map and press **Start here** or **Go here**.",
    "Tick **Travelling after dark** to prefer lit paths.",
    "Read the directions and warnings, or press **Read directions aloud**.",
    "Open **Route details** for the elevation profile, climb, surfaces and landmarks.",
    "To report a problem, press **Report an obstacle**, choose the place and the problem, and send it.",
    "Use **Display & voice** for larger text, high contrast and automatic read-aloud.",
  ]),
  H1("Appendix B: Running the Software"),
  P("The source code is in the group’s repository, in the `aacnras` folder. It needs Node.js 22 or newer."),
  ...[
    "cd aacnras",
    "npm install",
    "npm run dev          (development server at http://localhost:3000)",
    "npm test             (run the 25 automated tests)",
    "npm run build && npx next start -H 0.0.0.0 -p 3015   (serve to phones on the same Wi-Fi)",
  ].map((line) => new Paragraph({ spacing: { after: 0, line: 276 }, indent: { left: 360 }, children: [new TextRun({ text: line, font: "Courier New", size: 20 })] })),
  new Paragraph({ spacing: { after: 160 } }),
  P("The admin dashboard is at `/admin`. Its passcode is set with the `ADMIN_PASSCODE` setting."),
  H1("Appendix C: Survey Checklist"),
  ...bullets([
    "Check the six places cut off for wheelchair users and measure their access road slopes.",
    "For each building, record step-free entrance, ramp, lift and accessible toilet.",
    "List the departments and offices inside each faculty building.",
    "Walk the main routes and correct slopes, steps, surfaces, kerbs and lighting.",
    "Record benches and shelters as rest points.",
    "Map missing footpaths in OpenStreetMap and re-run the import.",
  ]),
  H1("Appendix D: Reports API"),
  table(
    ["Method and path", "Purpose", "Access"],
    [
      ["GET /api/reports", "List all obstacle reports", "Anyone"],
      ["POST /api/reports", "Create a report (type, path or building, location, details)", "Anyone"],
      ["PATCH /api/reports/:id", "Set status: pending, verified, rejected, resolved", "Admin passcode"],
      ["POST /api/admin/login", "Check the admin passcode", "Anyone"],
    ],
    [30, 50, 20],
  ),
];

const page = { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } };
const doc = new Document({
  creator: group.groupName,
  title: "AACNRAS Project Report",
  description: `Accessibility-Aware Campus Navigation and Route Advisory System — ${group.groupName}, OAU`,
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 24 }, paragraph: { spacing: { line: 360 } } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: FONT }, paragraph: { keepNext: true, keepLines: true, spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: FONT }, paragraph: { keepNext: true, keepLines: true, spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [
    {
      // titlePage: the cover gets its own (empty) footer, so it carries no page number.
      properties: { titlePage: true, page },
      footers: {
        first: new Footer({ children: [new Paragraph({ children: [] })] }),
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 20 })] })] }),
      },
      children: [
        ...titlePage, ...certification, ...acknowledgement, ...abstract, ...contents,
        ...chapter1, ...chapter2, ...chapter3, ...chapter4, ...chapter5,
        ...references, ...appendices,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("wrote", OUT);
});
