import { list, put, del, get } from "@vercel/blob";
import { readdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const PREFIX = "fiches/";
const DEFAULT_MATIERE = "Non classé";
const IS_LOCAL_DEV = process.env.VERCEL_ENV === "development";

const __dirname = dirname(fileURLToPath(import.meta.url));
// app/api/fiches.js -> app/ -> csv_questions/
const LOCAL_CSV_DIR = join(__dirname, "..", "csv_questions");

function isAuthorized(req) {
  const secret = process.env.UPLOAD_SECRET;
  if (!secret) return true;
  return req.headers["x-upload-secret"] === secret;
}

function sanitizePart(value) {
  return value.trim().replace(/[\\/]/g, "-");
}

function nameFromFilename(filename) {
  return filename
    .replace(/\.csv$/i, "")
    .replace(/_questions_revision$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

// pathname is "<matiere>/<name>.csv" (new) or "<name>.csv" (legacy, no matiere folder)
function parsePathname(pathname) {
  const rest = pathname.slice(PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash === -1) {
    return { matiere: DEFAULT_MATIERE, name: rest.replace(/\.csv$/i, "") };
  }
  return {
    matiere: rest.slice(0, slash),
    name: rest.slice(slash + 1).replace(/\.csv$/i, "")
  };
}

function listLocalFiches() {
  const entries = readdirSync(LOCAL_CSV_DIR, { withFileTypes: true });
  const out = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const matiere = entry.name;
      const dirPath = join(LOCAL_CSV_DIR, entry.name);
      const files = readdirSync(dirPath).filter((f) => f.toLowerCase().endsWith(".csv"));
      for (const filename of files) {
        const csv = readFileSync(join(dirPath, filename), "utf-8");
        out.push({
          pathname: `${PREFIX}${matiere}/${filename}`,
          matiere,
          name: nameFromFilename(filename),
          csv,
          uploadedAt: null,
          size: csv.length
        });
      }
    } else if (entry.name.toLowerCase().endsWith(".csv")) {
      const csv = readFileSync(join(LOCAL_CSV_DIR, entry.name), "utf-8");
      out.push({
        pathname: `${PREFIX}${entry.name}`,
        matiere: DEFAULT_MATIERE,
        name: nameFromFilename(entry.name),
        csv,
        uploadedAt: null,
        size: csv.length
      });
    }
  }

  return out;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    if (IS_LOCAL_DEV) {
      try {
        res.status(200).json({ fiches: listLocalFiches(), source: "local" });
      } catch (e) {
        console.error("local csv fallback failed:", e);
        res.status(500).json({ error: `lecture locale échouée : ${e.message}` });
      }
      return;
    }

    let blobs;
    try {
      ({ blobs } = await list({ prefix: PREFIX }));
    } catch (e) {
      console.error("list() failed:", e);
      res.status(500).json({ error: `list failed: ${e.message}` });
      return;
    }

    const fiches = await Promise.all(
      blobs.map(async (b) => {
        const { matiere, name } = parsePathname(b.pathname);
        try {
          const result = await get(b.url, { access: "private" });
          const csv = result ? await new Response(result.stream).text() : "";
          return {
            pathname: b.pathname,
            url: b.url,
            matiere,
            name,
            uploadedAt: b.uploadedAt,
            size: b.size,
            csv
          };
        } catch (e) {
          console.error(`get() failed for ${b.pathname}:`, e);
          return {
            pathname: b.pathname,
            url: b.url,
            matiere,
            name,
            uploadedAt: b.uploadedAt,
            size: b.size,
            csv: "",
            error: e.message
          };
        }
      })
    );
    res.status(200).json({ fiches });
    return;
  }

  if (req.method === "POST") {
    if (IS_LOCAL_DEV) {
      res.status(501).json({
        error: "En local (vercel dev), les fiches viennent de csv_questions/ - ajoute/modifie le fichier CSV directement puis relance."
      });
      return;
    }
    if (!isAuthorized(req)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const { matiere, name, csv } = req.body || {};
    if (!name || !csv) {
      res.status(400).json({ error: "name et csv requis" });
      return;
    }
    const matiereSlug = sanitizePart(matiere || DEFAULT_MATIERE);
    const pathname = `${PREFIX}${matiereSlug}/${sanitizePart(name)}.csv`;
    const blob = await put(pathname, csv, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/csv; charset=utf-8"
    });
    res.status(200).json({ pathname: blob.pathname });
    return;
  }

  if (req.method === "DELETE") {
    if (IS_LOCAL_DEV) {
      res.status(501).json({
        error: "En local (vercel dev), les fiches viennent de csv_questions/ - supprime le fichier CSV directement puis relance."
      });
      return;
    }
    if (!isAuthorized(req)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const { pathname } = req.query;
    if (!pathname) {
      res.status(400).json({ error: "pathname requis" });
      return;
    }
    await del(pathname);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "method not allowed" });
}
