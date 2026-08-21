
import pandas as pd

from QuizApp import QuizApp

def load_questions(csv_path="Cirrhose_questions_revision.csv"):
    df = pd.read_csv(csv_path)
    return [
        {"question": question, "reponse": response, "theme": theme}
        for question, response, theme in zip(df["Question"], df["Reponse"], df["Theme"])
    ]


def main():
    questions = load_questions()
    app = QuizApp(questions)
    app.mainloop()


if __name__ == "__main__":
    main()
