import tkinter as tk
from tkinter import font as tkfont

from utils import scheduler
from utils.progress_store import load_progress, save_progress


class QuizApp(tk.Tk):
    BG = "#fdf3f7"
    ACCENT = "#e0729c"
    ACCENT_DARK = "#c85a85"
    TEXT = "#3a2e35"
    CARD = "#ffffff"

    GRADE_LABELS = {"again": "Encore", "hard": "Difficile", "good": "Bien", "easy": "Facile"}
    GRADE_COLORS = {"again": "#e05555", "hard": "#e0a336", "good": "#5aa9e6", "easy": "#4caf50"}

    def __init__(self, questions):
        super().__init__()
        self.questions_by_id = {q["question"]: q for q in questions}
        self.question_ids = list(self.questions_by_id.keys())
        self.progress = load_progress()
        self.score = 0
        self.seen = 0
        self.current_id = None
        self.answer_visible = False

        self.title("Quiz Révision 🌸")
        self.geometry("640x520")
        self.configure(bg=self.BG)
        self.resizable(False, False)

        self.title_font = tkfont.Font(family="Segoe UI", size=20, weight="bold")
        self.theme_font = tkfont.Font(family="Segoe UI", size=12, weight="bold")
        self.question_font = tkfont.Font(family="Segoe UI", size=15)
        self.answer_font = tkfont.Font(family="Segoe UI", size=14, weight="bold")
        self.button_font = tkfont.Font(family="Segoe UI", size=12, weight="bold")
        self.score_font = tkfont.Font(family="Segoe UI", size=11)

        self._build_layout()
        self.next_question()

    def _build_layout(self):
        tk.Label(
            self, text="Quiz Révision 🌸", font=self.title_font, bg=self.BG, fg=self.ACCENT_DARK
        ).pack(pady=(20, 10))

        self.card = tk.Frame(self, bg=self.CARD, bd=0, highlightthickness=0)
        self.card.pack(padx=30, pady=10, fill="both", expand=True)

        self.theme_label = tk.Label(
            self.card, text="", font=self.theme_font, bg=self.CARD, fg=self.ACCENT
        )
        self.theme_label.pack(pady=(20, 10))

        self.question_label = tk.Label(
            self.card,
            text="",
            font=self.question_font,
            bg=self.CARD,
            fg=self.TEXT,
            wraplength=500,
            justify="center",
        )
        self.question_label.pack(padx=20, pady=10)

        self.answer_label = tk.Label(
            self.card,
            text="",
            font=self.answer_font,
            bg=self.CARD,
            fg=self.ACCENT_DARK,
            wraplength=500,
            justify="center",
        )
        self.answer_label.pack(padx=20, pady=10)

        self.score_label = tk.Label(
            self, text="", font=self.score_font, bg=self.BG, fg=self.TEXT
        )
        self.score_label.pack(pady=(5, 0))

        self.reveal_button = tk.Button(
            self,
            text="Voir la réponse",
            font=self.button_font,
            bg=self.ACCENT,
            fg="white",
            activebackground=self.ACCENT_DARK,
            activeforeground="white",
            relief="flat",
            padx=20,
            pady=10,
            command=self.reveal_answer,
        )
        self.reveal_button.pack(pady=20)

        self.grade_frame = tk.Frame(self, bg=self.BG)
        for rating in scheduler.RATINGS:
            tk.Button(
                self.grade_frame,
                text=self.GRADE_LABELS[rating],
                font=self.button_font,
                bg=self.GRADE_COLORS[rating],
                fg="white",
                activebackground=self.ACCENT_DARK,
                activeforeground="white",
                relief="flat",
                padx=14,
                pady=10,
                command=lambda r=rating: self.grade(r),
            ).pack(side="left", padx=6)

    def next_question(self):
        self.current_id = scheduler.pick_next(self.question_ids, self.progress)
        card = self.questions_by_id[self.current_id]
        self.answer_visible = False
        self.theme_label.config(text=card["theme"])
        self.question_label.config(text=card["question"])
        self.answer_label.config(text="")
        self.grade_frame.pack_forget()
        self.reveal_button.pack(pady=20)
        self.seen += 1
        self._update_score()

    def reveal_answer(self):
        card = self.questions_by_id[self.current_id]
        self.answer_label.config(text=card["reponse"])
        self.answer_visible = True
        self.reveal_button.pack_forget()
        self.grade_frame.pack(pady=20)

    def grade(self, rating):
        record = self.progress.setdefault(self.current_id, scheduler.new_card())
        scheduler.grade_card(record, rating)
        save_progress(self.progress)
        if rating in ("good", "easy"):
            self.score += 1
        self._update_score()
        self.next_question()

    def _update_score(self):
        self.score_label.config(text=f"Bonnes réponses : {self.score} / {self.seen}")
