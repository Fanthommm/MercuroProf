import { useMemo, useState } from "react";

const DEFAULT_MATIERE = "Gastroenterologie";

export default function ReviewSelector({ ficheGroups, onSelect }) {
  const [mode, setMode] = useState(null);
  const [ficheMatiere, setFicheMatiere] = useState(null);
  const [checkedFiches, setCheckedFiches] = useState(() => new Set());

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

  const totalCards = ficheGroups.reduce((sum, g) => sum + g.ids.length, 0);
  const ficheMatiereGroup = matiereGroups.find(
    (g) => g.matiere === ficheMatiere,
  );

  function toggleMode(next) {
    setMode((prev) => (prev === next ? null : next));
  }

  function toggleFiche(fiche) {
    setCheckedFiches((prev) => {
      const next = new Set(prev);
      if (next.has(fiche)) next.delete(fiche);
      else next.add(fiche);
      return next;
    });
  }

  function startFicheReview() {
    if (!checkedFiches.size) return;
    onSelect({
      mode: "fiches",
      matiere: ficheMatiere,
      fiches: Array.from(checkedFiches),
    });
  }

  return (
    <div className="review-selector">
      <button
        type="button"
        className="selector-tile selector-tile-main"
        onClick={() => onSelect({ mode: "all" })}
      >
        <span className="selector-icon">🔀</span>
        <span className="selector-title">Réviser toutes les cartes</span>
        <span className="selector-sub">{totalCards} questions</span>
      </button>

      <div className="selector-tile">
        <button
          type="button"
          className="selector-tile-header"
          onClick={() => toggleMode("matiere")}
          aria-expanded={mode === "matiere"}
        >
          <span className="selector-title">📚 Réviser une matière</span>
          <span className="chevron">{mode === "matiere" ? "▾" : "▸"}</span>
        </button>
        {mode === "matiere" && (
          <div className="fiche-filter">
            {matiereGroups.map((g) => (
              <button
                key={g.matiere}
                type="button"
                className="filter-pill matiere-pill"
                onClick={() =>
                  onSelect({ mode: "matiere", matiere: g.matiere })
                }
              >
                📁 {g.matiere} ({g.fiches.reduce((s, f) => s + f.ids.length, 0)}
                )
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="selector-tile">
        <button
          type="button"
          className="selector-tile-header"
          onClick={() => toggleMode("fiche")}
          aria-expanded={mode === "fiche"}
        >
          <span className="selector-title">
            📄 Réviser une ou plusieurs fiches
          </span>
          <span className="chevron">{mode === "fiche" ? "▾" : "▸"}</span>
        </button>
        {mode === "fiche" && (
          <div className="selector-fiche-picker">
            <p className="csv-hint">1. Choisis la matière</p>
            <div className="fiche-filter">
              {matiereGroups.map((g) => (
                <button
                  key={g.matiere}
                  type="button"
                  className={`filter-pill matiere-pill${ficheMatiere === g.matiere ? " active" : ""}`}
                  onClick={() => {
                    setFicheMatiere(g.matiere);
                    setCheckedFiches(new Set());
                  }}
                >
                  📁 {g.matiere}
                </button>
              ))}
            </div>

            {ficheMatiereGroup && (
              <>
                <p className="csv-hint">2. Choisis une ou plusieurs fiches</p>
                <div className="fiche-checklist">
                  {ficheMatiereGroup.fiches.map((f) => (
                    <label className="fiche-check-row" key={f.fiche}>
                      <input
                        type="checkbox"
                        checked={checkedFiches.has(f.fiche)}
                        onChange={() => toggleFiche(f.fiche)}
                      />
                      <span className="fiche-check-name">{f.fiche}</span>
                      <span className="count">{f.ids.length} questions</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="ghost-btn primary"
                  disabled={!checkedFiches.size}
                  onClick={startFicheReview}
                >
                  Commencer la révision ({checkedFiches.size})
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
