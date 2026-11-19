# Admin road GPS collection

## Goal
Let an admin select a road, collect its real latitude/longitude path while walking, manually add or correct points, and use that full road shape for map display and route distance.

## Admin workflow
1. In **Admin → Map**, add a **Roads** section listing every connected pair of nodes.
2. Selecting a road highlights it and opens its saved GPS points.
3. Provide two collection methods:
   - **Record while walking**: request location access, show live accuracy and recorded-point count, then provide Start, Pause/Resume, Stop, and Discard controls.
   - **Manual editing**: add a latitude/longitude pair, paste map coordinates in decimal or DMS format, reorder points, edit a point, or delete it.
4. After recording, show the proposed road line on the map before it replaces the saved shape. The admin can save or discard it.
5. Show clear warnings for denied GPS access, weak accuracy, too few points, duplicate points, and a recording whose endpoints are far from the selected road’s nodes.
6. Keep the existing **Save** action as the final persistence step so accidental edits are not published immediately.

## Route and map behavior
- Draw roads as polylines through their saved GPS points instead of straight endpoint lines.
- Calculate each road’s distance by summing all GPS segments along that polyline.
- Make active navigation follow the curved road and progressively hide the travelled portion of that curve.
- Use the same geometry for off-route checks, progress, remaining distance, and turn guidance.
- Fall back to the existing straight endpoint route when a road has no recorded geometry.
- Keep junctions hidden from manual visitor searches and lists; this feature changes only admin road editing and route geometry.

## Data compatibility
- Extend each connection with optional ordered road points while preserving its start node, end node, and difficulty multiplier.
- Automatically normalize existing saved tuple connections when loading, so current map data continues working without manual conversion.
- Save the upgraded connection data through the existing local and Firebase map save flow.
- Do not introduce a new backend or require data re-entry.

## Technical details
- Add a typed road-point model containing latitude, longitude, optional accuracy, and derived map coordinates.
- Reuse the current coordinate parsing and geolocation capabilities, extracting shared helpers where needed.
- Convert collected GPS points to map coordinates using the existing calibrated latitude/longitude mapping; prevent recording until enough calibrated node anchors exist.
- Filter noisy recordings by ignoring points with unacceptable accuracy, negligible movement, or implausible jumps; preserve the original coordinates for distance calculations.
- Update all connection consumers to use named connection fields rather than tuple positions, including map drawing, routing, deletion, renaming, GPS progress, statistics, and admin editing.
- Add focused tests for legacy-data conversion, polyline distance, curved-route selection, geometry reversal, and straight-line fallback.

## Verification
- Test manual add/edit/delete/reorder on desktop and mobile admin views.
- Test a simulated walking recording with permission granted, denied, paused, resumed, stopped, discarded, and saved.
- Verify an old saved map loads unchanged and gains geometry only when an admin records it.
- Verify the displayed route follows curves, travelled road disappears correctly, and shortest-route selection uses measured road length.
- Run routing tests, type checks, and a mobile viewport check without horizontal overflow.
