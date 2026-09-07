import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { previewAnswer } from '../lib/preview.mjs';
import { handleLead } from '../lib/leads.mjs';
const facts = JSON.parse(
  await readFile(new URL('../knowledge/faq.json', import.meta.url), 'utf8'),
);
const payload = {
  id: '8b28a1e4-1738-4003-9b5a-c59e36992e15',
  name: 'Test Visitor',
  email: 'TEST@example.com',
  interest: 'A receptionist',
  consent: true,
  website: '',
};
function req(body = payload, extra = {}) {
  return new Request('http://localhost:5173/api/leads', {
    method: 'POST',
    headers: {
      origin: 'http://localhost:5173',
      'content-type': 'application/json',
      ...extra,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}
test('all suggested questions return the corresponding exact fact', () => {
  for (const fact of facts) {
    const answer = previewAnswer(fact.question, facts);
    assert.equal(answer.text, fact.answer);
    assert.equal(answer.source, fact.id);
  }
});
test('unknown business facts decline instead of inventing an answer', () => {
  const answer = previewAnswer('What is your Berlin street address?', facts);
  assert.equal(answer.source, null);
  assert.match(answer.text, /don't have/);
});
test('contact question triggers the form, not a saved lead', () => {
  assert.equal(previewAnswer('Can I contact a human?', facts).contact, true);
});
test('valid submission persists normalized data and returns receipt only', async () => {
  let persisted;
  const response = await handleLead(req(), async (value) => {
    persisted = value;
  });
  assert.equal(response.status, 201);
  assert.equal(persisted.email, 'test@example.com');
  assert.equal(persisted.consent_version, 'demo-v1');
  const result = await response.json();
  assert.deepEqual(result, { saved: true, id: payload.id });
  assert.equal('email' in result, false);
});
test('validation rejects malformed, missing-consent and bot submissions without writes', async () => {
  for (const body of [
    '{bad',
    null,
    { ...payload, consent: false },
    { ...payload, email: 'invalid' },
    { ...payload, name: ' ' },
    { ...payload, interest: 'x'.repeat(1001) },
    { ...payload, id: 'bad' },
    { ...payload, website: 'spam' },
  ]) {
    const response = await handleLead(req(body), async () => {
      assert.fail('Must not persist invalid data');
    });
    assert.equal(response.status, 400);
  }
});
test('cross-origin submissions, non-JSON and oversized bodies are blocked', async () => {
  const save = async () => assert.fail('Must not persist');
  assert.equal(
    (
      await handleLead(
        req(payload, { origin: 'https://untrusted.example' }),
        save,
      )
    ).status,
    403,
  );
  assert.equal(
    (await handleLead(req(payload, { 'content-type': 'text/plain' }), save))
      .status,
    415,
  );
  assert.equal((await handleLead(req('x'.repeat(9000)), save)).status, 413);
});
test('database failure never claims success', async () => {
  const response = await handleLead(req(), async () => {
    throw new Error('private db detail');
  });
  assert.equal(response.status, 503);
  const result = await response.json();
  assert.equal(result.saved, undefined);
  assert.doesNotMatch(result.error, /private db detail/);
});
