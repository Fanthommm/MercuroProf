// Anki-style spaced repetition (SM-2 based), ported from the artifact version.

export const LEARNING_STEPS_MIN = [1, 10];
export const RELEARNING_STEPS_MIN = [10];
export const GRADUATING_INTERVAL_DAYS = 1;
export const EASY_INTERVAL_DAYS = 4;
export const STARTING_EASE = 2.5;
export const MINIMUM_EASE = 1.3;
export const EASY_BONUS = 1.3;
export const HARD_INTERVAL_MULTIPLIER = 1.2;
export const INTERVAL_MODIFIER = 1.0;
export const LAPSE_NEW_INTERVAL_PERCENT = 0.0;
export const FUZZ_RATIO = 0.05;
export const RATINGS = ["again", "hard", "good", "easy"];

export function newCard() {
  return {
    state: "new",
    step: 0,
    ease: STARTING_EASE,
    interval: 0,
    due: new Date(0).toISOString(),
    reps: 0,
    lapses: 0
  };
}

function addMinutes(date, min) {
  return new Date(date.getTime() + min * 60000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

function fuzzed(days) {
  if (days < 2) return days;
  const spread = Math.max(1, Math.round(days * FUZZ_RATIO));
  return days + Math.floor(Math.random() * (2 * spread + 1)) - spread;
}

function grow(interval, factor) {
  return fuzzed(Math.max(interval + 1, Math.round(interval * factor * INTERVAL_MODIFIER)));
}

export function gradeCard(card, rating, now) {
  now = now || new Date();
  const next = { ...card, reps: card.reps + 1 };
  const wasRelearning = card.state === "relearning";

  if (card.state === "new" || card.state === "learning" || card.state === "relearning") {
    const steps = wasRelearning ? RELEARNING_STEPS_MIN : LEARNING_STEPS_MIN;

    if (rating === "again") {
      next.state = wasRelearning ? "relearning" : "learning";
      next.step = 0;
      next.due = addMinutes(now, steps[0]).toISOString();
    } else if (rating === "hard") {
      next.state = wasRelearning ? "relearning" : "learning";
      const delay = steps[Math.min(card.step, steps.length - 1)];
      next.due = addMinutes(now, delay).toISOString();
    } else {
      const nextStep = card.step + 1;
      if (rating === "good" && nextStep < steps.length) {
        next.state = wasRelearning ? "relearning" : "learning";
        next.step = nextStep;
        next.due = addMinutes(now, steps[nextStep]).toISOString();
      } else {
        next.state = "review";
        next.step = 0;
        next.interval = wasRelearning
          ? Math.max(1, card.interval)
          : rating === "easy"
          ? EASY_INTERVAL_DAYS
          : GRADUATING_INTERVAL_DAYS;
        next.due = addDays(now, next.interval).toISOString();
      }
    }
  } else {
    if (rating === "again") {
      next.lapses = card.lapses + 1;
      next.ease = Math.max(MINIMUM_EASE, card.ease - 0.2);
      next.state = "relearning";
      next.step = 0;
      next.interval = Math.max(1, Math.round(card.interval * LAPSE_NEW_INTERVAL_PERCENT));
      next.due = addMinutes(now, RELEARNING_STEPS_MIN[0]).toISOString();
    } else if (rating === "hard") {
      next.ease = Math.max(MINIMUM_EASE, card.ease - 0.15);
      next.interval = grow(card.interval, HARD_INTERVAL_MULTIPLIER);
      next.due = addDays(now, next.interval).toISOString();
    } else if (rating === "good") {
      next.interval = grow(card.interval, card.ease);
      next.due = addDays(now, next.interval).toISOString();
    } else {
      next.ease = card.ease + 0.15;
      next.interval = grow(card.interval, next.ease * EASY_BONUS);
      next.due = addDays(now, next.interval).toISOString();
    }
  }

  return next;
}

export function pickNext(ids, progress, now) {
  now = now || new Date();
  const learningDue = [];
  const reviewDue = [];
  const neu = [];
  const others = [];

  ids.forEach((id) => {
    const card = progress[id];
    if (!card || card.state === "new") {
      neu.push(id);
      return;
    }
    const due = new Date(card.due);
    if (card.state === "learning" || card.state === "relearning") {
      (due <= now ? learningDue : others).push(id);
    } else {
      (due <= now ? reviewDue : others).push(id);
    }
  });

  for (const bucket of [learningDue, reviewDue, neu]) {
    if (bucket.length) return bucket[Math.floor(Math.random() * bucket.length)];
  }
  if (others.length) {
    return others.reduce((a, b) => (new Date(progress[a].due) <= new Date(progress[b].due) ? a : b));
  }
  return ids[Math.floor(Math.random() * ids.length)];
}

export function computeStats(ids, progress) {
  const now = new Date();
  const out = { neu: 0, learning: 0, dueNow: 0, ahead: 0 };
  ids.forEach((id) => {
    const card = progress[id];
    if (!card || card.state === "new") {
      out.neu++;
      return;
    }
    if (card.state === "learning" || card.state === "relearning") {
      out.learning++;
      return;
    }
    if (new Date(card.due) <= now) out.dueNow++;
    else out.ahead++;
  });
  return out;
}

export function computeTotals(ids, progress) {
  let seen = 0;
  let reps = 0;
  let easeSum = 0;
  let easeCount = 0;
  ids.forEach((id) => {
    const c = progress[id];
    if (!c) return;
    seen++;
    reps += c.reps;
    if (c.state === "review") {
      easeSum += c.ease;
      easeCount++;
    }
  });
  return { seen, reps, avgEase: easeCount ? easeSum / easeCount : null };
}

export function formatDelay(now, dueIso) {
  const diffMs = new Date(dueIso) - now;
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.round(hours / 24)} j`;
}
