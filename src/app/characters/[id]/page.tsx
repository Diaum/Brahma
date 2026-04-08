"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader, Button, Card, Modal } from "@/components/ui";

interface Episode {
  id: string;
  title: string;
  script: string | null;
  format: string;
  order: number;
  created_at: string;
}

const FORMAT_LABELS: Record<string, string> = {
  "16:9": "Widescreen",
  "9:16": "Stories/Reels",
  "1:1": "Feed",
};

export default function CharacterEpisodes() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Episode | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchEpisodes();
  }, [id]);

  async function fetchEpisodes() {
    try {
      const res = await fetch(`/api/characters/${id}/episodes`);
      if (res.ok) {
        const data = await res.json();
        setEpisodes(data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/episodes/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setEpisodes((prev) => prev.filter((e) => e.id !== deleteTarget.id));
        setDeleteTarget(null);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Episodios"
        description={`Personagem: ${id}`}
        action={
          <a href={`/characters/${id}/episodes/new`}>
            <Button>+ Novo Episodio</Button>
          </a>
        }
      />

      {loading ? (
        <p className="text-muted">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {episodes.map((episode) => (
            <Card key={episode.id} className="relative group">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-foreground truncate pr-2">
                  {episode.title}
                </h3>
                <span className="text-xs text-muted bg-card border border-border rounded px-2 py-0.5 shrink-0">
                  {episode.format}
                </span>
              </div>

              {episode.script && (
                <p className="text-muted text-sm line-clamp-3 mb-3">
                  {episode.script}
                </p>
              )}

              <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span>Ordem: {episode.order}</span>
                  <span>{FORMAT_LABELS[episode.format] || episode.format}</span>
                </div>
                <button
                  onClick={() => setDeleteTarget(episode)}
                  className="text-xs text-muted hover:text-red-400 transition cursor-pointer"
                >
                  Excluir
                </button>
              </div>
            </Card>
          ))}

          <Card
            href={`/characters/${id}/episodes/new`}
            className="border-2 border-dashed border-border flex flex-col items-center justify-center text-muted hover:text-accent min-h-[200px]"
          >
            <span className="text-4xl mb-2">+</span>
            <span>Criar episodio</span>
          </Card>
        </div>
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Excluir episodio"
      >
        <p className="text-muted mb-6">
          Tem certeza que deseja excluir o episodio{" "}
          <strong className="text-foreground">{deleteTarget?.title}</strong>?
          Esta acao nao pode ser desfeita.
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            variant="ghost"
            onClick={() => setDeleteTarget(null)}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="bg-red-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50 cursor-pointer text-sm"
          >
            {deleting ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
