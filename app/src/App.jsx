import { useMemo, useState } from "react";
import { useLocalStorageState } from "./lib/storage";
import { BUILTIN_QUESTIONS } from "./data/questions";
import TabNav from "./components/TabNav";
import ReviewView from "./components/ReviewView";
import StatsView from "./components/StatsView";
import Footer from "./components/Footer";

const BUILTIN_FICHES = new Set(BUILTIN_QUESTIONS.map((q) => q.fiche));

export default function App() {
  const [importedQuestions, setImportedQuestions] = useLocalStorageState(
    "fiches-cirrhose-imported-v1",
    []
  );
  const [progress, setProgress] = useLocalStorageState("fiches-cirrhose-progress-v1", {});
  const [activeFiche, setActiveFiche] = useLocalStorageState("fiches-cirrhose-filter-v1", "all");
  const [activeTab, setActiveTab] = useState("review");
  const [status, setStatus] = useState("");

  const allQuestions = useMemo(
    () => [...BUILTIN_QUESTIONS, ...importedQuestions],
    [importedQuestions]
  );

  const byId = useMemo(() => {
    const map = {};
    allQuestions.forEach((q) => {
      map[q.id] = q;
    });
    return map;
  }, [allQuestions]);

  const ids = useMemo(() => allQuestions.map((q) => q.id), [allQuestions]);

  const themeGroups = useMemo(() => {
    const order = [];
    const byTheme = {};
    allQuestions.forEach((q) => {
      if (!byTheme[q.theme]) {
        byTheme[q.theme] = [];
        order.push(q.theme);
      }
      byTheme[q.theme].push(q.id);
    });
    return order.map((theme) => ({ theme, ids: byTheme[theme] }));
  }, [allQuestions]);

  const ficheGroups = useMemo(() => {
    const order = [];
    const byFiche = {};
    allQuestions.forEach((q) => {
      if (!byFiche[q.fiche]) {
        byFiche[q.fiche] = [];
        order.push(q.fiche);
      }
      byFiche[q.fiche].push(q.id);
    });
    return order.map((fiche) => ({ fiche, ids: byFiche[fiche] }));
  }, [allQuestions]);

  const activeIds = useMemo(() => {
    if (activeFiche === "all") return ids;
    const g = ficheGroups.find((x) => x.fiche === activeFiche);
    return g ? g.ids : ids;
  }, [activeFiche, ficheGroups, ids]);

  function flash(msg) {
    setStatus(msg);
    setTimeout(() => {
      setStatus((prev) => (prev === msg ? "" : prev));
    }, 3000);
  }

  function handleGrade(id, updatedCard) {
    setProgress((prev) => ({ ...prev, [id]: updatedCard }));
  }

  function handleImportFiche(newQuestions) {
    setImportedQuestions((prev) => [...prev, ...newQuestions]);
  }

  function handleRemoveFiche(ficheName) {
    const idsToRemove = importedQuestions
      .filter((q) => q.fiche === ficheName)
      .map((q) => q.id);
    setImportedQuestions((prev) => prev.filter((q) => q.fiche !== ficheName));
    setProgress((prev) => {
      const next = { ...prev };
      idsToRemove.forEach((id) => delete next[id]);
      return next;
    });
    if (activeFiche === ficheName) setActiveFiche("all");
    flash(`Fiche « ${ficheName} » retirée.`);
  }

  return (
    <div className="app">
      <div className="app-inner">
        <header className="masthead">
          <div>
            <span className="eyebrow">Carnet de révision</span>
            <h1>Fiches Cirrhose 🌸</h1>
          </div>
        </header>

        <TabNav active={activeTab} onChange={setActiveTab} />

        {activeTab === "review" && (
          <ReviewView
            activeIds={activeIds}
            byId={byId}
            progress={progress}
            onGrade={handleGrade}
            ficheGroups={ficheGroups}
            activeFiche={activeFiche}
            onFicheChange={setActiveFiche}
          />
        )}

        {activeTab === "stats" && (
          <StatsView
            ids={ids}
            themeGroups={themeGroups}
            ficheGroups={ficheGroups}
            progress={progress}
            builtinFiches={BUILTIN_FICHES}
            onImportFiche={handleImportFiche}
            onRemoveFiche={handleRemoveFiche}
            flash={flash}
          />
        )}

        <div className="status-line">{status}</div>

        <Footer progress={progress} onRestore={setProgress} flash={flash} />
      </div>
    </div>
  );
}
