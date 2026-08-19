import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generatePatientCode } from './db.js';

test('generatePatientCode returns NRT- prefixed uppercase code', () => {
  const code = generatePatientCode('8b7a6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d');
  assert.match(code, /^NRT-[A-F0-9]{8}$/);
});

test('generatePatientCode is deterministic for the same id', () => {
  const id = '8b7a6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d';
  assert.equal(generatePatientCode(id), generatePatientCode(id));
});

test('generatePatientCode handles empty input', () => {
  const code = generatePatientCode('');
  assert.match(code, /^NRT-[A-F0-9]{8}$/);
});
