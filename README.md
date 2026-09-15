# Color Lab

A color-mixing web app for a five-year-old. Pick two or three paints, watch them mix,
and hear the result read aloud.

**Live app:** https://nathangraves814.github.io/color-lab/

## What it does

- 24 paints. Mix two, or add a third.
- Results come from a real subtractive paint model, not RGB averaging, so blue and
  yellow make green and the three primaries make brown.
- Every result is named and spoken out loud, so a child who cannot read yet can still
  use the whole app on their own.
- Colors I Found saves every mix discovered. Missions give nine target colors to chase.
- Works offline once loaded, and installs to the iPad home screen as a full-screen app.

## How the mixing works

Each paint is stored as a pigment recipe: an RYB chroma vector plus separate white
(tint) and black (shade) amounts. Mixing averages the recipes, rescales the chroma so
the hue stays as strong as the paints that went in, converts RYB to RGB by trilinear
blending between eight tuned cube corners, then applies the tint and shade.

Result names come from a list of 79 colors. The nearest one is found by CIELAB
distance, with names a young child already knows weighted to win ties.

## Adding it to an iPad

Open the link in Safari, tap Share, then Add to Home Screen.

## Running it locally

Any static file server works:

    python3 -m http.server 8000
