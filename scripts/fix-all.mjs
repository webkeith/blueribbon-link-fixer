import { createClient, getLinkFields, fixItem, saveItem } from '../lib/webflow.js';

const DRY = process.argv.includes('--dry');
const COLLECTIONS = (process.env.COLLECTION_IDS ||
  '67a085808283d8ec6318d530,67a206b60e886f042315e2aa,67a07554972751caf45af53a')
  .split(',').map(s => s.trim()).filter(Boolean);

const call = createClient(process.env.WEBFLOW_TOKEN);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let total = 0;

for (const id of COLLECTIONS) {
  const fields = await getLinkFields(call, id);
  const { displayName } = await call(`/collections/${id}`);
  console.log(`\n=== ${displayName} (${id})  rich text: [${fields.rich}]  link: [${fields.links}]`);

  let offset = 0, items;
  do {
    ({ items } = await call(`/collections/${id}/items?limit=100&offset=${offset}`));
    for (const item of items) {
      const { patch, changes } = fixItem(item, fields);
      if (!changes.length) continue;
      total += changes.length;
      console.log(`\n${item.fieldData.slug}${item.isDraft ? ' (draft)' : ''}`);
      changes.forEach(c => console.log('  ' + c));
      if (!DRY) { await saveItem(call, id, item, patch); await sleep(1100); }
    }
    offset += 100;
  } while (items.length === 100);
}

console.log(`\n${DRY ? '[dry run] ' : ''}${total} changes`);
