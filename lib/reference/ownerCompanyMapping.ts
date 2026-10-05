// SOURCE OF TRUTH for sales-owner -> company assignments (2026-10-05).
// Pushed into BigQuery `company_owner_map` (CompanyId, Owner) by
// scripts/sync-company-owner-map.ts, which resolves every CompanyId whose
// CompanyName EXACTLY equals one of the `names` below (sales_company_bills
// has one CompanyId per property/Zoho instance, so one company = several IDs).
//
// Owner strings match lead_tracker.Owner spelling ("Dikhita"), which drives
// the Leads owner tabs; canonicalOwner() in owners.ts also accepts "Dhikitha".
//
// Sources: Dhikitha/Rajesh/Anjali lists from the 2026-10-05 chat request
// (Riya-headed sub-list confirmed by the user to be Dhikitha's); Sajal and
// Bhanu from "Sales Person Company Wise List.xlsx" (Sheet1, cols A-B / E-F).
// "requested" is the name as the user wrote it; "names" are the exact
// sales_company_bills CompanyName values it was matched to.

export interface OwnerCompanyAssignment {
  requested: string;
  names: string[];
}

export const OWNER_COMPANY_MAPPING: Record<string, OwnerCompanyAssignment[]> = {
  "Rajesh": [
    {
      "requested": "ATPI",
      "names": [
        "ATPI TRAVEL LLC"
      ]
    },
    {
      "requested": "CHEMET (Hyd)",
      "names": [
        "CHEMET (HYD)"
      ]
    }
  ],
  "Dikhita": [
    {
      "requested": "Lotus Chocolate Company Ltd",
      "names": [
        "LOTUS CHOCOLATE COMPANY LTD"
      ]
    },
    {
      "requested": "JSW MG Motor India Private Limited",
      "names": [
        "JSW MG MOTOR INDIA PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Aadya Travels",
      "names": [
        "AADYA TRAVELS"
      ]
    },
    {
      "requested": "Fountain Services India",
      "names": [
        "FOUNTAIN SERVICES INDIA",
        "Fountain Services India"
      ]
    },
    {
      "requested": "DDK",
      "names": [
        "DDK Consultancy Services"
      ]
    },
    {
      "requested": "FG L.L.C-FZ",
      "names": [
        "FG L.L.C-FZ"
      ]
    },
    {
      "requested": "Nomads",
      "names": [
        "Nomad Temporary Housing"
      ]
    },
    {
      "requested": "Survworld",
      "names": [
        "SURV WORLDWIDE"
      ]
    },
    {
      "requested": "DRP Enterprises",
      "names": [
        " DRP ENTERPRISES Pvt Ltd",
        "DRP ENTERPRISES PRIVATE LIMITED",
        "DRP ENTERPRISES Pvt Ltd"
      ]
    },
    {
      "requested": "Mayrakhee",
      "names": [
        "MAYRAHKEE HOSPITALITY"
      ]
    },
    {
      "requested": "Blue Orange",
      "names": [
        "BLUE ORANGE HOSPITALITY"
      ]
    },
    {
      "requested": "HT Media Ltd.",
      "names": [
        "HT Media Ltd"
      ]
    },
    {
      "requested": "Riya Travels",
      "names": [
        "RIYA TRAVEL AND TOURS INDIA PVT LTD"
      ]
    }
  ],
  "Anjali": [
    {
      "requested": "Ikan Relocation",
      "names": [
        "IKAN RELOCATION SERVICES INDIA PRIVATE  LIMITED",
        "IKAN RELOCATION SERVICES INDIA PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Khanna Enterprise",
      "names": [
        "KHANNA ENTERPRISES (REGD.)"
      ]
    }
  ],
  "Sajal": [
    {
      "requested": "ADP",
      "names": [
        "ADP PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Advanta Enterprises",
      "names": [
        "ADVANTA ENTERPRISES LIMITED"
      ]
    },
    {
      "requested": "AGS Health",
      "names": [
        "AGS Health Ltd"
      ]
    },
    {
      "requested": "Altimetrik",
      "names": [
        "ALTIMETRIK"
      ]
    },
    {
      "requested": "Arha Media",
      "names": [
        "ARHA MEDIA & BROADCASTING PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Bosch",
      "names": [
        "BOSCH LIMITED"
      ]
    },
    {
      "requested": "Chandamma Kathalu",
      "names": [
        "CHANDAMAMA KATHALU PICTURES LLP"
      ]
    },
    {
      "requested": "Chubb",
      "names": [
        "Chubb Business Services India Private Limited"
      ]
    },
    {
      "requested": "Edumanagement Partners",
      "names": [
        "Edumanagement Partners Private Limited"
      ]
    },
    {
      "requested": "Endemol",
      "names": [
        "ENDEMOL INDIA PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Evergent Technologies",
      "names": [
        "EVERGENT TECHNOLOGIES PRIVATE LIMITED"
      ]
    },
    {
      "requested": "FMC Technologies",
      "names": [
        "FMC TECHNOLOGIES INDIA PRIVATE LIMITED (SEZ)",
        "FMC TECHNOLOGIES INDIA PRIVATE LIMITED(SEZ)"
      ]
    },
    {
      "requested": "GK productions",
      "names": [
        "GK PRODUCTION SOLUTIONS PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Hunger Experiment",
      "names": [
        "HUNGER EXPERIMENT PRIVATE LIMITED",
        "Hunger Experiment Private Limited"
      ]
    },
    {
      "requested": "IIFL Samasta Finance",
      "names": [
        "IIFL Samasta Finance Ltd"
      ]
    },
    {
      "requested": "JB Chemicals",
      "names": [
        "J. B. Chemicals & Pharmaceuticals Ltd",
        "J. B. Chemicals & Pharmaceuticals Ltd.",
        "J.B.Chemicals And Pharmaceuticals Ltd",
        "J.B.Chemicals and Pharmaceuticals Limited"
      ]
    },
    {
      "requested": "Knot Solutions",
      "names": [
        "KNOT SOLUTIONS PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Modular Containers",
      "names": [
        "MODULAR CONTAINERS PRIVATE LIMITED"
      ]
    },
    {
      "requested": "NB Healthcare",
      "names": [
        "NB HEALTHCARE TECHNOLOGIES PRIVATE LIMITED"
      ]
    },
    {
      "requested": "NetCracker",
      "names": [
        "NetCracker Technology Solutions (India) Private Limited(SEZ)"
      ]
    },
    {
      "requested": "Nexon Paints",
      "names": [
        "NEXON PAINTS PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Okatti ed",
      "names": [
        "Okatti ed tech pvt ltd"
      ]
    },
    {
      "requested": "Persistent Systems",
      "names": [
        "PERSISTENT SYSTEMS LIMITED (SEZ)",
        "PERSISTENT SYSTEMS LIMITED(Pune)"
      ]
    },
    {
      "requested": "Play Media",
      "names": [
        "Play Media Creations"
      ]
    },
    {
      "requested": "R1 RCM",
      "names": [
        "R1 RCM GLOBAL PRIVATE LIMITED (Tikri 48)",
        "R1 RCM GLOBAL PRIVATE LIMITED(CHN)",
        "R1 RCM GLOBAL PRIVATE LIMITED(Chennai)",
        "R1 RCM Global Pvt. Ltd (Sector 48)",
        "R1 RCM Global Pvt. Ltd.(BLR)",
        "R1 RCM Global Pvt. Ltd.(HYD)",
        "R1 RCM Global Pvt. Ltd.(Sector 135)",
        "R1 RCM Global Pvt. Ltd.(Sector 21)"
      ]
    },
    {
      "requested": "Regalix",
      "names": [
        "REGALIX INDIA PRIVATE LIMITED",
        "REGALIX INDIA PVT LTD"
      ]
    },
    {
      "requested": "Riyom Industries",
      "names": [
        "RIYOM INDUSTRIES PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Schindler India",
      "names": [
        "SCHINDLER INDIA PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Shika entertainments",
      "names": [
        "SHIKA ENTERTAINMENTS LLP"
      ]
    },
    {
      "requested": "SHINE SCREENS LLP",
      "names": [
        "SHINE SCREENS (INDIA) LLP"
      ]
    },
    {
      "requested": "Sithara ENT",
      "names": [
        "SITHARA ENTERTAINMENTS"
      ]
    },
    {
      "requested": "Tata Consumer",
      "names": [
        "TATA CONSUMER PRODUCTS LIMITED",
        "Tata Consumer Products Limited"
      ]
    },
    {
      "requested": "The Future Kids School",
      "names": [
        "THE FUTURE KIDS SCHOOL"
      ]
    },
    {
      "requested": "Tracert",
      "names": [
        "TRACERT SERVICES PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Trianz Digital",
      "names": [
        "TRIANZ DIGITAL CONSULTING PRIVATE LIMITED",
        "TRIANZ DIGITAL CONSULTING PRIVATE LIMITED (Bangalore)",
        "TRIANZ DIGITAL CONSULTING PRIVATE LIMITED (Chennai)",
        "TRIANZ DIGITAL CONSULTING PRIVATE LIMITED (SEZ HYD)",
        "TRIANZ DIGITAL CONSULTING PRIVATE LIMITED (chennai) (SEZ)",
        "TRIANZ DIGITAL CONSULTING PRIVATE LIMITED(BLR)",
        "TRIANZ DIGITAL CONSULTING PRIVATE LIMITED(Bengaluru)",
        "TRIANZ DIGITAL CONSULTING PRIVATE LIMITED(Chennai)",
        "TRIANZ DIGITAL CONSULTING PRIVATE LIMITED(HYD SEZ)",
        "TRIANZ DIGITAL CONSULTING PRIVATE LIMITED(HYD- SEZ)",
        "TRIANZ DIGITAL CONSULTING PRIVATE LIMITED(chennai)(SEZ)"
      ]
    },
    {
      "requested": "Vertiv Energy",
      "names": [
        "VERTIV ENERGY PRIVATE LIMITED",
        "VERTIV ENERGY PVT LTD",
        "Vertiv Energy Private Limited"
      ]
    },
    {
      "requested": "Vyjayanthi Movies",
      "names": [
        "VYJAYANTHI MOVIES"
      ]
    },
    {
      "requested": "XPO India",
      "names": [
        "XPO INDIA SHARED SERVICES LLP",
        "XPO INDIA SHARED SERVICES LLP( HYD)",
        "XPO India Shared Services LLP (Pune-SEZ)"
      ]
    },
    {
      "requested": "Roche Information Solutions India Pvt. Ltd",
      "names": [
        "Roche Information Solutions India Pvt. Ltd"
      ]
    },
    {
      "requested": "AltoLiving Enterprises",
      "names": [
        "ALTOLIVING ENTERPRISE SOFTWARE INDIA PRIVATE LIMITED"
      ]
    },
    {
      "requested": "ACT (Atria Convergence Technologies Ltd)",
      "names": [
        "ATRIA CONVERGENCE TECHNOLOGIES  LTD",
        "ATRIA CONVERGENCE TECHNOLOGIES LIMITED (BLR)",
        "ATRIA CONVERGENCE TECHNOLOGIES LTD"
      ]
    }
  ],
  "Bhanu": [
    {
      "requested": "Akbar Travels",
      "names": [
        "AKBAR TRAVELS OF INDIA PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Berkadia",
      "names": [
        "BERKADIA SERVICES INDIA PRIVATE LIMITED ( SEZ)",
        "BERKADIA SERVICES INDIA PRIVATE LIMITED(SEZ )",
        "Berkadia Services India Private Limited(HYD)(SEZ)"
      ]
    },
    {
      "requested": "Bhadrakali Pictures",
      "names": [
        "BHADRAKALI PICTURES PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Biological Limited",
      "names": [
        "BIOLOGICAL E LIMITED"
      ]
    },
    {
      "requested": "DarwinBox",
      "names": [
        "DARWINBOX DIGITAL SOLUTIONS PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Deugro",
      "names": [
        "DEUGRO PROJECTS (INDIA) PRIVATE LIMITED",
        "DEUGRO PROJECTS (INDIA) PVT. LTD"
      ]
    },
    {
      "requested": "E2open Software",
      "names": [
        "E2open Software India Private Limited"
      ]
    },
    {
      "requested": "Enfinity India (Tepsol)",
      "names": [
        "ENFINITY INDIA PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Epam systems",
      "names": [
        "EPAM SYSTEMS INDIA PRIVATE LIMITED"
      ]
    },
    {
      "requested": "EPIQ Systems",
      "names": [
        "EPIQ SYSTEMS INDIA PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Gold Box",
      "names": [
        "Gold Box Entertainments Pvt Ltd"
      ]
    },
    {
      "requested": "Green Gold Animation",
      "names": [
        "GREEN GOLD ANIMATION PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Haarika & Hassine",
      "names": [
        "HAARIKA & HASSINE CREATIONS"
      ]
    },
    {
      "requested": "JK Fenner",
      "names": [
        "J. K. FENNER (INDIA) LIMITED"
      ]
    },
    {
      "requested": "Kellton Tech",
      "names": [
        "KELLTON TECH SOLUTIONS LIMITED"
      ]
    },
    {
      "requested": "KL Edu Foundation",
      "names": [
        "KONERU LAKSHMAIAH EDUCATION FOUNDATION"
      ]
    },
    {
      "requested": "Microchip",
      "names": [
        "Microchip Technology(India) Pvt. Ltd"
      ]
    },
    {
      "requested": "Mondee",
      "names": [
        "Mondee technologies"
      ]
    },
    {
      "requested": "MSN Laboratories",
      "names": [
        "M S N LABORATORIES PRIVATE LIMITED"
      ]
    },
    {
      "requested": "NTT Data",
      "names": [
        "NTT DATA BUSINESS SOLUTIONS PRIVATE",
        "NTT DATA BUSINESS SOLUTIONS PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Optimus Drugs",
      "names": [
        "OPTIMUS DRUGS PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Power Mech",
      "names": [
        "POWER MECH PROJECTS LIMITED",
        "POWER MECH PROJECTS LTD"
      ]
    },
    {
      "requested": "Prestige",
      "names": [
        "PRESTIGE ESTATES PROJECTS LIMITED",
        "PRESTIGE MALL MANAGEMENT PRIVATE LIMITED",
        "Prestige Estates Projects Ltd",
        "Prestige property management and services"
      ]
    },
    {
      "requested": "Rapo Cinematic",
      "names": [
        "RAPO CINEMATICS LLP"
      ]
    },
    {
      "requested": "Sai Silks",
      "names": [
        "SAI SILKS KALAMANDIR LIMITED",
        "Sai Silks Kalamandir LTD"
      ]
    },
    {
      "requested": "Satguru Travel",
      "names": [
        "SATGURU TRAVEL AND TOURISM PRIVATE LIMITED"
      ]
    },
    {
      "requested": "SOL Productions",
      "names": [
        "SOL PRODUCTION LLP"
      ]
    },
    {
      "requested": "Talent Formula",
      "names": [
        "TALENT FORMULA PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Tanla Platforms",
      "names": [
        "TANLA PLATFORMS LIMITED"
      ]
    },
    {
      "requested": "TCS",
      "names": [
        "Tata Consultancy Services Limited(TCS)"
      ]
    },
    {
      "requested": "14 Reels",
      "names": [
        "14 REELS PLUS LLP"
      ]
    },
    {
      "requested": "Jet Streams",
      "names": [
        "JET STREAMS ENTERTAINMENTS LLP"
      ]
    },
    {
      "requested": "Karalikaa Pictures",
      "names": [
        "KARALIKAA PICTURES PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Manam Enterprises",
      "names": [
        "MANAM ENTERPRISES"
      ]
    },
    {
      "requested": "Mythri Movies",
      "names": [
        "MYTHRI MOVIE MAKERS",
        "MYTHRI MOVIE MAKERS ( Vijaya Devarakonda movie)",
        "MYTHRI MOVIE MAKERS (NTR Arts)",
        "MYTHRI MOVIE MAKERS (Ustad bhagath singh)",
        "MYTHRI MOVIE MAKERS(ustad bhagath singh)",
        "Mythri Movie Makers(Ram movie)"
      ]
    },
    {
      "requested": "People Media",
      "names": [
        "PEOPLE MEDIA FACTORY LLP",
        "PEOPLE MEDIA FACTORY LLP ( Rajashab)"
      ]
    },
    {
      "requested": "Poluru Productions",
      "names": [
        "POLURU PRODUCTIONS"
      ]
    },
    {
      "requested": "UV Creations",
      "names": [
        "U V CREATIONS"
      ]
    },
    {
      "requested": "Vittalacharya Mayajala",
      "names": [
        "VITTALACHARYA MAYAJALA SITRALU PRIVATE LIMITED"
      ]
    },
    {
      "requested": "Vriddhi Cinemas",
      "names": [
        "VRIDDHI CINEMAS LLP"
      ]
    },
    {
      "requested": "Vyra Ent's",
      "names": [
        "VYRA ENTERTAINMENTS LLP"
      ]
    }
  ]
};

// Companies the user confirmed (2026-10-05) as NEW / not yet booked: they
// belong to the owner below as soon as they first appear in sales_company_bills,
// with no re-run needed — queries resolve owner by normalized CompanyName for
// any CompanyId that has no company_owner_map row (see pendingOwnerSql).
// Match = normalized name equals `name`, or starts with `name` + space
// (`exact` = equals only; used for the short "ACT" so it can't catch "ACT FIBERNET").
export interface PendingOwnerName {
  owner: string;
  name: string;
  exact?: boolean;
}
export const PENDING_OWNER_NAMES: PendingOwnerName[] = [
  { owner: "Dikhita", name: "Yashodha" },
  { owner: "Dikhita", name: "Oasis" },
  { owner: "Dikhita", name: "CCIL" },
  { owner: "Dikhita", name: "Stay3Sixty" },
  { owner: "Dikhita", name: "Blueground" },
  { owner: "Dikhita", name: "Nutmegs Hospitality" },
  // ACT = ATRIA CONVERGENCE TECHNOLOGIES LTD (user-confirmed). b2b_bills calls it
  // "ACT"; sales_company_bills uses the full name (mapped above by CompanyId).
  // Both spellings are kept here so a new Zoho CompanyId under either name is
  // attributed to Sajal automatically.
  { owner: "Sajal", name: "ACT", exact: true },
  { owner: "Sajal", name: "Atria Convergence Technologies" },
];

// Requested but NOT mapped — awaiting an answer.
export const UNMATCHED_REQUESTS: { owner: string; requested: string; note: string }[] = [
  { owner: "Sajal / Bhanu", requested: "SLVC", note: "user says it sits under BOTH owners, but company_owner_map holds one owner per company; also exists only in b2b_bills (no CompanyId)" },
];

/** Same normalization as b2bContracts.ts / ownerCompanyAnalysis.ts's normKey. */
export function normKeySql(col: string): string {
  return `TRIM(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(UPPER(${col}), r'\\.', ''), r'\\s*\\(', ' ('), r'\\s+', ' '))`;
}

/** SQL CASE yielding the pending owner for a company name column, else NULL. Use as COALESCE(m.Owner, <this>). */
export function pendingOwnerSql(nameCol: string): string {
  const key = normKeySql(nameCol);
  const whens = PENDING_OWNER_NAMES.map((p) => {
    const n = p.name.toUpperCase().replace(/\./g, "").replace(/'/g, "\\'");
    const cond = p.exact ? `${key} = '${n}'` : `(${key} = '${n}' OR STARTS_WITH(${key}, '${n} '))`;
    return `WHEN ${cond} THEN '${p.owner}'`;
  });
  return `CASE ${whens.join(" ")} END`;
}
