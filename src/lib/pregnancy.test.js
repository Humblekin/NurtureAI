import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pregnancyStatusLabel, pregnancyStatusVariant, nextVisitNumber } from './pregnancy.js';

test('pregnancyStatusLabel maps known statuses to display labels', () => {
  assert.equal(pregnancyStatusLabel('active'), 'Current');
  assert.equal(pregnancyStatusLabel('completed'), 'Completed');
  assert.equal(pregnancyStatusLabel('miscarried'), 'Miscarried');
  assert.equal(pregnancyStatusLabel('aborted'), 'Aborted');
});

test('pregnancyStatusLabel falls back to a capitalized raw value', () => {
  assert.equal(pregnancyStatusLabel('unknown'), 'Unknown');
  assert.equal(pregnancyStatusLabel('ongoing'), 'Ongoing');
  assert.equal(pregnancyStatusLabel(''), 'Unknown');
  assert.equal(pregnancyStatusLabel(null), 'Unknown');
  assert.equal(pregnancyStatusLabel(undefined), 'Unknown');
});

test('pregnancyStatusVariant maps statuses to badge variants', () => {
  assert.equal(pregnancyStatusVariant('active'), 'primary');
  assert.equal(pregnancyStatusVariant('completed'), 'success');
  assert.equal(pregnancyStatusVariant('miscarried'), 'critical');
  assert.equal(pregnancyStatusVariant('aborted'), 'critical');
  assert.equal(pregnancyStatusVariant('anything-else'), 'neutral');
});

test('nextVisitNumber starts at 1 when no visits exist', () => {
  assert.equal(nextVisitNumber([], 'preg-1'), 1);
  assert.equal(nextVisitNumber(null, 'preg-1'), 1);
});

test('nextVisitNumber counts only visits for the given pregnancy', () => {
  const visits = [
    { id: 'a', pregnancy_id: 'preg-1', visit_number: 1 },
    { id: 'b', pregnancy_id: 'preg-1', visit_number: 2 },
    { id: 'c', pregnancy_id: 'preg-2', visit_number: 7 },
  ];
  assert.equal(nextVisitNumber(visits, 'preg-1'), 3);
  assert.equal(nextVisitNumber(visits, 'preg-2'), 8);
});

test('nextVisitNumber is one past the highest number, ignoring missing values', () => {
  const visits = [
    { id: 'a', pregnancy_id: 'preg-1', visit_number: 2 },
    { id: 'b', pregnancy_id: 'preg-1', visit_number: null },
    { id: 'c', pregnancy_id: 'preg-1', visit_number: undefined },
    { id: 'd', pregnancy_id: 'preg-1', visit_number: 5 },
  ];
  assert.equal(nextVisitNumber(visits, 'preg-1'), 6);
});

test('nextVisitNumber never reuses a number after a deletion', () => {
  const visits = [
    { id: 'a', pregnancy_id: 'preg-1', visit_number: 1 },
    { id: 'b', pregnancy_id: 'preg-1', visit_number: 3 },
  ];
  // 2 was deleted, but the next visit is still one past the highest (3 → 4).
  assert.equal(nextVisitNumber(visits, 'preg-1'), 4);
});
