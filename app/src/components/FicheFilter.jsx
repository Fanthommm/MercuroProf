import { useState } from "react";

const SEARCH_THRESHOLD = 6;

export default function FicheFilter({ ficheGroups, active, onChange }) {
  const [query, setQuery] = useState("");

  if (ficheGroups.length <= 1) return null;

  const normalizedQuery = query.trim().toLowerCase();
  const visibleFiches = normalizedQuery
    ? ficheGroups.filter((g) => g.fiche.toLowerCase().includes(normalizedQuery))
    : ficheGroups;

  const options = [
    { fiche: "all", label: "Toutes les fiches" },
    ...visibleFiches.map((g) => ({ fiche: g.fiche, label: g.fiche }))
  ];

  return (
    <div className="fiche-filter-wrap">
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
        {normalizedQuery && visibleFiches.length === 0 && (
          <span className="csv-hint">Aucune fiche ne correspond.</span>
        )}
      </div>
    </div>
  );
}
