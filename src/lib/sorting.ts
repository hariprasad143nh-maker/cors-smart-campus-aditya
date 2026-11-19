/** Shared, presentation-only sorting helpers for every selection list in the app. */

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Case-insensitive, numeric-aware string comparison ("Room 2" before "Room 10"). */
export const byText = (a: string, b: string) => collator.compare(a ?? '', b ?? '');

/** Sorted copy of a plain string list (nodes, departments, …). */
export const sortNames = (list: string[]) => [...list].sort(byText);

/**
 * Order items by a group key (its "related filter"), then alphabetically by label.
 * Blank group keys go last. Pass `groupOrder` to keep fixed enums in rank order
 * instead of alphabetical. Returns a flat array so flat renderers keep working.
 */
export function groupThenSort<T>(
  items: T[],
  groupKeyFn: (item: T) => string | undefined | null,
  labelFn: (item: T) => string,
  groupOrder?: readonly string[],
): T[] {
  const rank = (key: string) => {
    if (!key) return Number.MAX_SAFE_INTEGER;
    if (!groupOrder) return 0;
    const i = groupOrder.indexOf(key);
    return i === -1 ? groupOrder.length : i;
  };
  return [...items].sort((a, b) => {
    const ka = (groupKeyFn(a) || '').trim();
    const kb = (groupKeyFn(b) || '').trim();
    const ra = rank(ka);
    const rb = rank(kb);
    if (ra !== rb) return ra - rb;
    if (!groupOrder && ka !== kb) return byText(ka, kb);
    if (groupOrder && ra === groupOrder?.length && ka !== kb) return byText(ka, kb);
    return byText(labelFn(a), labelFn(b));
  });
}

/** Sort by date ascending (invalid/empty dates last), then by label. */
export function sortByDateThenText<T>(
  items: T[],
  dateFn: (item: T) => string | undefined,
  labelFn: (item: T) => string,
): T[] {
  const ts = (v?: string) => {
    const t = v ? new Date(v).getTime() : NaN;
    return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
  };
  return [...items].sort((a, b) => ts(dateFn(a)) - ts(dateFn(b)) || byText(labelFn(a), labelFn(b)));
}