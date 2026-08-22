import { useRef, useState } from "react";
import {
  deleteFiche,
  getUploadSecret,
  questionsFromCSV,
  setUploadSecret,
  uploadFiche,
  verifySecret
} from "../lib/fiches";

function diffSummary(oldCsv, newCsv, ficheMeta) {
  const oldQs = questionsFromCSV(oldCsv, ficheMeta).map((q) => q.question);
  const newQs = questionsFromCSV(newCsv, ficheMeta).map((q) => q.question);
  const oldSet = new Set(oldQs);
  const newSet = new Set(newQs);
  const added = newQs.filter((q) => !oldSet.has(q)).length;
  const removed = oldQs.filter((q) => !newSet.has(q)).length;
  const unchanged = newQs.length - added;
  return { oldCount: oldQs.length, newCount: newQs.length, added, removed, unchanged };
}

function downloadCsv(name, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function FicheAdminModal({ manifest, ficheGroups, onClose, onFichesChanged, flash }) {
  const [secret, setSecretInput] = useState(getUploadSecret());
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  const fileInputRef = useRef(null);
  const bulkInputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingText, setPendingText] = useState("");
  const [ficheName, setFicheName] = useState("");
  const [busy, setBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [duplicateConfirm, setDuplicateConfirm] = useState(null);

  async function handleUnlock() {
    setChecking(true);
    setUnlockError("");
    try {
      const ok = await verifySecret(secret);
      if (ok) {
        setUploadSecret(secret);
        setUnlocked(true);
      } else {
        setUnlockError("Mot de passe incorrect.");
      }
    } catch (e) {
      setUnlockError("Vérification impossible.");
    } finally {
      setChecking(false);
    }
  }

  function deriveNameFromFilename(filename) {
    return filename
      .replace(/\.[^.]+$/, "")
      .replace(/_questions_revision$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();
  }

  async function handleFileChosen(e) {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    setPendingFile(file);
    setPendingText(text);
    setFicheName(deriveNameFromFilename(file.name));
  }

  function cancelImport() {
    setPendingFile(null);
    setPendingText("");
    setFicheName("");
    setDuplicateConfirm(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function doUpload(name, text) {
    setBusy(true);
    try {
      const preview = questionsFromCSV(text, { pathname: "preview", name });
      await uploadFiche(name, text);
      flash(`${preview.length} questions envoyées pour « ${name} ».`);
      cancelImport();
      onFichesChanged();
    } catch (e) {
      flash(e.message === "unauthorized" ? "Mot de passe incorrect." : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!pendingFile) return;
    const name = ficheName.trim();
    if (!name) {
      flash("Donne un nom à la fiche avant d'ajouter.");
      return;
    }

    const preview = questionsFromCSV(pendingText, { pathname: "preview", name });
    if (!preview.length) {
      flash("Fichier illisible ou mal formé (colonnes attendues : Theme, Question, Reponse).");
      return;
    }

    const existing = manifest.find((m) => m.name === name);
    if (existing) {
      setDuplicateConfirm({ name, oldCsv: existing.csv, newCsv: pendingText });
      return;
    }

    await doUpload(name, pendingText);
  }

  async function handleBulkFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setBusy(true);
    let added = 0;
    let skipped = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setBulkProgress({ current: i + 1, total: files.length, name: file.name });
      try {
        const name = deriveNameFromFilename(file.name);
        const text = await file.text();
        const preview = questionsFromCSV(text, { pathname: "preview", name });
        if (!preview.length) {
          skipped++;
          continue;
        }
        await uploadFiche(name, text);
        added++;
      } catch (err) {
        skipped++;
      }
    }
    setBulkProgress(null);
    setBusy(false);
    if (bulkInputRef.current) bulkInputRef.current.value = "";
    flash(skipped > 0 ? `${added} fiche(s) importée(s), ${skipped} ignorée(s).` : `${added} fiche(s) importée(s).`);
    onFichesChanged();
  }

  async function handleRemove(g) {
    const entry = manifest.find((m) => m.name === g.fiche);
    if (!entry) return;
    setBusy(true);
    try {
      await deleteFiche(entry.url || entry.pathname);
      flash(`Fiche « ${g.fiche} » retirée.`);
      onFichesChanged();
    } catch (e) {
      flash(e.message === "unauthorized" ? "Mot de passe incorrect." : "Suppression impossible.");
    } finally {
      setBusy(false);
    }
  }

  function handleDownload(g) {
    const entry = manifest.find((m) => m.name === g.fiche);
    if (!entry || !entry.csv) {
      flash("Contenu indisponible pour cette fiche.");
      return;
    }
    downloadCsv(entry.name, entry.csv);
  }

  const summary = duplicateConfirm
    ? diffSummary(duplicateConfirm.oldCsv, duplicateConfirm.newCsv, { pathname: "preview", name: duplicateConfirm.name })
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">
          ×
        </button>

        {!unlocked ? (
          <div className="modal-lock">
            <p className="section-label">Gestion des fiches</p>
            <p>Entre le mot de passe d'édition pour continuer.</p>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecretInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              placeholder="Mot de passe d'édition"
              autoFocus
            />
            <button type="button" className="ghost-btn primary" disabled={checking} onClick={handleUnlock}>
              Déverrouiller
            </button>
            {unlockError && <p className="csv-hint">{unlockError}</p>}
          </div>
        ) : (
          <div className="modal-body">
            <p className="section-label">Gestion des fiches</p>

            <div className="fiche-list">
              {ficheGroups.map((g) => (
                <div className="fiche-row" key={g.fiche}>
                  <span className="name">{g.fiche}</span>
                  <span className="count">{g.ids.length} questions</span>
                  <button
                    type="button"
                    className="remove"
                    title="Télécharger le CSV"
                    disabled={busy}
                    onClick={() => handleDownload(g)}
                  >
                    ⇩
                  </button>
                  <button
                    type="button"
                    className="remove"
                    title="Retirer cette fiche"
                    disabled={busy}
                    onClick={() => handleRemove(g)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="import-actions">
              <button type="button" className="ghost-btn" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                + Importer une fiche (CSV)
              </button>
              <button type="button" className="ghost-btn" disabled={busy} onClick={() => bulkInputRef.current?.click()}>
                + Importer plusieurs fiches
              </button>
            </div>
            <p className="csv-hint">
              Colonnes attendues : <code>Theme</code>, <code>Question</code>, <code>Reponse</code>.
            </p>
            {bulkProgress && (
              <p className="csv-hint">
                Import en cours : {bulkProgress.current}/{bulkProgress.total} ({bulkProgress.name})
              </p>
            )}

            <input ref={fileInputRef} type="file" accept=".csv,text/csv" hidden onChange={handleFileChosen} />
            <input
              ref={bulkInputRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              hidden
              onChange={handleBulkFiles}
            />

            {pendingFile && !duplicateConfirm && (
              <div className="import-confirm">
                <input
                  type="text"
                  value={ficheName}
                  onChange={(e) => setFicheName(e.target.value)}
                  placeholder="Nom de la fiche"
                  maxLength={80}
                />
                <div className="import-actions">
                  <button type="button" className="ghost-btn primary" disabled={busy} onClick={confirmImport}>
                    Ajouter
                  </button>
                  <button type="button" className="ghost-btn" disabled={busy} onClick={cancelImport}>
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {duplicateConfirm && (
              <div className="modal-overlay" onClick={() => setDuplicateConfirm(null)}>
                <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
                  <p>
                    Cette fiche existe déjà : « {duplicateConfirm.name} ». Voulez-vous la remplacer ?
                  </p>
                  {summary && (
                    <p className="csv-hint">
                      Actuelle : {summary.oldCount} questions → Nouvelle : {summary.newCount} questions
                      {" "}({summary.added} ajoutée(s), {summary.removed} retirée(s), {summary.unchanged} inchangée(s))
                    </p>
                  )}
                  <div className="import-actions">
                    <button
                      type="button"
                      className="ghost-btn primary"
                      disabled={busy}
                      onClick={() => doUpload(duplicateConfirm.name, duplicateConfirm.newCsv)}
                    >
                      Oui, remplacer
                    </button>
                    <button type="button" className="ghost-btn" disabled={busy} onClick={() => setDuplicateConfirm(null)}>
                      Non
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
