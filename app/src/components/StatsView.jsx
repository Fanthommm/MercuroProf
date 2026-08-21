import { useRef, useState } from "react";
import { computeStats, computeTotals } from "../lib/scheduler";
import { parseCSV } from "../lib/csv";
import StatTiles from "./StatTiles";

export default function StatsView({
  ids,
  themeGroups,
  ficheGroups,
  progress,
  builtinFiches,
  onImportFiche,
  onRemoveFiche,
  flash
}) {
  const totals = computeTotals(ids, progress);
  const fileInputRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [ficheName, setFicheName] = useState("");

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

  function confirmImport() {
    if (!pendingFile) return;
    const name = ficheName.trim();
    if (!name) {
      flash("Donne un nom à la fiche avant d'ajouter.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCSV(reader.result);
        if (!rows.length) throw new Error("fichier vide");
        const header = rows[0].map((h) => h.trim().toLowerCase());
        const qIdx = header.indexOf("question");
        const rIdx = header.indexOf("reponse") >= 0 ? header.indexOf("reponse") : header.indexOf("réponse");
        const tIdx = header.indexOf("theme") >= 0 ? header.indexOf("theme") : header.indexOf("thème");
        if (qIdx < 0 || rIdx < 0) throw new Error("colonnes manquantes");

        const stamp = Date.now();
        const added = [];
        rows.slice(1).forEach((cols, i) => {
          const question = (cols[qIdx] || "").trim();
          const reponse = (cols[rIdx] || "").trim();
          if (!question || !reponse) return;
          const theme = tIdx >= 0 ? (cols[tIdx] || "").trim() : "";
          added.push({
            id: `imp${stamp}-${i}`,
            fiche: name,
            theme: theme || name,
            question,
            reponse
          });
        });
        if (!added.length) throw new Error("aucune question valide");
        onImportFiche(added);
        flash(`${added.length} questions importées depuis « ${name} ».`);
      } catch (e) {
        flash("Fichier illisible ou mal formé (colonnes attendues : Theme, Question, Reponse).");
      }
      cancelImport();
    };
    reader.readAsText(pendingFile);
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

        <div className="fiche-list">
          {ficheGroups.map((g) => (
            <div className="fiche-row" key={g.fiche}>
              <span className="name">{g.fiche}</span>
              <span className="count">{g.ids.length} questions</span>
              {!builtinFiches.has(g.fiche) && (
                <button
                  type="button"
                  className="remove"
                  title="Retirer cette fiche"
                  onClick={() => onRemoveFiche(g.fiche)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <button type="button" className="ghost-btn" onClick={() => fileInputRef.current?.click()}>
          + Importer une fiche (CSV)
        </button>
        <p className="csv-hint">
          Colonnes attendues : <code>Theme</code>, <code>Question</code>, <code>Reponse</code>
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
              <button type="button" className="ghost-btn primary" onClick={confirmImport}>
                Ajouter
              </button>
              <button type="button" className="ghost-btn" onClick={cancelImport}>
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
