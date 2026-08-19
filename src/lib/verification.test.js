import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getVerificationStatus, VERIFICATION_STATUS, VERIFICATION_LABELS, VERIFICATION_VARIANTS } from './verification.js';

const { VERIFIED, PENDING_VERIFICATION, REQUIRES_REVIEW, UNVERIFIED } = VERIFICATION_STATUS;

test('worker-recorded data is VERIFIED', () => {
  const row = { verified: true, data_source: 'healthcare_worker', verified_by: 'w-1', verified_at: '2026-08-01' };
  const status = getVerificationStatus(row);
  assert.equal(status.status, VERIFIED);
  assert.equal(status.label, VERIFICATION_LABELS[VERIFIED]);
  assert.equal(status.variant, VERIFICATION_VARIANTS[VERIFIED]);
});

test('mother self-registered records await worker verification', () => {
  const row = { verified: false, data_source: 'mother_registered' };
  const status = getVerificationStatus(row);
  assert.equal(status.status, PENDING_VERIFICATION);
});

test('mother-reported clinical data requires review', () => {
  const row = { verified: false, data_source: 'mother_reported' };
  const status = getVerificationStatus(row);
  assert.equal(status.status, REQUIRES_REVIEW);
});

test('records without provenance are UNVERIFIED', () => {
  assert.equal(getVerificationStatus({}).status, UNVERIFIED);
  assert.equal(getVerificationStatus(null).status, UNVERIFIED);
  assert.equal(getVerificationStatus(undefined).status, UNVERIFIED);
});

test('explicit verified:true wins even without a known data_source', () => {
  const status = getVerificationStatus({ verified: true });
  assert.equal(status.status, VERIFIED);
});

test('system-sourced data with verified flag follows the flag', () => {
  assert.equal(getVerificationStatus({ verified: true, data_source: 'system' }).status, VERIFIED);
  assert.equal(getVerificationStatus({ verified: false, data_source: 'system' }).status, UNVERIFIED);
});
