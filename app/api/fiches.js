import { list, put, del } from "@vercel/blob";

const PREFIX = "fiches/";

function isAuthorized(req) {
  const secret = process.env.UPLOAD_SECRET;
  if (!secret) return true;
  return req.headers["x-upload-secret"] === secret;
}

function ficheNameFromPathname(pathname) {
  return decodeURIComponent(pathname.slice(PREFIX.length).replace(/\.csv$/, ""));
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { blobs } = await list({ prefix: PREFIX });
    const fiches = blobs.map((b) => ({
      pathname: b.pathname,
      url: b.url,
      name: ficheNameFromPathname(b.pathname),
      uploadedAt: b.uploadedAt,
      size: b.size
    }));
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
    const pathname = `${PREFIX}${encodeURIComponent(name.trim())}.csv`;
    const blob = await put(pathname, csv, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/csv; charset=utf-8"
    });
    res.status(200).json({ pathname: blob.pathname, url: blob.url });
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
