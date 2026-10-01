/**
 * NurtureAI — Canonical health profile vocabulary
 *
 * Single source of truth for every field the mother health profile holds,
 * shared by BOTH setup paths:
 *
 *   - "Talk With Amina"  (onboardingEngine + OnboardingFlow)
 *   - "Fill the form"    (OnboardingForm)
 *
 * They used to disagree — the engine emitted a flat `child_name`, the form
 * expected a `children_list` array; the engine asked for an `edd` the form had
 * no box for; the engine produced `has_another_child` the form never read. The
 * two paths were then wired to entirely separate save routines, so the same
 * answer could not move between them.
 *
 * Keeping one vocabulary here means an answer captured by voice can be handed
 * straight to the form for review, and vice versa.
 */

import { normalizeBloodGroup } from '../lib/bloodGroup.js';

// ── Steps and fields ──────────────────────────────────
// `type` drives both rendering and value coercion.

export const YES_NO = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
];

const BLOOD_GROUP_OPTIONS = [
  { value: '', label: 'Select blood group' },
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
];

const CHILD_GENDER_OPTIONS = [
  { value: '', label: 'Select' },
  { value: 'male', label: 'Boy' },
  { value: 'female', label: 'Girl' },
];

export const CHILD_FIELDS = [
  {
    name: 'name',
    label: 'Name',
    labelDag: 'Sunan',
    type: 'text',
    required: true,
    placeholder: "Child's name",
  },
  {
    name: 'date_of_birth',
    label: 'Date of Birth',
    labelDag: 'Ranar Haihuwa',
    type: 'date',
    required: false,
  },
  {
    name: 'gender',
    label: 'Gender',
    labelDag: 'Jinsi',
    type: 'select',
    required: false,
    options: CHILD_GENDER_OPTIONS,
  },
  {
    name: 'birth_weight',
    label: 'Birth Weight (kg)',
    labelDag: 'Nauyin Haihuwa (kg)',
    type: 'number',
    required: false,
    placeholder: 'e.g. 3.2',
    min: 0.5,
    max: 6,
    step: 0.1,
  },
];

export const PROFILE_STEPS = [
  {
    id: 'personal',
    title: 'Personal Information',
    titleDag: 'Bayanan Kai',
    fields: [
      { name: 'full_name', label: 'Full Name', labelDag: 'Sunan Cikakke', type: 'text', required: true, placeholder: 'Your full name' },
      { name: 'date_of_birth', label: 'Date of Birth', labelDag: 'Ranar Haihuwa', type: 'date', required: true },
      { name: 'community', label: 'Community', labelDag: "Al'umma", type: 'text', required: true, placeholder: 'e.g. Tamale South' },
      { name: 'district', label: 'District', labelDag: 'Yanki', type: 'text', required: false, placeholder: 'e.g. Tamale Metropolitan' },
      { name: 'emergency_contact', label: 'Emergency Contact', labelDag: 'Lambar Gaggawa', type: 'text', required: false, placeholder: 'Phone number or name' },
    ],
  },
  {
    id: 'pregnancy',
    title: 'Pregnancy Information',
    titleDag: 'Bayanan Ciki',
    fields: [
      { name: 'is_pregnant', label: 'Are you currently pregnant?', labelDag: 'Kana ciki a yanzu?', type: 'select', required: true, options: YES_NO },
      { name: 'lmp', label: 'Last Menstrual Period', labelDag: 'Jinin na ƙarshe', type: 'date', required: true, condition: (d) => d.is_pregnant === 'Yes' },
      { name: 'is_first_pregnancy', label: 'Is this your first pregnancy?', labelDag: 'Shin wannan shine fara cikin ka?', type: 'select', required: true, options: YES_NO, condition: (d) => d.is_pregnant === 'Yes' },
      {
        // Derived, never asked: shown read-only so the mother can see when the
        // system expects her to give birth. Kept as a real field rather than
        // dropped so the voice path and the form agree on the shape.
        name: 'edd',
        label: 'Estimated Due Date',
        labelDag: 'Ranar Za A Zaɗi',
        type: 'date',
        required: false,
        readOnly: true,
        condition: (d) => d.is_pregnant === 'Yes',
      },
      { name: 'gravida', label: 'Total pregnancies (including current)', labelDag: 'Jimlar ciki', type: 'number', required: true, min: 1, condition: (d) => d.is_pregnant === 'Yes' },
      { name: 'para', label: 'Live births', labelDag: 'Yawan haihuwa', type: 'number', required: true, min: 0, condition: (d) => d.is_pregnant === 'Yes' && d.is_first_pregnancy !== 'Yes' },
      { name: 'previous_complications', label: 'Previous pregnancy complications', labelDag: 'Matsalar ciki na baya', type: 'textarea', required: false, placeholder: 'e.g. high blood pressure, bleeding', condition: (d) => d.is_pregnant === 'Yes' && d.is_first_pregnancy !== 'Yes' },
    ],
  },
  {
    id: 'medical',
    title: 'Medical History',
    titleDag: 'Tarihin Lafiya',
    fields: [
      { name: 'existing_conditions', label: 'Existing medical conditions', labelDag: 'Cututtukan da ke tattare', type: 'textarea', required: false, placeholder: 'e.g. diabetes, asthma, sickle cell' },
      { name: 'current_medications', label: 'Current medications or supplements', labelDag: 'Magungunan da ke tattare', type: 'textarea', required: false, placeholder: 'e.g. iron tablets, folic acid' },
      { name: 'blood_group', label: 'Blood group', labelDag: 'Irin jini', type: 'select', required: false, options: BLOOD_GROUP_OPTIONS },
    ],
  },
  {
    id: 'healthcare',
    title: 'Healthcare Information',
    titleDag: 'Bayanan Lafiya',
    fields: [
      { name: 'preferred_facility', label: 'Preferred health facility', labelDag: 'Asibitin da aka fi so', type: 'text', required: false, placeholder: 'e.g. Tamale Hospital' },
      { name: 'previous_anc', label: 'Have you attended ANC visits?', labelDag: 'Ka taɓa ziyarce asibit?', type: 'select', required: true, options: YES_NO, condition: (d) => d.is_pregnant === 'Yes' },
    ],
  },
  {
    id: 'lifestyle',
    title: 'Lifestyle & Nutrition',
    titleDag: 'Rayuwa & Abinci',
    fields: [
      { name: 'nutrition', label: 'Describe your eating habits', labelDag: 'Bayyana yadda kake cin abinci', type: 'textarea', required: false, placeholder: 'e.g. I eat three meals a day, lots of vegetables' },
      { name: 'supplements', label: 'Taking supplements (iron, folic acid)?', labelDag: 'Kana ɗauke da ƙarin abinci?', type: 'select', required: false, options: YES_NO },
    ],
  },
  {
    id: 'children',
    title: 'Children',
    titleDag: 'Yara',
    fields: [
      { name: 'has_children', label: 'Do you have any children?', labelDag: 'Kana da wani yaro?', type: 'select', required: true, options: YES_NO },
    ],
  },
];

// Flat lookup used by the voice extractor and by coercion.
export const FIELD_BY_NAME = PROFILE_STEPS.reduce((acc, step) => {
  for (const field of step.fields) acc[field.name] = field;
  return acc;
}, {});

export const CHILD_FIELD_BY_NAME = CHILD_FIELDS.reduce((acc, field) => {
  acc[field.name] = field;
  return acc;
}, {});

// ── Date parsing ──────────────────────────────────────

const MONTHS = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function toIso(year, month, day) {
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Pivot two-digit years, so "98" is 1998 and "15" is 2015.
  const y = year < 100 ? (year >= 50 ? 1900 + year : 2000 + year) : year;
  const date = new Date(Date.UTC(y, month - 1, day));
  // Reject impossible dates that JS would silently roll over (e.g. 31 Feb).
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${y}-${pad(month)}-${pad(day)}`;
}

/**
 * Parse the many ways a date can arrive — typed, spoken by Amina's AI, or
 * dictated into a form field — into the `YYYY-MM-DD` that <input type="date">
 * and the database both require.
 *
 * Accepts: 1998-05-15 | 15 May 1998 | 15th May 1998 | May 15, 1998 |
 *          15/05/1998 (day-first, as spoken in Ghana)
 * Returns null when it cannot be understood, so the caller can leave the field
 * blank for the mother to correct rather than saving a wrong date.
 */
export function parseDateInput(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return null;

  let text = String(value).trim();
  if (!text) return null;

  // Already ISO.
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return toIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // Drop ordinal suffixes and filler words: "15th of May 1998" -> "15 May 1998".
  text = text
    .toLowerCase()
    .replace(/(\d+)(st|nd|rd|th)/g, '$1')
    .replace(/\bof\b/g, ' ')
    .replace(/[,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Day-first numeric: 15/05/1998 or 15-05-98
  const numeric = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (numeric) {
    const [, d, m, y] = numeric;
    return toIso(Number(y), Number(m), Number(d));
  }

  // Textual: "<day> <month> <year>" or "<month> <day> <year>"
  const monthKey = Object.keys(MONTHS).find((m) => new RegExp(`\\b${m}\\b`).test(text));
  if (monthKey) {
    const month = MONTHS[monthKey];
    // Remove the month word so whatever numbers remain are the day and the year.
    // Picking the day as "the number that is not the year" handles both
    // orderings ("15 May 1998" and "May 15 1998") without a fragile guess.
    const rest = text.replace(new RegExp(`\\b${monthKey}\\b`), ' ');
    const numbers = (rest.match(/\d+/g) || []).map(Number);
    if (numbers.length >= 2) {
      const yearIdx = numbers.findIndex((n) => n > 31);
      let day;
      let year;
      if (yearIdx === -1) {
        day = numbers[0];
        year = numbers[1];
      } else {
        year = numbers[yearIdx];
        day = numbers[yearIdx === 0 ? 1 : 0];
      }
      return toIso(year, month, day);
    }
  }

  return null;
}

// ── Number parsing ────────────────────────────────────

const WORD_NUMBERS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
};

/**
 * Parse a spoken or typed number. Speech recognition renders "2.6" as "2.6"
 * but also "2.6" as "2 point 6", and integers as "three", so all three forms
 * have to work. Returns null when no number is present.
 */
export function parseNumberInput(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined) return null;

  const text = String(value).trim().toLowerCase();
  if (!text) return null;

  const decimal = text.match(/(-?\d+(?:\.\d+)?)\s*(?:point|dot)\s*(-?\d+)/);
  if (decimal) return Number(`${decimal[1]}.${decimal[2]}`);

  const direct = text.match(/-?\d+(?:\.\d+)?/);
  if (direct) {
    const n = Number(direct[0]);
    return Number.isFinite(n) ? n : null;
  }

  const word = Object.keys(WORD_NUMBERS).find((w) => new RegExp(`\\b${w}\\b`).test(text));
  return word ? WORD_NUMBERS[word] : null;
}

// ── Select matching ───────────────────────────────────

// Checked before the yes/no words: "not sure" contains both "not" and "sure",
// and answering "No" to "are you pregnant?" because she is unsure is worse than
// leaving the field blank for her to choose.
const UNSURE_WORDS = [
  'not sure', 'unsure', 'not certain', "don't know", 'do not know', 'dont know',
  'unknown', 'maybe', 'perhaps', 'not really',
];
const YES_WORDS = ['yes', 'yeah', 'yep', 'yup', 'correct', 'aye', 'iye', 'indeed'];
const NO_WORDS = ['no', 'nope', 'nah', 'negative', 'baa', 'ba', 'koma'];
const MALE_WORDS = ['male', 'boy', 'man', 'son', 'ɓoɗɗo', 'bɔɗɗɔ'];
const FEMALE_WORDS = ['female', 'girl', 'woman', 'daughter', 'kuɗiya', 'kudiya'];

/**
 * Match free speech against a select's options. Falls back to a substring test
 * so a longer phrase ("I already visited, yes") still resolves.
 */
function matchSelect(field, raw) {
  const text = String(raw).trim();
  if (!text) return '';
  const lower = text.toLowerCase();

  const options = field.options || [];
  const values = options.map((o) => String(o.value));

  if (field.name === 'blood_group') {
    const normalized = normalizeBloodGroup(lower);
    if (normalized) return normalized;
  }

  const wants = (words) => words.some((w) => new RegExp(`(^|\\b)${w}\\b`).test(lower));
  const booleanMatch = values.includes('Yes') && values.includes('No')
    ? (UNSURE_WORDS.some((w) => lower.includes(w))
        ? ''
        : wants(YES_WORDS) ? 'Yes' : wants(NO_WORDS) ? 'No' : null)
    : null;
  if (booleanMatch !== null) return booleanMatch;

  if (values.includes('male') && values.includes('female')) {
    if (wants(MALE_WORDS)) return 'male';
    if (wants(FEMALE_WORDS)) return 'female';
  }

  const exact = values.find((v) => v && v.toLowerCase() === lower);
  if (exact !== undefined) return exact;

  const partial = values.find((v) => v && v.length > 1 && lower.includes(v.toLowerCase()));
  return partial !== undefined ? partial : '';
}

// ── Coercion ──────────────────────────────────────────

/**
 * Force any incoming value into the shape a field expects. Used on everything
 * that arrives from outside the form: the AI extractor, dictated speech, and
 * the seeded voice draft. Anything that cannot be understood becomes '' so the
 * field renders blank and the mother is asked, rather than storing garbage.
 */
export function coerceFieldValue(field, value) {
  if (!field) return '';
  if (value === null || value === undefined) return '';

  switch (field.type) {
    case 'date':
      return parseDateInput(value) || '';
    case 'number': {
      const n = parseNumberInput(value);
      if (n === null) return '';
      if (field.min !== undefined && n < field.min) return '';
      if (field.max !== undefined && n > field.max) return '';
      return String(n);
    }
    case 'select': {
      const matched = matchSelect(field, value);
      // An empty option is legitimate (the blood group placeholder).
      if (matched === '' && field.name === 'blood_group') return '';
      return matched;
    }
    default:
      return String(value).trim();
  }
}

/** Coerce a whole draft, dropping keys the profile does not define. */
// "Do you have another child?" drives the conversation's repeat loop. It is not
// a profile field (the answer is deliberately discarded afterwards), so it has
// no canonical definition and needs its own coercion.
//
// The bias matters here: anything that is not a clear refusal counts as "yes",
// because treating a hesitant "well... yes" as "no" silently truncates the
// child's list while the conversation still looks complete.
const NEGATIVE_FIRST_WORDS = new Set([
  'no', 'nope', 'nah', 'none', 'nothing', 'never', 'negative', 'neither',
]);

const NEGATIVE_LEADING_PHRASES = [
  'no more', 'not anymore', 'that is all', 'thats all', 'that is it',
  'that is everything', 'no further', 'no other', 'no additional',
  'finish', 'finished', 'done', 'enough', 'stop', 'end',
];

export function coerceLoopControl(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return '';

  // Punctuation is stripped before matching because the natural form of this
  // answer is "No, that is all" — a prefix check on the raw text would miss the
  // comma and read a clear refusal as agreement.
  const text = raw.replace(/[.!?,;:"'()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';

  if (NEGATIVE_FIRST_WORDS.has(text.split(' ')[0])) return 'No';
  if (NEGATIVE_LEADING_PHRASES.some((phrase) => text.startsWith(phrase))) return 'No';
  return 'Yes';
}

export function coerceDraft(draft = {}) {
  const out = {};
  for (const step of PROFILE_STEPS) {
    for (const field of step.fields) {
      if (draft[field.name] !== undefined) {
        out[field.name] = coerceFieldValue(field, draft[field.name]);
      }
    }
  }
  // Children live outside the flat field list. They must survive the handoff,
  // otherwise every answer the conversation collected is silently lost.
  if (Array.isArray(draft.children_list)) {
    out.children_list = draft.children_list
      .filter((child) => child && typeof child === 'object')
      .map((child) => {
        const shaped = {};
        for (const field of CHILD_FIELDS) {
          shaped[field.name] = coerceFieldValue(field, child[field.name]);
        }
        return shaped;
      });
  }
  return out;
}

// ── Draft ⇄ form state ────────────────────────────────

export function emptyFormData() {
  const data = {};
  for (const step of PROFILE_STEPS) {
    for (const field of step.fields) data[field.name] = '';
  }
  data.children_list = [];
  return data;
}

/**
 * Build the form's state from a canonical draft, coercing every value.
 * Children are dropped when the mother said she has none, so a stale draft
 * cannot resurrect them.
 */
export function formDataFromDraft(draft = {}) {
  const data = emptyFormData();
  for (const step of PROFILE_STEPS) {
    for (const field of step.fields) {
      const value = draft[field.name];
      if (value !== undefined && value !== null && value !== '') {
        data[field.name] = coerceFieldValue(field, value);
      }
    }
  }

  const children = Array.isArray(draft.children_list) ? draft.children_list : [];
  data.children_list = data.has_children === 'Yes'
    ? children.map((child) => {
        const shaped = {};
        for (const field of CHILD_FIELDS) {
          shaped[field.name] = coerceFieldValue(field, child?.[field.name]);
        }
        return shaped;
      }).filter((child) => child.name || child.date_of_birth || child.gender)
    : [];

  return data;
}

/**
 * Convert the form's state back into a canonical draft for saving. This is the
 * mirror of formDataFromDraft and the only shape the save path accepts.
 */
export function draftFromFormData(formData = {}) {
  const draft = {};
  for (const step of PROFILE_STEPS) {
    for (const field of step.fields) {
      draft[field.name] = coerceFieldValue(field, formData[field.name]);
    }
  }
  draft.children_list = (formData.children_list || []).map((child) => {
    const shaped = {};
    for (const field of CHILD_FIELDS) {
      shaped[field.name] = coerceFieldValue(field, child?.[field.name]);
    }
    return shaped;
  });
  return draft;
}

/**
 * Turn dictated speech into a field value. Returns null when nothing usable was
 * heard, which the caller treats as "keep listening" rather than "clear field".
 */
export function fieldValueFromSpeech(field, speech) {
  const text = String(speech || '').trim();
  if (!text) return null;
  const value = coerceFieldValue(field, text);
  return value === '' ? null : value;
}

export default {
  PROFILE_STEPS,
  CHILD_FIELDS,
  FIELD_BY_NAME,
  CHILD_FIELD_BY_NAME,
  YES_NO,
  parseDateInput,
  parseNumberInput,
  coerceFieldValue,
  coerceDraft,
  emptyFormData,
  formDataFromDraft,
  draftFromFormData,
  fieldValueFromSpeech,
};