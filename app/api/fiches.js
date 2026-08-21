import { list, put, del, get } from "@vercel/blob";

const PREFIX = "fiches/";

function isAuthorized(req) {
  const secret = process.env.UPLOAD_SECRET;
  if (!secret) return true;
  return req.headers["x-upload-secret"] === secret;
}

function ficheNameFromPathname(pathname) {
  return pathname.slice(PREFIX.length).replace(/\.csv$/, "");
}

function sanitizeFicheName(name) {
  return name.trim().replace(/\//g, "-");
}

export default async function handler(req, res) {
  if (req.method === "GET") {
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
        try {
          const result = await get(b.url, { access: "private" });
          const csv = result ? await new Response(result.stream).text() : "";
          return {
            pathname: b.pathname,
            url: b.url,
            name: ficheNameFromPathname(b.pathname),
            uploadedAt: b.uploadedAt,
            size: b.size,
            csv
          };
        } catch (e) {
          console.error(`get() failed for ${b.pathname}:`, e);
          return {
            pathname: b.pathname,
            url: b.url,
            name: ficheNameFromPathname(b.pathname),
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
    if (!isAuthorized(req)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const { name, csv } = req.body || {};
    if (!name || !csv) {
      res.status(400).json({ error: "name et csv requis" });
      return;
    }
    const pathname = `${PREFIX}${sanitizeFicheName(name)}.csv`;
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
