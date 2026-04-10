"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader, Button, Card, Modal } from "@/components/ui";
import { CharacterCard } from "@/components/CharacterCard";

interface Character {
  id: string;
  name: string;
  age: number;
  description_pt?: string;
  cover_image_url?: string | null;
}

export default function Home() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCharacters = useCallback(() => {
    setLoading(true);
    fetch("/api/characters")
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao carregar personagens");
        return res.json();
      })
      .then((data) => setCharacters(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  // Re-fetch when page becomes visible (debounced, only if last fetch > 30s ago)
  useEffect(() => {
    let lastFetch = Date.now();
    function maybeRefetch() {
      if (Date.now() - lastFetch > 30000) {
        lastFetch = Date.now();
        loadCharacters();
      }
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        maybeRefetch();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", maybeRefetch);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", maybeRefetch);
    };
  }, [loadCharacters]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/characters/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setCharacters((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        setDeleteTarget(null);
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Personagens"
        description="Crie e gerencie seus personagens para producao de video"
        action={
          <a href="/characters/new">
            <Button>+ Novo Personagem</Button>
          </a>
        }
      />

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-xl p-4 animate-pulse"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-full bg-border" />
                <div className="w-24 h-5 bg-border rounded" />
                <div className="w-16 h-4 bg-border rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : characters.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-24 h-24 rounded-full bg-card border border-border flex items-center justify-center text-4xl text-muted mb-6">
            ?
          </div>
          <h2 className="text-xl font-semibold mb-2">Nenhum personagem criado</h2>
          <p className="text-muted mb-6 max-w-md">
            Comece criando seu primeiro personagem para gerar videos com IA.
          </p>
          <a href="/characters/new">
            <Button size="lg">+ Criar primeiro personagem</Button>
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {characters.map((char) => (
            <CharacterCard
              key={char.id}
              id={char.id}
              name={char.name}
              age={char.age}
              description_pt={char.description_pt}
              cover_image_url={char.cover_image_url}
              onDelete={() => setDeleteTarget(char)}
            />
          ))}
          <Card
            href="/characters/new"
            className="border-2 border-dashed border-border flex flex-col items-center justify-center text-muted hover:text-accent min-h-[200px]"
          >
            <span className="text-4xl mb-2">+</span>
            <span>Criar personagem</span>
          </Card>
        </div>
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Excluir personagem"
      >
        <p className="text-muted mb-6">
          Tem certeza que deseja excluir{" "}
          <strong className="text-foreground">{deleteTarget?.name}</strong>?
          Todos os episodios, shots e imagens serao removidos. Esta acao nao
          pode ser desfeita.
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
