export default function handler(req, res) {
  const secret = process.env.UPLOAD_SECRET;
  const provided = req.headers["x-upload-secret"];
  if (!secret || provided === secret) {
    res.status(200).json({ ok: true });
    return;
  }
  res.status(401).json({ ok: false });
}
