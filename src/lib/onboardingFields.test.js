import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDateInput,
  parseNumberInput,
  coerceFieldValue,
  coerceDraft,
  coerceLoopControl,
  formDataFromDraft,
  draftFromFormData,
  fieldValueFromSpeech,
  FIELD_BY_NAME,
  CHILD_FIELD_BY_NAME,
} from '../services/onboardingFields.js';

test('parseDateInput accepts ISO, day-first, and month-first forms', () => {
  assert.equal(parseDateInput('1998-05-15'), '1998-05-15');
  assert.equal(parseDateInput('15 May 1998'), '1998-05-15');
  assert.equal(parseDateInput('15th May 1998'), '1998-05-15');
  assert.equal(parseDateInput('15th of May 1998'), '1998-05-15');
  assert.equal(parseDateInput('May 15, 1998'), '1998-05-15');
  assert.equal(parseDateInput('may 15 1998'), '1998-05-15');
});

test('parseDateInput reads numeric dates day-first, as spoken in Ghana', () => {
  // 05 cannot be a day here, so this has to be 5 May.
  assert.equal(parseDateInput('05/05/1998'), '1998-05-05');
  assert.equal(parseDateInput('15/05/1998'), '1998-05-15');
  assert.equal(parseDateInput('15-05-98'), '1998-05-15');
});

test('parseDateInput rejects impossible and unparseable dates', () => {
  assert.equal(parseDateInput('31 February 2020'), null);
  assert.equal(parseDateInput('sometime last year'), null);
  assert.equal(parseDateInput(''), null);
  assert.equal(parseDateInput(null), null);
  // Valid but not a date string.
  assert.equal(parseDateInput('3'), null);
});

test('parseNumberInput handles digits, "point" speech, and number words', () => {
  assert.equal(parseNumberInput('3'), 3);
  assert.equal(parseNumberInput('3.2'), 3.2);
  assert.equal(parseNumberInput('2 point 6'), 2.6);
  assert.equal(parseNumberInput('about three kilos'), 3);
  assert.equal(parseNumberInput('nothing here'), null);
  assert.equal(parseNumberInput(''), null);
});

test('coerceFieldValue normalizes a date field to the input type format', () => {
  const field = FIELD_BY_NAME.date_of_birth;
  assert.equal(coerceFieldValue(field, '15 May 1998'), '1998-05-15');
  // Unparseable input blanks the field instead of storing a wrong date.
  assert.equal(coerceFieldValue(field, 'when I was young'), '');
});

test('coerceFieldValue enforces numeric bounds rather than clamping', () => {
  const field = FIELD_BY_NAME.gravida;
  assert.equal(coerceFieldValue(field, '3'), '3');
  assert.equal(coerceFieldValue(field, 3), '3');
  assert.equal(coerceFieldValue(field, '0'), '');
  const weight = CHILD_FIELD_BY_NAME.birth_weight;
  assert.equal(coerceFieldValue(weight, '3.2'), '3.2');
  assert.equal(coerceFieldValue(weight, '2'), '2');
  assert.equal(coerceFieldValue(weight, '0.2'), '');
  assert.equal(coerceFieldValue(weight, '9'), '');
});

test('coerceFieldValue matches spoken yes/no in English and Dagbani', () => {
  const field = FIELD_BY_NAME.is_pregnant;
  assert.equal(coerceFieldValue(field, 'yes'), 'Yes');
  assert.equal(coerceFieldValue(field, 'Yeah, I am'), 'Yes');
  assert.equal(coerceFieldValue(field, 'aye'), 'Yes');
  assert.equal(coerceFieldValue(field, 'no'), 'No');
  assert.equal(coerceFieldValue(field, 'baa'), 'No');
  assert.equal(coerceFieldValue(field, 'I am not sure'), '');
});

test('coerceFieldValue maps boy/girl onto the stored gender codes', () => {
  const field = CHILD_FIELD_BY_NAME.gender;
  assert.equal(coerceFieldValue(field, 'boy'), 'male');
  assert.equal(coerceFieldValue(field, 'a girl'), 'female');
  assert.equal(coerceFieldValue(field, 'kuɗiya'), 'female');
  assert.equal(coerceFieldValue(field, 'undecided'), '');
});

test('coerceFieldValue normalizes spoken blood groups', () => {
  const field = FIELD_BY_NAME.blood_group;
  assert.equal(coerceFieldValue(field, 'O positive'), 'O+');
  assert.equal(coerceFieldValue(field, 'a negative'), 'A-');
  assert.equal(coerceFieldValue(field, 'AB+'), 'AB+');
  assert.equal(coerceFieldValue(field, 'I do not know'), '');
});

test('formDataFromDraft keeps every child in the list', () => {
  // Regression: the engine used to emit one flat child_name and silently drop
  // every child after the first.
  const draft = {
    full_name: 'Mariam Abdulai',
    has_children: 'Yes',
    children_list: [
      { name: 'Ama', date_of_birth: '15 March 2024', gender: 'Girl', birth_weight: '3.2' },
      { name: 'Fuseini', date_of_birth: '2 May 2021', gender: 'Boy', birth_weight: '2.8' },
    ],
  };
  const form = formDataFromDraft(draft);
  assert.equal(form.full_name, 'Mariam Abdulai');
  assert.equal(form.children_list.length, 2);
  assert.equal(form.children_list[0].gender, 'female');
  assert.equal(form.children_list[0].birth_weight, '3.2');
  assert.equal(form.children_list[1].name, 'Fuseini');
  assert.equal(form.children_list[1].gender, 'male');
});

test('formDataFromDraft discards children when the mother said she has none', () => {
  const form = formDataFromDraft({
    has_children: 'No',
    children_list: [{ name: 'Ama' }],
  });
  assert.deepEqual(form.children_list, []);
});

test('draftFromFormData round-trips without losing children or coercion', () => {
  const draft = {
    full_name: 'Mariam Abdulai',
    date_of_birth: '15 May 1998',
    is_pregnant: 'Yes',
    lmp: 'January 15, 2026',
    gravida: '3',
    has_children: 'Yes',
    children_list: [
      { name: 'Ama', date_of_birth: '15 March 2024', gender: 'female', birth_weight: '3.2' },
    ],
  };
  const roundTripped = draftFromFormData(formDataFromDraft(draft));
  assert.equal(roundTripped.date_of_birth, '1998-05-15');
  assert.equal(roundTripped.lmp, '2026-01-15');
  assert.equal(roundTripped.gravida, '3');
  assert.equal(roundTripped.children_list.length, 1);
  assert.equal(roundTripped.children_list[0].birth_weight, '3.2');
});

test('fieldValueFromSpeech returns null rather than clearing on bad input', () => {
  assert.equal(fieldValueFromSpeech(FIELD_BY_NAME.date_of_birth, 'fifteenth of May'), null);
  assert.equal(fieldValueFromSpeech(FIELD_BY_NAME.date_of_birth, '15th of May 1998'), '1998-05-15');
  assert.equal(fieldValueFromSpeech(FIELD_BY_NAME.community, ''), null);
  assert.equal(fieldValueFromSpeech(FIELD_BY_NAME.is_pregnant, 'yes please'), 'Yes');
});

test('coerceDraft keeps children, which the store uses as its handoff shape', () => {
  // Regression: coerceDraft only walked the flat PROFILE_STEPS fields, so every
  // child collected in the conversation was dropped on the way to the form.
  const coerced = coerceDraft({
    community: 'Tamale',
    has_children: 'Yes',
    children_list: [
      { name: 'Ama', date_of_birth: '15 March 2024', gender: 'girl', birth_weight: '3.2' },
      { name: 'Bakpa', date_of_birth: '2 Jan 2026', gender: 'boy', birth_weight: '2.8 kg' },
    ],
  });

  assert.equal(coerced.children_list.length, 2);
  assert.equal(coerced.children_list[0].name, 'Ama');
  assert.equal(coerced.children_list[0].date_of_birth, '2024-03-15');
  assert.equal(coerced.children_list[0].gender, 'female');
  assert.equal(coerced.children_list[0].birth_weight, '3.2');
  assert.equal(coerced.children_list[1].birth_weight, '2.8');
  assert.equal(coerced.community, 'Tamale');
});

test('coerceDraft gives every child the full field shape and drops junk entries', () => {
  const coerced = coerceDraft({
    children_list: [
      { name: 'Ama' },
      null,
      'not a child',
      { name: 'Bakpa' },
    ],
  });

  assert.equal(coerced.children_list.length, 2);
  assert.deepEqual(
    Object.keys(coerced.children_list[0]).sort(),
    Object.keys(CHILD_FIELD_BY_NAME).sort()
  );
});

test('coerceDraft leaves children_list absent when the draft has none', () => {
  const coerced = coerceDraft({ community: 'Tamale' });
  assert.equal('children_list' in coerced, false);
  assert.equal(coerced.community, 'Tamale');
});

test('coerceLoopControl keeps the repeat loop going on anything but a refusal', () => {
  // Regression: "do you have another child?" is not a canonical field, so it was
  // routed through FIELD_BY_NAME and dropped. The loop never matched, the
  // conversation ended after one child, and it still looked complete.
  for (const yes of ['Yes', 'yes', 'yes i do', 'well yes', 'mm yes', 'one more', 'Yes please', 'y']) {
    assert.equal(coerceLoopControl(yes), 'Yes', `expected ${yes} to continue the loop`);
  }
  for (const no of ['No', 'no', 'no more', 'nope', 'No, that is all', 'No.', 'none', 'finished', 'done', 'no thanks']) {
    assert.equal(coerceLoopControl(no), 'No', `expected ${no} to end the loop`);
  }
});

test('coerceLoopControl still hears a yes that carries a negation-sounding tail', () => {
  for (const yes of ['Yes please', 'yes, one more', 'yeah add her']) {
    assert.equal(coerceLoopControl(yes), 'Yes', `expected ${yes} to continue the loop`);
  }
});

test('coerceLoopControl returns empty for silence so the question can be re-asked', () => {
  assert.equal(coerceLoopControl(''), '');
  assert.equal(coerceLoopControl('   '), '');
  assert.equal(coerceLoopControl(null), '');
  assert.equal(coerceLoopControl(undefined), '');
});