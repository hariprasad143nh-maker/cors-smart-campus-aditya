# Consistent sorting for every selection list

Goal: everywhere a user or admin picks something, the list is grouped by its related filter first, then sorted alphabetically (case-insensitive, numeric-aware so Room 2 comes before Room 10).

## What changes for users

Wizard (student / parent / visitor flow)
- Branch and department dropdowns: alphabetical.
- Current-location dropdown: campus locations alphabetical (junction nodes stay hidden).
- Destination popup lists:
  - Officers / Dean / HOD / Staff: grouped by department (A-Z, blank department last), then name A-Z.
  - Labs: grouped by department, then lab name A-Z.
  - Clubs: grouped by club type, then club name A-Z.
  - Events: soonest date first, then event name A-Z.
  - Reception / Admission: location name A-Z.
- The destination category chips keep their current fixed order (a menu, not a data list).

Admin editors
- Staff editor: grouped by designation, then department A-Z, then name A-Z; designation stays in rank order, department and location dropdowns alphabetical.
- Labs editor: grouped by department, then name A-Z; department and location dropdowns alphabetical.
- Clubs editor: grouped by type, then name A-Z; location dropdown alphabetical.
- Events editor: date ascending, then name A-Z; venue dropdown alphabetical.
- Departments editor: shown alphabetically and kept sorted when saved.
- Map / point editors: node dropdowns alphabetical.

## Technical notes

- New shared helper `src/lib/sorting.ts`:
  - `byText(a, b)` using `localeCompare(..., { numeric: true, sensitivity: 'base' })`.
  - `sortNames(list)` for plain string lists (nodes, departments).
  - `groupThenSort(items, groupKeyFn, labelFn, groupOrder?)` returning a flat ordered array, blank group keys last, optional explicit group order for fixed enums (designation, club type). Flat return means existing renderers need no restructuring.
- Apply in `src/components/UserFlowWizard.tsx` (the `destOptions` memo plus department and current-location selects), `StaffDataEditor.tsx`, `LabsEditor.tsx`, `ClubsEditor.tsx`, `EventsEditor.tsx`, `DepartmentsEditor.tsx`, and the node selects in `EditorPanel.tsx`.
- `src/lib/departments.ts`: sort on read inside `subscribeDepartments` so every consumer receives an ordered list.
- Presentation-only change: no data model, Firestore schema, speech, or navigation logic is touched.