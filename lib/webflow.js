import { fixHtml, fixHref } from './fix-links.js';

const API = 'https://api.webflow.com/v2';

export function createClient(token) {
  if (!token) throw new Error('WEBFLOW_TOKEN is not set');
  const call = async (path, init = {}) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(API + path, {
        ...init,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          accept: 'application/json',
          ...init.headers,
        },
      });
      if (res.status === 429) {
        const wait = Number(res.headers.get('retry-after') || 2) * 1000;
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) throw new Error(`Webflow ${init.method || 'GET'} ${path} -> ${res.status} ${await res.text()}`);
      return res.status === 204 ? null : res.json();
    }
    throw new Error(`Webflow ${path} rate limited`);
  };
  return call;
}

const schemaCache = new Map();

export async function getLinkFields(call, collectionId) {
  if (schemaCache.has(collectionId)) return schemaCache.get(collectionId);
  const { fields } = await call(`/collections/${collectionId}`);
  const result = {
    rich: fields.filter(f => f.type === 'RichText').map(f => f.slug),
    links: fields.filter(f => f.type === 'Link').map(f => f.slug),
  };
  schemaCache.set(collectionId, result);
  return result;
}

export function fixItem(item, { rich, links }) {
  const patch = {};
  const changes = [];
  for (const f of rich) {
    const html = item.fieldData?.[f];
    if (typeof html !== 'string' || !html) continue;
    const r = fixHtml(html);
    if (r.changes.length && r.out !== html) {
      patch[f] = r.out;
      changes.push(...r.changes.map(c => `[${f}] ${c}`));
    }
  }
  for (const f of links) {
    const url = item.fieldData?.[f];
    if (typeof url !== 'string' || !url) continue;
    const next = fixHref(url);
    if (next) {
      patch[f] = next;
      changes.push(`[${f}] ${url}  ->  ${next}`);
    }
  }
  return { patch, changes };
}

export async function saveItem(call, collectionId, item, patch) {
  const live = !item.isDraft && !!item.lastPublished;
  const path = `/collections/${collectionId}/items/${item.id}${live ? '/live' : ''}`;
  return call(path, { method: 'PATCH', body: JSON.stringify({ fieldData: patch }) });
}
