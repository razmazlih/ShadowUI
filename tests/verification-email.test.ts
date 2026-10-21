import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildVerificationEmail } from '../lib/verification-email';

test('verification email has an accessible RTL action and a plain-text fallback', () => {
  const url = 'https://shadowui.example/auth/verify?token=abc&lang=he';
  const email = buildVerificationEmail(url);
  assert.match(email.subject, /ShadowUI/);
  assert.match(email.html, /<html lang="he" dir="rtl">/);
  assert.match(email.html, /<a href="https:\/\/shadowui\.example\/auth\/verify\?token=abc&amp;lang=he"[^>]*>אימות כתובת המייל<\/a>/);
  assert.ok(email.text.includes(url));
  assert.match(email.text, /אין צורך בלחיצה נוספת באתר/);
  assert.doesNotMatch(email.html, /<script|<img|<link /i);
});

test('verification email escapes URL text and attributes without altering the text fallback', () => {
  const url = 'https://example.com/verify?token="\'><test>&next=1';
  const email = buildVerificationEmail(url);
  assert.ok(email.html.includes('token=&quot;&#39;&gt;&lt;test&gt;&amp;next=1'));
  assert.ok(email.text.includes(url));
  assert.doesNotMatch(email.html, /<test>/);
});

test('verification email rejects active URL schemes and embedded credentials', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'https://user:password@example.com', 'invalid']) {
    assert.throws(() => buildVerificationEmail(url));
  }
});
