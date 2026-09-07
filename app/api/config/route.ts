import { env } from 'cloudflare:workers';
export function GET() {
  const config = env as unknown as Record<string, string>;
  const agentId = config.DID_AGENT_ID || '';
  const clientKey = config.DID_CLIENT_KEY || '';
  return Response.json(
    {
      agentId,
      clientKey,
      live: Boolean(agentId && clientKey),
      microphone: config.DID_AVATAR_TYPE === 'expressive',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
