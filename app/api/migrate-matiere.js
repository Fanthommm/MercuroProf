// One-time migration: move legacy fiches stored at "fiches/<name>.csv"
// into the matiere-folder scheme "fiches/Gastroenterologie/<name>.csv".
// Call once after deploying (needs Blob/OIDC access, so run in Production,
// not via `vercel dev`), then delete this file.
//
//   curl -X POST https://<ton-app>.vercel.app/api/migrate-matiere?dryRun=1 -H "x-upload-secret: <mdp>"
//   curl -X POST https://<ton-app>.vercel.app/api/migrate-matiere -H "x-upload-secret: <mdp>"

import { list, put, del, get } from "@vercel/blob";

const PREFIX = "fiches/";
const DEFAULT_MATIERE = "Gastroenterologie";

function isAuthorized(req) {
  const secret = process.env.UPLOAD_SECRET;
  if (!secret) return true;
  return req.headers["x-upload-secret"] === secret;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const dryRun = req.query.dryRun === "1" || req.query.dryRun === "true";

  let blobs;
  try {
    ({ blobs } = await list({ prefix: PREFIX }));
  } catch (e) {
    res.status(500).json({ error: `list failed: ${e.message}` });
    return;
  }

  const legacy = blobs.filter((b) => {
    const rest = b.pathname.slice(PREFIX.length);
    return rest.indexOf("/") === -1;
  });

  const results = [];
  for (const b of legacy) {
    const filename = b.pathname.slice(PREFIX.length);
    const newPathname = `${PREFIX}${DEFAULT_MATIERE}/${filename}`;

    if (dryRun) {
      results.push({ from: b.pathname, to: newPathname, status: "would-migrate" });
      continue;
    }

    try {
      const result = await get(b.url, { access: "private" });
      if (!result) {
        results.push({ from: b.pathname, status: "skipped", reason: "contenu introuvable" });
        continue;
      }
      const csv = await new Response(result.stream).text();
      await put(newPathname, csv, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "text/csv; charset=utf-8"
      });
      await del(b.url);
      results.push({ from: b.pathname, to: newPathname, status: "migrated" });
    } catch (e) {
      results.push({ from: b.pathname, status: "error", error: e.message });
    }
  }

  res.status(200).json({
    dryRun,
    totalLegacy: legacy.length,
    migrated: results.filter((r) => r.status === "migrated").length,
    results
  });
}
