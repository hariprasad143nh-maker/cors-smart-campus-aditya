# Replace an active navigation route

## What will change
- Keep the navigation controls usable while guidance is active, so the user can choose another start point or destination.
- Change the action to clearly indicate that it will replace the current route when navigation is already running.
- When the user starts the newly selected route, immediately stop the previous voice command, GPS route follower, route animation, rerouting work, and on-screen instruction.
- Start the selected route as a fresh navigation session and update the path, destination marker, spoken guidance, and on-screen command together.
- Prevent delayed arrival, rerouting, or walkthrough callbacks from the old route from stopping or overwriting the new route.

## Technical details
- Centralize active-navigation cancellation and use the existing navigation token to invalidate all previous asynchronous work.
- Guard delayed reroute and arrival callbacks with the route token, not only the fallback walkthrough loop.
- Allow the navigation-panel action during an active route while still requiring valid, different start and destination selections.
- Preserve automatic GPS junction starts, hidden junctions in manual lists, voice settings, and current route calculation behavior.
- Verify route A can be replaced by route B on mobile and desktop, with only route B continuing to speak and update on screen.
