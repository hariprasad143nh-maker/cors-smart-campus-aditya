# On-screen turn-by-turn navigation

## What will change
- Add a prominent navigation instruction panel over the map while a route is active.
- Keep the displayed instruction synchronized with GPS progress: starting direction, approaching turn with distance, turn-now command, rerouting, and arrival.
- Show the next destination or waypoint and remaining route distance beneath the main command.
- Use clear direction icons and a compact mobile layout that stays above the existing map controls and bottom bar.
- Preserve the current spoken guidance, Telugu behavior, route drawing, GPS snapping, and admin tools.

## Technical details
- Store the current visual instruction as navigation state in the map page and update it from the existing follower callbacks.
- Calculate remaining distance from the current segment progress using real GPS coordinates when available, with mapped-distance fallback.
- Add translated labels for remaining distance and navigation statuses in English, Telugu, and Hindi.
- Clear or replace stale instructions whenever navigation restarts, reroutes, finishes, or is cancelled.
- Verify the banner and route state on phone-sized and desktop views, and run the existing navigation checks.
