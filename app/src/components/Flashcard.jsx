import GradeRow from "./GradeRow";

export default function Flashcard({ card, revealed, etas, onGrade, onReveal }) {
  if (!card) {
    return (
      <div className="flashcard">
        <div className="question">Aucune carte disponible pour cette sélection.</div>
      </div>
    );
  }

  return (
    <div className="flashcard">
      <span className="theme-tab">{card.theme}</span>
      <div className="question">{card.question}</div>

      <div className={`answer-panel${revealed ? " shown" : ""}`}>
        <div className="answer-fold">
          <div className="answer-label">Réponse</div>
          <div className="answer-text">{card.reponse}</div>
        </div>
      </div>

      {!revealed && (
        <button type="button" className="reveal-btn" onClick={onReveal}>
          Voir la réponse
        </button>
      )}

      {revealed && <GradeRow etas={etas} onGrade={onGrade} />}
    </div>
  );
}
