import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { useFieldDictation } from './useFieldDictation.js';

test('useFieldDictation renders without crashing during hook initialization', () => {
  function TestComponent() {
    const dictation = useFieldDictation('en');
    return React.createElement('div', null, dictation.isListening ? 'listening' : 'ready');
  }

  const html = renderToString(React.createElement(TestComponent));
  assert.match(html, /ready|listening/);
});
