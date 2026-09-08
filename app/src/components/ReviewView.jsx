import { useEffect, useState } from "react";
import {
  RATINGS,
  computeStats,
  formatDelay,
  gradeCard,
  newCard,
  pickNext,
} from "../lib/scheduler";
import StatTiles from "./StatTiles";
import Flashcard from "./Flashcard";
import ReviewSelector from "./ReviewSelector";

const DEFAULT_MATIERE = "Gastroenterologie";

function computeActiveIds(selection, ids, ficheGroups) {
  if (!selection || selection.mode === "all") return ids;
  if (selection.mode === "matiere") {
    return ficheGroups
      .filter((g) => (g.matiere || DEFAULT_MATIERE) === selection.matiere)
      .flatMap((g) => g.ids);
  }
  if (selection.mode === "fiches") {
    const set = new Set(selection.fiches);
    return ficheGroups.filter((g) => set.has(g.fiche)).flatMap((g) => g.ids);
  }
  return ids;
}

function describeSelection(selection) {
  if (!selection || selection.mode === "all") return "Toutes les cartes";
  if (selection.mode === "matiere") return `📁 ${selection.matiere}`;
  if (selection.mode === "fiches") {
    return selection.fiches.length > 1
      ? `${selection.fiches.length} fiches sélectionnées`
      : selection.fiches[0];
  }
  return "";
}

export default function ReviewView({
  ids,
  byId,
  progress,
  onGrade,
  ficheGroups,
  selection,
  onSelectionChange,
}) {
  const activeIds = computeActiveIds(selection, ids, ficheGroups);

  const [currentId, setCurrentId] = useState(() => pickNext(activeIds, progress));
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setCurrentId(pickNext(activeIds, progress));
    setRevealed(false);
    // Only re-pick when the selection itself changes; grading re-picks explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  if (!selection) {
    return (
      <section className="view">
        <ReviewSelector ficheGroups={ficheGroups} onSelect={onSelectionChange} />
      </section>
    );
  }

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

  function handleAnswerClick() {
    setRevealed(true);
  }

  return (
    <section className="view">
      <div className="selection-bar">
        <span className="selection-label">{describeSelection(selection)}</span>
        <button type="button" className="ghost-btn" onClick={() => onSelectionChange(null)}>
          ← Changer
        </button>
      </div>

      <StatTiles
        className="stats"
        items={[
          [stats.neu, "Nouvelles"],
          [stats.learning, "En cours"],
          [stats.dueNow, "À revoir"],
          [stats.ahead, "Acquises"],
        ]}
      />

      <Flashcard
        card={card}
        revealed={revealed}
        etas={etas}
        onGrade={handleGrade}
        onReveal={handleAnswerClick}
      />
    </section>
  );
}
