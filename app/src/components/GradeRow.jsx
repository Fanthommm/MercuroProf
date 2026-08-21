import { RATINGS } from "../lib/scheduler";

const LABELS = { again: "Encore", hard: "Difficile", good: "Bien", easy: "Facile" };

export default function GradeRow({ etas, onGrade }) {
  return (
    <div className="grade-row">
      {RATINGS.map((rating) => (
        <button
          key={rating}
          type="button"
          className={`grade-btn ${rating}`}
          onClick={() => onGrade(rating)}
        >
          <span className="lbl">{LABELS[rating]}</span>
          <span className="eta">{etas[rating]}</span>
        </button>
      ))}
    </div>
  );
}
