import { useMemo, useRef, useState } from "react";
import {
  deleteFiche,
  getUploadSecret,
  questionsFromCSV,
  setUploadSecret,
  uploadFiche,
  verifySecret
} from "../lib/fiches";

const DEFAULT_MATIERE = "Gastroenterologie";

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

function deriveNameFromFilename(filename) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/_questions_revision$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
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
  const [matiere, setMatiere] = useState(DEFAULT_MATIERE);
  const [bulkMatiere, setBulkMatiere] = useState(DEFAULT_MATIERE);
  const [busy, setBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [duplicateConfirm, setDuplicateConfirm] = useState(null);

  const matiereGroups = useMemo(() => {
    const order = [];
    const byMatiere = {};
    ficheGroups.forEach((g) => {
      const m = g.matiere || DEFAULT_MATIERE;
      if (!byMatiere[m]) {
        byMatiere[m] = [];
        order.push(m);
      }
      byMatiere[m].push(g);
    });
    return order.map((m) => ({ matiere: m, fiches: byMatiere[m] }));
  }, [ficheGroups]);

  const knownMatieres = matiereGroups.map((g) => g.matiere);

  async function handleUnlock() {
    setChecking(true);
    setUnlockError("");
    try {
      const ok = await verifySecret(secret);
      if (ok) {
        setUploadSecret(secret);
        setUnlocked(true);
        if (knownMatieres.length) {
          setMatiere(knownMatieres[0]);
          setBulkMatiere(knownMatieres[0]);
        }
      } else {
        setUnlockError("Mot de passe incorrect.");
      }
    } catch (e) {
      setUnlockError("Vérification impossible.");
    } finally {
      setChecking(false);
    }
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

  async function doUpload(matiereValue, name, text) {
    setBusy(true);
    try {
      const preview = questionsFromCSV(text, { pathname: "preview", matiere: matiereValue, name });
      await uploadFiche(matiereValue, name, text);
      flash(`${preview.length} questions envoyées pour « ${name} » (${matiereValue}).`);
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
    const matiereValue = matiere.trim() || DEFAULT_MATIERE;
    if (!name) {
      flash("Donne un nom à la fiche avant d'ajouter.");
      return;
    }

    const preview = questionsFromCSV(pendingText, { pathname: "preview", matiere: matiereValue, name });
    if (!preview.length) {
      flash("Fichier illisible ou mal formé (colonnes attendues : Theme, Question, Reponse).");
      return;
    }

    const existing = manifest.find(
      (m) => m.name === name && (m.matiere || DEFAULT_MATIERE) === matiereValue
    );
    if (existing) {
      setDuplicateConfirm({ matiere: matiereValue, name, oldCsv: existing.csv, newCsv: pendingText });
      return;
    }

    await doUpload(matiereValue, name, pendingText);
  }

  async function handleBulkFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const matiereValue = bulkMatiere.trim() || DEFAULT_MATIERE;

    setBusy(true);
    let added = 0;
    let skipped = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setBulkProgress({ current: i + 1, total: files.length, name: file.name });
      try {
        const name = deriveNameFromFilename(file.name);
        const text = await file.text();
        const preview = questionsFromCSV(text, { pathname: "preview", matiere: matiereValue, name });
        if (!preview.length) {
          skipped++;
          continue;
        }
        await uploadFiche(matiereValue, name, text);
        added++;
      } catch (err) {
        skipped++;
      }
    }
    setBulkProgress(null);
    setBusy(false);
    if (bulkInputRef.current) bulkInputRef.current.value = "";
    flash(
      skipped > 0
        ? `${added} fiche(s) importée(s) dans « ${matiereValue} », ${skipped} ignorée(s).`
        : `${added} fiche(s) importée(s) dans « ${matiereValue} ».`
    );
    onFichesChanged();
  }

  async function handleRemove(g) {
    const entry = manifest.find(
      (m) => m.name === g.fiche && (m.matiere || DEFAULT_MATIERE) === (g.matiere || DEFAULT_MATIERE)
    );
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
    const entry = manifest.find(
      (m) => m.name === g.fiche && (m.matiere || DEFAULT_MATIERE) === (g.matiere || DEFAULT_MATIERE)
    );
    if (!entry || !entry.csv) {
      flash("Contenu indisponible pour cette fiche.");
      return;
    }
    downloadCsv(entry.name, entry.csv);
  }

  const summary = duplicateConfirm
    ? diffSummary(duplicateConfirm.oldCsv, duplicateConfirm.newCsv, {
        pathname: "preview",
        matiere: duplicateConfirm.matiere,
        name: duplicateConfirm.name
      })
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

            {matiereGroups.map((mg) => (
              <div key={mg.matiere}>
                <div className="matiere-header">
                  <span>📁 {mg.matiere}</span>
                  <span className="count">{mg.fiches.length} fiche(s)</span>
                </div>
                <div className="fiche-list">
                  {mg.fiches.map((g) => (
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
              </div>
            ))}

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

            <input
              type="text"
              value={bulkMatiere}
              onChange={(e) => setBulkMatiere(e.target.value)}
              placeholder="Matière pour l'import en lot"
              list="matiere-options"
            />
            <datalist id="matiere-options">
              {knownMatieres.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>

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
                <input
                  type="text"
                  value={matiere}
                  onChange={(e) => setMatiere(e.target.value)}
                  placeholder="Matière (ex: Gastroenterologie)"
                  maxLength={60}
                  list="matiere-options"
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
                    Cette fiche existe déjà : « {duplicateConfirm.name} » ({duplicateConfirm.matiere}). Voulez-vous la
                    remplacer ?
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
                      onClick={() => doUpload(duplicateConfirm.matiere, duplicateConfirm.name, duplicateConfirm.newCsv)}
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
