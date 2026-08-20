// PRD §3.4 / Reference Data §4 — static (Room, Property) -> Room Type lookup.
// 260 unique pairs, ported verbatim from the reference doc (2 exact-duplicate
// source rows already removed there). LP included for historical joins only
// (§3.3 — LP itself excluded from current/future property filters elsewhere).

export interface RoomTypeEntry {
  property: string;
  room: string;
  roomType: string;
}

const KDP: [string, string][] = [
  ["101 old-Premier King Supreme", "Executive Room"],
  ["101-Premier Twin Supreme", "Executive Room"],
  ["102-Premier King Supreme", "Executive Room"],
  ["103-Premier King Supreme", "Executive Room"],
  ["104-Premier King Supreme", "Executive Room"],
  ["105-Premier King Supreme", "Executive Room"],
  ["106-Premier King Supreme", "Executive Room"],
  ["107-Studio Supreme", "Studio Room"],
  ["108-Studio Supreme", "Studio Room"],
  ["109-Studio Supreme", "Studio Room"],
  ["110-Studio Supreme", "Studio Room"],
  ["111-Studio Supreme", "Studio Room"],
  ["112-Studio Supreme", "Studio Room"],
  ["114-Studio Supreme", "Studio Room"],
  ["115-Studio Supreme", "Studio Room"],
  ["201 old-Premier King Supreme", "Executive Room"],
  ["201-Premier Twin Supreme", "Executive Room"],
  ["202-Premier King Supreme", "Executive Room"],
  ["203-Premier King Supreme", "Executive Room"],
  ["204-Premier King Supreme", "Executive Room"],
  ["205-Premier King Supreme", "Executive Room"],
  ["206-Premier King Supreme", "Executive Room"],
  ["207-Studio Supreme", "Studio Room"],
  ["208-Studio Supreme", "Studio Room"],
  ["209-Studio Supreme", "Studio Room"],
  ["210-Studio Supreme", "Studio Room"],
  ["211-Studio Supreme", "Studio Room"],
  ["212-Studio Supreme", "Studio Room"],
  ["214-Studio Supreme", "Studio Room"],
  ["215-Studio Supreme", "Studio Room"],
  ["301 old-Premier King Supreme", "Executive Room"],
  ["301-Premier Twin Supreme", "Executive Room"],
  ["302-Premier King Supreme", "Executive Room"],
  ["303-Premier King Supreme", "Executive Room"],
  ["304-Premier King Supreme", "Executive Room"],
  ["305-Premier King Supreme", "Executive Room"],
  ["306-Premier King Supreme", "Executive Room"],
  ["307-Studio Supreme", "Studio Room"],
  ["308-Studio Supreme", "Studio Room"],
  ["309-Studio Supreme", "Studio Room"],
  ["310-Studio Supreme", "Studio Room"],
  ["311-Studio Supreme", "Studio Room"],
  ["312-Studio Supreme", "Studio Room"],
  ["314-Studio Supreme", "Studio Room"],
  ["315-Studio Supreme", "Studio Room"],
  ["401 old-Premier King Supreme", "Executive Room"],
  ["401-Premier Twin Supreme", "Executive Room"],
  ["402-Premier King Supreme", "Executive Room"],
  ["403-Premier King Supreme", "Executive Room"],
  ["404-Premier King Supreme", "Executive Room"],
  ["405-Premier King Supreme", "Executive Room"],
  ["406-Premier King Supreme", "Executive Room"],
  ["407-Studio Supreme", "Studio Room"],
  ["408-Studio Supreme", "Studio Room"],
  ["409-Studio Supreme", "Studio Room"],
  ["410-Studio Supreme", "Studio Room"],
  ["411-Studio Supreme", "Studio Room"],
  ["412-Studio Supreme", "Studio Room"],
  ["414-Studio Supreme", "Studio Room"],
  ["415-Studio Supreme", "Studio Room"],
  ["501-One Bedroom Suite", "1 BHK"],
  ["502-One Bedroom Suite", "1 BHK"],
  ["503-One Bedroom Suite", "1 BHK"],
  ["504-One Bedroom Suite", "1 BHK"],
  ["505-One Bedroom Suite", "1 BHK"],
  ["506-One Bedroom Suite", "1 BHK"],
  ["507-One Bedroom Suite", "1 BHK"],
  ["Banquet Hall-Banquet Hall", "Banquet"],
  ["Banquet Hall", "Banquet"], // bare form seen in real sales_booking data (56 rows) — "X-X" doesn't reduce via number-prefix stripping since there's no leading digit
  ["Premier King Supreme", "Executive Room"],
  ["Premier Twin Supreme", "Executive Room"],
];

const HTC: [string, string][] = [
  ["11-Premier King Supreme", "Executive Room"],
  ["12-Premier Twin Supreme", "Executive Room"],
  ["14-Studio Supreme", "Studio Room"],
  ["15-Premier Twin Supreme", "Executive Room"],
  ["16-Premier King Supreme", "Executive Room"],
  ["17-One Bedroom Suite", "1 BHK"],
  ["21-Premier King Supreme", "Executive Room"],
  ["22-Premier Twin Supreme", "Executive Room"],
  ["23-Studio Supreme", "Studio Room"],
  ["24-Premier Twin Supreme", "Executive Room"],
  ["25-Premier King Supreme", "Executive Room"],
  ["26-One Bedroom Suite", "1 BHK"],
  ["31-Premier King Supreme", "Executive Room"],
  ["32-Premier Twin Supreme", "Executive Room"],
  ["33-Studio Supreme", "Studio Room"],
  ["34-Premier Twin Supreme", "Executive Room"],
  ["35-Premier King Supreme", "Executive Room"],
  ["36-One Bedroom Suite", "1 BHK"],
  ["41-Premier King Supreme", "Executive Room"],
  ["42-Premier Twin Supreme", "Executive Room"],
  ["43-Studio Supreme", "Studio Room"],
  ["44-Premier Twin Supreme", "Executive Room"],
  ["45-Premier King Supreme", "Executive Room"],
  ["46-One Bedroom Suite", "1 BHK"],
  ["51-Premier King Supreme", "Executive Room"],
  ["52-Premier Twin Supreme", "Executive Room"],
  ["53-Studio Supreme", "Studio Room"],
  ["54-Premier Twin Supreme", "Executive Room"],
  ["55-Premier King Supreme", "Executive Room"],
  ["56-One Bedroom Suite", "1 BHK"],
  ["61-Premier King Supreme", "Executive Room"],
  ["62-Premier Twin Supreme", "Executive Room"],
  ["63-One Bedroom Suite Supreme", "1 BHK"],
  ["64-Premier King Supreme", "Executive Room"],
];

const JHS: [string, string][] = [
  ["100 - 2 BHK Studio-Two Bedroom Suite", "2 BHK"],
  ["101-Premier Room", "Executive Room"],
  ["102-One Bedroom Suite", "1 BHK"],
  ["103-Studio Supreme", "Studio Room"],
  ["104-Studio Supreme", "Studio Room"],
  ["105-Studio Exclusive", "Studio Room"],
  ["106-Studio Exclusive", "Studio Room"],
  ["107-Studio Exclusive", "Studio Room"],
  ["108-Studio Exclusive", "Studio Room"],
  ["109-One Bedroom Suite", "1 BHK"],
  ["110-Premier Room", "Executive Room"],
  ["111-Premier Room", "Executive Room"],
  ["200 - 2 BHK Studio-Two Bedroom Suite", "2 BHK"],
  ["201-Premier Room", "Executive Room"],
  ["202-One Bedroom Suite", "1 BHK"],
  ["203-Studio Supreme", "Studio Room"],
  ["204-Studio Supreme", "Studio Room"],
  ["205-Studio Exclusive", "Studio Room"],
  ["206-Studio Exclusive", "Studio Room"],
  ["207-Studio Exclusive", "Studio Room"],
  ["208-Studio Exclusive", "Studio Room"],
  ["209-One Bedroom Suite", "1 BHK"],
  ["210-Premier Room", "Executive Room"],
  ["211-Premier Room", "Executive Room"],
  ["300 - 2BHK Studio-Two Bedroom Suite", "2 BHK"],
  ["301-Premier Room", "Executive Room"],
  ["302-One Bedroom Suite", "1 BHK"],
  ["303-Studio Supreme", "Studio Room"],
  ["304-Studio Supreme", "Studio Room"],
  ["305-Studio Exclusive", "Studio Room"],
  ["306-Studio Exclusive", "Studio Room"],
  ["307-Studio Exclusive", "Studio Room"],
  ["308-Studio Exclusive", "Studio Room"],
  ["309-One Bedroom Suite", "1 BHK"],
  ["310-Premier Room", "Executive Room"],
  ["311-Premier Room", "Executive Room"],
  ["Premier Room", "Executive Room"],
  ["Studio Exclusive", "Studio Room"],
  ["Two Bedroom Suite", "2 BHK"],
];

const BH4: [string, string][] = [
  ["100-3BHK Apartment", "Studio Room"],
  ["101-Executive Room", "Studio Room"],
  ["102-Executive Room", "Studio Room"],
  ["103-Executive Room", "Studio Room"],
  ["200-3BHK Apartment", "Studio Room"],
  ["201-Executive Room", "Studio Room"],
  ["202-Executive Room", "Studio Room"],
  ["203-Executive Room", "Studio Room"],
  ["300-3BHK Apartment", "Studio Room"],
  ["301-Executive Room", "Studio Room"],
  ["302-Executive Room", "Studio Room"],
  ["303-Executive Room", "Studio Room"],
  ["400-3BHK Apartment", "Studio Room"],
  ["401-Executive Room", "Studio Room"],
  ["402-Executive Room", "Studio Room"],
  ["403-Executive Room", "Studio Room"],
  ["500-3BHK Apartment", "Studio Room"],
  ["501-Executive Room", "Studio Room"],
  ["502-Executive Room", "Studio Room"],
  ["503-Executive Room", "Studio Room"],
  ["600-3BHK Apartment", "Studio Room"],
  ["601-Executive Room", "Studio Room"],
  ["602-Executive Room", "Studio Room"],
  ["603-Executive Room", "Studio Room"],
];

const GB: [string, string][] = [
  ["101", "Hyber Room"],
  ["101-Hyber Room", "Hyber Room"],
  ["102", "Hyber Room Lite"],
  ["102-Hyber Room", "Hyber Room Go"],
  ["102.-Hyber Go", "Hyber Room Go"],
  ["102.-Hyber Rooms Go", "Hyber Room Go"],
  ["103", "Hyber Room Lite"],
  ["103-Hyber Room", "Hyber Room Go"],
  ["103.-Hyber Go", "Hyber Room Go"],
  ["103.-Hyber Rooms Go", "Hyber Room Go"],
  ["104", "Hyber Room Lite"],
  ["104-Hyber Room", "Hyber Room Go"],
  ["104.-Hyber Go", "Hyber Room Go"],
  ["104.-Hyber Rooms Go", "Hyber Room Go"],
  ["105", "Hyber Room Lite"],
  ["105-Hyber Room", "Hyber Room Go"],
  ["105.-Hyber Go", "Hyber Room Go"],
  ["105.-Hyber Rooms Go", "Hyber Room Go"],
  ["106", "Hyber Room Lite"],
  ["106-Hyber Go", "Hyber Room Go"],
  ["106-Hyber Rooms Go", "Hyber Room Go"],
  ["107", "Hyber Room"],
  ["107-Hyber Room", "Hyber Room"],
  ["201", "Hyber Room"],
  ["201-Hyber Room", "Hyber Room"],
  ["202", "Hyber Room Lite"],
  ["202-Hyber Room", "Hyber Room Go"],
  ["202.-Hyber Go", "Hyber Room Go"],
  ["202.-Hyber Rooms Go", "Hyber Room Go"],
  ["203", "Hyber Room Lite"],
  ["203-Hyber Room", "Hyber Room Go"],
  ["203.-Hyber Go", "Hyber Room Go"],
  ["203.-Hyber Rooms Go", "Hyber Room Go"],
  ["204", "Hyber Room Lite"],
  ["204-Hyber Room", "Hyber Room Go"],
  ["204.-Hyber Go", "Hyber Room Go"],
  ["204.-Hyber Rooms Go", "Hyber Room Go"],
  ["205", "Hyber Room Lite"],
  ["205-Hyber Room", "Hyber Room Go"],
  ["205.-Hyber Go", "Hyber Room Go"],
  ["205.-Hyber Rooms Go", "Hyber Room Go"],
  ["206", "Hyber Room Lite"],
  ["206-Hyber Go", "Hyber Room Go"],
  ["206-Hyber Rooms Go", "Hyber Room Go"],
  ["207", "Hyber Room"],
  ["207-Hyber Room", "Hyber Room"],
  ["301", "Hyber Room"],
  ["301-Hyber Room", "Hyber Room"],
  ["302", "Hyber Room Lite"],
  ["302-Hyber Room", "Hyber Room Go"],
  ["302.-Hyber Go", "Hyber Room Go"],
  ["302.-Hyber Rooms Go", "Hyber Room Go"],
  ["303", "Hyber Room Lite"],
  ["303-Hyber Room", "Hyber Room Go"],
  ["303.-Hyber Go", "Hyber Room Go"],
  ["303.-Hyber Rooms Go", "Hyber Room Go"],
  ["304", "Hyber Room Lite"],
  ["304-Hyber Room", "Hyber Room Go"],
  ["304.-Hyber Go", "Hyber Room Go"],
  ["304.-Hyber Rooms Go", "Hyber Room Go"],
  ["305", "Hyber Room Lite"],
  ["305-Hyber Room", "Hyber Room Go"],
  ["305.-Hyber Go", "Hyber Room Go"],
  ["305.-Hyber Rooms Go", "Hyber Room Go"],
  ["306", "Hyber Room Lite"],
  ["306-Hyber Go", "Hyber Room Go"],
  ["306-Hyber Rooms Go", "Hyber Room Go"],
  ["307", "Hyber Room"],
  ["307-Hyber Room", "Hyber Room"],
  ["Hyber Go", "Hyber Room Go"],
];

const LP: [string, string][] = [
  ["100 3BHK Apartment-3BHK Apartment", "Studio Room"],
  ["101-Executive Room", "Studio Room"],
  ["102-Executive Room", "Studio Room"],
  ["103-Executive Room", "Studio Room"],
  ["104 - SR-Studio Room", "Studio Room"],
  ["200 3BHK Apartment-3BHK Apartment", "Studio Room"],
  ["201-Executive Room", "Studio Room"],
  ["202-Executive Room", "Studio Room"],
  ["203-Executive Room", "Studio Room"],
  ["204 - SR-Studio Room", "Studio Room"],
  ["301-Executive Room", "Studio Room"],
  ["302-Executive Room", "Studio Room"],
  ["303-Executive Room", "Studio Room"],
  ["304 - SR-Studio Room", "Studio Room"],
  ["3BHK Apartment", "Studio Room"],
  ["400 3BHK Apartment-3BHK Apartment", "Studio Room"],
  ["401-Executive Room", "Studio Room"],
  ["402-Executive Room", "Studio Room"],
  ["403-Executive Room", "Studio Room"],
  ["404 - SR-Studio Room", "Studio Room"],
  ["4BHK Apartment", "Studio Room"],
  ["Executive Room", "Studio Room"],
  ["Studio Room", "Studio Room"],
];

function expand(property: string, pairs: [string, string][]): RoomTypeEntry[] {
  return pairs.map(([room, roomType]) => ({ property, room, roomType }));
}

export const ROOM_TYPE_MAPPING: RoomTypeEntry[] = [
  ...expand("KDP", KDP),
  ...expand("HTC", HTC),
  ...expand("JHS", JHS),
  ...expand("BH4", BH4),
  ...expand("GB", GB),
  ...expand("LP", LP),
];

// User-confirmed 2026-08-19: the reference table's Room values carry a room-number
// prefix ("107-Studio Supreme"), but real sales_booking.Room is frequently just the
// bare type name ("Studio Supreme") — confirmed against live data this covers 63%
// of rows the exact-match join was missing. Strip a leading room-number prefix
// (digits, optional letters like "old", optional dash/dot separator) from both
// sides before joining. Keep the SQL regex (roomNormalizeSqlExpr) in sync with this.
export function normalizeRoomLabel(raw: string): string {
  return raw.trim().replace(/^\d+\s*[A-Za-z]*\s*[-.]+\s*/, "");
}

export interface RoomTypeEntryNormalized extends RoomTypeEntry {
  normalizedRoom: string;
}

export const ROOM_TYPE_MAPPING_NORMALIZED: RoomTypeEntryNormalized[] = ROOM_TYPE_MAPPING.map(
  (e) => ({ ...e, normalizedRoom: normalizeRoomLabel(e.room) })
);

export const ROOM_TYPES = [
  "Executive Room",
  "Studio Room",
  "1 BHK",
  "2 BHK",
  "Banquet",
  "Hyber Room",
  "Hyber Room Lite",
  "Hyber Room Go",
] as const;

function sqlEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function dedupeBy(
  entries: RoomTypeEntryNormalized[],
  keyFn: (e: RoomTypeEntryNormalized) => string
): RoomTypeEntryNormalized[] {
  const seen = new Map<string, RoomTypeEntryNormalized>();
  for (const e of entries) {
    const key = keyFn(e);
    if (!seen.has(key)) seen.set(key, e);
  }
  return [...seen.values()];
}

// GB matches on RAW room text (join key must stay unique per (property, room) — see
// gbRoomMatchKeySqlExpr below for why normalization is wrong for GB). All other
// properties match on the number-stripped normalized text (already dedupe-safe:
// every duplicate normalized key among them agrees on Room Type).
const DEDUPED_FOR_SQL: RoomTypeEntryNormalized[] = [
  ...dedupeBy(
    ROOM_TYPE_MAPPING_NORMALIZED.filter((e) => e.property !== "GB"),
    (e) => `${e.property}||${e.normalizedRoom}`
  ),
  ...dedupeBy(
    ROOM_TYPE_MAPPING_NORMALIZED.filter((e) => e.property === "GB"),
    (e) => `${e.property}||${e.room}`
  ),
];

/** BigQuery UNNEST(ARRAY<STRUCT<...>>) literal — carries both raw and normalized room text; see roomTypeJoinCondition(). */
export function roomTypeMappingSqlUnnest(): string {
  const structs = DEDUPED_FOR_SQL.map(
    (e) =>
      `STRUCT('${sqlEscape(e.property)}' AS property, '${sqlEscape(e.room)}' AS room, '${sqlEscape(e.normalizedRoom)}' AS normalized_room, '${sqlEscape(e.roomType)}' AS room_type)`
  ).join(",\n    ");
  return `UNNEST([\n    ${structs}\n  ])`;
}

/**
 * SQL mirror of normalizeRoomLabel() — strips a leading room-number prefix so real
 * sales_booking.Room values (often bare type names) match the reference table's
 * numbered entries. Keep in sync with the JS regex above.
 */
export function normalizeRoomSqlExpr(roomCol: string): string {
  return `TRIM(REGEXP_REPLACE(TRIM(${roomCol}), r'^\\d+\\s*[A-Za-z]*\\s*[-.]+\\s*', ''))`;
}

/**
 * GB-only exception (confirmed against live data 2026-08-19): number-prefix
 * stripping breaks GB because the room *number* itself (not just the suffix)
 * decides Room vs Room Lite vs Room Go — e.g. "101-Hyber Room" -> Hyber Room but
 * "102-Hyber Room" -> Hyber Room Go. Real GB data has two row shapes: some rows
 * already carry the number embedded in Room (e.g. "102-Hyber Room", exact-matches
 * the reference as-is); others have bare Room="Hyber Room" with the number only in
 * RoomNo (confirmed fully populated for these — no blanks). Reconstruct the
 * reference table's own "<RoomNo>-<Room>" shape when Room doesn't already start
 * with the number, then match against the reference's *raw* (unnormalized) text.
 */
export function gbRoomMatchKeySqlExpr(roomCol: string, roomNoCol: string): string {
  return `IF(
    STARTS_WITH(TRIM(${roomCol}), TRIM(${roomNoCol})),
    TRIM(${roomCol}),
    CONCAT(TRIM(${roomNoCol}), '-', TRIM(${roomCol}))
  )`;
}

/**
 * Full LEFT JOIN ON-condition against roomTypeMappingRawSqlUnnest() AS rt, given the
 * booking table's alias. Non-GB properties match on the normalized (number-stripped)
 * room label; GB matches on the raw reference text via the reconstructed RoomNo+Room key.
 */
export function roomTypeJoinCondition(bookingAlias: string): string {
  const b = bookingAlias;
  return `${b}.Property = rt.property
    AND (
      (${b}.Property != 'GB' AND ${normalizeRoomSqlExpr(`${b}.Room`)} = rt.normalized_room)
      OR (${b}.Property = 'GB' AND ${gbRoomMatchKeySqlExpr(`${b}.Room`, `${b}.RoomNo`)} = rt.room)
    )`;
}
