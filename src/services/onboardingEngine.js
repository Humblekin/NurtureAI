import { chatCompletion } from '../lib/groq';
import { normalizeBloodGroup } from '../lib/bloodGroup';
import { calculateWeeksFromLMP, calculateEDDFromLMP } from '../lib/pregnancy';
import { FIELD_BY_NAME, CHILD_FIELD_BY_NAME, coerceFieldValue, coerceLoopControl } from './onboardingFields';

/**
 * NurtureAI — Onboarding Conversation Engine
 *
 * Manages the conversational flow for mother registration via Amina AI.
 * Uses dynamic branching questions and AI data extraction.
 */

// ── Question Definitions ─────────────────────────────

const QUESTIONS = [
  // ─── Personal Information ───
  {
    id: 'full_name',
    text: "Let's start with your name. What is your full name?",
    textDag: "Na ƙa tabbatar da sunanka. Menene sunan ka gaba ɗaya?",
    category: 'personal',
    type: 'text',
    field: 'full_name',
    required: true,
  },
  {
    id: 'date_of_birth',
    text: "When is your date of birth? You can say something like '15th May 1998' or 'May 15, 1998'.",
    textDag: "Yaɗayake kin haihu? Za ka iya cewa '15 ga watan Mai 1998'.",
    category: 'personal',
    type: 'date',
    field: 'date_of_birth',
    required: true,
  },
  {
    id: 'community',
    text: "Which community do you live in? For example, Tamale South, Lamashegu, or similar.",
    textDag: "Wanne ƙauke kake zaune? Misali, Tamale South, Lamashegu, ko kamar haka.",
    category: 'personal',
    type: 'text',
    field: 'community',
    required: true,
  },
  {
    id: 'district',
    text: "Which district are you in?",
    textDag: "Wanne ɗandamali ne kake?",
    category: 'personal',
    type: 'text',
    field: 'district',
    required: false,
  },
  {
    id: 'emergency_contact',
    text: "Do you have an emergency contact? If yes, what is their name and phone number?",
    textDag: "Kana da wanda zaka iya kira a lokacin gaggawa? Idan haka, menene sunansa da lambar wayar sa?",
    category: 'personal',
    type: 'text',
    field: 'emergency_contact',
    required: false,
  },

  // ─── Pregnancy Information ───
  {
    id: 'is_pregnant',
    text: "Are you currently pregnant?",
    textDag: "Kana ciki a yanzu?",
    category: 'pregnancy',
    type: 'choice',
    options: ['Yes', 'No'],
    field: 'is_pregnant',
    required: true,
  },
  {
    id: 'is_first_pregnancy',
    text: "Is this your first pregnancy?",
    textDag: "Shin wannan shine fara cikin ka?",
    category: 'pregnancy',
    type: 'choice',
    options: ['Yes', 'No'],
    field: 'is_first_pregnancy',
    required: true,
    condition: (data) => data.is_pregnant === 'Yes',
  },
  {
    id: 'lmp',
    text: "When was the first day of your last menstrual period? This helps us calculate how far along you are. You can say something like '15th January 2026' or 'January 15, 2026'.",
    textDag: "Yaushe ne ranar fara jinin ka na ƙarshe? Wannan yana taimaka mana mu ƙidaya yawan watankin ciki. Za ka iya cewa '15 ga watan Janairu 2026'.",
    category: 'pregnancy',
    type: 'date',
    field: 'lmp',
    required: true,
    condition: (data) => data.is_pregnant === 'Yes',
  },
  {
    id: 'edd_known',
    text: "Do you know your estimated due date? If yes, when is it?",
    textDag: "Ka san yaushe kake tsamman zaka haihu? Idan haka, yaushe ne?",
    category: 'pregnancy',
    type: 'text',
    field: 'edd',
    required: false,
    condition: (data) => data.is_pregnant === 'Yes',
  },
  {
    id: 'gravida',
    text: "How many times have you been pregnant in total, including this current pregnancy?",
    textDag: "Yaya yawan cikin ka gaba ɗaya, gami da wannan cikin yanzu?",
    category: 'pregnancy',
    type: 'number',
    field: 'gravida',
    required: true,
    condition: (data) => data.is_pregnant === 'Yes',
  },
  {
    id: 'para',
    text: "How many babies have you delivered that survived?",
    textDag: "Yaya yawan 'ya'yan da ka haife sun rai?",
    category: 'pregnancy',
    type: 'number',
    field: 'para',
    required: true,
    condition: (data) => data.is_pregnant === 'Yes' && data.is_first_pregnancy === 'No',
  },
  {
    id: 'previous_complications',
    text: "Have you had any complications in previous pregnancies? For example, high blood pressure, excessive bleeding, or premature delivery?",
    textDag: "Kana da wani irin matsala a cikin ka na baya? Misali, ƙwanƙwasa jini, yawan jini, ko haifar da ƙaramin ƙwaƙƙwara?",
    category: 'pregnancy',
    type: 'text',
    field: 'previous_complications',
    required: false,
    condition: (data) => data.is_pregnant === 'Yes' && data.is_first_pregnancy === 'No',
  },

  // ─── Medical History ───
  {
    id: 'existing_conditions',
    text: "Do you have any existing medical conditions? For example, high blood pressure, diabetes, asthma, or sickle cell?",
    textDag: "Kana da wani irin cuta? Misali, ƙwanƙwasa jini, sugar, Asthma, ko Sickle Cell?",
    category: 'medical',
    type: 'text',
    field: 'existing_conditions',
    required: false,
  },
  {
    id: 'current_medications',
    text: "Are you currently taking any medications or supplements? If yes, please tell me what they are.",
    textDag: "Kana ɗauke da wani irin magani a yanzu? Idan haka, da fatan za a gaya mani menene.",
    category: 'medical',
    type: 'text',
    field: 'current_medications',
    required: false,
  },
  {
    id: 'blood_group',
    text: "Do you know your blood group? For example, O positive, A negative, or AB positive?",
    textDag: "Ka san irin jinin ka? Misali, O positive, A negative, ko AB positive?",
    category: 'medical',
    type: 'text',
    field: 'blood_group',
    required: false,
  },

  // ─── Healthcare Information ───
  {
    id: 'preferred_facility',
    text: "Which health facility do you prefer to visit? For example, Tamale Central Hospital, or your nearest CHPS compound.",
    textDag: "Wanne asibitake kake son ziyarce? Misali, Asibitin Tsakiyar Tamale, ko CHPS din ka na kusa.",
    category: 'healthcare',
    type: 'text',
    field: 'preferred_facility',
    required: false,
  },
  {
    id: 'previous_anc',
    text: "Have you attended any antenatal care (ANC) visits during this pregnancy?",
    textDag: "Ka taɓa ziyarce wani asibit a lokacin cikin ka?",
    category: 'healthcare',
    type: 'choice',
    options: ['Yes', 'No'],
    field: 'previous_anc',
    required: true,
    condition: (data) => data.is_pregnant === 'Yes',
  },

  // ─── Lifestyle ───
  {
    id: 'nutrition',
    text: "How would you describe your eating habits? Are you eating well and regularly?",
    textDag: "Yaya kake cewa habillan abincin ka? Kana cin abinci mai kyau kuma a lokaci?",
    category: 'lifestyle',
    type: 'text',
    field: 'nutrition',
    required: false,
  },
  {
    id: 'supplements',
    text: "Are you taking any supplements like iron or folic acid?",
    textDag: "Kana ɗauke da wani irin ƙarin abinci kamar iron ko folic acid?",
    category: 'lifestyle',
    type: 'choice',
    options: ['Yes', 'No'],
    field: 'supplements',
    required: false,
  },

  // ─── Children Information ───
  {
    id: 'has_children',
    text: "Do you have any children?",
    textDag: "Kana da wani yaro?",
    category: 'children',
    type: 'choice',
    options: ['Yes', 'No'],
    field: 'has_children',
    required: true,
  },
  {
    id: 'child_name',
    text: "What is your child's name?",
    textDag: "Menene sunan yaron ka?",
    category: 'children',
    type: 'text',
    field: 'name',
    childField: 'name',
    required: true,
    condition: (data) => data.has_children === 'Yes',
  },
  {
    id: 'child_date_of_birth',
    text: "When was your child born? You can say something like '15th March 2024' or 'March 15, 2024'.",
    textDag: "Yaɗayake yaron ka ya haihu? Za ka iya cewa '15 ga watan Maris 2024'.",
    category: 'children',
    type: 'date',
    field: 'date_of_birth',
    childField: 'date_of_birth',
    required: true,
    condition: (data) => data.has_children === 'Yes',
  },
  {
    id: 'child_gender',
    text: "Is your child a boy or a girl?",
    textDag: "Yaron ka baɗɗo ne ko kuɗiya?",
    category: 'children',
    type: 'choice',
    options: ['Boy', 'Girl'],
    field: 'gender',
    childField: 'gender',
    required: true,
    condition: (data) => data.has_children === 'Yes',
  },
  {
    id: 'child_birth_weight',
    text: "Do you know your child's birth weight in kilograms? For example, 3.2 or 3.5.",
    textDag: "Ka san nauyin yaron ka a lokacin haihuwa a cikin kilogram? Misali, 3.2 ko 3.5.",
    category: 'children',
    type: 'number',
    field: 'birth_weight',
    childField: 'birth_weight',
    required: false,
    condition: (data) => data.has_children === 'Yes',
  },
  {
    // Drives the repeat loop only — never stored, so the collected shape stays
    // identical to the form's.
    id: 'has_another_child',
    text: "Do you have another child you'd like to register?",
    textDag: "Kana da wani yaro da kake son yi rajista?",
    category: 'children',
    type: 'choice',
    options: ['Yes', 'No'],
    field: 'has_another_child',
    // Marks this question as loop control rather than profile data. It is not a
    // canonical field, so it has to be handled explicitly in applyExtracted or
    // the answer is dropped and the repeat loop never runs.
    loopControl: true,
    required: true,
    condition: (data) => data.has_children === 'Yes',
  },
];

// Where the repeating child block begins, plus a ceiling so a misheard "yes"
// can never spin the conversation forever.
const CHILD_QUESTION_START = QUESTIONS.findIndex((q) => q.childField === 'name');
const MAX_CHILDREN = 8;

/**
 * Turn a canonical draft into the three record shapes the database needs.
 *
 * Pure and draft-driven so BOTH setup paths save identically: the voice path
 * passes what the conversation collected, the form path passes what she typed
 * or dictated. The form used to carry its own copy of this logic and was
 * missing claim_mother (which prevents duplicate patient records), the
 * community health worker assignment, the welcome journal entry and the
 * welcome notification.
 */
export function buildProfileRecords(draft = {}, profileId = null) {
  const d = draft || {};

  const motherProfile = {
    profile_id: profileId,
    full_name: d.full_name || 'Unknown',
    date_of_birth: d.date_of_birth || null,
    phone: d.phone || null,
    community: d.community || null,
    blood_group: normalizeBloodGroup(d.blood_group),
    medical_history: [
      d.existing_conditions,
      d.current_medications ? `Current medications: ${d.current_medications}` : null,
      d.previous_complications ? `Previous complications: ${d.previous_complications}` : null,
    ].filter(Boolean).join('. ') || null,
    risk_level: 'low',
    assigned_worker_id: null,
    edd: null,
  };

  let pregnancyProfile = null;
  if (d.is_pregnant === 'Yes') {
    const lmpDate = d.lmp || null;
    const edd = d.edd || calculateEDDFromLMP(lmpDate);
    motherProfile.edd = edd;

    pregnancyProfile = {
      mother_id: null, // Set after mother is created
      status: 'active',
      risk_level: 'low',
      lmp: lmpDate,
      edd: edd,
      gravida: parseInt(d.gravida) || 1,
      para: parseInt(d.para) || 0,
      notes: [
        d.previous_complications ? `Previous complications: ${d.previous_complications}` : null,
        d.nutrition ? `Nutrition: ${d.nutrition}` : null,
        d.supplements === 'Yes' ? 'Taking supplements' : null,
      ].filter(Boolean).join('. ') || null,
    };
  }

  // Every collected child, not just the first. This used to build a single
  // record from flat `child_*` keys, silently dropping every child after the
  // first even though the mother had answered the questions for them.
  const childrenProfiles = [];
  const children = Array.isArray(d.children_list) ? d.children_list : [];
  children.forEach((child) => {
    const name = child?.name?.trim();
    if (!name) return;
    childrenProfiles.push({
      mother_id: null, // Set after mother is created
      full_name: name,
      date_of_birth: child.date_of_birth || null,
      gender: child.gender === 'male' || child.gender === 'female' ? child.gender : null,
      birth_weight: child.birth_weight ? parseFloat(child.birth_weight) : null,
    });
  });

  return { motherProfile, pregnancyProfile, childrenProfiles, collectedData: d };
}

// ── Helper Functions ─────────────────────────────────

// ── Onboarding Engine ────────────────────────────────

export class OnboardingEngine {
  constructor(profileId, language = 'en') {
    this.profileId = profileId;
    this.language = language;
    this.collectedData = { children_list: [] };
    this.conversationHistory = [];
    this.currentQuestionIndex = 0;
    this.childIndex = 0;
    this.answeredCount = 0;
    this.isComplete = false;
    this.isSaving = false;
  }

  /**
   * Get the next relevant question based on collected data and branching rules.
   */
  getNextQuestion() {
    while (this.currentQuestionIndex < QUESTIONS.length) {
      const question = QUESTIONS[this.currentQuestionIndex];

      // Check if this question has a condition
      if (question.condition && !question.condition(this.collectedData)) {
        this.currentQuestionIndex++;
        continue;
      }

      return question;
    }
    return null; // All questions answered
  }

  /**
   * Start the conversation — returns the welcome message and first question.
   */
  start() {
    this.conversationHistory = [];

    const welcomeText = this.language === 'dag'
      ? "Sannu! Ni ce Amina, abokiyar ki ta lafiya. Ina son taimaka wa ki ƙirƙirar bayanan ki na kiwon lafiya. Zan tambaye ki tambayoyi kaɗan, kuma zan yi magana da ki a hankali. Mu fara!"
      : "Hello! I'm Amina, your personal health companion. I'm here to help you set up your health profile. I'll ask you a few questions one at a time, and we'll go at your pace. Let's begin!";

    this.conversationHistory.push({ role: 'assistant', content: welcomeText });

    const firstQuestion = this.getNextQuestion();
    if (firstQuestion) {
      const questionText = this.language === 'dag' ? firstQuestion.textDag : firstQuestion.text;
      this.conversationHistory.push({ role: 'assistant', content: questionText });
    }

    return {
      welcomeText,
      firstQuestion,
      conversationHistory: this.conversationHistory,
    };
  }

  /**
   * Process the user's response to the current question.
   * Uses AI to extract structured data from the response.
   */
  async processResponse(userResponse) {
    const currentQuestion = this.getNextQuestion();
    if (!currentQuestion || this.isComplete) {
      return { success: false, error: 'No active question' };
    }

    // Add user response to history
    this.conversationHistory.push({ role: 'user', content: userResponse });

    // Use AI to extract structured data from the response
    const extractedData = await this.extractData(currentQuestion, userResponse);

    // Merge extracted data
    this.applyExtracted(currentQuestion, extractedData);

    // Move to next question
    this.currentQuestionIndex++;
    this.answeredCount += 1;

    // The repeating child block jumps the cursor back to the top of itself
    // instead of running off the end of the question list.
    if (currentQuestion.id === 'has_another_child') {
      const wantsAnother = this.collectedData.has_another_child === 'Yes';
      delete this.collectedData.has_another_child;
      const current = this.collectedData.children_list?.[this.childIndex];
      const named = current?.name?.trim();
      if (wantsAnother && named && this.childIndex < MAX_CHILDREN - 1) {
        this.childIndex += 1;
        this.currentQuestionIndex = CHILD_QUESTION_START;
      } else if (!named) {
        // Nothing usable was captured — do not leave a ghost row behind for the
        // form to render as a blank, unremovable child.
        this.collectedData.children_list.splice(this.childIndex, 1);
      }
    }

    // Check if all questions are done
    const nextQuestion = this.getNextQuestion();
    if (!nextQuestion) {
      this.isComplete = true;
      return {
        success: true,
        extractedData,
        isComplete: true,
        summary: this.buildSummary(),
      };
    }

    // Generate a natural follow-up using AI
    const followUp = await this.generateFollowUp(currentQuestion, userResponse, nextQuestion);

    this.conversationHistory.push({ role: 'assistant', content: followUp });

    return {
      success: true,
      extractedData,
      isComplete: false,
      nextQuestion,
      followUp,
      conversationHistory: this.conversationHistory,
    };
  }

  /**
   * Merge an extraction into `collectedData`.
   *
   * Two things happen here that a plain `Object.assign` did not:
   *   1. Only keys the profile actually defines are accepted, so a confused
   *      model cannot invent fields that end up in the database.
   *   2. Every value is coerced to its field's type. The model answering with
   *      "15 May 1998" or "yeah" is normal; storing that verbatim is what
   *      produced blank date inputs and "maybe" in a select.
   */
  applyExtracted(question, extractedData) {
    if (!extractedData || typeof extractedData !== 'object') return;

    if (question.childField) {
      const childField = CHILD_FIELD_BY_NAME[question.childField];
      if (!childField) return;
      const raw = extractedData[question.field] ?? extractedData[question.childField];
      if (raw === undefined) return;
      const value = coerceFieldValue(childField, raw);
      if (value === '') return;
      if (!Array.isArray(this.collectedData.children_list)) this.collectedData.children_list = [];
      const index = this.childIndex;
      const existing = this.collectedData.children_list[index] || {};
      this.collectedData.children_list[index] = { ...existing, [question.childField]: value };
      return;
    }

    // "Do you have another child?" drives the repeat loop. It is deliberately
    // not a canonical field, so it must be applied here or the loop below never
    // sees it and stops after the first child.
    if (question.loopControl) {
      const raw = extractedData[question.field];
      const value = coerceLoopControl(raw);
      if (value) this.collectedData[question.field] = value;
      return;
    }

    for (const [key, value] of Object.entries(extractedData)) {
      const field = FIELD_BY_NAME[key];
      if (!field) continue;
      this.collectedData[key] = coerceFieldValue(field, value);
    }
  }

  /**
   * Use AI to extract structured data from a free-text response.
   */
  async extractData(question, response) {
    const extractPrompt = `You are a data extraction assistant. Extract structured information from the user's response.

Current question: "${question.text}"
User's response: "${response}"

Return ONLY a valid JSON object with the extracted field(s). Do not include any explanation.

Field to extract: "${question.field}"
Question type: "${question.type}"

Formatting rules — these matter, your values are stored as-is:
- Dates must be "YYYY-MM-DD". If the day or month is ambiguous, choose the most likely reading.
- Numbers must be plain digits, no words and no units.
- Blood group must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-.
${question.childField ? '- Gender must be "male" or "female".\n' : ''}
Examples:
- If field is "full_name" and response is "My name is Mariam Abdulai", return: {"full_name": "Mariam Abdulai"}
- If field is "date_of_birth" and response is "15th May 1998", return: {"date_of_birth": "1998-05-15"}
- If field is "is_pregnant" and response is "Yes I am", return: {"is_pregnant": "Yes"}
- If field is "gravida" and response is "This is my third pregnancy", return: {"gravida": 3}
- If field is "lmp" and response is "January 15, 2026", return: {"lmp": "2026-01-15"}
- If field is "community" and response is "I live in Tamale South", return: {"community": "Tamale South"}
- If field is "blood_group" and response is "I think it is O positive", return: {"blood_group": "O+"}
- If field is "existing_conditions" and response is "I have high blood pressure", return: {"existing_conditions": "High blood pressure"}
- If field is "emergency_contact" and response is "My husband Ibrahim, +233241234567", return: {"emergency_contact": "Ibrahim +233241234567"}
- If field is "birth_weight" and response is "about three point two kilos", return: {"birth_weight": 3.2}
- If the response does not actually answer the question, return: {}

Return ONLY the JSON object:`;

    try {
      const result = await chatCompletion(
        [
          { role: 'system', content: 'You are a precise data extraction assistant. Return only valid JSON.' },
          { role: 'user', content: extractPrompt },
        ],
        { temperature: 0.1, maxTokens: 200, language: this.language }
      );

      // Parse the JSON response
      const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return parsed;
    } catch (error) {
      console.warn('[Onboarding] Data extraction failed, using raw response:', error);
      // Fallback: store raw response
      return { [question.field]: response };
    }
  }

  /**
   * Generate a natural follow-up message using AI.
   */
  async generateFollowUp(previousQuestion, userResponse, nextQuestion) {
    const langInstruction = this.language === 'dag'
      ? 'Respond in Dagbani. Be warm and natural.'
      : 'Respond in English. Be warm and natural.';

    const prompt = `You are Amina, a warm and caring healthcare AI assistant in Ghana. You are guiding a mother through her health profile setup. This is an important first impression — make her feel welcomed and cared for.

The mother just answered:
Previous question: "${previousQuestion.text}"
Her answer: "${userResponse}"

Now you need to ask the next question naturally. DO NOT just repeat the next question text. Instead, create a natural conversational transition.

Next question to ask: "${this.language === 'dag' ? nextQuestion.textDag : nextQuestion.text}"

Rules:
- Be warm and encouraging
- Acknowledge her answer briefly (1 sentence)
- If she mentioned something important (like a medical condition or a worry), show empathy and reassurance
- Then ask the next question naturally, making it feel like a conversation, not a form
- Keep it brief (2-3 sentences total)
- Never sound robotic or like a search engine
- ${langInstruction}`;

    try {
      const response = await chatCompletion(
        [
          { role: 'system', content: 'You are Amina, a warm healthcare AI companion. Be natural and caring. This is a conversational onboarding — not a medical interview.' },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.7, maxTokens: 150, language: this.language }
      );
      return response;
    } catch {
      // Fallback: just ask the next question directly
      return this.language === 'dag' ? nextQuestion.textDag : nextQuestion.text;
    }
  }

  /**
   * Build a summary of all collected data for confirmation.
   */
  buildSummary() {
    const d = this.collectedData;
    const lines = [];

    lines.push("**Personal Information:**");
    if (d.full_name) lines.push(`• Name: ${d.full_name}`);
    if (d.date_of_birth) lines.push(`• Date of Birth: ${d.date_of_birth}`);
    if (d.community) lines.push(`• Community: ${d.community}`);
    if (d.district) lines.push(`• District: ${d.district}`);
    if (d.emergency_contact) lines.push(`• Emergency Contact: ${d.emergency_contact}`);

    if (d.is_pregnant === 'Yes') {
      lines.push("");
      lines.push("**Pregnancy Information:**");
      if (d.is_first_pregnancy) lines.push(`• First pregnancy: ${d.is_first_pregnancy}`);
      if (d.lmp) {
        const weeks = calculateWeeksFromLMP(d.lmp);
        lines.push(`• Last menstrual period: ${d.lmp} (${weeks ? `~${weeks} weeks ago` : ''})`);
      }
      if (d.edd) lines.push(`• Estimated due date: ${d.edd}`);
      if (d.gravida) lines.push(`• Total pregnancies: ${d.gravida}`);
      if (d.para) lines.push(`• Previous deliveries: ${d.para}`);
      if (d.previous_complications) lines.push(`• Previous complications: ${d.previous_complications}`);
    }

    if (d.existing_conditions || d.current_medications || d.blood_group) {
      lines.push("");
      lines.push("**Medical Information:**");
      if (d.blood_group) lines.push(`• Blood group: ${d.blood_group}`);
      if (d.existing_conditions) lines.push(`• Medical conditions: ${d.existing_conditions}`);
      if (d.current_medications) lines.push(`• Medications: ${d.current_medications}`);
    }

    if (d.preferred_facility || d.previous_anc) {
      lines.push("");
      lines.push("**Healthcare:**");
      if (d.preferred_facility) lines.push(`• Preferred facility: ${d.preferred_facility}`);
      if (d.previous_anc) lines.push(`• Previous ANC visits: ${d.previous_anc}`);
    }

    if (d.nutrition || d.supplements) {
      lines.push("");
      lines.push("**Lifestyle:**");
      if (d.nutrition) lines.push(`• Nutrition: ${d.nutrition}`);
      if (d.supplements) lines.push(`• Taking supplements: ${d.supplements}`);
    }

    const children = Array.isArray(d.children_list) ? d.children_list : [];
    if (children.length > 0) {
      lines.push("");
      lines.push("**Children:**");
      children.forEach((child, i) => {
        lines.push(`• ${children.length > 1 ? `Child ${i + 1}` : 'Child'}: ${child.name || 'Unknown'}`);
        if (child.date_of_birth) lines.push(`  • Date of birth: ${child.date_of_birth}`);
        if (child.gender) lines.push(`  • Gender: ${child.gender}`);
        if (child.birth_weight) lines.push(`  • Birth weight: ${child.birth_weight}kg`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Handle confirmation from the mother.
   * Returns structured data ready for database insertion.
   */
  async handleConfirmation(confirmed) {
    if (!confirmed) {
      return { success: false, message: 'Please tell me what needs to be corrected.' };
    }

    this.isSaving = true;

    return {
      success: true,
      ...buildProfileRecords(this.collectedData, this.profileId),
    };
  }

  /**
   * Get the current progress percentage.
   */
  getProgress() {
    if (this.isComplete) return 100;
    const total = QUESTIONS.filter(q => !q.condition || q.condition(this.collectedData)).length;
    if (total <= 0) return 0;
    // `currentQuestionIndex` rewinds every time another child is offered, so
    // use a monotonic count — otherwise the bar jumps backwards mid-interview.
    const answered = Math.min(this.answeredCount, total - 1);
    return Math.round((answered / total) * 100);
  }
}

export default OnboardingEngine;
