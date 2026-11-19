# Livability story + city map

Open `index.html` through VS Code Live Server (do not use file://). Requires an internet connection for the CDN scripts, state outlines, and optional city coordinate lookup.

## Structure
- `index.html`: introductory section, three-step Scrollama story, and final interactive map section outside the story.
- `main.js`: Scrollama + placeholder story SVG (unchanged from original starter).
- `map.js`: working city explorer logic copied from the successful hover/zoom-fixed version.
- `style.css`: original story styling.
- `map.css`: styles scoped to the final map, avoiding global CSS collisions.
- `city_metrics.csv`: the 1,307 merged city/state records with temperatures.

## Test
1. Scroll through the three metric sections and check the sticky graphic updates.
2. Scroll *past* the story to the final explorer: it should scroll normally, not stick.
3. Check multiple toggles, hover tooltip, zoom, pan, and reset.
4. Hover city dots after zooming: the map uses transform-aware pointer hit testing.

## Notes
The sticky story graphic is intentionally a D3 placeholder, not the final city map. The explorer currently uses an online location lookup with a 30-city fallback, so it may map fewer than 1,307 cities. The footer reports actual count. The data only includes cities from the merged input. No sliders or rankings have been added yet.
