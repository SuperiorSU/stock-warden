const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const prisma = new PrismaClient();

const SLUG_PREFIX   = 'sviet-hist-';
const HIST_SUFFIX   = '.hist@sviet.ac.in';
const SEED_PWD      = 'StockWarden@2026';
const SESSION_YEAR  = 2026;

// ─── Employee map: normalized name → { email, fullName, dept, isExisting } ────
// auth '1507' / 'Enacell2273' in ISSUANCES are old-system authority codes (not DB IDs).
// They map to Ramanpreet Kaur / Jaspreet Singh IM respectively, looked up by email.
const EMPLOYEE_MAP = {
  'akshay kumar':        { email: 'hpadmission@sviet.ac.in',            fullName: 'Akshay Kumar',          dept: 'Admin Block', isExisting: true  },
  'manik dhiman':        { email: 'manikdhiman@sviet.ac.in',            fullName: 'Manik Dhiman',          dept: 'Admin Block', isExisting: false },
  'tarandeep singh':     { email: 'tarandeepsingh@sviet.ac.in',         fullName: 'Tarandeep Singh',       dept: 'Admin Block', isExisting: false },
  'jyotsna duggal':      { email: 'hr@sviet.ac.in',                     fullName: 'Jyotsna Duggal',        dept: 'Admin Block', isExisting: false },
  'meena thakur':        { email: 'principalsvce@sviet.ac.in',          fullName: 'Meena Thakur',          dept: 'Admin Block', isExisting: false },
  'rupinder kaur':       { email: 'rupinderkaur.ap@sviet.ac.in',        fullName: 'Rupinder Kaur',         dept: 'Admin Block', isExisting: false },
  'ankur gill':          { email: 'ankurgill6@gmail.com',               fullName: 'Ankur Gill',            dept: 'Admin Block', isExisting: false, password: 'Nanank@2626' },
  'pertik garg':         { email: 'directorplaning@sviet.ac.in',        fullName: 'Pertik Garg',           dept: 'Admin Block', isExisting: true  },
  'ashok garg':          { email: `ashok.garg${HIST_SUFFIX}`,           fullName: 'Ashok Garg',            dept: 'Admin Block', isExisting: false },
  'muzaffar ahmed':      { email: `muzaffar.ahmed${HIST_SUFFIX}`,       fullName: 'Muzaffar Ahmed',        dept: 'Admin Block', isExisting: false },
  'sunil kumar soni':    { email: `sunil.kumar.soni${HIST_SUFFIX}`,     fullName: 'Sunil Kumar Soni',      dept: 'Admin Block', isExisting: false },
  'rajesh kumar':        { email: `rajesh.kumar${HIST_SUFFIX}`,         fullName: 'Rajesh Kumar',          dept: 'Admin Block', isExisting: false },
  'talwinder singh':     { email: `talwinder.singh${HIST_SUFFIX}`,      fullName: 'Talwinder Singh',       dept: 'Admin Block', isExisting: false },
  'ankur garg':          { email: `ankur.garg${HIST_SUFFIX}`,           fullName: 'Ankur Garg',            dept: 'Admin Block', isExisting: false },
  'junaid majeed':       { email: `junaid.majeed${HIST_SUFFIX}`,        fullName: 'Junaid Majeed',         dept: 'Admin Block', isExisting: false },
  'kunal koul':          { email: `kunal.koul${HIST_SUFFIX}`,           fullName: 'Kunal Koul',            dept: 'Admin Block', isExisting: false },
  'jaspreet singh':      { email: `jaspreet.singh${HIST_SUFFIX}`,       fullName: 'Jaspreet Singh',        dept: 'Admin Block', isExisting: false },
  'jaspreet singh gill': { email: `jaspreet.singh.gill${HIST_SUFFIX}`,  fullName: 'Jaspreet Singh Gill',   dept: 'Admin Block', isExisting: false },
  'dr richa ranjan':     { email: `richa.ranjan${HIST_SUFFIX}`,         fullName: 'Dr Richa Ranjan',       dept: 'Admin Block', isExisting: false },
  'ajay malik':          { email: `ajay.malik${HIST_SUFFIX}`,           fullName: 'Ajay Malik',            dept: 'Admin Block', isExisting: false },
  'govind':              { email: `govind${HIST_SUFFIX}`,               fullName: 'Govind',                dept: 'Admin Block', isExisting: false },
  'vikrant s choudhary': { email: `vikrant.choudhary${HIST_SUFFIX}`,    fullName: 'Vikrant S Choudhary',   dept: 'Admin Block', isExisting: false },
  'amrik singh':         { email: `amrik.singh${HIST_SUFFIX}`,          fullName: 'Amrik Singh',           dept: 'Admin Block', isExisting: false },
  'vishal garg':         { email: `vishal.garg${HIST_SUFFIX}`,          fullName: 'Vishal Garg',           dept: 'Admin Block', isExisting: false },
  'ankur gupta':         { email: `ankur.gupta${HIST_SUFFIX}`,          fullName: 'Ankur Gupta',           dept: 'Admin Block', isExisting: false },
  'ashwani garg':        { email: `ashwani.garg${HIST_SUFFIX}`,         fullName: 'Ashwani Garg',          dept: 'Admin Block', isExisting: false },
  'shivani guleria':     { email: `shivani.guleria${HIST_SUFFIX}`,      fullName: 'Shivani Guleria',       dept: 'Admin Block', isExisting: false },
  'kuldeep singh':       { email: `kuldeep.singh${HIST_SUFFIX}`,        fullName: 'Kuldeep Singh',         dept: 'Admin Block', isExisting: false },
  'gaurav garg':         { email: `gaurav.garg${HIST_SUFFIX}`,          fullName: 'Gaurav Garg',           dept: 'Admin Block', isExisting: false },
  'sagar kumar':         { email: `sagar.kumar${HIST_SUFFIX}`,          fullName: 'Sagar Kumar',           dept: 'Admin Block', isExisting: false },
  'aaseesdeep singh':    { email: `aaseesdeep.singh${HIST_SUFFIX}`,     fullName: 'Aaseesdeep Singh',      dept: 'Admin Block', isExisting: false },
  'vikaram singh':       { email: `vikaram.singh${HIST_SUFFIX}`,        fullName: 'Vikaram Singh',         dept: 'Admin Block', isExisting: false },
};

// ─── Item config ───────────────────────────────────────────────────────────────
// remaining: known remaining stock after all issuances. null = random 100-1000.
// noHistory: true = old material, no issuance records exist for these.
const ITEM_CONFIG = [
  { name: 'Daily Planner 2026',           unit: 'pieces', unitPrice: '30.00',  remaining: 4700, category: 'Stationery'     },
  { name: 'Svcl Brochures 2026',          unit: 'pieces', unitPrice: '41.00',  remaining: 1000, category: 'Print Material' },
  { name: 'Svgoi Brochures 2026',         unit: 'pieces', unitPrice: '36.80',  remaining: 2500, category: 'Print Material' },
  { name: 'Sviet Brochures 2026',         unit: 'pieces', unitPrice: '36.80',  remaining: 2000, category: 'Print Material' },
  { name: 'Svpc Brochures 2026',          unit: 'pieces', unitPrice: '41.00',  remaining: 1000, category: 'Print Material' },
  { name: 'International Leaflets - 2026',unit: 'pieces', unitPrice: '2.00',   remaining: null, category: 'Print Material' },
  { name: 'Diary A 2026',                 unit: 'pieces', unitPrice: '600.00', remaining: null, category: 'Stationery'     },
  { name: 'Diary B 2026',                 unit: 'pieces', unitPrice: '260.00', remaining: null, category: 'Stationery'     },
  { name: 'Svce Brochures 2026',          unit: 'pieces', unitPrice: '20.00',  remaining: null, category: 'Print Material' },
  { name: 'Techlearns Brochures Old',     unit: 'pieces', unitPrice: '100.00', remaining: 315,  category: 'Print Material', noHistory: true },
  { name: 'College Register',             unit: 'pieces', unitPrice: '100.00', remaining: 4866, category: 'Stationery',     noHistory: true },
  { name: 'Trifold Old Brochures',        unit: 'pieces', unitPrice: '100.00', remaining: 1000, category: 'Print Material', noHistory: true },
];

// ─── All issuances from sheet-1 ────────────────────────────────────────────────
// auth '1507' = Ramanpreet Kaur (svietramanpreetkaur9592@gmail.com)
// auth 'Enacell2273' = Jaspreet Singh IM (jbhel781@gmail.com)
const ISSUANCES = [
  // ── 1507 (Ramanpreet Kaur) ──────────────────────────────────────────────────
  { auth: '1507',        date: '2025-12-10', name: 'Akshay Kumar',        item: 'Daily Planner 2026',            qty: 1400 },
  { auth: '1507',        date: '2025-12-10', name: 'Akshay Kumar',        item: 'Diary B 2026',                  qty: 120  },
  { auth: '1507',        date: '2025-12-10', name: 'Ashok Garg',          item: 'Diary B 2026',                  qty: 32   },
  { auth: '1507',        date: '2025-12-12', name: 'Ankur Gill',          item: 'Diary A 2026',                  qty: 24   },
  { auth: '1507',        date: '2025-12-12', name: 'Ashok Garg',          item: 'Diary A 2026',                  qty: 24   },
  { auth: '1507',        date: '2025-12-12', name: 'Manik Dhiman',        item: 'Diary B 2026',                  qty: 1    },
  { auth: '1507',        date: '2025-12-12', name: 'Muzaffar Ahmed',      item: 'Diary A 2026',                  qty: 48   },
  { auth: '1507',        date: '2025-12-12', name: 'Muzaffar Ahmed',      item: 'Diary B 2026',                  qty: 80   },
  { auth: '1507',        date: '2025-12-12', name: 'Tarandeep Singh',     item: 'Diary A 2026',                  qty: 4    },
  { auth: '1507',        date: '2025-12-12', name: 'Tarandeep Singh',     item: 'Diary B 2026',                  qty: 8    },
  { auth: '1507',        date: '2025-12-12', name: 'Vishal Garg',         item: 'Diary A 2026',                  qty: 24   },
  { auth: '1507',        date: '2025-12-16', name: 'Ankur Gupta',         item: 'Diary B 2026',                  qty: 1    },
  { auth: '1507',        date: '2025-12-16', name: 'Ashwani Garg',        item: 'Diary A 2026',                  qty: 24   },
  { auth: '1507',        date: '2025-12-16', name: 'Pertik Garg',         item: 'Diary A 2026',                  qty: 1    },
  { auth: '1507',        date: '2025-12-16', name: 'Pertik Garg',         item: 'Diary B 2026',                  qty: 2    },
  { auth: '1507',        date: '2025-12-16', name: 'Rupinder Kaur',       item: 'Diary B 2026',                  qty: 2    },
  { auth: '1507',        date: '2025-12-16', name: 'Vishal Garg',         item: 'Diary B 2026',                  qty: 24   },
  { auth: '1507',        date: '2025-12-17', name: 'Ashwani Garg',        item: 'Diary B 2026',                  qty: 5    },
  { auth: '1507',        date: '2025-12-18', name: 'Ankur Gill',          item: 'Diary A 2026',                  qty: 100  },
  { auth: '1507',        date: '2025-12-18', name: 'Ankur Gill',          item: 'Diary B 2026',                  qty: 200  },
  { auth: '1507',        date: '2025-12-19', name: 'Ashwani Garg',        item: 'Diary B 2026',                  qty: 30   },
  { auth: '1507',        date: '2025-12-22', name: 'Manik Dhiman',        item: 'Diary A 2026',                  qty: 20   },
  { auth: '1507',        date: '2025-12-22', name: 'Manik Dhiman',        item: 'Diary B 2026',                  qty: 30   },
  { auth: '1507',        date: '2025-12-22', name: 'Rajesh Kumar',        item: 'Diary A 2026',                  qty: 5    },
  { auth: '1507',        date: '2025-12-22', name: 'Rajesh Kumar',        item: 'Diary B 2026',                  qty: 10   },
  { auth: '1507',        date: '2025-12-24', name: 'Sunil Kumar Soni',    item: 'International Leaflets - 2026', qty: 10000},
  { auth: '1507',        date: '2026-01-09', name: 'Meena Thakur',        item: 'Daily Planner 2026',            qty: 500  },
  { auth: '1507',        date: '2026-01-09', name: 'Muzaffar Ahmed',      item: 'Diary A 2026',                  qty: 1    },
  { auth: '1507',        date: '2026-01-31', name: 'Dr Richa Ranjan',     item: 'Daily Planner 2026',            qty: 15   },
  { auth: '1507',        date: '2026-02-10', name: 'Shivani Guleria',     item: 'Diary B 2026',                  qty: 6    },
  { auth: '1507',        date: '2026-02-19', name: 'Kuldeep Singh',       item: 'Diary B 2026',                  qty: 2    },
  { auth: '1507',        date: '2026-02-20', name: 'Akshay Kumar',        item: 'Diary B 2026',                  qty: 60   },
  { auth: '1507',        date: '2026-03-18', name: 'Tarandeep Singh',     item: 'Daily Planner 2026',            qty: 140  },
  { auth: '1507',        date: '2026-03-20', name: 'Manik Dhiman',        item: 'Daily Planner 2026',            qty: 200  },
  { auth: '1507',        date: '2026-03-20', name: 'Tarandeep Singh',     item: 'Diary B 2026',                  qty: 11   },
  { auth: '1507',        date: '2026-03-23', name: 'Jaspreet Singh',      item: 'Daily Planner 2026',            qty: 100  },
  { auth: '1507',        date: '2026-03-23', name: 'Tarandeep Singh',     item: 'Daily Planner 2026',            qty: 200  },
  { auth: '1507',        date: '2026-04-02', name: 'Akshay Kumar',        item: 'Svcl Brochures 2026',           qty: 50   },
  { auth: '1507',        date: '2026-04-02', name: 'Akshay Kumar',        item: 'Svgoi Brochures 2026',          qty: 250  },
  { auth: '1507',        date: '2026-04-02', name: 'Akshay Kumar',        item: 'Sviet Brochures 2026',          qty: 150  },
  { auth: '1507',        date: '2026-04-02', name: 'Akshay Kumar',        item: 'Svpc Brochures 2026',           qty: 150  },
  { auth: '1507',        date: '2026-04-02', name: 'Muzaffar Ahmed',      item: 'Svcl Brochures 2026',           qty: 50   },
  { auth: '1507',        date: '2026-04-02', name: 'Muzaffar Ahmed',      item: 'Svgoi Brochures 2026',          qty: 250  },
  { auth: '1507',        date: '2026-04-02', name: 'Muzaffar Ahmed',      item: 'Sviet Brochures 2026',          qty: 150  },
  { auth: '1507',        date: '2026-04-02', name: 'Muzaffar Ahmed',      item: 'Svpc Brochures 2026',           qty: 150  },
  { auth: '1507',        date: '2026-04-08', name: 'Sunil Kumar Soni',    item: 'Svcl Brochures 2026',           qty: 3    },
  { auth: '1507',        date: '2026-04-08', name: 'Sunil Kumar Soni',    item: 'Svgoi Brochures 2026',          qty: 2    },
  { auth: '1507',        date: '2026-04-08', name: 'Sunil Kumar Soni',    item: 'Sviet Brochures 2026',          qty: 3    },
  { auth: '1507',        date: '2026-04-08', name: 'Sunil Kumar Soni',    item: 'Svpc Brochures 2026',           qty: 2    },
  { auth: '1507',        date: '2026-05-01', name: 'Akshay Kumar',        item: 'Daily Planner 2026',            qty: 1000 },
  { auth: '1507',        date: '2026-05-02', name: 'Ankur Gill',          item: 'Svcl Brochures 2026',           qty: 10   },
  { auth: '1507',        date: '2026-05-02', name: 'Ankur Gill',          item: 'Svgoi Brochures 2026',          qty: 10   },
  { auth: '1507',        date: '2026-05-02', name: 'Ankur Gill',          item: 'Sviet Brochures 2026',          qty: 10   },
  { auth: '1507',        date: '2026-05-02', name: 'Ankur Gill',          item: 'Svpc Brochures 2026',           qty: 10   },
  { auth: '1507',        date: '2026-05-04', name: 'Ankur Gill',          item: 'Sviet Brochures 2026',          qty: 60   },
  { auth: '1507',        date: '2026-05-13', name: 'Ajay Malik',          item: 'Daily Planner 2026',            qty: 100  },
  { auth: '1507',        date: '2026-05-13', name: 'Akshay Kumar',        item: 'Svcl Brochures 2026',           qty: 20   },
  { auth: '1507',        date: '2026-05-13', name: 'Akshay Kumar',        item: 'Svgoi Brochures 2026',          qty: 100  },
  { auth: '1507',        date: '2026-05-13', name: 'Akshay Kumar',        item: 'Sviet Brochures 2026',          qty: 30   },
  { auth: '1507',        date: '2026-05-13', name: 'Akshay Kumar',        item: 'Svpc Brochures 2026',           qty: 50   },
  { auth: '1507',        date: '2026-05-20', name: 'Akshay Kumar',        item: 'Svgoi Brochures 2026',          qty: 20   },
  { auth: '1507',        date: '2026-05-20', name: 'Meena Thakur',        item: 'Daily Planner 2026',            qty: 200  },
  { auth: '1507',        date: '2026-05-22', name: 'Ankur Garg',          item: 'Svcl Brochures 2026',           qty: 5    },
  { auth: '1507',        date: '2026-05-22', name: 'Ankur Garg',          item: 'Svgoi Brochures 2026',          qty: 5    },
  { auth: '1507',        date: '2026-05-22', name: 'Ankur Garg',          item: 'Sviet Brochures 2026',          qty: 5    },
  { auth: '1507',        date: '2026-05-22', name: 'Ankur Garg',          item: 'Svpc Brochures 2026',           qty: 5    },
  { auth: '1507',        date: '2026-05-22', name: 'Tarandeep Singh',     item: 'Svgoi Brochures 2026',          qty: 15   },
  { auth: '1507',        date: '2026-05-22', name: 'Tarandeep Singh',     item: 'Sviet Brochures 2026',          qty: 15   },
  { auth: '1507',        date: '2026-05-22', name: 'Tarandeep Singh',     item: 'Svpc Brochures 2026',           qty: 15   },
  { auth: '1507',        date: '2026-06-06', name: 'Tarandeep Singh',     item: 'Daily Planner 2026',            qty: 600  },
  { auth: '1507',        date: '2026-06-08', name: 'Ankur Gill',          item: 'Svgoi Brochures 2026',          qty: 40   },
  { auth: '1507',        date: '2026-06-08', name: 'Ankur Gill',          item: 'Svpc Brochures 2026',           qty: 15   },
  { auth: '1507',        date: '2026-06-08', name: 'Meena Thakur',        item: 'Svce Brochures 2026',           qty: 100  },
  { auth: '1507',        date: '2026-06-16', name: 'Akshay Kumar',        item: 'Svce Brochures 2026',           qty: 25   },
  { auth: '1507',        date: '2026-06-16', name: 'Vikrant S Choudhary', item: 'Svcl Brochures 2026',           qty: 25   },
  { auth: '1507',        date: '2026-06-16', name: 'Vikrant S Choudhary', item: 'Svgoi Brochures 2026',          qty: 25   },
  { auth: '1507',        date: '2026-06-16', name: 'Vikrant S Choudhary', item: 'Sviet Brochures 2026',          qty: 25   },
  { auth: '1507',        date: '2026-06-16', name: 'Vikrant S Choudhary', item: 'Svpc Brochures 2026',           qty: 20   },
  // ── Enacell2273 (Jaspreet Singh IM) ─────────────────────────────────────────
  { auth: 'Enacell2273', date: '2025-12-05', name: 'Akshay Kumar',        item: 'Daily Planner 2026',            qty: 10   },
  { auth: 'Enacell2273', date: '2025-12-05', name: 'Akshay Kumar',        item: 'Daily Planner 2026',            qty: 600  },
  { auth: 'Enacell2273', date: '2025-12-11', name: 'Manik Dhiman',        item: 'Diary B 2026',                  qty: 1    },
  { auth: 'Enacell2273', date: '2025-12-18', name: 'Akshay Kumar',        item: 'Diary A 2026',                  qty: 40   },
  { auth: 'Enacell2273', date: '2025-12-18', name: 'Jaspreet Singh',      item: 'Diary A 2026',                  qty: 10   },
  { auth: 'Enacell2273', date: '2025-12-18', name: 'Jaspreet Singh',      item: 'Diary B 2026',                  qty: 10   },
  { auth: 'Enacell2273', date: '2025-12-18', name: 'Manik Dhiman',        item: 'Daily Planner 2026',            qty: 100  },
  { auth: 'Enacell2273', date: '2025-12-18', name: 'Manik Dhiman',        item: 'Diary A 2026',                  qty: 20   },
  { auth: 'Enacell2273', date: '2025-12-18', name: 'Manik Dhiman',        item: 'Diary B 2026',                  qty: 20   },
  { auth: 'Enacell2273', date: '2025-12-18', name: 'Rajesh Kumar',        item: 'Diary B 2026',                  qty: 2    },
  { auth: 'Enacell2273', date: '2025-12-19', name: 'Akshay Kumar',        item: 'Daily Planner 2026',            qty: 1000 },
  { auth: 'Enacell2273', date: '2025-12-19', name: 'Akshay Kumar',        item: 'Diary A 2026',                  qty: 30   },
  { auth: 'Enacell2273', date: '2025-12-19', name: 'Akshay Kumar',        item: 'Diary B 2026',                  qty: 30   },
  { auth: 'Enacell2273', date: '2025-12-19', name: 'Talwinder Singh',     item: 'Diary A 2026',                  qty: 5    },
  { auth: 'Enacell2273', date: '2025-12-19', name: 'Talwinder Singh',     item: 'Diary B 2026',                  qty: 8    },
  { auth: 'Enacell2273', date: '2025-12-19', name: 'Tarandeep Singh',     item: 'Diary A 2026',                  qty: 5    },
  { auth: 'Enacell2273', date: '2025-12-19', name: 'Tarandeep Singh',     item: 'Diary B 2026',                  qty: 5    },
  { auth: 'Enacell2273', date: '2025-12-19', name: 'Vikrant S Choudhary', item: 'Diary A 2026',                  qty: 50   },
  { auth: 'Enacell2273', date: '2025-12-19', name: 'Vikrant S Choudhary', item: 'Diary B 2026',                  qty: 70   },
  { auth: 'Enacell2273', date: '2025-12-23', name: 'Vikaram Singh',       item: 'Diary B 2026',                  qty: 10   },
  { auth: 'Enacell2273', date: '2025-12-26', name: 'Sunil Kumar Soni',    item: 'Diary A 2026',                  qty: 7    },
  { auth: 'Enacell2273', date: '2025-12-26', name: 'Sunil Kumar Soni',    item: 'Diary B 2026',                  qty: 8    },
  { auth: 'Enacell2273', date: '2025-12-26', name: 'Talwinder Singh',     item: 'Diary A 2026',                  qty: 10   },
  { auth: 'Enacell2273', date: '2025-12-26', name: 'Talwinder Singh',     item: 'Diary B 2026',                  qty: 20   },
  { auth: 'Enacell2273', date: '2025-12-29', name: 'Jaspreet Singh',      item: 'Diary A 2026',                  qty: 2    },
  { auth: 'Enacell2273', date: '2025-12-29', name: 'Jaspreet Singh',      item: 'Diary A 2026',                  qty: 7    },
  { auth: 'Enacell2273', date: '2025-12-29', name: 'Jaspreet Singh',      item: 'Diary B 2026',                  qty: 10   },
  { auth: 'Enacell2273', date: '2025-12-29', name: 'Rajesh Kumar',        item: 'Daily Planner 2026',            qty: 100  },
  { auth: 'Enacell2273', date: '2025-12-29', name: 'Tarandeep Singh',     item: 'Diary A 2026',                  qty: 15   },
  { auth: 'Enacell2273', date: '2025-12-29', name: 'Tarandeep Singh',     item: 'Diary B 2026',                  qty: 20   },
  { auth: 'Enacell2273', date: '2025-12-30', name: 'Jyotsna Duggal',      item: 'Diary A 2026',                  qty: 2    },
  { auth: 'Enacell2273', date: '2025-12-31', name: 'Manik Dhiman',        item: 'Daily Planner 2026',            qty: 200  },
  { auth: 'Enacell2273', date: '2025-12-31', name: 'Talwinder Singh',     item: 'Daily Planner 2026',            qty: 20   },
  { auth: 'Enacell2273', date: '2026-01-02', name: 'Ankur Garg',          item: 'Daily Planner 2026',            qty: 300  },
  { auth: 'Enacell2273', date: '2026-01-02', name: 'Ankur Garg',          item: 'Diary B 2026',                  qty: 50   },
  { auth: 'Enacell2273', date: '2026-01-02', name: 'Jyotsna Duggal',      item: 'Diary A 2026',                  qty: 7    },
  { auth: 'Enacell2273', date: '2026-01-02', name: 'Jyotsna Duggal',      item: 'Diary B 2026',                  qty: 17   },
  { auth: 'Enacell2273', date: '2026-01-02', name: 'Talwinder Singh',     item: 'Daily Planner 2026',            qty: 20   },
  { auth: 'Enacell2273', date: '2026-01-03', name: 'Junaid Majeed',       item: 'Daily Planner 2026',            qty: 20   },
  { auth: 'Enacell2273', date: '2026-01-03', name: 'Junaid Majeed',       item: 'Diary B 2026',                  qty: 2    },
  { auth: 'Enacell2273', date: '2026-01-03', name: 'Manik Dhiman',        item: 'Diary B 2026',                  qty: 30   },
  { auth: 'Enacell2273', date: '2026-01-05', name: 'Jyotsna Duggal',      item: 'Diary B 2026',                  qty: 3    },
  { auth: 'Enacell2273', date: '2026-01-05', name: 'Kunal Koul',          item: 'Daily Planner 2026',            qty: 100  },
  { auth: 'Enacell2273', date: '2026-01-05', name: 'Kunal Koul',          item: 'Diary A 2026',                  qty: 2    },
  { auth: 'Enacell2273', date: '2026-01-05', name: 'Tarandeep Singh',     item: 'Daily Planner 2026',            qty: 150  },
  { auth: 'Enacell2273', date: '2026-01-05', name: 'Tarandeep Singh',     item: 'Diary B 2026',                  qty: 10   },
  { auth: 'Enacell2273', date: '2026-01-06', name: 'Ankur Garg',          item: 'Diary B 2026',                  qty: 20   },
  { auth: 'Enacell2273', date: '2026-01-09', name: 'Ashwani Garg',        item: 'Diary B 2026',                  qty: 5    },
  { auth: 'Enacell2273', date: '2026-01-09', name: 'Jaspreet Singh',      item: 'Daily Planner 2026',            qty: 150  },
  { auth: 'Enacell2273', date: '2026-01-09', name: 'Pertik Garg',         item: 'Diary A 2026',                  qty: 4    },
  { auth: 'Enacell2273', date: '2026-01-12', name: 'Rajesh Kumar',        item: 'Diary B 2026',                  qty: 10   },
  { auth: 'Enacell2273', date: '2026-01-12', name: 'Talwinder Singh',     item: 'Daily Planner 2026',            qty: 20   },
  { auth: 'Enacell2273', date: '2026-01-14', name: 'Gaurav Garg',         item: 'Diary B 2026',                  qty: 40   },
  { auth: 'Enacell2273', date: '2026-01-14', name: 'Jaspreet Singh',      item: 'Diary B 2026',                  qty: 10   },
  { auth: 'Enacell2273', date: '2026-01-17', name: 'Muzaffar Ahmed',      item: 'Diary B 2026',                  qty: 3    },
  { auth: 'Enacell2273', date: '2026-01-19', name: 'Muzaffar Ahmed',      item: 'Daily Planner 2026',            qty: 800  },
  { auth: 'Enacell2273', date: '2026-01-19', name: 'Muzaffar Ahmed',      item: 'Diary B 2026',                  qty: 30   },
  { auth: 'Enacell2273', date: '2026-01-20', name: 'Muzaffar Ahmed',      item: 'Diary A 2026',                  qty: 2    },
  { auth: 'Enacell2273', date: '2026-01-21', name: 'Jaspreet Singh',      item: 'Diary B 2026',                  qty: 4    },
  { auth: 'Enacell2273', date: '2026-01-21', name: 'Jaspreet Singh Gill', item: 'Diary B 2026',                  qty: 4    },
  { auth: 'Enacell2273', date: '2026-01-21', name: 'Sagar Kumar',         item: 'Diary A 2026',                  qty: 1    },
  { auth: 'Enacell2273', date: '2026-01-28', name: 'Ajay Malik',          item: 'Diary B 2026',                  qty: 2    },
  { auth: 'Enacell2273', date: '2026-01-29', name: 'Ankur Garg',          item: 'Daily Planner 2026',            qty: 50   },
  { auth: 'Enacell2273', date: '2026-01-29', name: 'Meena Thakur',        item: 'Diary B 2026',                  qty: 2    },
  { auth: 'Enacell2273', date: '2026-02-02', name: 'Ajay Malik',          item: 'Daily Planner 2026',            qty: 20   },
  { auth: 'Enacell2273', date: '2026-02-03', name: 'Govind',              item: 'Daily Planner 2026',            qty: 50   },
  { auth: 'Enacell2273', date: '2026-02-06', name: 'Amrik Singh',         item: 'Diary B 2026',                  qty: 10   },
  { auth: 'Enacell2273', date: '2026-02-06', name: 'Manik Dhiman',        item: 'Daily Planner 2026',            qty: 200  },
  { auth: 'Enacell2273', date: '2026-02-06', name: 'Talwinder Singh',     item: 'Diary B 2026',                  qty: 15   },
  { auth: 'Enacell2273', date: '2026-02-06', name: 'Tarandeep Singh',     item: 'Diary B 2026',                  qty: 10   },
  { auth: 'Enacell2273', date: '2026-02-07', name: 'Ajay Malik',          item: 'Diary B 2026',                  qty: 8    },
  { auth: 'Enacell2273', date: '2026-02-09', name: 'Jyotsna Duggal',      item: 'Diary A 2026',                  qty: 1    },
  { auth: 'Enacell2273', date: '2026-02-10', name: 'Govind',              item: 'Daily Planner 2026',            qty: 600  },
  { auth: 'Enacell2273', date: '2026-02-10', name: 'Govind',              item: 'Diary B 2026',                  qty: 20   },
  { auth: 'Enacell2273', date: '2026-02-10', name: 'Manik Dhiman',        item: 'Daily Planner 2026',            qty: 100  },
  { auth: 'Enacell2273', date: '2026-02-10', name: 'Manik Dhiman',        item: 'Diary B 2026',                  qty: 15   },
  { auth: 'Enacell2273', date: '2026-02-10', name: 'Rajesh Kumar',        item: 'Daily Planner 2026',            qty: 50   },
  { auth: 'Enacell2273', date: '2026-02-10', name: 'Rajesh Kumar',        item: 'Diary B 2026',                  qty: 10   },
  { auth: 'Enacell2273', date: '2026-02-10', name: 'Tarandeep Singh',     item: 'Daily Planner 2026',            qty: 200  },
  { auth: 'Enacell2273', date: '2026-02-11', name: 'Tarandeep Singh',     item: 'Diary B 2026',                  qty: 15   },
  { auth: 'Enacell2273', date: '2026-02-17', name: 'Jaspreet Singh',      item: 'Daily Planner 2026',            qty: 500  },
  { auth: 'Enacell2273', date: '2026-02-17', name: 'Manik Dhiman',        item: 'Daily Planner 2026',            qty: 500  },
  { auth: 'Enacell2273', date: '2026-02-17', name: 'Rajesh Kumar',        item: 'Daily Planner 2026',            qty: 400  },
  { auth: 'Enacell2273', date: '2026-02-17', name: 'Tarandeep Singh',     item: 'Daily Planner 2026',            qty: 500  },
  { auth: 'Enacell2273', date: '2026-02-17', name: 'Vikrant S Choudhary', item: 'Daily Planner 2026',            qty: 400  },
  { auth: 'Enacell2273', date: '2026-02-24', name: 'Amrik Singh',         item: 'Daily Planner 2026',            qty: 100  },
  { auth: 'Enacell2273', date: '2026-02-24', name: 'Amrik Singh',         item: 'Diary B 2026',                  qty: 15   },
  { auth: 'Enacell2273', date: '2026-02-24', name: 'Govind',              item: 'Daily Planner 2026',            qty: 700  },
  { auth: 'Enacell2273', date: '2026-02-24', name: 'Govind',              item: 'Diary B 2026',                  qty: 30   },
  { auth: 'Enacell2273', date: '2026-02-26', name: 'Jaspreet Singh',      item: 'Daily Planner 2026',            qty: 50   },
  { auth: 'Enacell2273', date: '2026-03-02', name: 'Jaspreet Singh',      item: 'Daily Planner 2026',            qty: 150  },
  { auth: 'Enacell2273', date: '2026-03-02', name: 'Manik Dhiman',        item: 'Diary A 2026',                  qty: 1    },
  { auth: 'Enacell2273', date: '2026-03-07', name: 'Tarandeep Singh',     item: 'Daily Planner 2026',            qty: 50   },
  { auth: 'Enacell2273', date: '2026-03-07', name: 'Tarandeep Singh',     item: 'Daily Planner 2026',            qty: 200  },
  { auth: 'Enacell2273', date: '2026-03-09', name: 'Rajesh Kumar',        item: 'Daily Planner 2026',            qty: 100  },
  { auth: 'Enacell2273', date: '2026-03-11', name: 'Aaseesdeep Singh',    item: 'Diary B 2026',                  qty: 1    },
  { auth: 'Enacell2273', date: '2026-03-11', name: 'Manik Dhiman',        item: 'Daily Planner 2026',            qty: 25   },
  { auth: 'Enacell2273', date: '2026-03-11', name: 'Manik Dhiman',        item: 'Daily Planner 2026',            qty: 175  },
  { auth: 'Enacell2273', date: '2026-03-11', name: 'Vikrant S Choudhary', item: 'Daily Planner 2026',            qty: 700  },
  { auth: 'Enacell2273', date: '2026-03-11', name: 'Vikrant S Choudhary', item: 'Diary B 2026',                  qty: 50   },
  { auth: 'Enacell2273', date: '2026-03-12', name: 'Ajay Malik',          item: 'Daily Planner 2026',            qty: 100  },
  { auth: 'Enacell2273', date: '2026-03-12', name: 'Manik Dhiman',        item: 'Daily Planner 2026',            qty: 50   },
  { auth: 'Enacell2273', date: '2026-03-12', name: 'Tarandeep Singh',     item: 'Daily Planner 2026',            qty: 100  },
  { auth: 'Enacell2273', date: '2026-03-12', name: 'Tarandeep Singh',     item: 'Diary B 2026',                  qty: 3    },
  { auth: 'Enacell2273', date: '2026-03-16', name: 'Ankur Gill',          item: 'Diary B 2026',                  qty: 10   },
  { auth: 'Enacell2273', date: '2026-03-20', name: 'Jaspreet Singh',      item: 'Daily Planner 2026',            qty: 100  },
  { auth: 'Enacell2273', date: '2026-03-20', name: 'Rajesh Kumar',        item: 'Daily Planner 2026',            qty: 200  },
  { auth: 'Enacell2273', date: '2026-03-20', name: 'Talwinder Singh',     item: 'Daily Planner 2026',            qty: 200  },
  { auth: 'Enacell2273', date: '2026-03-23', name: 'Tarandeep Singh',     item: 'Daily Planner 2026',            qty: 100  },
  { auth: 'Enacell2273', date: '2026-03-25', name: 'Tarandeep Singh',     item: 'Daily Planner 2026',            qty: 100  },
  { auth: 'Enacell2273', date: '2026-04-09', name: 'Govind',              item: 'Svcl Brochures 2026',           qty: 10   },
  { auth: 'Enacell2273', date: '2026-04-09', name: 'Govind',              item: 'Svgoi Brochures 2026',          qty: 10   },
  { auth: 'Enacell2273', date: '2026-04-09', name: 'Govind',              item: 'Sviet Brochures 2026',          qty: 10   },
  { auth: 'Enacell2273', date: '2026-04-09', name: 'Govind',              item: 'Svpc Brochures 2026',           qty: 10   },
  { auth: 'Enacell2273', date: '2026-04-09', name: 'Jaspreet Singh',      item: 'Svcl Brochures 2026',           qty: 5    },
  { auth: 'Enacell2273', date: '2026-04-09', name: 'Jaspreet Singh',      item: 'Svgoi Brochures 2026',          qty: 5    },
  { auth: 'Enacell2273', date: '2026-04-09', name: 'Jaspreet Singh',      item: 'Sviet Brochures 2026',          qty: 5    },
  { auth: 'Enacell2273', date: '2026-04-09', name: 'Jaspreet Singh',      item: 'Svpc Brochures 2026',           qty: 5    },
  { auth: 'Enacell2273', date: '2026-04-10', name: 'Ajay Malik',          item: 'Svcl Brochures 2026',           qty: 5    },
  { auth: 'Enacell2273', date: '2026-04-10', name: 'Ajay Malik',          item: 'Svgoi Brochures 2026',          qty: 20   },
  { auth: 'Enacell2273', date: '2026-04-10', name: 'Ajay Malik',          item: 'Sviet Brochures 2026',          qty: 5    },
  { auth: 'Enacell2273', date: '2026-04-10', name: 'Ajay Malik',          item: 'Svpc Brochures 2026',           qty: 5    },
  { auth: 'Enacell2273', date: '2026-04-11', name: 'Tarandeep Singh',     item: 'Svpc Brochures 2026',           qty: 1    },
  { auth: 'Enacell2273', date: '2026-04-14', name: 'Ankur Gill',          item: 'Svcl Brochures 2026',           qty: 20   },
  { auth: 'Enacell2273', date: '2026-04-14', name: 'Ankur Gill',          item: 'Svgoi Brochures 2026',          qty: 30   },
  { auth: 'Enacell2273', date: '2026-04-14', name: 'Ankur Gill',          item: 'Sviet Brochures 2026',          qty: 30   },
  { auth: 'Enacell2273', date: '2026-04-14', name: 'Ankur Gill',          item: 'Svpc Brochures 2026',           qty: 20   },
  { auth: 'Enacell2273', date: '2026-04-14', name: 'Rajesh Kumar',        item: 'Svcl Brochures 2026',           qty: 15   },
  { auth: 'Enacell2273', date: '2026-04-14', name: 'Rajesh Kumar',        item: 'Svgoi Brochures 2026',          qty: 25   },
  { auth: 'Enacell2273', date: '2026-04-14', name: 'Rajesh Kumar',        item: 'Sviet Brochures 2026',          qty: 15   },
  { auth: 'Enacell2273', date: '2026-04-14', name: 'Rajesh Kumar',        item: 'Svpc Brochures 2026',           qty: 15   },
  { auth: 'Enacell2273', date: '2026-04-14', name: 'Tarandeep Singh',     item: 'Svgoi Brochures 2026',          qty: 8    },
  { auth: 'Enacell2273', date: '2026-04-18', name: 'Ankur Garg',          item: 'Daily Planner 2026',            qty: 200  },
  { auth: 'Enacell2273', date: '2026-04-18', name: 'Ankur Garg',          item: 'Svcl Brochures 2026',           qty: 50   },
  { auth: 'Enacell2273', date: '2026-04-18', name: 'Ankur Garg',          item: 'Svgoi Brochures 2026',          qty: 150  },
  { auth: 'Enacell2273', date: '2026-04-18', name: 'Ankur Garg',          item: 'Sviet Brochures 2026',          qty: 150  },
  { auth: 'Enacell2273', date: '2026-04-18', name: 'Ankur Garg',          item: 'Svpc Brochures 2026',           qty: 250  },
  { auth: 'Enacell2273', date: '2026-04-23', name: 'Manik Dhiman',        item: 'Svcl Brochures 2026',           qty: 15   },
  { auth: 'Enacell2273', date: '2026-04-23', name: 'Manik Dhiman',        item: 'Svgoi Brochures 2026',          qty: 15   },
  { auth: 'Enacell2273', date: '2026-04-23', name: 'Manik Dhiman',        item: 'Sviet Brochures 2026',          qty: 15   },
  { auth: 'Enacell2273', date: '2026-04-23', name: 'Manik Dhiman',        item: 'Svpc Brochures 2026',           qty: 15   },
  { auth: 'Enacell2273', date: '2026-04-28', name: 'Manik Dhiman',        item: 'Svcl Brochures 2026',           qty: 10   },
  { auth: 'Enacell2273', date: '2026-04-28', name: 'Tarandeep Singh',     item: 'Svcl Brochures 2026',           qty: 20   },
  { auth: 'Enacell2273', date: '2026-04-28', name: 'Tarandeep Singh',     item: 'Svgoi Brochures 2026',          qty: 20   },
  { auth: 'Enacell2273', date: '2026-04-28', name: 'Tarandeep Singh',     item: 'Sviet Brochures 2026',          qty: 20   },
  { auth: 'Enacell2273', date: '2026-04-28', name: 'Tarandeep Singh',     item: 'Svpc Brochures 2026',           qty: 20   },
  { auth: 'Enacell2273', date: '2026-04-30', name: 'Akshay Kumar',        item: 'Daily Planner 2026',            qty: 100  },
  { auth: 'Enacell2273', date: '2026-04-30', name: 'Akshay Kumar',        item: 'Svcl Brochures 2026',           qty: 10   },
  { auth: 'Enacell2273', date: '2026-04-30', name: 'Akshay Kumar',        item: 'Svgoi Brochures 2026',          qty: 40   },
  { auth: 'Enacell2273', date: '2026-04-30', name: 'Akshay Kumar',        item: 'Sviet Brochures 2026',          qty: 30   },
  { auth: 'Enacell2273', date: '2026-04-30', name: 'Akshay Kumar',        item: 'Svpc Brochures 2026',           qty: 30   },
  { auth: 'Enacell2273', date: '2026-06-12', name: 'Ajay Malik',          item: 'Daily Planner 2026',            qty: 3    },
  { auth: 'Enacell2273', date: '2026-06-12', name: 'Ajay Malik',          item: 'Daily Planner 2026',            qty: 30   },
  { auth: 'Enacell2273', date: '2026-06-12', name: 'Ajay Malik',          item: 'Svce Brochures 2026',           qty: 4    },
  { auth: 'Enacell2273', date: '2026-06-12', name: 'Ajay Malik',          item: 'Svcl Brochures 2026',           qty: 4    },
  { auth: 'Enacell2273', date: '2026-06-12', name: 'Ajay Malik',          item: 'Sviet Brochures 2026',          qty: 4    },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function normKey(name) { return name.trim().toLowerCase().replace(/\s+/g, ' '); }
function toSlug(name)  { return `${SLUG_PREFIX}${name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}`; }
function randRemaining(){ return Math.floor(Math.random() * 901) + 100; }
function pad(n, w = 4)  { return String(n).padStart(w, '0'); }
function msToDate(ms)   { return new Date(ms); }

async function main() {
  const passwordHash = await argon2.hash(SEED_PWD, {
    type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 2,
  });

  // ── 1. Look up required existing users ──────────────────────────────────────
  console.log('Looking up existing users...');
  const admin       = await prisma.user.findUniqueOrThrow({ where: { email: 'svietadmission@sviet.ac.in' } });
  const imJaspreet  = await prisma.user.findUniqueOrThrow({ where: { email: 'jbhel781@gmail.com' } });
  const imRamanpreet= await prisma.user.findUniqueOrThrow({ where: { email: 'svietramanpreetkaur9592@gmail.com' } });

  // IM map: auth → IM user
  const IM_USER = { '1507': imRamanpreet, 'Enacell2273': imJaspreet };

  // ── 2. Create / upsert all employee users ────────────────────────────────────
  console.log('Creating employee users...');
  const userByKey = {}; // normKey → User record

  for (const [key, emp] of Object.entries(EMPLOYEE_MAP)) {
    if (emp.isExisting) {
      const u = await prisma.user.findUniqueOrThrow({ where: { email: emp.email } });
      userByKey[key] = u;
    } else {
      const hash = emp.password
        ? await argon2.hash(emp.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 2 })
        : passwordHash;
      const u = await prisma.user.upsert({
        where:  { email: emp.email },
        update: { name: emp.fullName, isActive: true, isApproved: true,
                  ...(emp.dept ? { department: emp.dept } : {}) },
        create: { email: emp.email, name: emp.fullName, role: 'USER',
                  department: emp.dept ?? 'Admin Block', passwordHash: hash,
                  isActive: true, isApproved: true },
      });
      userByKey[key] = u;
    }
  }

  // ── 3. Compute item totals from issuance data ────────────────────────────────
  console.log('Computing item totals...');
  const totalIssuedMap = {};
  for (const iso of ISSUANCES) {
    totalIssuedMap[iso.item] = (totalIssuedMap[iso.item] || 0) + iso.qty;
  }

  // ── 4. Create inventory items ────────────────────────────────────────────────
  console.log('Creating inventory items...');
  const itemByName = {};
  const itemRemaining = {};

  for (const cfg of ITEM_CONFIG) {
    const rem  = cfg.remaining !== null ? cfg.remaining : randRemaining();
    const issued = totalIssuedMap[cfg.name] || 0;
    const total  = issued + rem;
    itemRemaining[cfg.name] = rem;

    const slug = toSlug(cfg.name);
    const common = {
      name: cfg.name, category: cfg.category, unit: cfg.unit,
      description: `${cfg.name} — imported from previous system.`,
      totalQuantity: total, availableQty: total,
      sessionYear: SESSION_YEAR, isActive: true, isStale: false,
      unitPrice: cfg.unitPrice, currency: 'INR',
    };
    const item = await prisma.inventoryItem.upsert({
      where:  { slug },
      update: common,
      create: { ...common, slug, createdBy: admin.id },
    });
    itemByName[cfg.name] = item;
  }

  // ── 5. Pre-compute quantityAfter for each issuance (chronological) ──────────
  console.log('Pre-computing stock running balances...');
  const sortedIso = [...ISSUANCES].sort((a, b) => new Date(a.date) - new Date(b.date));
  const runBal = {};
  for (const cfg of ITEM_CONFIG) {
    runBal[cfg.name] = (totalIssuedMap[cfg.name] || 0) + (itemRemaining[cfg.name] || 0);
  }
  for (const iso of sortedIso) {
    runBal[iso.item] -= iso.qty;
    iso._after = runBal[iso.item];
  }

  // ── 6. Initial ADDED stock history for each item ─────────────────────────────
  console.log('Creating initial stock history...');
  const seedStart = new Date('2025-12-01T08:00:00Z');
  for (const cfg of ITEM_CONFIG) {
    const item  = itemByName[cfg.name];
    const total = item.totalQuantity;
    await prisma.stockHistory.create({
      data: {
        itemId: item.id, changeType: 'ADDED',
        quantityDelta: total, quantityAfter: total,
        changedBy: admin.id,
        notes: `Initial stock loaded from previous system.`,
        createdAt: seedStart,
      },
    });
  }

  // ── 7. Group issuances by (employee, IM) ─────────────────────────────────────
  console.log('Grouping issuances by employee + inventory manager...');
  const groups = {};
  for (const iso of sortedIso) {
    const empKey = normKey(iso.name);
    const grpKey = `${empKey}|${iso.auth}`;
    if (!groups[grpKey]) {
      groups[grpKey] = { empKey, auth: iso.auth, rows: [] };
    }
    groups[grpKey].rows.push(iso);
  }

  // ── 8. Create Requests, RequestItems, history, expenditure per group ─────────
  console.log('Creating requests and all related records...');
  let reqIndex = 1;

  for (const [grpKey, grp] of Object.entries(groups)) {
    const empInfo = EMPLOYEE_MAP[grp.empKey];
    if (!empInfo) {
      console.warn(`  ⚠ No employee mapping for: "${grp.empKey}" — skipping`);
      continue;
    }

    const empUser  = userByKey[grp.empKey];
    const imUser   = IM_USER[grp.auth];
    const firstMs  = Math.min(...grp.rows.map(r => new Date(r.date).getTime()));
    const firstDate = msToDate(firstMs);
    const createdAt = msToDate(firstMs - 2 * 86400000);
    const pendingAt = msToDate(firstMs - 1 * 86400000);
    const approvedAt = firstDate;

    const receiptNumber = `SVHIST-${SESSION_YEAR}-${pad(reqIndex)}`;
    const invoiceNumber = `INV-HIST-${SESSION_YEAR}-${pad(reqIndex)}`;
    reqIndex++;

    // Aggregate quantities per item for this group
    const itemTotals = {};
    for (const row of grp.rows) {
      itemTotals[row.item] = (itemTotals[row.item] || 0) + row.qty;
    }

    // Create request
    const req = await prisma.request.create({
      data: {
        userId: empUser.id,
        status: 'APPROVED',
        notes: 'Imported from previous stock management system.',
        adminId: admin.id,
        adminNotes: 'Approved — historical import.',
        inventoryManagerId: imUser.id,
        inventoryManagerNotes: 'Fulfilled — historical import.',
        invoiceNumber,
        receiptNumber,
        sessionYear: SESSION_YEAR,
        createdAt,
        processedAt: approvedAt,
        inventoryProcessedAt: approvedAt,
      },
    });

    // Create RequestItems + ExpenditureRecords
    for (const [itemName, qty] of Object.entries(itemTotals)) {
      const invItem = itemByName[itemName];
      if (!invItem) continue;

      const ri = await prisma.requestItem.create({
        data: {
          requestId: req.id, itemId: invItem.id,
          quantityReq: qty, quantityAllocated: qty, quantityFul: qty,
          createdAt,
        },
      });

      const unitPriceNum = parseFloat(invItem.unitPrice);
      await prisma.expenditureRecord.create({
        data: {
          requestId: req.id, requestItemId: ri.id,
          itemId: invItem.id, itemName: invItem.name,
          category: invItem.category ?? '',
          unitPrice: invItem.unitPrice,
          quantityFulfilled: qty,
          totalAmount: (unitPriceNum * qty).toFixed(2),
          sessionYear: SESSION_YEAR,
          approvedAt,
          approvedBy: admin.id,
          department: empUser.department ?? empInfo.dept ?? 'Staff',
        },
      });
    }

    // RequestStatusHistory
    await prisma.requestStatusHistory.createMany({
      data: [
        { requestId: req.id, toStatus: 'REQUESTED',  changedBy: empUser.id, createdAt },
        { requestId: req.id, fromStatus: 'REQUESTED', toStatus: 'PENDING',  changedBy: admin.id,   createdAt: pendingAt },
        { requestId: req.id, fromStatus: 'PENDING',   toStatus: 'APPROVED', changedBy: admin.id,   notes: 'Historical import approval.', createdAt: approvedAt },
      ],
    });

    // StockHistory — one row per original issuance (preserves full history)
    for (const row of grp.rows) {
      const invItem = itemByName[row.item];
      if (!invItem) continue;
      await prisma.stockHistory.create({
        data: {
          itemId: invItem.id, changeType: 'FULFILLED',
          quantityDelta: -row.qty, quantityAfter: row._after,
          changedBy: imUser.id, requestId: req.id,
          notes: `Issued to ${empInfo.fullName}.`,
          createdAt: new Date(row.date),
        },
      });
    }

    // Notification for employee
    await prisma.notification.create({
      data: {
        userId: empUser.id, requestId: req.id,
        type: 'REQUEST_APPROVED', title: 'Items Issued',
        message: `Your stationery/print material request has been fulfilled (${receiptNumber}).`,
        isRead: true, createdAt: approvedAt,
      },
    });

    // AuditLog
    await prisma.auditLog.createMany({
      data: [
        { userId: admin.id,  action: 'APPROVE_REQUEST', entity: 'Request', entityId: req.id, metadata: { receipt: receiptNumber, employee: empInfo.fullName }, createdAt: approvedAt },
        { userId: imUser.id, action: 'FULFIL_REQUEST',  entity: 'Request', entityId: req.id, metadata: { receipt: receiptNumber, items: Object.keys(itemTotals) }, createdAt: approvedAt },
      ],
    });
  }

  // ── 9. Update availableQty on all items to correct remaining values ──────────
  console.log('Setting final availableQty on items...');
  for (const cfg of ITEM_CONFIG) {
    await prisma.inventoryItem.update({
      where: { id: itemByName[cfg.name].id },
      data:  { availableQty: itemRemaining[cfg.name] },
    });
  }

  // ── Done ─────────────────────────────────────────────────────────────────────
  const groupCount = Object.keys(groups).length;
  console.log(`\nSeed-sviet complete.`);
  console.log(`  Employees:       ${Object.keys(userByKey).length}`);
  console.log(`  Inventory items: ${ITEM_CONFIG.length}`);
  console.log(`  Requests:        ${groupCount}`);
  console.log(`  Issuances:       ${ISSUANCES.length}`);
  console.log(`\n  Login password for all new/placeholder accounts: ${SEED_PWD}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('seed-sviet error:', err);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
