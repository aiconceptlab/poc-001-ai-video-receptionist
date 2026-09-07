export function validateLead(value) {
  if (!value || typeof value !== 'object')
    throw new Error('Please complete the form.');
  if (value.website) throw new Error('Unable to accept this submission.');
  if (value.consent !== true)
    throw new Error('Please agree to storing your enquiry.');
  const lengths = { name: [1, 100], email: [3, 254], interest: [1, 1000] };
  const result = {};
  for (const [field, [min, max]] of Object.entries(lengths)) {
    const text = typeof value[field] === 'string' ? value[field].trim() : '';
    if (text.length < min || text.length > max)
      throw new Error('Please check your ' + field + '.');
    result[field] = text;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))
    throw new Error('Please enter a valid email.');
  if (
    typeof value.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.id,
    )
  )
    throw new Error('Please reopen the form and try again.');
  return {
    ...result,
    id: value.id,
    email: result.email.toLowerCase(),
    consent_version: 'demo-v1',
    created_at: new Date().toISOString(),
  };
}

export async function handleLead(request, save) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json(
      { error: 'Origin not allowed.' },
      { status: 403, headers },
    );
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return Response.json({ error: 'Expected JSON.' }, { status: 415, headers });
  let lead;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error('Missing form data.');
    const chunks = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        return Response.json(
          { error: 'Form is too large.' },
          { status: 413, headers },
        );
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    lead = validateLead(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (error) {
    return Response.json(
      { error: error instanceof SyntaxError ? 'Invalid JSON.' : error.message },
      { status: 400, headers },
    );
  }
  try {
    await save(lead);
    return Response.json(
      { saved: true, id: lead.id },
      { status: 201, headers },
    );
  } catch {
    return Response.json(
      { error: 'Your enquiry was not saved. Please try again.' },
      { status: 503, headers },
    );
  }
}
