"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui";
import { CharacterCard } from "@/components/CharacterCard";

interface Character {
  id: string;
  name: string;
  age: number;
  description_pt?: string;
}

export default function Home() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/characters")
      .then((res) => {
        if (!res.ok) throw new Error("Erro ao carregar personagens");
        return res.json();
      })
      .then((data) => setCharacters(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
    </div>
  );
}
