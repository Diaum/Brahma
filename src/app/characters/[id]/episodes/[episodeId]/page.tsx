"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui";

interface Episode {
  id: string;
  title: string;
  format: string;
  script: string | null;
}

interface Shot {
  id: string;
  prompt_scene: string;
  status: string;
  image_url: string | null;
  order: number;
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  generated: "Gerado",
  approved: "Aprovado",
  animated: "Animado",
};

export default function EpisodeShots() {
  const { id, episodeId } = useParams<{ id: string; episodeId: string }>();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [epRes, shotsRes] = await Promise.all([
          fetch(`/api/episodes/${episodeId}`),
          fetch(`/api/characters/${id}/episodes/${episodeId}/shots`),
        ]);

        if (epRes.ok) setEpisode(await epRes.json());
        if (shotsRes.ok) setShots(await shotsRes.json());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, episodeId]);

  if (loading) {
    return <p className="text-muted">Carregando...</p>;
  }

  return (
    <div>
      <PageHeader
        title={episode?.title || "Shots"}
        description={episode ? `Formato: ${episode.format}` : undefined}
        action={
          <div className="flex gap-2">
            <a href={`/characters/${id}/episodes/${episodeId}/script`}>
              <Button variant="secondary">Roteiro</Button>
            </a>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {shots.map((shot) => (
          <Card key={shot.id}>
            {shot.image_url ? (
              <img
                src={shot.image_url}
                alt={shot.prompt_scene}
                className="w-full h-40 object-cover rounded-lg mb-3"
              />
            ) : (
              <div className="w-full h-40 bg-background rounded-lg mb-3 flex items-center justify-center text-muted">
                Sem imagem
              </div>
            )}
            <p className="text-sm line-clamp-2 mb-2">{shot.prompt_scene}</p>
            <span className="text-xs text-muted">
              {statusLabels[shot.status] || shot.status}
            </span>
          </Card>
        ))}
        {shots.length === 0 && (
          <Card className="border-2 border-dashed border-border flex flex-col items-center justify-center text-muted min-h-[200px]">
            <span className="text-4xl mb-2">🎬</span>
            <span>Nenhum shot ainda</span>
          </Card>
        )}
      </div>
    </div>
  );
}
