import { parseCSV } from "./csv";

const SECRET_KEY = "fiches-cirrhose-upload-secret";

export function getUploadSecret() {
  try {
    return localStorage.getItem(SECRET_KEY) || "";
  } catch (e) {
    return "";
  }
}

export function setUploadSecret(value) {
  try {
    localStorage.setItem(SECRET_KEY, value);
  } catch (e) {
    // ignore
  }
}

export async function verifySecret(secret) {
  const res = await fetch("/api/verify", {
    method: "POST",
    headers: { "x-upload-secret": secret }
  });
  return res.ok;
}

export async function fetchFicheManifest() {
  const res = await fetch("/api/fiches");
  if (!res.ok) throw new Error("Liste des fiches indisponible.");
  const data = await res.json();
  return data.fiches;
}

export async function uploadFiche(name, csvText) {
  const res = await fetch("/api/fiches", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-upload-secret": getUploadSecret()
    },
    body: JSON.stringify({ name, csv: csvText })
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Envoi impossible.");
  }
  return res.json();
}

export async function deleteFiche(pathname) {
  const res = await fetch(`/api/fiches?pathname=${encodeURIComponent(pathname)}`, {
    method: "DELETE",
    headers: { "x-upload-secret": getUploadSecret() }
  });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Suppression impossible.");
  }
  return res.json();
}

export function questionsFromCSV(csvText, fiche) {
  const rows = parseCSV(csvText);
  if (!rows.length) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const qIdx = header.indexOf("question");
  const rIdx = header.indexOf("reponse") >= 0 ? header.indexOf("reponse") : header.indexOf("réponse");
  const tIdx = header.indexOf("theme") >= 0 ? header.indexOf("theme") : header.indexOf("thème");
  if (qIdx < 0 || rIdx < 0) return [];

  const out = [];
  rows.slice(1).forEach((cols, i) => {
    const question = (cols[qIdx] || "").trim();
    const reponse = (cols[rIdx] || "").trim();
    if (!question || !reponse) return;
    const theme = tIdx >= 0 ? (cols[tIdx] || "").trim() : "";
    out.push({
      id: `blob:${fiche.pathname}:${i}`,
      fiche: fiche.name,
      theme: theme || fiche.name,
      question,
      reponse
    });
  });
  return out;
}
