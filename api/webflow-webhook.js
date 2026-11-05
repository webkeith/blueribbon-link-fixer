import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient, getLinkFields, fixItem, saveItem } from '../lib/webflow.js';

const ALLOWED = (process.env.COLLECTION_IDS ||
  '67a085808283d8ec6318d530,67a206b60e886f042315e2aa,67a07554972751caf45af53a')
  .split(',').map(s => s.trim()).filter(Boolean);

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const safeEqual = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

function authorized(request, raw) {
  const secret = process.env.WEBFLOW_WEBHOOK_SECRET;
  const sig = request.headers.get('x-webflow-signature');
  const ts = request.headers.get('x-webflow-timestamp');
  if (secret && sig && ts) {
    if (Math.abs(Date.now() - Number(ts)) > 5 * 60 * 1000) return false;
    const expected = createHmac('sha256', secret).update(`${ts}:${raw}`).digest('hex');
    return safeEqual(expected, sig);
  }
  const key = process.env.WEBHOOK_KEY;
  if (!key) return false;
  const given = new URL(request.url).searchParams.get('key') || '';
  return safeEqual(given, key);
}

function extractItems(body) {
  const p = body?.payload;
  if (!p) return [];
  if (Array.isArray(p.items)) return p.items;
  if (Array.isArray(p)) return p;
  if (p.id && p.collectionId) return [p];
  return [];
}

export async function POST(request) {
  const raw = await request.text();
  if (!authorized(request, raw)) return json(401, { error: 'unauthorized' });

  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'bad json' }); }

  const call = createClient(process.env.WEBFLOW_TOKEN);
  const results = [];

  for (const ref of extractItems(body)) {
    const collectionId = ref.collectionId;
    if (!collectionId || !ALLOWED.includes(collectionId)) {
      results.push({ id: ref.id, skipped: 'collection not allowed' });
      continue;
    }
    try {
      const fields = await getLinkFields(call, collectionId);
      const item = await call(`/collections/${collectionId}/items/${ref.id}`);
      const { patch, changes } = fixItem(item, fields);
      if (!changes.length) {
        results.push({ id: ref.id, slug: item.fieldData?.slug, changes: 0 });
        continue;
      }
      if (process.env.DRY_RUN !== 'true') await saveItem(call, collectionId, item, patch);
      console.log(`[fixed] ${item.fieldData?.slug} (${changes.length})\n  ` + changes.join('\n  '));
      results.push({ id: ref.id, slug: item.fieldData?.slug, changes: changes.length, dryRun: process.env.DRY_RUN === 'true' });
    } catch (err) {
      console.error(`[error] ${ref.id}`, err.message);
      results.push({ id: ref.id, error: err.message });
    }
  }

  return json(200, { trigger: body.triggerType, results });
}

export function GET() {
  return json(200, { ok: true, service: 'blueribbon-link-fixer' });
}
