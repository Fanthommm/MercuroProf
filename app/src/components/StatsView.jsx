import { useRef, useState } from "react";
import { computeStats, computeTotals } from "../lib/scheduler";
import { deleteFiche, getUploadSecret, questionsFromCSV, setUploadSecret, uploadFiche } from "../lib/fiches";
import StatTiles from "./StatTiles";

export default function StatsView({
  ids,
  themeGroups,
  ficheGroups,
  manifest,
  progress,
  onFichesChanged,
  flash,
  loadError
}) {
  const totals = computeTotals(ids, progress);
  const fileInputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [ficheName, setFicheName] = useState("");
  const [secret, setSecret] = useState(getUploadSecret());
  const [busy, setBusy] = useState(false);

  function handleSecretChange(e) {
    setSecret(e.target.value);
    setUploadSecret(e.target.value);
  }

  function handleFileChosen(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPendingFile(file);
    setFicheName(file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim());
  }

  function cancelImport() {
    setPendingFile(null);
    setFicheName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function confirmImport() {
    if (!pendingFile) return;
    const name = ficheName.trim();
    if (!name) {
      flash("Donne un nom à la fiche avant d'ajouter.");
      return;
    }

    const text = await pendingFile.text();
    const preview = questionsFromCSV(text, { pathname: "preview", name });
    if (!preview.length) {
      flash("Fichier illisible ou mal formé (colonnes attendues : Theme, Question, Reponse).");
      return;
    }

    setBusy(true);
    try {
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

  async function handleRemove(g) {
    const entry = manifest.find((m) => m.name === g.fiche);
    if (!entry) return;
    setBusy(true);
    try {
      await deleteFiche(entry.pathname);
      flash(`Fiche « ${g.fiche} » retirée.`);
      onFichesChanged();
    } catch (e) {
      flash(e.message === "unauthorized" ? "Mot de passe incorrect." : "Suppression impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="view">
      <StatTiles
        className="totals-row"
        items={[
          [`${totals.seen} / ${ids.length}`, "Cartes vues"],
          [totals.reps, "Révisions"],
          [totals.avgEase === null ? "—" : totals.avgEase.toFixed(2), "Facilité moy."]
        ]}
      />

      <div className="fiche-manager">
        <span className="section-label">Mes fiches</span>

        {loadError && <p className="csv-hint">Fiches partagées indisponibles ({loadError}).</p>}

        <div className="fiche-list">
          {ficheGroups.map((g) => (
            <div className="fiche-row" key={g.fiche}>
              <span className="name">{g.fiche}</span>
              <span className="count">{g.ids.length} questions</span>
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

        <input
          type="text"
          value={secret}
          onChange={handleSecretChange}
          placeholder="Mot de passe d'édition"
        />

        <button
          type="button"
          className="ghost-btn"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          + Importer une fiche (CSV)
        </button>
        <p className="csv-hint">
          Colonnes attendues : <code>Theme</code>, <code>Question</code>, <code>Reponse</code> — visible
          sur tous les appareils une fois envoyée.
        </p>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" hidden onChange={handleFileChosen} />

        {pendingFile && (
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
      </div>

      <div className="legend">
        <span><i className="dot ahead" />Acquises</span>
        <span><i className="dot due" />À revoir</span>
        <span><i className="dot learning" />En cours</span>
        <span><i className="dot new" />Nouvelles</span>
      </div>

      <div className="theme-list">
        {themeGroups.map((g) => {
          const s = computeStats(g.ids, progress);
          const total = g.ids.length;
          const pct = (n) => (total ? (n / total) * 100 : 0);
          return (
            <div className="theme-row" key={g.theme}>
              <div className="head">
                <span className="name">{g.theme}</span>
                <span className="count">
                  {s.ahead} / {total} acquises
                </span>
              </div>
              <div className="theme-bar">
                <span className="seg-ahead" style={{ width: `${pct(s.ahead)}%` }} />
                <span className="seg-due" style={{ width: `${pct(s.dueNow)}%` }} />
                <span className="seg-learning" style={{ width: `${pct(s.learning)}%` }} />
                <span className="seg-new" style={{ width: `${pct(s.neu)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
