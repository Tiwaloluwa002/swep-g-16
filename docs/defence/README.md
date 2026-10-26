# AACNRAS defence report and slides

These scripts generate the SWEP defence documents for [AACNRAS](../../aacnras/README.md):

- `build-report.js` builds the Word report (`AACNRAS Project Report - SWEP Group 15.docx`).
- `build-deck.js` builds the PowerPoint slides (`AACNRAS Defence Slides - SWEP Group 15.pptx`).

Both are written to your Desktop by default.

## Filling in group details

Edit [`group.json`](group.json), then rebuild. Names appear on the report's title page and on the cover slide:

```json
{
  "faculty": "Faculty of ...",
  "supervisor": "Dr ...",
  "defenceDate": "...",
  "members": [
    { "name": "Olatunji Victor Toluwase", "matric": "CSC/2023/155", "department": "Computer Science and Cybersecurity" }
  ]
}
```

Fields left as `""` print as a blank line to fill in by hand.

## Building

```bash
cd docs/defence
npm install
npm run report    # Word report
npm run slides    # PowerPoint slides
```

The slides use theme colours applied by the Claude `pptx` skill's `apply_theme.js`. The script finds it automatically, or you can point `APPLY_THEME` at it. Without it, the slides fall back to Office's default colours.

## Slide checklist (Dr Solanke)

The deck follows Dr Solanke's advice. Check these again after any edit:

- [x] Names on the front page (from `group.json`)
- [x] A short introduction of the work (slide 2)
- [x] Citations: a source line on each slide that uses a fact, plus a References slide
- [x] Mitigation for each limitation (slide 18)
- [x] A short caption on each image and chart
- [x] A thank-you slide at the end
