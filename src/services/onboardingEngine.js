import { chatCompletion } from '../lib/groq';

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
    field: 'child_name',
    required: true,
    condition: (data) => data.has_children === 'Yes',
  },
  {
    id: 'child_date_of_birth',
    text: "When was your child born? You can say something like '15th March 2024' or 'March 15, 2024'.",
    textDag: "Yaɗayake yaron ka ya haihu? Za ka iya cewa '15 ga watan Maris 2024'.",
    category: 'children',
    type: 'date',
    field: 'child_date_of_birth',
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
    field: 'child_gender',
    required: true,
    condition: (data) => data.has_children === 'Yes',
  },
  {
    id: 'child_birth_weight',
    text: "Do you know your child's birth weight in kilograms? For example, 3.2 or 3.5.",
    textDag: "Ka san nauyin yaron ka a lokacin haihuwa a cikin kilogram? Misali, 3.2 ko 3.5.",
    category: 'children',
    type: 'number',
    field: 'child_birth_weight',
    required: false,
    condition: (data) => data.has_children === 'Yes',
  },
  {
    id: 'has_another_child',
    text: "Do you have another child you'd like to register?",
    textDag: "Kana da wani yaro da kake son yi rajista?",
    category: 'children',
    type: 'choice',
    options: ['Yes', 'No'],
    field: 'has_another_child',
    required: true,
    condition: (data) => data.has_children === 'Yes',
  },
];

// ── Helper Functions ─────────────────────────────────

function calculateWeeksFromLMP(lmp) {
  if (!lmp) return null;
  const start = new Date(lmp);
  const now = new Date();
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7));
}

function calculateEDDFromLMP(lmp) {
  if (!lmp) return null;
  const start = new Date(lmp);
  start.setDate(start.getDate() + 280); // 40 weeks
  return start.toISOString().split('T')[0];
}

// ── Onboarding Engine ────────────────────────────────

export class OnboardingEngine {
  constructor(profileId, language = 'en') {
    this.profileId = profileId;
    this.language = language;
    this.collectedData = {};
    this.conversationHistory = [];
    this.currentQuestionIndex = 0;
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
    if (extractedData) {
      Object.assign(this.collectedData, extractedData);
    }

    // Move to next question
    this.currentQuestionIndex++;

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
   * Use AI to extract structured data from a free-text response.
   */
  async extractData(question, response) {
    const extractPrompt = `You are a data extraction assistant. Extract structured information from the user's response.

Current question: "${question.text}"
User's response: "${response}"

Return ONLY a valid JSON object with the extracted field(s). Do not include any explanation.

Field to extract: "${question.field}"
Question type: "${question.type}"

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

Return ONLY the JSON object:`;

    try {
      const result = await chatCompletion(
        [
          { role: 'system', content: 'You are a precise data extraction assistant. Return only valid JSON.' },
          { role: 'user', content: extractPrompt },
        ],
        { temperature: 0.1, maxTokens: 200 }
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
        { temperature: 0.7, maxTokens: 150 }
      );
      return response;
    } catch (error) {
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

    if (d.has_children === 'Yes' && d.child_name) {
      lines.push("");
      lines.push("**Children:**");
      lines.push(`• Name: ${d.child_name}`);
      if (d.child_date_of_birth) lines.push(`• Date of birth: ${d.child_date_of_birth}`);
      if (d.child_gender) lines.push(`• Gender: ${d.child_gender}`);
      if (d.child_birth_weight) lines.push(`• Birth weight: ${d.child_birth_weight}kg`);
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

    const d = this.collectedData;

    // Build mother profile
    const motherProfile = {
      profile_id: this.profileId,
      full_name: d.full_name || 'Unknown',
      date_of_birth: d.date_of_birth || null,
      phone: null, // Set from registration
      community: d.community || null,
      blood_group: d.blood_group || null,
      medical_history: [
        d.existing_conditions,
        d.current_medications ? `Current medications: ${d.current_medications}` : null,
        d.previous_complications ? `Previous complications: ${d.previous_complications}` : null,
      ].filter(Boolean).join('. ') || null,
      risk_level: 'low',
      assigned_worker_id: null,
      edd: null,
    };

    // Build pregnancy profile if pregnant
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

    // Build children profiles if has children
    let childrenProfiles = [];
    if (d.has_children === 'Yes' && d.child_name) {
      // For voice onboarding, we collect one child at a time
      // The has_another_child question controls if we collect more
      childrenProfiles.push({
        mother_id: null, // Set after mother is created
        full_name: d.child_name || 'Unknown',
        date_of_birth: d.child_date_of_birth || null,
        gender: d.child_gender === 'Boy' ? 'male' : d.child_gender === 'Girl' ? 'female' : null,
        birth_weight: d.child_birth_weight ? parseFloat(d.child_birth_weight) : null,
      });
    }

    return {
      success: true,
      motherProfile,
      pregnancyProfile,
      childrenProfiles,
      collectedData: d,
    };
  }

  /**
   * Get the current progress percentage.
   */
  getProgress() {
    const total = QUESTIONS.filter(q => !q.condition || q.condition(this.collectedData)).length;
    const answered = Math.min(this.currentQuestionIndex, total);
    return Math.round((answered / total) * 100);
  }
}

export default OnboardingEngine;
