import type { Exercise } from "./types";

export type SupersetRow = { id: string; superset?: boolean };

export type SupersetGroup = {
  /** 1-based group number, in workout order. */
  index: number;
  /** Group letter shown in the session: A, B, C. */
  letter: string;
  /** Exercise ids in the group, in order. */
  ids: string[];
};

export type SupersetInfo = {
  /** Group number per exercise id, or 0 when the movement stands alone. */
  groupOf: Record<string, number>;
  /** Position inside the group, 1-based, for the A1 / A2 label. */
  slotOf: Record<string, number>;
  groups: SupersetGroup[];
};

function groupLetter(index: number) {
  let value = index;
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label || "A";
}

/**
 * Reads superset groups out of a flat list of movements.
 *
 * Consecutive flagged movements form one group. A lone flag also absorbs the
 * movement after it, because files written before the editor existed only
 * marked the first half of a pair. A group with no partner is not a superset,
 * so it falls back to a normal movement.
 */
export function supersetInfo(
  rows: SupersetRow[],
  options: { pairUp?: boolean } = {},
): SupersetInfo {
  const pairUp = options.pairUp ?? true;
  const assigned = new Array<number>(rows.length).fill(0);
  let next = 0;

  for (let index = 0; index < rows.length; index += 1) {
    if (!rows[index].superset || assigned[index]) continue;
    next += 1;
    const group = next;
    assigned[index] = group;

    let cursor = index + 1;
    while (cursor < rows.length && rows[cursor].superset && !assigned[cursor]) {
      assigned[cursor] = group;
      cursor += 1;
    }

    // Legacy pair: only the first movement was flagged.
    if (
      pairUp &&
      cursor === index + 1 &&
      cursor < rows.length &&
      !rows[cursor].superset &&
      !assigned[cursor]
    ) {
      assigned[cursor] = group;
    }
  }

  const sizes = new Map<number, number>();
  for (const group of assigned) if (group) sizes.set(group, (sizes.get(group) ?? 0) + 1);

  const groupOf: Record<string, number> = {};
  const slotOf: Record<string, number> = {};
  const groups: SupersetGroup[] = [];
  const slots = new Map<number, number>();

  rows.forEach((row, index) => {
    const group = assigned[index];
    if (!group || (sizes.get(group) ?? 0) < 2) {
      groupOf[row.id] = 0;
      slotOf[row.id] = 0;
      return;
    }

    const slot = (slots.get(group) ?? 0) + 1;
    slots.set(group, slot);
    groupOf[row.id] = group;
    slotOf[row.id] = slot;

    const entry = groups.find((item) => item.index === group);
    if (entry) entry.ids.push(row.id);
    else groups.push({ index: group, letter: groupLetter(group), ids: [row.id] });
  });

  return { groupOf, slotOf, groups };
}

/** Clears flags that do not belong to a real pair, so saved data stays clean. */
export function normalizeSupersetFlags<T extends SupersetRow>(
  rows: T[],
  options: { pairUp?: boolean } = {},
): T[] {
  const { groupOf } = supersetInfo(rows, options);
  return rows.map((row) => ({ ...row, superset: (groupOf[row.id] ?? 0) > 0 }) as T);
}

/** "A2" for a movement inside a group, or null when it stands alone. */
export function supersetLabel(info: SupersetInfo, id: string) {
  const group = info.groupOf[id] ?? 0;
  if (!group) return null;
  const letter = info.groups.find((item) => item.index === group)?.letter ?? "";
  return `${letter}${info.slotOf[id] ?? 1}`;
}

export function supersetCount(exercises: Exercise[]) {
  return supersetInfo(exercises).groups.length;
}
