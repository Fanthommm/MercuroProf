export default function FicheFilter({ ficheGroups, active, onChange }) {
  if (ficheGroups.length <= 1) return null;

  const options = [
    { fiche: "all", label: "Toutes les fiches" },
    ...ficheGroups.map((g) => ({ fiche: g.fiche, label: g.fiche }))
  ];

  return (
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
    </div>
  );
}
