import { readFile, writeFile, mkdir } from 'node:fs/promises';
const agentId = process.env.DID_AGENT_ID;
const key = process.env.DID_API_KEY;
if (!agentId || !key)
  throw new Error(
    'Set DID_AGENT_ID and DID_API_KEY in .env first. The API key is used only by this script.',
  );
if (!/^agt_[\w-]+$/.test(agentId))
  throw new Error('DID_AGENT_ID must be a D-ID agent ID.');
async function api(path, method = 'GET', body) {
  const response = await fetch('https://api.d-id.com' + path, {
    method,
    headers: {
      Authorization: 'Basic ' + key.replace(/^Basic\s+/i, ''),
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      'D-ID ' +
        method +
        ' ' +
        path +
        ' returned ' +
        response.status +
        '. Check API credentials, agent ownership, and plan access.',
    );
  return response.json();
}
const agent = await api('/agents/' + agentId);
const items = agent.tools?.items || [];
const spec = JSON.parse(
  await readFile(
    new URL('../knowledge/open-contact-tool.json', import.meta.url),
    'utf8',
  ),
);
let toolId;
// Preserve every existing tool; avoid creating a duplicate on repeat runs.
for (const item of items) {
  const tool = await api('/tools/' + item.tool_id);
  if (tool.name === spec.name) {
    if (tool.config?.type !== 'client')
      throw new Error(
        'An existing tool has the same name but is not a client tool. Resolve it in D-ID first.',
      );
    toolId = tool.id;
    break;
  }
}
const cacheDir = new URL('../.local/', import.meta.url);
const cacheFile = new URL('../.local/tool.json', import.meta.url);
if (!toolId) {
  try {
    const cached = JSON.parse(await readFile(cacheFile, 'utf8'));
    if (cached.agentId === agentId) {
      const tool = await api('/tools/' + cached.toolId);
      if (tool.name === spec.name && tool.config?.type === 'client')
        toolId = tool.id;
    }
  } catch {
    /* No usable cache. */
  }
  if (!toolId) {
    const tool = await api('/tools', 'POST', spec);
    if (!tool.id) throw new Error('D-ID did not return a tool ID.');
    toolId = tool.id;
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cacheFile, JSON.stringify({ agentId, toolId }));
  }
  await api('/agents/' + agentId, 'PATCH', {
    tools: {
      ...agent.tools,
      items: [...items, { tool_id: toolId }],
      tool_choice: agent.tools?.tool_choice || 'auto',
    },
  });
}
console.log(
  'open_contact_form is attached. Start a NEW session to use it. The manual enquiry button works independently.',
);
