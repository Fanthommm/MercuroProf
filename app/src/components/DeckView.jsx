import { useRef, useState } from "react";
import { computeStats, computeTotals } from "../lib/scheduler";
import {
  deleteFiche,
  getUploadSecret,
  questionsFromCSV,
  setUploadSecret,
  uploadFiche,
} from "../lib/fiches";
import FicheFilter from "./FicheFilter";
import StatTiles from "./StatTiles";

function describeCard(card) {
  if (!card || card.state === "new") return { label: "Nouvelle", dot: "new" };
  if (card.state === "learning" || card.state === "relearning") {
    return { label: "En apprentissage", dot: "learning" };
  }
  return new Date(card.due) <= new Date()
    ? { label: "À revoir", dot: "due" }
    : { label: "Acquise", dot: "ahead" };
}

export default function DeckView({
  ids,
  byId,
  themeGroups,
  ficheGroups,
  manifest,
  progress,
  onFichesChanged,
  flash,
  loadError,
}) {
  const [selectedFiche, setSelectedFiche] = useState("all");
  const [expandedThemes, setExpandedThemes] = useState(() => new Set());
  const [showWarnings, setShowWarnings] = useState(false);

  const problemFiches = manifest.filter(
    (m) => m.error || !ficheGroups.some((g) => g.fiche === m.name),
  );

  function toggleTheme(theme) {
    setExpandedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(theme)) next.delete(theme);
      else next.add(theme);
      return next;
    });
  }

  const filteredIds =
    selectedFiche === "all"
      ? ids
      : ficheGroups.find((g) => g.fiche === selectedFiche)?.ids || ids;

  const filteredThemeGroups =
    selectedFiche === "all"
      ? themeGroups
      : (() => {
          const scoped = new Set(filteredIds);
          return themeGroups
            .map((g) => ({ theme: g.theme, ids: g.ids.filter((id) => scoped.has(id)) }))
            .filter((g) => g.ids.length > 0);
        })();

  const totals = computeTotals(filteredIds, progress);
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
    setFicheName(
      file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim(),
    );
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
      flash(
        "Fichier illisible ou mal formé (colonnes attendues : Theme, Question, Reponse).",
      );
      return;
    }

    setBusy(true);
    try {
      await uploadFiche(name, text);
      flash(`${preview.length} questions envoyées pour « ${name} ».`);
      cancelImport();
      onFichesChanged();
    } catch (e) {
      flash(
        e.message === "unauthorized"
          ? "Mot de passe incorrect."
          : "Envoi impossible.",
      );
    } finally {
      setBusy(false);
    }
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
      flash(
        e.message === "unauthorized"
          ? "Mot de passe incorrect."
          : "Suppression impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="view">
      <FicheFilter
        ficheGroups={ficheGroups}
        active={selectedFiche}
        onChange={setSelectedFiche}
      />

      <StatTiles
        className="totals-row"
        items={[
          [`${totals.seen} / ${filteredIds.length}`, "Cartes vues"],
          [totals.reps, "Révisions"],
          [
            totals.avgEase === null ? "—" : totals.avgEase.toFixed(2),
            "Facilité moy.",
          ],
        ]}
      />

      <div className="fiche-manager">
        <span className="section-label">Mes fiches</span>

        {loadError && (
          <p className="csv-hint">
            Fiches partagées indisponibles ({loadError}).
          </p>
        )}

        {problemFiches.length > 0 && (
          <>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setShowWarnings((v) => !v)}
            >
              ⚠️ {problemFiches.length} fiche(s) à vérifier {showWarnings ? "▾" : "▸"}
            </button>
            {showWarnings &&
              problemFiches.map((m) => (
                <p className="csv-hint" key={m.pathname}>
                  « {m.name} » ({m.pathname}) :{" "}
                  {m.error || "0 question reconnue dans ce CSV"}
                </p>
              ))}
          </>
        )}

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
          Colonnes attendues : <code>Theme</code>, <code>Question</code>,{" "}
          <code>Reponse</code> — visible sur tous les appareils une fois
          envoyée.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={handleFileChosen}
        />

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
              <button
                type="button"
                className="ghost-btn primary"
                disabled={busy}
                onClick={confirmImport}
              >
                Ajouter
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={busy}
                onClick={cancelImport}
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="legend">
        <span>
          <i className="dot ahead" />
          Acquises
        </span>
        <span>
          <i className="dot due" />À revoir
        </span>
        <span>
          <i className="dot learning" />
          En cours
        </span>
        <span>
          <i className="dot new" />
          Nouvelles
        </span>
      </div>

      <div className="theme-list">
        {filteredThemeGroups.map((g) => {
          const s = computeStats(g.ids, progress);
          const total = g.ids.length;
          const pct = (n) => (total ? (n / total) * 100 : 0);
          const isOpen = expandedThemes.has(g.theme);
          return (
            <div className="theme-row" key={g.theme}>
              <button
                type="button"
                className="head theme-head-btn"
                onClick={() => toggleTheme(g.theme)}
                aria-expanded={isOpen}
              >
                <span className="name">
                  {g.theme}
                  <span className="chevron">{isOpen ? "▾" : "▸"}</span>
                </span>
                <span className="count">
                  {s.ahead} / {total} acquises
                </span>
              </button>
              <div className="theme-bar">
                <span
                  className="seg-ahead"
                  style={{ width: `${pct(s.ahead)}%` }}
                />
                <span
                  className="seg-due"
                  style={{ width: `${pct(s.dueNow)}%` }}
                />
                <span
                  className="seg-learning"
                  style={{ width: `${pct(s.learning)}%` }}
                />
                <span className="seg-new" style={{ width: `${pct(s.neu)}%` }} />
              </div>

              {isOpen && (
                <div className="question-list">
                  {g.ids.map((id) => {
                    const q = byId[id];
                    if (!q) return null;
                    const info = describeCard(progress[id]);
                    const card = progress[id];
                    const meta = !card || card.reps === 0
                      ? "Jamais révisée"
                      : card.lapses > 0
                      ? `${card.reps} révisions · ${card.lapses} fois « Encore »`
                      : `${card.reps} révisions`;
                    return (
                      <div className="question-row" key={id}>
                        <i className={`dot ${info.dot}`} />
                        <span className="q-text">{q.question}</span>
                        <span className="q-meta">
                          {info.label} · {meta}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
