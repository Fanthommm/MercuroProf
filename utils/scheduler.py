"""Anki-style spaced repetition (SM-2 based, per docs.ankiweb.net/deck-options.html).

New cards move through short learning steps, then graduate into the review
queue where the delay before the next review grows with an ease factor that
rises on Easy, falls on Again/Hard, and resets to the learning queue on a
lapse (Again on a review card).
"""

import random
from datetime import datetime, timedelta

LEARNING_STEPS_MIN = [1, 10]
RELEARNING_STEPS_MIN = [10]
GRADUATING_INTERVAL_DAYS = 1
EASY_INTERVAL_DAYS = 4
STARTING_EASE = 2.5
MINIMUM_EASE = 1.3
EASY_BONUS = 1.3
HARD_INTERVAL_MULTIPLIER = 1.2
INTERVAL_MODIFIER = 1.0
LAPSE_NEW_INTERVAL_PERCENT = 0.0
FUZZ_RATIO = 0.05

RATINGS = ("again", "hard", "good", "easy")


def new_card():
    return {
        "state": "new",
        "step": 0,
        "ease": STARTING_EASE,
        "interval": 0,
        "due": datetime.min.isoformat(),
        "reps": 0,
        "lapses": 0,
    }


def _fuzzed(days):
    if days < 2:
        return days
    spread = max(1, round(days * FUZZ_RATIO))
    return days + random.randint(-spread, spread)


def _grow(interval, factor):
    return _fuzzed(max(interval + 1, round(interval * factor * INTERVAL_MODIFIER)))


def grade_card(card, rating, now=None):
    """Update `card` in place following Anki's SM-2 rules and return it."""
    if rating not in RATINGS:
        raise ValueError(f"unknown rating: {rating}")

    now = now or datetime.now()
    card["reps"] += 1
    was_relearning = card["state"] == "relearning"

    if card["state"] in ("new", "learning", "relearning"):
        steps = RELEARNING_STEPS_MIN if was_relearning else LEARNING_STEPS_MIN

        if rating == "again":
            card["state"] = "relearning" if was_relearning else "learning"
            card["step"] = 0
            card["due"] = (now + timedelta(minutes=steps[0])).isoformat()
        elif rating == "hard":
            card["state"] = "relearning" if was_relearning else "learning"
            delay = steps[min(card["step"], len(steps) - 1)]
            card["due"] = (now + timedelta(minutes=delay)).isoformat()
        else:  # good or easy: advance a step, or graduate
            next_step = card["step"] + 1
            if rating == "good" and next_step < len(steps):
                card["state"] = "relearning" if was_relearning else "learning"
                card["step"] = next_step
                card["due"] = (now + timedelta(minutes=steps[next_step])).isoformat()
            else:
                card["state"] = "review"
                card["step"] = 0
                if was_relearning:
                    card["interval"] = max(1, card["interval"])
                else:
                    card["interval"] = (
                        EASY_INTERVAL_DAYS if rating == "easy" else GRADUATING_INTERVAL_DAYS
                    )
                card["due"] = (now + timedelta(days=card["interval"])).isoformat()

    else:  # review
        if rating == "again":
            card["lapses"] += 1
            card["ease"] = max(MINIMUM_EASE, card["ease"] - 0.20)
            card["state"] = "relearning"
            card["step"] = 0
            card["interval"] = max(1, round(card["interval"] * LAPSE_NEW_INTERVAL_PERCENT))
            card["due"] = (now + timedelta(minutes=RELEARNING_STEPS_MIN[0])).isoformat()
        elif rating == "hard":
            card["ease"] = max(MINIMUM_EASE, card["ease"] - 0.15)
            card["interval"] = _grow(card["interval"], HARD_INTERVAL_MULTIPLIER)
            card["due"] = (now + timedelta(days=card["interval"])).isoformat()
        elif rating == "good":
            card["interval"] = _grow(card["interval"], card["ease"])
            card["due"] = (now + timedelta(days=card["interval"])).isoformat()
        else:  # easy
            card["ease"] = card["ease"] + 0.15
            card["interval"] = _grow(card["interval"], card["ease"] * EASY_BONUS)
            card["due"] = (now + timedelta(days=card["interval"])).isoformat()

    return card


def pick_next(question_ids, progress, now=None):
    """Anki-style queue priority: due learning/relearning cards first, then due
    review cards, then unseen cards, then (if nothing is due yet) whichever
    card is due soonest, so the app is never stuck with nothing to show.
    """
    now = now or datetime.now()

    learning_due, review_due, new, others = [], [], [], []
    for qid in question_ids:
        card = progress.get(qid)
        if card is None or card["state"] == "new":
            new.append(qid)
            continue
        due = datetime.fromisoformat(card["due"])
        if card["state"] in ("learning", "relearning"):
            (learning_due if due <= now else others).append(qid)
        else:  # review
            (review_due if due <= now else others).append(qid)

    for bucket in (learning_due, review_due, new):
        if bucket:
            return random.choice(bucket)

    if others:
        return min(others, key=lambda qid: progress[qid]["due"])
    return random.choice(question_ids)
