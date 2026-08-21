"""
Telecharge en PDF la "Version imprimable" de chaque fiche LiSA du college
Gastroenterologie (CDUHGE), listees dans gastro_items.json.

Usage:
    python scrape_lisa_gastro.py --login   # ouvre une fenetre de navigateur pour te connecter
    python scrape_lisa_gastro.py           # telecharge les PDF avec la session sauvegardee
"""

import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE_URL = "https://livret.uness.fr"
ITEMS_FILE = Path(__file__).parent / "gastro_items.json"
STATE_FILE = Path(__file__).parent / ".lisa_auth_state.json"
OUTPUT_DIR = Path(__file__).parent.parent / "fiches LiSA" / "Gastroenterologie"

INVALID_CHARS = '\\/:*?"<>|'


def load_items():
    with ITEMS_FILE.open(encoding="utf-8") as f:
        return json.load(f)


def safe_filename(name):
    return "".join(c for c in name if c not in INVALID_CHARS).strip()


def do_login():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        page.goto(BASE_URL + "/lisa/2026/Item_de_connaissance_2C")
        print("Connecte-toi dans la fenetre du navigateur (identifiants uness).")
        input("Une fois connecte et la page des items affichee, reviens ici et appuie sur Entree...")
        context.storage_state(path=str(STATE_FILE))
        browser.close()
    print(f"Session sauvegardee dans {STATE_FILE.name}. Tu peux relancer sans --login.")


def open_printable_version(page, href):
    page.goto(BASE_URL + href, wait_until="networkidle")
    link = page.locator("a:has-text('Version imprimable')").first
    if link.count():
        with page.expect_navigation(wait_until="networkidle"):
            link.click()
        return True

    fallback_url = BASE_URL + "/lisa/2026/Fiche_LiSA:" + href.rsplit("/", 1)[-1]
    page.goto(fallback_url, wait_until="networkidle")
    link = page.locator("a:has-text('Version imprimable')").first
    if link.count():
        with page.expect_navigation(wait_until="networkidle"):
            link.click()
        return True

    return False


def scrape():
    if not STATE_FILE.exists():
        print("Aucune session trouvee. Lance d'abord : python scrape_lisa_gastro.py --login")
        sys.exit(1)

    items = load_items()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(storage_state=str(STATE_FILE))
        page = context.new_page()

        for num, href, title, college1, college2 in items:
            out_path = OUTPUT_DIR / f"{num}_{safe_filename(title)}.pdf"
            if out_path.exists():
                print(f"[{num}] {title} -> deja present, ignore")
                continue

            print(f"[{num}] {title}")
            found_printable = open_printable_version(page, href)
            if not found_printable:
                print("  !! lien 'Version imprimable' introuvable, impression de la page telle quelle")

            page.pdf(path=str(out_path), format="A4", print_background=True)
            print(f"  -> {out_path.name}")
            time.sleep(1)

        browser.close()

    print("Termine.")


if __name__ == "__main__":
    if "--login" in sys.argv:
        do_login()
    else:
        scrape()
