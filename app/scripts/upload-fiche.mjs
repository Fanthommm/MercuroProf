// Dev-only helper: push a local CSV straight into the Blob store, bypassing
// the app's UI/passphrase gate. Requires BLOB_READ_WRITE_TOKEN in the
// environment (e.g. `node --env-file=.env.local scripts/upload-fiche.mjs ...`).
//
// Usage:
//   node --env-file=.env.local scripts/upload-fiche.mjs "<nom de la fiche>" <chemin-vers-le.csv>

import { readFileSync } from "fs";
import { put } from "@vercel/blob";

const [, , name, filePath] = process.argv;

if (!name || !filePath) {
  console.error('Usage: node scripts/upload-fiche.mjs "<nom de la fiche>" <chemin-vers-le.csv>');
  process.exit(1);
}

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN manquant. Lance `vercel env pull .env.local` puis relance avec --env-file=.env.local");
  process.exit(1);
}

const csv = readFileSync(filePath, "utf-8");
const pathname = `fiches/${encodeURIComponent(name.trim())}.csv`;

const blob = await put(pathname, csv, {
  access: "public",
  addRandomSuffix: false,
  allowOverwrite: true,
  contentType: "text/csv; charset=utf-8"
});

console.log(`Envoyé : ${blob.pathname}`);
console.log(blob.url);
