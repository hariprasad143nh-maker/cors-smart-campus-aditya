# Mobile usability improvements

## What will change
- Make screens use the full phone height correctly, including browser and safe-area space.
- Tighten the top bars and content spacing so key controls stay visible on smaller phones.
- Make popups and bottom panels fit within the screen and scroll cleanly.
- Keep search fields, selectors, and main actions at comfortable touch sizes.
- Improve the map controls and bottom navigation so they do not overlap.
- Verify the main selection flow and map view at common phone sizes.

## Technical details
- Add shared mobile viewport, overflow, safe-area, and touch-target rules.
- Refine mobile-only classes in the user flow, map page, navigation panel, dialogs, and sheets.
- Preserve desktop layouts and all existing navigation/GPS behavior.
