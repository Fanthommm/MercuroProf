import { useState } from "react";
import { computeStats, computeTotals } from "../lib/scheduler";
import FicheFilter from "./FicheFilter";
import StatTiles from "./StatTiles";
import FicheAdminModal from "./FicheAdminModal";

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
  const [adminOpen, setAdminOpen] = useState(false);

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

      {loadError && (
        <p className="csv-hint">Fiches partagées indisponibles ({loadError}).</p>
      )}

      <button type="button" className="ghost-btn" onClick={() => setAdminOpen(true)}>
        🔒 Gérer les fiches ({ficheGroups.length})
        {problemFiches.length > 0 ? ` · ⚠️ ${problemFiches.length}` : ""}
      </button>

      {adminOpen && (
        <FicheAdminModal
          manifest={manifest}
          ficheGroups={ficheGroups}
          onClose={() => setAdminOpen(false)}
          onFichesChanged={onFichesChanged}
          flash={flash}
        />
      )}

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
