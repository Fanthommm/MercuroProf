import { useMemo, useState } from "react";

const SEARCH_THRESHOLD = 6;
const DEFAULT_MATIERE = "Gastroenterologie";

export default function FicheFilter({ ficheGroups, active, onChange }) {
  const [query, setQuery] = useState("");
  const [matiereFilter, setMatiereFilter] = useState("all");

  const matieres = useMemo(() => {
    const order = [];
    const counts = {};
    ficheGroups.forEach((g) => {
      const m = g.matiere || DEFAULT_MATIERE;
      if (!counts[m]) {
        counts[m] = 0;
        order.push(m);
      }
      counts[m] += 1;
    });
    return order.map((m) => ({ matiere: m, count: counts[m] }));
  }, [ficheGroups]);

  if (ficheGroups.length <= 1) return null;

  const normalizedQuery = query.trim().toLowerCase();
  const visibleFiches = ficheGroups.filter((g) => {
    const matiere = g.matiere || DEFAULT_MATIERE;
    if (matiere !== matiereFilter) return false;
    if (normalizedQuery && !g.fiche.toLowerCase().includes(normalizedQuery))
      return false;
    return true;
  });

  const options = [
    { fiche: "all", label: "Toutes les fiches" },
    ...visibleFiches.map((g) => ({ fiche: g.fiche, label: g.fiche })),
  ];

  return (
    <div className="fiche-filter-wrap">
      <span className="section-label">Matières</span>
      <div className="fiche-filter">
        {matieres.length > 1 && (
          <button
            type="button"
            className={`filter-pill matiere-pill${matiereFilter === "all" ? " active" : ""}`}
            onClick={() => setMatiereFilter("all")}
          >
            Toutes les matières
          </button>
        )}
        {matieres.map((m) => (
          <button
            key={m.matiere}
            type="button"
            className={`filter-pill matiere-pill${matiereFilter === m.matiere ? " active" : ""}`}
            onClick={() =>
              setMatiereFilter(matiereFilter === m.matiere ? "all" : m.matiere)
            }
          >
            📁 {m.matiere} ({m.count})
          </button>
        ))}
      </div>

      {ficheGroups.length > SEARCH_THRESHOLD && (
        <input
          type="text"
          className="fiche-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une fiche..."
        />
      )}

      <div className="fiche-filter">
        {options.map((opt) => (
          <button
            key={opt.fiche}
            type="button"
            className={`filter-pill${opt.fiche === active ? " active" : ""}`}
            onClick={() => onChange(opt.fiche)}
          >
            {opt.label}
          </button>
        ))}
        {(normalizedQuery || matiereFilter !== "all") &&
          visibleFiches.length === 0 && (
            <span className="csv-hint">Aucune fiche ne correspond.</span>
          )}
      </div>
    </div>
  );
}
