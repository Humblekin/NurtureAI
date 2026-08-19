/**
 * NurtureAI — Deterministic Emergency Pre-Screen
 *
 * Runs BEFORE any AI call. If the mother's message matches a red-flag
 * danger sign, Amina short-circuits the conversation with a fixed,
 * deterministic emergency response. This guarantees critical advice is
 * never gated behind the LLM (offline, latency, or provider failure).
 *
 * English + Dagbani pattern matching. Matching is substring-based on
 * lowercased text so voice transcriptions with minor errors still hit.
 */

export const EMERGENCY_RESPONSES = {
  EN: {
    title: 'URGENT — Please seek medical help right now',
    body: [
      'This could be an emergency. Please do not wait.',
      'Go to the nearest health facility or hospital NOW, or call for help immediately.',
      'Do NOT try to treat this at home.',
      'If you are alone, ask a neighbour or family member to help you get to care.',
    ],
    call: 'If the situation is getting worse, call your health worker or the emergency line right away.',
  },
  DAG: {
    title: 'KUHINZA — Di kuri yo biεhiri, kana kpaŋsi ni tibsim sɔŋsim',
    body: [
      'Ŋɔ nyɛla ŋmɔŋ nyɛrisuŋ. M-paari tɔbu.',
      'Chaŋ dɔɣiri ni / laaribaa tidoo pɔi ni saha ŋɔ, bee kum boli niriba saha.',
      'Di niŋ a maŋa tibsim yili saha shεli.',
      'Yi yi be tooni, puhimi a niriba ni bɛ sɔŋ a chaŋ tibsim ni.',
    ],
    call: 'Yi yi kpalim ka di tooi zaŋ pahira, boli a laariba bee pukpariba kɔrisi din be tooni pɔi ni saha.',
  },
};

// Each entry: { label, patterns: [regex...], response: EMERGENCY key suffix }
const DANGER_SIGNS = [
  {
    label: 'severe_bleeding',
    patterns: [
      /\b(bleeding)\b/,
      /\b(bleeding|blood)\b.*\b(heavy|severe|profuse|excessive|gushing|too much|alot|a lot|uncontroll)\b/,
      /\b(heavy|severe|profuse|excessive|gushing|too much|a lot)\b.*\b(bleeding|blood)\b/,
      /\bhaemorrhage\b/, /\bhemorrhage\b/,
      /\bvaginal\s*blood\b/,
      /\b(seeing|see|discharge|passing)\s*blood\b/,
      /\bblood\s*(clots|clot|gushing)\b/,
    ],
  },
  {
    label: 'convulsions_fits',
    patterns: [
      /\b(seizure|seizures|convulsion|convulsions|fits|fit)\b/,
      /\b(eclampsia|eclamptic)\b/,
      /\bshaking\b.*\b(uncontroll|severe)\b/,
      /jerking\s*uncontroll/,
    ],
  },
  {
    label: 'unconscious',
    patterns: [
      /\b(unconscious|unresponsive|unresponsive)\b/,
      /\bfainted\b|\bfainting\b|\bfaint\b/,
      /\bcollapsed\b|\bcollapse\b/,
      /\bpassed\s*out\b/,
    ],
  },
  {
    label: 'severe_abdominal_pain',
    patterns: [
      /\bsevere\s*(stomach|abdominal|belly|tummy)\s*(pain|cramp|cramps)\b/,
      /\b(belly|tummy|stomach|abdominal)\s*pain\b.*\b(severe|unbearable|very bad|terrible)\b/,
      /\bunbearable\s*(pain|cramp|cramps)\b/,
      /\bpain\b.*\b(bad|terrible)\b.*\b(belly|stomach|tummy)\b/,
    ],
  },
  {
    label: 'difficulty_breathing',
    patterns: [
      /\b(can'?t|can\s*not|hard|difficult|trouble)\s*breath/,
      /\bshort(ness)?\s*of\s*breath\b/,
      /\b(dyspnea|dyspnoea)\b/,
      /\bbreathless\b/,
      /\b(choking|choke)\b/,
      /\bnot\s*breathing\b/,
    ],
  },
  {
    label: 'face_hands_swelling',
    patterns: [
      /\bswollen\b.*\b(face|hands|fingers|eyes)\b/,
      /\b(face|hands|fingers)\b.*\bswollen\b/,
      /\bsudden\s*swelling\b/,
      /\bswelling\b.*\b(face|hands)\b/,
    ],
  },
  {
    label: 'reduced_fetal_movement',
    patterns: [
      /\bbaby\b.*\bnot\s*moving\b/,
      /\bnot\s*moving\b.*\bbaby\b/,
      /\b(baby|child)\b.*\b(less|fewer|stopped)\s*mov/,
      /\b(still|stopped|no)\s*movement\b/,
      /\breduced\s*fetal\s*movement\b/,
    ],
  },
  {
    label: 'waters_broke_early',
    patterns: [
      /\bwaters?\s*(broke|broken|burst)\b/,
      /\bwater\s*breaking\b/,
      /\b(leaking|leaking?)\s*(amniotic\s*)?fluid\b/,
      /\bamniotic\s*fluid\b/,
    ],
  },
  {
    label: 'high_fever',
    patterns: [
      /\b(very|extremely|really|too)\s*high\s*fever\b/,
      /\bfever\b.*\b(over|above|more than)\s*(38|39|40)\b/,
      /\b(hot|burning)\b.*\b(whole|all)\s*body\b/,
      /\bsevere\s*fever\b/,
    ],
  },
  {
    label: 'severe_vomiting',
    patterns: [
      /\b(severe|constant|continuous|uncontrollable|can'?t\s*stop)\s*vomit/,
      /\bvomit\b.*\b(blood|bile)\b/,
      /\bthrowing\s*up\b.*\b(blood|everything)\b/,
    ],
  },
  {
    label: 'blurred_vision',
    patterns: [
      /\bblurred?\s*v(ision|iew)\b/,
      /\b(can'?t|hard)\s*(see|seeing)\b.*\bclearly\b/,
      /\bflashing\s*lights\b/,
      /\bspots?\b.*\b(eyes|vision)\b/,
    ],
  },
  {
    label: 'baby_not_feed',
    patterns: [
      /\b(baby|child)\b.*\b(not|refus|won'?t|stopped)\s*(feeding|eat|breastfeed|nurse|drink)/,
      /\b(not|refus)\s*(to\s*)?(feed|eat|drink)\b.*\b(baby|child)\b/,
      /\bwon'?t\s*feed\b/,
    ],
  },
  {
    label: 'dehydration_child',
    patterns: [
      /\b(no|not)\s*urine\b/,
      /\b(sunken|sunken)\s*eyes\b/,
      /\b(dry|very\s*dry)\s*mouth\b.*\b(baby|child)\b/,
      /\bdehydrat/,
    ],
  },
];

/**
 * Scan text for emergency danger signs.
 * @returns {null|{label: string, response: {title: string, body: string[], call: string}}} 
 *   Matched danger sign with bilingual response, or null if safe.
 */
export function screenForEmergency(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();

  for (const sign of DANGER_SIGNS) {
    for (const re of sign.patterns) {
      if (re.test(lower)) {
        return {
          label: sign.label,
          response: EMERGENCY_RESPONSES,
        };
      }
    }
  }

  return null;
}

/**
 * Build the deterministic emergency reply for a given language.
 */
export function buildEmergencyReply(match, language = 'en') {
  const lang = language === 'dag' ? 'DAG' : 'EN';
  const r = match.response[lang];
  return `⚠️ ${r.title}\n\n${r.body.join('\n')}\n\n${r.call}`;
}

export default { screenForEmergency, buildEmergencyReply, DANGER_SIGNS };
