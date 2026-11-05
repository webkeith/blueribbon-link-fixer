# Blue Ribbon Link Fixer

Cleans links in Webflow CMS items (Blog, Service Areas, Services):

- removes empty ChatGPT citation links and `utm_source=chatgpt.com`
- rewrites internal links that 301-redirect to their final URL
- unwraps `google.com/search?q=` links into direct links
- normalizes `blueribbonseptic.com` → `https://www.blueribbonseptic.com`, no trailing slash
- fixes malformed external URLs (CSLB, Yelp `\&`, Sacramento County EMD, `http://`)

Two ways to run it:

| | What | When |
|---|---|---|
| `scripts/fix-all.mjs` | One-time bulk cleanup of every item | Run once now |
| `api/webflow-webhook.js` | Vercel function that fixes each item when it's published | Ongoing |

Requires Node 18+. No dependencies.

---

## 1. Run the tests

```powershell
npm test
```

## 2. One-time cleanup

```powershell
$env:WEBFLOW_TOKEN="your_token"
npm run fix:dry
npm run fix
```

`fix:dry` prints every change and saves nothing. `fix` writes the changes to the live items.

Token: Webflow → Site settings → Apps & integrations → API access → Generate API token, with **CMS: Read and write** scope.

---

## 3. Deploy the webhook to Vercel

### Option A: Vercel CLI

```powershell
npm i -g vercel
vercel login
vercel link
vercel env add WEBFLOW_TOKEN production
vercel env add WEBHOOK_KEY production
vercel env add DRY_RUN production
vercel --prod
```

### Option B: GitHub import

Push this folder to a GitHub repo, then go to vercel.com → Add New → Project → Import. Leave Framework Preset as **Other**, and add the environment variables below before deploying.

### Environment variables

| Name | Value |
|---|---|
| `WEBFLOW_TOKEN` | API token with CMS read/write |
| `WEBHOOK_KEY` | A random string. Generate one with `node -e "console.log(crypto.randomUUID())"` |
| `DRY_RUN` | `true` for the first test, then `false` |
| `WEBFLOW_WEBHOOK_SECRET` | Optional. Set it only if you create the webhook via API/OAuth and have a signing secret |
| `COLLECTION_IDS` | Optional. Defaults to Blog, Service Areas and Services |

After changing an env var, redeploy (`vercel --prod`) so it takes effect.

### Check it's live

Open `https://YOUR-PROJECT.vercel.app/api/webflow-webhook` in a browser. You should get `{"ok":true,...}`.

---

## 4. Add the webhook in Webflow

Site settings → Apps & integrations → Webhooks → Add webhook

- **Trigger type:** `Collection item published`
- **Webhook URL:** `https://YOUR-PROJECT.vercel.app/api/webflow-webhook?key=YOUR_WEBHOOK_KEY`

One webhook covers every collection on the site. The function ignores collections that aren't in `COLLECTION_IDS`.

### Test

1. Keep `DRY_RUN=true`.
2. Publish a blog post in Webflow.
3. Open Vercel → Project → Logs. You'll see `[fixed] slug (n)` followed by each change, or `changes: 0` when the post is already clean.
4. If the output looks right, set `DRY_RUN=false` and redeploy.

### Loop safety

When the function saves a fix, Webflow publishes the item again and fires the webhook a second time. On that second pass the item is already clean, so nothing is saved and the loop stops.

---

## Maintenance

When you rename a slug and add a 301 in Webflow, add the old → new pair to `MAP` in `lib/fix-links.js` and redeploy. Run `npm test` after editing.

## Files

```
api/webflow-webhook.js   Vercel function (POST = webhook, GET = health check)
lib/fix-links.js         Link rules and redirect map (shared)
lib/webflow.js           Webflow API client, field detection, save logic
scripts/fix-all.mjs      One-time bulk cleanup
test/fix-links.test.mjs  Unit tests
```
