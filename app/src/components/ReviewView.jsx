import { useEffect, useState } from "react";
import { RATINGS, computeStats, formatDelay, gradeCard, newCard, pickNext } from "../lib/scheduler";
import FicheFilter from "./FicheFilter";
import StatTiles from "./StatTiles";
import GradeRow from "./GradeRow";

export default function ReviewView({
  activeIds,
  byId,
  progress,
  onGrade,
  ficheGroups,
  activeFiche,
  onFicheChange
}) {
  const [currentId, setCurrentId] = useState(() => pickNext(activeIds, progress));
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setCurrentId(pickNext(activeIds, progress));
    setRevealed(false);
    // Only re-pick when the filter itself changes; grading re-picks explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFiche]);

  const card = byId[currentId];
  const stats = computeStats(activeIds, progress);

  const etas = {};
  if (revealed && card) {
    const now = new Date();
    const base = progress[currentId] || newCard();
    RATINGS.forEach((r) => {
      etas[r] = formatDelay(now, gradeCard(base, r, now).due);
    });
  }

  function handleGrade(rating) {
    const base = progress[currentId] || newCard();
    const updated = gradeCard(base, rating);
    onGrade(currentId, updated);
    const mergedProgress = { ...progress, [currentId]: updated };
    setCurrentId(pickNext(activeIds, mergedProgress));
    setRevealed(false);
  }

  if (!card) {
    return (
      <section className="view">
        <div className="flashcard">
          <div className="question">
            Aucune fiche disponible pour l'instant. Ajoute-en une depuis l'onglet Statistiques.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="view">
      <FicheFilter ficheGroups={ficheGroups} active={activeFiche} onChange={onFicheChange} />

      <StatTiles
        className="stats"
        items={[
          [stats.neu, "Nouvelles"],
          [stats.learning, "En cours"],
          [stats.dueNow, "À revoir"],
          [stats.ahead, "Acquises"]
        ]}
      />

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
          <button type="button" className="reveal-btn" onClick={() => setRevealed(true)}>
            Voir la réponse
          </button>
        )}

        {revealed && <GradeRow etas={etas} onGrade={handleGrade} />}
      </div>
    </section>
  );
}
