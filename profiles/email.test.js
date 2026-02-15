import { test } from 'node:test';
import assert from 'node:assert';
import { getLoginEmail } from './email.js';

test('getLoginEmail returns a string', () => {
  const code = '123456';
  const email = getLoginEmail(code);
  assert.strictEqual(typeof email, 'string');
});

test('getLoginEmail contains the verification code', () => {
  const code = '876543';
  const email = getLoginEmail(code);
  assert.ok(email.includes(code), `Email should contain code ${code}`);
});

test('getLoginEmail contains HTML structure', () => {
  const code = '000000';
  const email = getLoginEmail(code);
  assert.ok(email.includes('<!DOCTYPE html>'));
  assert.ok(email.includes('<html>'));
  assert.ok(email.includes('</html>'));
});

test('getLoginEmail contains one of the expected quotes', () => {
  const code = '111111';
  const email = getLoginEmail(code);
  const quotes = [
      "Privacy first, always. - Lightlink",
      "Your data, yours. - Lightlink",
      "Unsure? Undoubtably. - Lightlink",
      "What's yours, stays yours. - Lightlink"
  ];

  const hasQuote = quotes.some(quote => email.includes(quote));
  assert.ok(hasQuote, 'Email should contain one of the random quotes');
});
