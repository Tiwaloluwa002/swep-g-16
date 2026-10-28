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
const shot = (name, text) => figure(path.join(SHOTS, name), 470, 294, text);

// ---------- content ----------
// Sections start on a new page only where a break helps the reader; short ones run on.
const S = (text, newPage = true) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: newPage, children: [new TextRun(text)] });
const LINE = "________________________";

const memberRows = group.hasMembers
  ? group.members.map((m, i) => [String(i + 1), m.name, m.matric, m.department])
  : [1, 2, 3, 4, 5].map((n) => [String(n), "", "", ""]);

const titlePage = [
  new Paragraph({ spacing: { before: 400 } }),
  center("**ACCESSIBILITY-AWARE CAMPUS NAVIGATION AND ROUTE ADVISORY SYSTEM (AACNRAS)**", { run: { size: 32 } }),
  new Paragraph({ spacing: { after: 200 } }),
  center("A report submitted in fulfilment of the requirements of the Students’ Work Experience Programme (SWEP)"),
  new Paragraph({ spacing: { after: 200 } }),
  center(`**${group.groupName}**`, { run: { size: 28 } }),
  table(["S/N", "Name", "Matriculation number", "Department"], memberRows, [7, 38, 25, 30]),
  new Paragraph({ spacing: { after: 240 } }),
  ...(group.faculty ? [center(group.faculty)] : []),
  center(group.university),
  center(`Source code: ${group.repoUrl}`),
  new Paragraph({ spacing: { after: 240 } }),
  center(`Supervisor: ${group.supervisor || BLANK}`),
  center(`Date: ${group.defenceDate || BLANK}`),
];

const contents = [
  S("Table of Contents"),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  P("*If the table above is empty, right-click it in Word and choose Update Field.*"),
];

const s1 = [
  S("1. Introduction"),
  P("AACNRAS is a web app that plans walking routes across the Obafemi Awolowo University (OAU) campus for the way each person moves. A wheelchair user gets a route with no steps and no slope steeper than 1:12. A student on crutches is kept off long climbs. A visually impaired student is kept away from busy roads. Every route comes with turn-by-turn directions, warnings about what lies ahead, and details about the destination building."),
  P("About 1.3 billion people, 16% of the world, live with a significant disability (WHO, 2022), and Nigeria’s Discrimination Against Persons with Disabilities (Prohibition) Act 2018 requires public buildings to be accessible. OAU’s campus is large and hilly, and ordinary map apps send everyone the same way."),
  H2("1.1 Aim"),
  P("To design and build a web app that gives accessible routes and route advice across the OAU campus."),
  H2("1.2 Objectives"),
  ...numbered([
    "Model the campus paths as a network with slope, steps, surface, lighting and kerbs.",
    "Define four travel profiles, each with its own rules.",
    "Find the best route for each profile with the A* search algorithm.",
    "Turn routes into clear directions, warnings and route statistics.",
    "Show accessibility details for campus buildings.",
    "Let anyone report obstacles, and let an admin verify them so routes avoid them.",
    "Make the app itself accessible: high contrast, large text, read-aloud and keyboard use.",
  ]),
];

const s2 = [
  S("2. The Problem and the App’s Implications for the Campus"),
  H2("2.1 The problem"),
  ...bullets([
    "**A wheelchair user** is sent to a 51-step staircase on the usual route from Moremi Hall to the Senate Building.",
    "**A student on crutches** is sent up the steepest hill, because it is the shortest path.",
    "**A visually impaired student** is sent along busy roads with no dropped kerbs or tactile paving.",
    "**Nobody** can easily find out which buildings have ramps, lifts or accessible toilets, or whether a path is flooded today.",
  ]),
  H2("2.2 Implications for the campus"),
  table(
    ["Area", "What changes with AACNRAS"],
    [
      ["Students and staff with disabilities", "Safer, more independent movement; less need to ask for help or take risky routes"],
      ["Temporary injuries and fatigue", "Anyone on crutches or recovering from illness gets gentle routes with no stairs"],
      ["Safety after dark", "After-dark mode prefers lit paths, which helps every student walking at night"],
      ["Visitors and new students", "Clear directions to 79 places, including halls, banks and the Health Centre"],
      ["Campus maintenance", "Obstacle reports show where paths flood or ramps break, so Works can fix them sooner"],
      ["Campus planning", "The app already points to six places that may be unreachable by wheelchair, a ready list for new ramps"],
      ["Legal duty", "Supports the university’s duty under the 2018 Disability Act with evidence of where access is missing"],
    ],
    [32, 68],
  ),
  caption("Table 2.1: Implications of AACNRAS for the OAU campus"),
  P("**Things to manage.** Routes are only as good as the data, so the paths and buildings must be surveyed and kept up to date. The app does not track anyone: it needs no account and does not record a user’s location."),
];

const s3 = [
  S("3. Distinct Features and Specifications"),
  H2("3.1 Distinct features"),
  ...bullets([
    "**Four travel profiles:** standard walking, wheelchair user, visually impaired and limited mobility.",
    "**Accessible route finding:** the best route for the person, not just the shortest.",
    "**Warnings at each step:** steps, slopes, rough ground, missing kerbs, unlit paths and reported obstacles.",
    "**Route details:** an elevation chart, total climb, steepest part, surfaces, lighting and landmarks.",
    "**Building details:** step-free entrance, ramp, lift, toilet, opening hours and nearby places.",
    "**Obstacle reports:** anyone reports; an admin verifies; routes then avoid the path.",
    "**After-dark mode** that prefers lit paths.",
    "**Accessible design:** high contrast, three text sizes, read-aloud, keyboard and screen-reader support.",
  ]),
  H2("3.2 Specifications"),
  table(
    ["Item", "Specification"],
    [
      ["Type", "Web app; works in any modern browser on phones and computers"],
      ["Coverage", "Main OAU campus, Ile-Ife: 79 places, 471 junctions, 577 path segments (78.6 km)"],
      ["Travel profiles", "4 (standard, wheelchair, visually impaired, limited mobility)"],
      ["Route search", "A* algorithm; about 0.1 ms per route, computed in the browser"],
      ["Map data", "OpenStreetMap; slopes from the Copernicus 90 m terrain model"],
      ["Storage", "PostgreSQL (Supabase in production) for obstacle reports"],
      ["Accessibility", "Follows WCAG 2.2 practices; Atkinson Hyperlegible typeface"],
      ["Admin access", "Passcode-protected dashboard at /admin"],
      ["Automated tests", "29, all passing"],
    ],
    [28, 72],
  ),
  caption("Table 3.1: AACNRAS specifications"),
];

const s4 = [
  S("4. Comparison with Existing Tools", false),
  P("Some tools solve part of this problem elsewhere. None covers the OAU campus with routes, building details and obstacle reports together."),
  table(
    ["Feature", "Google Maps", "Wheelmap", "AccessMap", "AACNRAS"],
    [
      ["Routes by mobility need", "Transit only", "No", "Yes", "Yes, 4 profiles"],
      ["Knows slopes and steps", "No", "No", "Yes", "Yes"],
      ["Building accessibility", "Some places", "Yes (ratings)", "No", "Yes"],
      ["Obstacle reports", "No", "No", "No", "Yes, verified"],
      ["Covers OAU paths", "Roads only", "A few places", "No (Seattle)", "Yes"],
      ["Free and open data", "No", "Yes", "Yes", "Yes"],
    ],
    [28, 18, 18, 18, 18],
  ),
  caption("Table 4.1: AACNRAS compared with existing tools (Bolten et al., 2017; Wheelmap.org; Neis and Zielstra, 2014)"),
];

const s5 = [
  S("5. Tools and Technology Stack"),
  table(
    ["Tool", "What we used it for"],
    [
      ["Next.js 16 and React 19", "The web app: pages, the route planner and the admin dashboard"],
      ["TypeScript", "The programming language, with type checks that catch mistakes early"],
      ["Tailwind CSS 4", "Styling, including high-contrast mode and text sizes"],
      ["Leaflet", "The interactive campus map"],
      ["OpenStreetMap and Overpass API", "Campus paths, steps and building positions"],
      ["Open-Meteo Elevation API", "Terrain heights, used to estimate slopes"],
      ["PostgreSQL (Supabase)", "Stores obstacle reports in production"],
      ["PGlite", "Postgres inside Node.js, for local use and tests with no server"],
      ["Vitest", "Automated tests"],
      ["ESLint", "Checks code quality"],
      ["Git and GitHub", "Version control and sharing the code"],
      ["Vercel", "Hosting the app online"],
    ],
    [32, 68],
  ),
  caption("Table 5.1: Tools and technology used"),
  P("**Tools needed to run it:** a computer with Node.js 22 or newer, npm (comes with Node.js), Git, and a web browser. For deployment: a Supabase account (free) and a Vercel account (free)."),
];

const s6 = [
  S("6. System Architecture", false),
  ...figure(path.join(ASSETS, "architecture.png"), 560, 412, "Figure 6.1: System architecture"),
  ...bullets([
    "**Data preparation:** an import script downloads paths and places from OpenStreetMap and terrain heights from Open-Meteo, and saves them as campus data files.",
    "**In the browser:** the app loads the campus data and computes routes on the user’s own device, so routes appear instantly.",
    "**On the server:** only obstacle reports and admin actions go to the server, which saves them in the PostgreSQL database.",
  ]),
];

const s7 = [
  S("7. How the Routing Works"),
  P("The campus is stored as a network: junctions joined by path segments. Each segment records its length, slope, steps, surface, lighting and kerbs. Each travel profile gives every segment a **cost**:"),
  ...bullets([
    "Some segments are **ruled out**, such as steps for wheelchair users, or slopes above a profile’s limit.",
    "Others cost **more** when they are steep, rough, unlit or on a busy road.",
    "The A* search algorithm (Hart, Nilsson and Raphael, 1968) then finds the route with the lowest total cost.",
  ]),
  table(
    ["Profile", "Speed", "Steps", "Max slope", "Prefers"],
    [
      ["Standard walking", "4.7 km/h", "Allowed", "Any", "Fastest route"],
      ["Wheelchair user", "3.2 km/h", "Never", "8% (1:12)", "Smooth paved paths, dropped kerbs"],
      ["Visually impaired", "3.6 km/h", "Avoided", "Any", "Tactile paving, away from busy roads"],
      ["Limited mobility", "2.5 km/h", "Strongly avoided", "10%", "Gentle slopes, smooth ground"],
    ],
    [22, 12, 17, 13, 36],
  ),
  caption("Table 7.1: Travel profiles. The 8% limit follows the 1:12 ramp rule in the 2010 ADA Standards."),
];

const s8 = [
  S("8. How to Use the App"),
  H2("8.1 Plan a route"),
  ...numbered([
    "Open the app. Under **How are you travelling?**, choose your profile.",
    "Choose **From** and **To**, or tap a building on the map and press **Start here** or **Go here**.",
    "Tick **Travelling after dark** if you want lit paths.",
  ]),
  ...shot("route-planner.png", "Figure 8.1: The route planner. The route is drawn in blue; dotted blue marks a stretch not yet mapped."),
  H2("8.2 Read the directions and route details"),
  P("Each step shows its warnings. **Route details** show the elevation chart, climb, steepest part, surfaces, lighting and landmarks. Press **Read directions aloud** to hear them."),
  ...shot("route-details.png", "Figure 8.2: Directions with warnings, and the route details with the elevation chart."),
  H2("8.3 Look up a building"),
  P("The card below the directions describes the destination: its accessibility features, any reported problems, nearby places and links to Google Maps and OpenStreetMap. Tap any building on the map and press **Details** to see its card."),
  ...shot("building-details.png", "Figure 8.3: The building card for the library, with an unverified flooding report."),
  H2("8.4 Report an obstacle"),
  P("Press **Report an obstacle**, choose a path (by nearest building or the exact spot on the map) or a building, pick the problem, and press **Send report**."),
  ...shot("report-obstacle.png", "Figure 8.4: The obstacle report form."),
  H2("8.5 Review reports (admin)"),
  P("Go to `/admin` and enter the passcode. Press **Verify**, **Reject** or **Mark resolved** on each report. A verified blocked path is removed from routing until it is resolved."),
  ...shot("admin-dashboard.png", "Figure 8.5: The admin dashboard with two reports awaiting review."),
  H2("8.6 Change display settings"),
  P("Press **Display & voice** to choose a text size, turn on high contrast, or have directions read aloud automatically."),
  ...shot("wheelchair-high-contrast.png", "Figure 8.6: High-contrast mode with large text and the wheelchair profile."),
];

const s9 = [
  S("9. App Life Cycle"),
  H2("9.1 Development life cycle"),
  P("We built AACNRAS in short steps, testing each one before the next. The full history is in the repository."),
  table(
    ["Stage", "Date (2026)", "What we did"],
    [
      ["1. Planning", "22 Oct", "Chose the project in the group poll; set the aim and objectives"],
      ["2. Design", "22 Oct", "Designed the campus network, the travel profiles and the cost rules"],
      ["3. Build: routing", "22 Oct", "Built the A* routing engine and the directions, with tests"],
      ["4. Build: real data", "23 Oct", "Imported OAU paths, places and slopes from OpenStreetMap"],
      ["5. Build: interface", "23 Oct", "Built the route planner, map, building cards, reports and admin"],
      ["6. Testing and fixing", "23 Oct", "Tested on laptops and phones; fixed 4 layout faults"],
      ["7. Documentation", "23–26 Oct", "Wrote the README, this report and the slides"],
      ["8. Production readiness", "27 Oct", "Moved report storage to PostgreSQL for online hosting"],
      ["9. Deployment", "Next", "Host on Vercel with a Supabase database"],
      ["10. Maintenance", "Ongoing", "On-site survey, data updates, new features"],
    ],
    [24, 16, 60],
  ),
  caption("Table 9.1: Development life cycle"),
  H2("9.2 Life of a route request"),
  P("The user picks a profile and two places → the browser finds the best route with A* → it builds the directions and route details → the map draws the route. No server is involved, so it works the same for one user or many."),
  H2("9.3 Life of an obstacle report"),
  P("Sent by any user → **Awaiting review** (shown as a warning on routes) → an admin marks it **Verified** (routes avoid the path), **Rejected** (hidden) or **Resolved** (hidden, path usable again)."),
];

const s10 = [
  S("10. What the System Can Handle", false),
  table(
    ["Measure", "Value"],
    [
      ["Places users can route between", "79"],
      ["Campus paths in the network", "577 segments, 78.6 km"],
      ["Place-to-place trips tested", "6,162 for each of the 4 profiles"],
      ["Time to compute one route", "About 0.1 ms"],
      ["Server work per route", "None: routes are computed on the user’s device"],
      ["Server work per report", "One small database row"],
      ["Devices", "Phones, tablets and computers with a modern browser"],
      ["Report description", "Up to 500 characters"],
    ],
    [45, 55],
  ),
  caption("Table 10.1: Capacity of the system"),
  P("Because routing runs in each user’s browser, more users do not slow the server down. The main limit is the hosting plan’s database and bandwidth, which free tiers cover for a campus pilot. The map needs an internet connection to load."),
];

const s11 = [
  S("11. Tests Done and Results"),
  H2("11.1 Automated tests"),
  table(
    ["Area", "Tests", "What they check"],
    [
      ["Routing", "15", "No steps or steep slopes for wheelchairs; blocked paths avoided; after-dark mode; verified vs pending reports; real OAU data connected"],
      ["Route details", "5", "Elevation profile, climb and descent, steps, surfaces, steepest part, landmarks"],
      ["Places", "5", "Grouping, nearby places, opening hours, links, unique IDs"],
      ["Report storage", "4", "Saving, listing and updating reports in PostgreSQL; rejecting bad input"],
    ],
    [20, 10, 70],
  ),
  caption("Table 11.1: Automated tests (29 in total, all passing)"),
  P("Type checking, code linting and a production build also pass. The app was tested by hand on laptops and phones."),
  H2("11.2 Results"),
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
  caption("Table 11.2: Trips with a route, by profile"),
  P("**Key finding:** six places appear unreachable by wheelchair: Akingbade Health Bay, the Chemical Engineering Laboratory and Lecture Theatre, the Faculty of Estate Design and Management, Kufoniyi and the AFRIGIST New Admin Block. Every mapped road into them is estimated at 9% to 12% slope, above the 8% limit."),
  P("**Example:** from Moremi Hall to the Senate Building, the standard route is 1,127 m with a 51-step staircase; the wheelchair route is 1,235 m with no steps."),
];

const s12 = [
  S("12. Errors Found and Fixes"),
  table(
    ["Problem", "Cause", "Fix"],
    [
      ["Buildings drawn in the wrong places", "The first version used estimated positions", "Imported real building positions from OpenStreetMap"],
      ["Slopes of up to 54% on gentle roads", "The terrain model is too coarse for short paths", "Measure slopes over at least 90 m"],
      ["Map shrank to zero height on phones", "A layout rule overrode the map’s height", "Fixed map height on small screens"],
      ["Page wider than phone screens", "Long building names stretched the pickers", "Pickers limited to the screen width"],
      ["Blank space under the page on desktop", "Hidden screen-reader labels were placed against the whole page", "Pinned the layout to the screen and contained the labels"],
      ["Route line turned grey in high contrast", "The grey filter covered the whole map", "Grey filter applied to the base map only"],
      ["Reports would be lost on online hosts", "Reports were saved in a local file", "Moved reports to a PostgreSQL database"],
      ["Demo admin passcode could work online", "A default passcode was built in", "A passcode must now be set in production"],
    ],
    [30, 35, 35],
  ),
  caption("Table 12.1: Errors found during testing and how we fixed them. Each fix is a commit in the repository."),
];

const s13 = [
  S("13. Installation and Deployment Guide"),
  H2("13.1 Run it on your computer"),
  ...numbered([
    "Install Node.js 22 or newer and Git.",
    `Download the code: \`git clone ${group.repoUrl}\``,
    "Open the app folder: `cd swep-g-15/aacnras`",
    "Install the packages: `npm install`",
    "Start the app: `npm run dev`, then open http://localhost:3000",
    "Run the tests: `npm test`",
  ]),
  P("No database is needed locally: the app stores reports in a built-in database (PGlite) in its `data` folder."),
  H2("13.2 Put it online"),
  ...numbered([
    "Create a free Supabase project. In **Project Settings → Database → Connection string**, copy the **Transaction pooler** link and add your password.",
    "Create a Vercel project from the GitHub repository, with **Root Directory** set to `aacnras`.",
    "In Vercel, add the settings below, then deploy.",
  ]),
  table(
    ["Setting", "Value"],
    [
      ["DATABASE_URL", "The Supabase connection link (required)"],
      ["ADMIN_PASSCODE", "A long passcode for the admin page (required)"],
      ["DATABASE_SCHEMA", "Optional; defaults to aacnras"],
    ],
    [35, 65],
  ),
  caption("Table 13.1: Production settings"),
  P("The app creates its database tables by itself the first time it runs."),
];

const s14 = [
  S("14. Implemented and Open Features"),
  table(
    ["Feature", "Status"],
    [
      ["Four travel profiles and A* routing", "Implemented"],
      ["Directions, warnings and read-aloud", "Implemented"],
      ["Route details and elevation chart", "Implemented"],
      ["79 places with building details", "Implemented"],
      ["Obstacle reports and admin review", "Implemented"],
      ["High contrast, text sizes, keyboard support", "Implemented"],
      ["PostgreSQL storage for online hosting", "Implemented"],
      ["Building accessibility data (ramps, lifts, toilets)", "Open: needs the on-site survey"],
      ["Measured slopes for the six cut-off places", "Open: needs the on-site survey"],
      ["Missing footpaths near some buildings", "Open: to be mapped in OpenStreetMap"],
      ["Start from the phone’s GPS location", "Open"],
      ["Live spoken guidance while walking", "Open"],
      ["Different costs for uphill and downhill", "Open"],
      ["Offline map", "Open"],
      ["Yoruba language", "Open"],
      ["Individual admin accounts", "Open"],
      ["Photos of entrances and ramps", "Open"],
    ],
    [65, 35],
  ),
  caption("Table 14.1: Implemented features and open improvements"),
];

const s15 = [
  S("15. Conclusion"),
  P("AACNRAS shows that a free, open-data web app can give OAU students routes that fit how they move. All seven objectives were met. The app also produced a useful finding: six places that may need ramps or other access."),
  H2("15.1 Limitations and mitigation"),
  table(
    ["Limitation", "Mitigation"],
    [
      ["Building accessibility not yet surveyed", "The app shows “not surveyed” instead of guessing; our survey fills it in"],
      ["Slopes are estimates from a 90 m grid", "Measure slopes on site, starting with the six cut-off places"],
      ["Some footpaths missing near buildings", "Directions flag unmapped stretches; we map the paths in OpenStreetMap"],
      ["Obstacle reports could be false", "Reports only change routes after an admin verifies them"],
      ["Routes start at buildings, not GPS", "Add GPS start points in the next version"],
    ],
    [45, 55],
  ),
  caption("Table 15.1: Limitations and how each is mitigated"),
  H2("15.2 Recommendations"),
  ...numbered([
    "Complete the on-site survey, starting with the six places cut off for wheelchair users.",
    "Share the findings with the university’s Physical Planning and Works departments.",
    "Deploy the app for a campus pilot and gather feedback from students with disabilities.",
  ]),
];

const s16 = [
  S("16. Project Links and Group Members"),
  P(`**Source code and documentation:** ${group.repoUrl}`),
  P("The repository contains the full code, the installation and deployment guide, the list of tests, and the history of every change and fix."),
  table(
    ["S/N", "Name", "Matriculation number", "Department", "LinkedIn"],
    group.hasMembers
      ? group.members.map((m, i) => [String(i + 1), m.name, m.matric, m.department, m.linkedin || LINE])
      : [1, 2, 3, 4, 5].map((n) => [String(n), "", "", "", LINE]),
    [6, 28, 20, 26, 20],
  ),
  caption("Table 16.1: Group members"),
];

const references = [
  S("References"),
  ...[
    "Bolten, N., Mukherjee, S., Sipeeva, V., Tanweer, A., & Caspi, A. (2017). A pedestrian-centered data approach for equitable access to urban infrastructure environments. *IBM Journal of Research and Development, 61*(6).",
    "Braille Institute. (2019). *Atkinson Hyperlegible typeface*. https://www.brailleinstitute.org/freefont/",
    "European Space Agency. *Copernicus Digital Elevation Model, GLO-90*. https://spacedata.copernicus.eu",
    "Federal Republic of Nigeria. (2018). *Discrimination Against Persons with Disabilities (Prohibition) Act*.",
    "Hart, P. E., Nilsson, N. J., & Raphael, B. (1968). A formal basis for the heuristic determination of minimum cost paths. *IEEE Transactions on Systems Science and Cybernetics, 4*(2), 100–107.",
    "Neis, P., & Zielstra, D. (2014). Generation of a tailored routing network for disabled people based on collaboratively collected geodata. *Applied Geography, 47*, 70–77.",
    "OpenStreetMap contributors. (2026). *OpenStreetMap* [Data set, retrieved 22 October 2026]. https://www.openstreetmap.org/copyright",
    "Sozialhelden e.V. *Wheelmap.org*. https://wheelmap.org",
    "U.S. Department of Justice. (2010). *2010 ADA Standards for Accessible Design*.",
    "World Health Organization. (2022). *Global report on health equity for persons with disabilities*. Geneva: WHO.",
    "World Wide Web Consortium. (2023). *Web Content Accessibility Guidelines (WCAG) 2.2*. https://www.w3.org/TR/WCAG22/",
  ].map((r) => new Paragraph({ children: runs(r), spacing: { after: 160 }, indent: { left: 720, hanging: 720 } })),
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
        run: { size: 32, bold: true, font: FONT }, paragraph: { keepNext: true, keepLines: true, spacing: { before: 360, after: 240 }, outlineLevel: 0 } },
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
        ...titlePage, ...contents,
        ...s1, ...s2, ...s3, ...s4, ...s5, ...s6, ...s7, ...s8, ...s9, ...s10, ...s11, ...s12, ...s13, ...s14, ...s15, ...s16,
        ...references,
      ],
    },
  ],
});

// Writes the Word file, then a PDF beside it when LibreOffice is installed.
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("wrote", OUT);
  const soffice = "/Applications/LibreOffice.app/Contents/MacOS/soffice";
  if (!fs.existsSync(soffice)) return console.warn("LibreOffice not found: skipping the PDF.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lo-"));
  require("child_process").execFileSync(soffice, ["--headless", `-env:UserInstallation=file://${profile}`, "--convert-to", "pdf", "--outdir", path.dirname(OUT), OUT], { stdio: "ignore" });
  console.log("wrote", OUT.replace(/\.docx$/, ".pdf"));
});
