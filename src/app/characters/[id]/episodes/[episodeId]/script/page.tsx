"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

export default function EpisodeScript() {
  const { id, episodeId } = useParams<{ id: string; episodeId: string }>();
  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/episodes/${episodeId}`);
        if (!res.ok) throw new Error("Erro ao carregar episodio");
        const data = await res.json();
        setTitle(data.title);
        setScript(data.script || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, episodeId]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");

    try {
      const res = await fetch(`/api/episodes/${episodeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao salvar roteiro");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-muted">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Roteiro</h1>
          <p className="text-muted mt-1">{title}</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-green-400 text-sm">Salvo!</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-accent text-black font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <a
            href={`/characters/${id}/episodes/${episodeId}`}
            className="px-4 py-2 rounded-lg border border-border text-muted hover:text-foreground hover:border-foreground transition"
          >
            Voltar
          </a>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <textarea
        value={script}
        onChange={(e) => setScript(e.target.value)}
        placeholder="Escreva o roteiro do episodio aqui..."
        rows={20}
        className="w-full bg-card border border-border rounded-lg px-4 py-4 text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition resize-y font-mono text-sm leading-relaxed"
      />
    </div>
  );
}
