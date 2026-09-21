// AUTO-GENERATED reference data, transcribed from the two finance
// "Revenue Dashboard" workbooks (FY24-25.xlsx, FY25-26.xlsx) provided
// 2026-09-21 — see Skyla_Dashboard_KPI_Logic_Reference.md's 2026-09-21
// entries for the full reconciliation story. Do not hand-edit; regenerate
// from the source workbooks if a correction is needed.
//
// Coverage: KDP/HTC/JHS/BH4 for all 24 months of both FYs; GB from Sep
// 2025 onward in FY25-26 (absent before — the sheet has no row for it) and
// Apr 2024-Jan 2025 in FY24-25 (Feb/Mar 2025 genuinely inactive, omitted);
// LP has Sold Nights/Revenue/ARR/Occupancy in the FY25-26 sheet only (no
// FY24-25 LP row at all) but is NOT included here — LP's real numbers
// already come from a dedicated monthly source (lpMonthly.ts), which nothing
// here should override.
//
// `revenue` is the workbook's own single Revenue figure for the month —
// Room Revenue only for every property except GB (Room + ancillary/other,
// see reports.ts's fetchOtherRevenueByMonth comment) — never F&B, which
// predates both workbooks. `b2bRevenue`/`b2cRevenue` are FY24-25 only
// (that workbook, uniquely, splits revenue by B2B/B2C — FY25-26's does not).
export interface HistoricalMonthData {
  soldRoomNights: number;
  availableRoomNights: number;
  revenue: number;
  b2bRevenue?: number;
  b2cRevenue?: number;
}

// Key: `${property}|${YYYY-MM}`.
export const HISTORICAL_MONTHLY_DATA: Record<string, HistoricalMonthData> = {
  "BH4|2025-04": { soldRoomNights: 408, availableRoomNights: 540, revenue: 1466564 },
  "JHS|2025-04": { soldRoomNights: 840, availableRoomNights: 990, revenue: 4325865 },
  "HTC|2025-04": { soldRoomNights: 915, availableRoomNights: 1020, revenue: 3917375 },
  "KDP|2025-04": { soldRoomNights: 1576, availableRoomNights: 1890, revenue: 10135316 },
  "BH4|2025-05": { soldRoomNights: 338, availableRoomNights: 558, revenue: 1165400 },
  "JHS|2025-05": { soldRoomNights: 806, availableRoomNights: 1023, revenue: 4047713 },
  "HTC|2025-05": { soldRoomNights: 813, availableRoomNights: 1054, revenue: 3280485 },
  "KDP|2025-05": { soldRoomNights: 1417, availableRoomNights: 1953, revenue: 8951263 },
  "BH4|2025-06": { soldRoomNights: 429, availableRoomNights: 540, revenue: 1581695 },
  "JHS|2025-06": { soldRoomNights: 705, availableRoomNights: 990, revenue: 3609391 },
  "HTC|2025-06": { soldRoomNights: 911, availableRoomNights: 1024, revenue: 3985062 },
  "KDP|2025-06": { soldRoomNights: 1537, availableRoomNights: 1890, revenue: 9004093 },
  "BH4|2025-07": { soldRoomNights: 450, availableRoomNights: 558, revenue: 1632425 },
  "JHS|2025-07": { soldRoomNights: 828, availableRoomNights: 1023, revenue: 4177401 },
  "HTC|2025-07": { soldRoomNights: 906, availableRoomNights: 1054, revenue: 3872291 },
  "KDP|2025-07": { soldRoomNights: 1655, availableRoomNights: 1953, revenue: 9939404 },
  "BH4|2025-08": { soldRoomNights: 481, availableRoomNights: 558, revenue: 1764685 },
  "JHS|2025-08": { soldRoomNights: 606, availableRoomNights: 1023, revenue: 3217867 },
  "HTC|2025-08": { soldRoomNights: 804, availableRoomNights: 1054, revenue: 3515272 },
  "KDP|2025-08": { soldRoomNights: 1249, availableRoomNights: 1953, revenue: 7450133 },
  "BH4|2025-09": { soldRoomNights: 368, availableRoomNights: 540, revenue: 1332436 },
  "JHS|2025-09": { soldRoomNights: 794, availableRoomNights: 990, revenue: 4444507 },
  "HTC|2025-09": { soldRoomNights: 859, availableRoomNights: 1020, revenue: 3761493 },
  "KDP|2025-09": { soldRoomNights: 1399, availableRoomNights: 1890, revenue: 8374856 },
  "GB|2025-09": { soldRoomNights: 132, availableRoomNights: 336, revenue: 544615 },
  "BH4|2025-10": { soldRoomNights: 324, availableRoomNights: 558, revenue: 1213044 },
  "JHS|2025-10": { soldRoomNights: 680, availableRoomNights: 1023, revenue: 3668823 },
  "HTC|2025-10": { soldRoomNights: 767, availableRoomNights: 1054, revenue: 3400954 },
  "KDP|2025-10": { soldRoomNights: 1156, availableRoomNights: 1953, revenue: 7273771 },
  "GB|2025-10": { soldRoomNights: 255, availableRoomNights: 651, revenue: 1031192 },
  "BH4|2025-11": { soldRoomNights: 431, availableRoomNights: 540, revenue: 1837254 },
  "JHS|2025-11": { soldRoomNights: 853, availableRoomNights: 990, revenue: 5145882 },
  "HTC|2025-11": { soldRoomNights: 898, availableRoomNights: 1020, revenue: 4334995 },
  "KDP|2025-11": { soldRoomNights: 1479, availableRoomNights: 1890, revenue: 11401515 },
  "GB|2025-11": { soldRoomNights: 386, availableRoomNights: 630, revenue: 1534870 },
  "BH4|2025-12": { soldRoomNights: 449, availableRoomNights: 558, revenue: 1997512 },
  "JHS|2025-12": { soldRoomNights: 696, availableRoomNights: 1023, revenue: 4262252 },
  "HTC|2025-12": { soldRoomNights: 716, availableRoomNights: 1054, revenue: 3983609 },
  "KDP|2025-12": { soldRoomNights: 1439, availableRoomNights: 1953, revenue: 9871971 },
  "GB|2025-12": { soldRoomNights: 256, availableRoomNights: 651, revenue: 1058005 },
  "BH4|2026-01": { soldRoomNights: 478, availableRoomNights: 558, revenue: 2276713 },
  "JHS|2026-01": { soldRoomNights: 764, availableRoomNights: 1023, revenue: 4621295 },
  "HTC|2026-01": { soldRoomNights: 838, availableRoomNights: 1054, revenue: 4452538 },
  "KDP|2026-01": { soldRoomNights: 1538, availableRoomNights: 1953, revenue: 10241417 },
  "GB|2026-01": { soldRoomNights: 396, availableRoomNights: 651, revenue: 1577719 },
  "BH4|2026-02": { soldRoomNights: 320, availableRoomNights: 504, revenue: 1452277 },
  "JHS|2026-02": { soldRoomNights: 771, availableRoomNights: 924, revenue: 4735210 },
  "HTC|2026-02": { soldRoomNights: 724, availableRoomNights: 952, revenue: 3595792 },
  "KDP|2026-02": { soldRoomNights: 1495, availableRoomNights: 1764, revenue: 10538219 },
  "GB|2026-02": { soldRoomNights: 462, availableRoomNights: 588, revenue: 1710472 },
  "BH4|2026-03": { soldRoomNights: 334, availableRoomNights: 558, revenue: 1341084 },
  "JHS|2026-03": { soldRoomNights: 639, availableRoomNights: 1023, revenue: 3696112 },
  "HTC|2026-03": { soldRoomNights: 837, availableRoomNights: 1054, revenue: 3886423 },
  "KDP|2026-03": { soldRoomNights: 1298, availableRoomNights: 1953, revenue: 9077475 },
  "GB|2026-03": { soldRoomNights: 328, availableRoomNights: 651, revenue: 1267734 },
  "KDP|2024-04": { soldRoomNights: 903, availableRoomNights: 1890, revenue: 4382868, b2bRevenue: 1850700, b2cRevenue: 2532168 },
  "JHS|2024-04": { soldRoomNights: 660, availableRoomNights: 990, revenue: 3134790, b2bRevenue: 1423200, b2cRevenue: 1711590 },
  "HTC|2024-04": { soldRoomNights: 826, availableRoomNights: 1020, revenue: 3325213, b2bRevenue: 2731450, b2cRevenue: 593763 },
  "BH4|2024-04": { soldRoomNights: 447, availableRoomNights: 540, revenue: 1481200, b2bRevenue: 766100, b2cRevenue: 715100 },
  "GB|2024-04": { soldRoomNights: 258, availableRoomNights: 630, revenue: 728435, b2bRevenue: 596151, b2cRevenue: 132284 },
  "KDP|2024-05": { soldRoomNights: 927, availableRoomNights: 1953, revenue: 4516981, b2bRevenue: 1451517, b2cRevenue: 3065464 },
  "JHS|2024-05": { soldRoomNights: 581, availableRoomNights: 1023, revenue: 2854276, b2bRevenue: 1152305, b2cRevenue: 1701971 },
  "HTC|2024-05": { soldRoomNights: 903, availableRoomNights: 1054, revenue: 3660328, b2bRevenue: 2803475, b2cRevenue: 856853 },
  "BH4|2024-05": { soldRoomNights: 451, availableRoomNights: 558, revenue: 1497522, b2bRevenue: 635450, b2cRevenue: 862072 },
  "GB|2024-05": { soldRoomNights: 344, availableRoomNights: 651, revenue: 961770, b2bRevenue: 797582, b2cRevenue: 164188 },
  "KDP|2024-06": { soldRoomNights: 1176, availableRoomNights: 1890, revenue: 5992920, b2bRevenue: 1617450, b2cRevenue: 4375470 },
  "JHS|2024-06": { soldRoomNights: 786, availableRoomNights: 990, revenue: 3872563, b2bRevenue: 1133900, b2cRevenue: 2738663 },
  "HTC|2024-06": { soldRoomNights: 901, availableRoomNights: 1020, revenue: 3808280, b2bRevenue: 3118460, b2cRevenue: 689820 },
  "BH4|2024-06": { soldRoomNights: 499, availableRoomNights: 540, revenue: 1801450, b2bRevenue: 718600, b2cRevenue: 1082850 },
  "GB|2024-06": { soldRoomNights: 350, availableRoomNights: 630, revenue: 1056500, b2bRevenue: 633750, b2cRevenue: 422750 },
  "KDP|2024-07": { soldRoomNights: 1558, availableRoomNights: 1953, revenue: 7945423, b2bRevenue: 4043050, b2cRevenue: 3902373 },
  "JHS|2024-07": { soldRoomNights: 877, availableRoomNights: 1023, revenue: 4315676, b2bRevenue: 1835300, b2cRevenue: 2480376 },
  "HTC|2024-07": { soldRoomNights: 935, availableRoomNights: 1054, revenue: 4024861, b2bRevenue: 2868665, b2cRevenue: 1156196 },
  "BH4|2024-07": { soldRoomNights: 527, availableRoomNights: 558, revenue: 2010400, b2bRevenue: 478850, b2cRevenue: 1531550 },
  "GB|2024-07": { soldRoomNights: 442, availableRoomNights: 651, revenue: 1426850, b2bRevenue: 544600, b2cRevenue: 882250 },
  "KDP|2024-08": { soldRoomNights: 1383, availableRoomNights: 1953, revenue: 7423050, b2bRevenue: 1894100, b2cRevenue: 5528950 },
  "JHS|2024-08": { soldRoomNights: 741, availableRoomNights: 1023, revenue: 3791754, b2bRevenue: 1218560, b2cRevenue: 2573194 },
  "HTC|2024-08": { soldRoomNights: 844, availableRoomNights: 1054, revenue: 3825326, b2bRevenue: 2337611, b2cRevenue: 1487715 },
  "BH4|2024-08": { soldRoomNights: 516, availableRoomNights: 558, revenue: 1865100, b2bRevenue: 740500, b2cRevenue: 1124600 },
  "GB|2024-08": { soldRoomNights: 434, availableRoomNights: 651, revenue: 1413961, b2bRevenue: 548500, b2cRevenue: 865461 },
  "KDP|2024-09": { soldRoomNights: 1341, availableRoomNights: 1890, revenue: 7605369, b2bRevenue: 3000700, b2cRevenue: 4604669 },
  "JHS|2024-09": { soldRoomNights: 714, availableRoomNights: 990, revenue: 3536121, b2bRevenue: 2157900, b2cRevenue: 1378221 },
  "HTC|2024-09": { soldRoomNights: 881, availableRoomNights: 1020, revenue: 3854034, b2bRevenue: 2879000, b2cRevenue: 975034 },
  "BH4|2024-09": { soldRoomNights: 468, availableRoomNights: 540, revenue: 1669143, b2bRevenue: 743200, b2cRevenue: 925943 },
  "GB|2024-09": { soldRoomNights: 400, availableRoomNights: 630, revenue: 1327900, b2bRevenue: 312900, b2cRevenue: 1015000 },
  "KDP|2024-10": { soldRoomNights: 1206, availableRoomNights: 1953, revenue: 7540520, b2bRevenue: 2704800, b2cRevenue: 4835720 },
  "JHS|2024-10": { soldRoomNights: 715, availableRoomNights: 1023, revenue: 3843893, b2bRevenue: 2271048, b2cRevenue: 1572845 },
  "HTC|2024-10": { soldRoomNights: 910, availableRoomNights: 1054, revenue: 3977545, b2bRevenue: 2602800, b2cRevenue: 1374745 },
  "BH4|2024-10": { soldRoomNights: 513, availableRoomNights: 558, revenue: 1880829, b2bRevenue: 860900, b2cRevenue: 1019929 },
  "GB|2024-10": { soldRoomNights: 435, availableRoomNights: 651, revenue: 1372700, b2bRevenue: 455700, b2cRevenue: 917000 },
  "KDP|2024-11": { soldRoomNights: 1467, availableRoomNights: 1890, revenue: 10735480, b2bRevenue: 3511896, b2cRevenue: 7223584 },
  "JHS|2024-11": { soldRoomNights: 759, availableRoomNights: 990, revenue: 4272162, b2bRevenue: 2184550, b2cRevenue: 2087612 },
  "HTC|2024-11": { soldRoomNights: 864, availableRoomNights: 1020, revenue: 3932928, b2bRevenue: 2226000, b2cRevenue: 1706928 },
  "BH4|2024-11": { soldRoomNights: 471, availableRoomNights: 540, revenue: 1925125, b2bRevenue: 708475, b2cRevenue: 1216650 },
  "GB|2024-11": { soldRoomNights: 401, availableRoomNights: 630, revenue: 1237255, b2bRevenue: 497600, b2cRevenue: 739655 },
  "KDP|2024-12": { soldRoomNights: 1386, availableRoomNights: 1953, revenue: 8638810, b2bRevenue: 3321151, b2cRevenue: 5317659 },
  "JHS|2024-12": { soldRoomNights: 778, availableRoomNights: 1023, revenue: 3917855, b2bRevenue: 2247050, b2cRevenue: 1670805 },
  "HTC|2024-12": { soldRoomNights: 848, availableRoomNights: 1054, revenue: 3609733, b2bRevenue: 2340550, b2cRevenue: 1269183 },
  "BH4|2024-12": { soldRoomNights: 498, availableRoomNights: 558, revenue: 2160875, b2bRevenue: 334950, b2cRevenue: 1825925 },
  "GB|2024-12": { soldRoomNights: 418, availableRoomNights: 651, revenue: 1297145, b2bRevenue: 547550, b2cRevenue: 749595 },
  "KDP|2025-01": { soldRoomNights: 1485, availableRoomNights: 1953, revenue: 8951421, b2bRevenue: 5885964, b2cRevenue: 3065457 },
  "JHS|2025-01": { soldRoomNights: 745, availableRoomNights: 1023, revenue: 3660713, b2bRevenue: 2209400, b2cRevenue: 1451313 },
  "HTC|2025-01": { soldRoomNights: 878, availableRoomNights: 1054, revenue: 3806113, b2bRevenue: 2506900, b2cRevenue: 1299213 },
  "BH4|2025-01": { soldRoomNights: 502, availableRoomNights: 558, revenue: 1888500, b2bRevenue: 267000, b2cRevenue: 1621500 },
  "GB|2025-01": { soldRoomNights: 7, availableRoomNights: 651, revenue: 17500, b2bRevenue: 17500, b2cRevenue: 0 },
  "KDP|2025-02": { soldRoomNights: 1515, availableRoomNights: 1764, revenue: 9061905, b2bRevenue: 4924700, b2cRevenue: 4137205 },
  "JHS|2025-02": { soldRoomNights: 742, availableRoomNights: 924, revenue: 3912880, b2bRevenue: 1789000, b2cRevenue: 2123880 },
  "HTC|2025-02": { soldRoomNights: 851, availableRoomNights: 952, revenue: 3748623, b2bRevenue: 2991640, b2cRevenue: 756983 },
  "BH4|2025-02": { soldRoomNights: 397, availableRoomNights: 504, revenue: 1513883, b2bRevenue: 344950, b2cRevenue: 1168933 },
  "KDP|2025-03": { soldRoomNights: 1478, availableRoomNights: 1953, revenue: 9012463, b2bRevenue: 4410475, b2cRevenue: 4601988 },
  "JHS|2025-03": { soldRoomNights: 765, availableRoomNights: 1023, revenue: 4061140, b2bRevenue: 2233425, b2cRevenue: 1827715 },
  "HTC|2025-03": { soldRoomNights: 817, availableRoomNights: 1054, revenue: 3514076, b2bRevenue: 3054365, b2cRevenue: 459711 },
  "BH4|2025-03": { soldRoomNights: 380, availableRoomNights: 558, revenue: 1339251, b2bRevenue: 618325, b2cRevenue: 720926 },
};

export function getHistoricalMonthData(property: string, monthKey: string): HistoricalMonthData | undefined {
  // monthKey may arrive as a full ISO date ("YYYY-MM-01") -- this table keys by "YYYY-MM" only.
  return HISTORICAL_MONTHLY_DATA[`${property}|${monthKey.slice(0, 7)}`];
}
