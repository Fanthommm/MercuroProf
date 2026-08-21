import { useRef } from "react";

export default function Footer({ progress, onRestore, flash }) {
  const inputRef = useRef(null);

  function handleExport() {
    const payload = JSON.stringify({ savedAt: new Date().toISOString(), progress }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fiches-cirrhose-progression.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    flash("Sauvegarde téléchargée.");
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const restored = parsed && parsed.progress ? parsed.progress : parsed;
        if (!restored || typeof restored !== "object") throw new Error("format invalide");
        onRestore(restored);
        flash("Progression restaurée.");
      } catch (err) {
        flash("Fichier illisible.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <footer>
      <span>D'après les fiches LiSA</span>
      <div className="backup-controls">
        <button type="button" onClick={handleExport}>
          Sauvegarder une copie
        </button>
        <button type="button" onClick={() => inputRef.current?.click()}>
          Restaurer
        </button>
        <input ref={inputRef} type="file" accept="application/json" hidden onChange={handleFile} />
      </div>
    </footer>
  );
}
