import { env } from 'cloudflare:workers';
import { handleLead } from '@/lib/leads.mjs';
export function POST(request: Request) {
  return handleLead(request, async (lead: Record<string, string>) => {
    const { LEADS_DB: db } = env as unknown as { LEADS_DB: D1Database };
    await db
      .prepare(
        'INSERT INTO leads (id, name, email, interest, consent_version, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING',
      )
      .bind(
        lead.id,
        lead.name,
        lead.email,
        lead.interest,
        lead.consent_version,
        lead.created_at,
      )
      .run();
  });
}
