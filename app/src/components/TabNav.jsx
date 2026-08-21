export default function TabNav({ active, onChange }) {
  return (
    <div className="tab-nav">
      <button
        type="button"
        className={`tab-btn${active === "review" ? " active" : ""}`}
        onClick={() => onChange("review")}
      >
        Réviser
      </button>
      <button
        type="button"
        className={`tab-btn${active === "decks" ? " active" : ""}`}
        onClick={() => onChange("decks")}
      >
        Fiches
      </button>
    </div>
  );
}
