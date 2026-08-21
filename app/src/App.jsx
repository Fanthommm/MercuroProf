import { useEffect, useMemo, useState } from "react";
import { useLocalStorageState } from "./lib/storage";
import { fetchFicheManifest, questionsFromCSV } from "./lib/fiches";
import TabNav from "./components/TabNav";
import ReviewView from "./components/ReviewView";
import StatsView from "./components/StatsView";
import Footer from "./components/Footer";

export default function App() {
  const [progress, setProgress] = useLocalStorageState("fiches-cirrhose-progress-v1", {});
  const [activeFiche, setActiveFiche] = useLocalStorageState("fiches-cirrhose-filter-v1", "all");
  const [activeTab, setActiveTab] = useState("review");
  const [status, setStatus] = useState("");

  const [manifest, setManifest] = useState([]);
  const [importedQuestions, setImportedQuestions] = useState([]);
  const [fichesLoading, setFichesLoading] = useState(true);
  const [fichesError, setFichesError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setFichesLoading(true);
      setFichesError(null);
      try {
        const list = await fetchFicheManifest();
        const results = list.map((f) => questionsFromCSV(f.csv, f));
        if (!cancelled) {
          setManifest(list);
          setImportedQuestions(results.flat());
        }
      } catch (e) {
        if (!cancelled) setFichesError(e.message || "Chargement des fiches impossible.");
      } finally {
        if (!cancelled) setFichesLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  function refreshFiches() {
    setRefreshTick((t) => t + 1);
  }

  const allQuestions = importedQuestions;

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

  const initialLoad = fichesLoading && manifest.length === 0 && importedQuestions.length === 0;

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

        {initialLoad && <p className="status-line">Chargement des fiches...</p>}

        {!initialLoad && activeTab === "review" && (
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

        {!initialLoad && activeTab === "stats" && (
          <StatsView
            ids={ids}
            themeGroups={themeGroups}
            ficheGroups={ficheGroups}
            manifest={manifest}
            progress={progress}
            onFichesChanged={refreshFiches}
            flash={flash}
            loadError={fichesError}
          />
        )}

        <div className="status-line">{status}</div>

        <Footer progress={progress} onRestore={setProgress} flash={flash} />
      </div>
    </div>
  );
}
