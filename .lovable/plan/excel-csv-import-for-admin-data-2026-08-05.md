# Excel / CSV import for admin data

Yes — this is possible. Admins will be able to bulk-add records from an Excel (.xlsx) or CSV file instead of typing each one.

## What you get

Each admin editor (Staff/Officers, Labs, Clubs, Events) gets two new buttons at the top:

- **Download template** — a ready-made Excel file with the correct column headers, one example row, and a dropdown-friendly layout so columns always match.
- **Import from Excel** — pick a file, see a preview of what was read, then choose:
  - **Add on top** — keep existing records, append new rows, and update any existing record whose name matches a row in the file with that row's new details
  - **Replace all** — clear that section and load only the file's rows

Before anything is saved you see a summary: how many rows are valid, how many were skipped, and why (missing name, unknown department, unknown location, bad date). Only valid rows get imported; you can cancel.

## Columns per data type

```text
Staff:  Name | Designation | Department | Phone | Email | Location | Room | Floor
Labs:   Name | Department | Location | Room | Floor
Clubs:  Name | Type | Location | Room | Floor | Coordinator Name | Coordinator Phone
Events: Name | Date (YYYY-MM-DD) | Venue | Room | Floor | For Students | For Others
```

Rules applied while importing:
- Designation must be one of Officers / Dean / HOD / Professor / Vice Principal / Dignitary / Other (case-insensitive).
- Department is matched against your live departments list; unknown names are reported, with an option to add them as new departments in the same step.
- Location / Venue is matched against existing map nodes, both by raw node id and by the friendly display name (e.g. "Main Gate" → `main_gate`). Unmatched rows are skipped and listed.
- Dates accept Excel date cells and YYYY-MM-DD text. Past-dated events still auto-expire as they do today.
- Yes/No columns accept yes/no, true/false, 1/0.

## Technical notes

- Add `xlsx` (SheetJS) as a dependency; parsing and template generation happen fully in the browser, no backend needed.
- New `src/lib/excel-import.ts`: `readSheet(file)` → rows, plus per-type row mappers and validators returning `{ valid, skipped[] }`, and `buildTemplate(type)` for the download.
- New `src/components/ImportDataDialog.tsx`: shared dialog (file picker → preview table → Add on top / Replace all / Cancel). Takes the target type, current records, map node list, and departments; returns the merged array.
- Each editor (`StaffDataEditor`, `LabsEditor`, `ClubsEditor`, `EventsEditor`) gets an import/template button row and calls its existing `onUpdate(...)` with the merged list, so the current Firestore save paths (`saveAllStaffToFirebase`, `saveAllLabs`, `saveAllClubs`, `saveAllEvents`) are reused unchanged.
- Ids are generated with the existing `generateId` / `generateStaffId` helpers; imported rows are sorted with the existing `src/lib/sorting.ts` helpers so lists stay grouped and alphabetical.
- Guardrails: 2 MB / 2000-row cap per file, string fields trimmed and length-capped, floors coerced to integers.