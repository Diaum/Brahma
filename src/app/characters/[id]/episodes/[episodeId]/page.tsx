"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { PageHeader, Button, Card, Modal } from "@/components/ui";

interface Episode {
  id: string;
  title: string;
  format: string;
  script: string | null;
}

interface Shot {
  id: string;
  prompt_scene: string;
  prompt_full: string;
  status: string;
  image_url: string | null;
  reference_image_url: string | null;
  order: number;
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  generated: "Gerado",
  approved: "Aprovado",
  animated: "Animado",
};

const statusColors: Record<string, string> = {
  pending: "bg-muted/20 text-muted",
  generated: "bg-amber-500/20 text-amber-400",
  approved: "bg-green-500/20 text-green-400",
  animated: "bg-blue-500/20 text-blue-400",
};

export default function EpisodeShots() {
  const { id, episodeId } = useParams<{ id: string; episodeId: string }>();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [strengthMap, setStrengthMap] = useState<Record<string, number>>({});
  const [previewShot, setPreviewShot] = useState<Shot | null>(null);

  // New shot form state
  const [showNewForm, setShowNewForm] = useState(false);
  const [sceneInput, setSceneInput] = useState("");
  const [composedPrompt, setComposedPrompt] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
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
  }, [id, episodeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function getStrength(shotId: string) {
    return strengthMap[shotId] ?? 0.5;
  }

  function setStrength(shotId: string, value: number) {
    setStrengthMap((prev) => ({ ...prev, [shotId]: value }));
  }

  function getPreviousApprovedImage(shotOrder: number): string | null {
    const sorted = [...shots].sort((a, b) => a.order - b.order);
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].order < shotOrder && sorted[i].image_url) {
        return sorted[i].image_url;
      }
    }
    return null;
  }

  async function handleCompose() {
    if (!sceneInput.trim()) return;
    setComposing(true);
    setError(null);

    try {
      const res = await fetch(`/api/characters/${id}/compose-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_scene: sceneInput.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao compor prompt");
      }

      const data = await res.json();
      setComposedPrompt(data.prompt_full);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setComposing(false);
    }
  }

  async function handleCreateShot() {
    if (!composedPrompt || !sceneInput.trim()) return;
    setCreating(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/characters/${id}/episodes/${episodeId}/shots`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt_scene: sceneInput.trim(),
            prompt_full: composedPrompt,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao criar shot");
      }

      setSceneInput("");
      setComposedPrompt(null);
      setShowNewForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setCreating(false);
    }
  }

  async function handleGenerate(shot: Shot) {
    setGeneratingId(shot.id);
    setError(null);

    try {
      const referenceImageUrl = getPreviousApprovedImage(shot.order);
      const strength = getStrength(shot.id);

      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId: shot.id,
          prompt: shot.prompt_full || shot.prompt_scene,
          referenceImageUrl,
          aspectRatio: episode?.format || "9:16",
          strength,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao gerar imagem");
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleApprove(shot: Shot) {
    const res = await fetch(
      `/api/characters/${id}/episodes/${episodeId}/shots/${shot.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      }
    );
    if (res.ok) await loadData();
  }

  if (loading) {
    return <p className="text-muted">Carregando...</p>;
  }

  const isFirstShot = (shot: Shot) => {
    const sorted = [...shots].sort((a, b) => a.order - b.order);
    return sorted[0]?.id === shot.id;
  };

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
            <Button onClick={() => setShowNewForm(!showNewForm)}>
              {showNewForm ? "Cancelar" : "Novo Shot"}
            </Button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-300 hover:text-red-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* New Shot Form */}
      {showNewForm && (
        <Card className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Novo Shot</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">
                Descrição da cena (PT)
              </label>
              <textarea
                value={sceneInput}
                onChange={(e) => {
                  setSceneInput(e.target.value);
                  setComposedPrompt(null);
                }}
                placeholder="Ex: Em uma cadeira, mexendo no computador, close up, pessoas em volta"
                rows={3}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCompose}
                disabled={!sceneInput.trim() || composing}
                variant="secondary"
              >
                {composing ? "Compondo..." : "Preview do prompt"}
              </Button>
            </div>

            {composedPrompt && (
              <div>
                <label className="block text-sm text-muted mb-1">
                  Prompt composto (EN)
                </label>
                <div className="bg-background border border-border rounded-lg p-3 text-sm text-foreground/80 max-h-40 overflow-y-auto">
                  {composedPrompt}
                </div>
                <div className="mt-3">
                  <Button
                    onClick={handleCreateShot}
                    disabled={creating}
                  >
                    {creating ? "Criando..." : "Criar Shot"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {shots.map((shot) => {
          const isGenerating = generatingId === shot.id;
          const hasReference = !isFirstShot(shot);
          const refImage = getPreviousApprovedImage(shot.order);

          return (
            <Card key={shot.id} className="flex flex-col">
              {/* Image area */}
              {shot.image_url ? (
                <button
                  type="button"
                  onClick={() => setPreviewShot(shot)}
                  className="cursor-pointer w-full"
                >
                  <img
                    src={shot.image_url}
                    alt={shot.prompt_scene}
                    className="w-full h-40 object-cover rounded-lg mb-3"
                  />
                </button>
              ) : (
                <div className="w-full h-40 bg-background rounded-lg mb-3 flex items-center justify-center text-muted">
                  {isGenerating ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Gerando...</span>
                    </div>
                  ) : (
                    "Sem imagem"
                  )}
                </div>
              )}

              {/* Shot info */}
              <p className="text-sm line-clamp-2 mb-2">{shot.prompt_scene}</p>
              <span
                className={`text-xs px-2 py-0.5 rounded-full w-fit mb-3 ${statusColors[shot.status] || "text-muted"}`}
              >
                {statusLabels[shot.status] || shot.status}
              </span>

              {/* Strength slider for shots with reference */}
              {hasReference && refImage && (
                <div className="mb-3">
                  <label className="text-xs text-muted block mb-1">
                    Influência da referência:{" "}
                    {Math.round(getStrength(shot.id) * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={getStrength(shot.id)}
                    onChange={(e) =>
                      setStrength(shot.id, parseFloat(e.target.value))
                    }
                    className="w-full h-1 bg-border rounded-full appearance-none cursor-pointer accent-accent"
                  />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 mt-auto">
                <Button
                  size="sm"
                  variant={shot.image_url ? "secondary" : "primary"}
                  onClick={() => handleGenerate(shot)}
                  disabled={isGenerating}
                  className="flex-1"
                >
                  {isGenerating
                    ? "Gerando..."
                    : shot.image_url
                      ? "Regerar"
                      : "Gerar imagem"}
                </Button>
                {shot.image_url && shot.status !== "approved" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleApprove(shot)}
                    className="text-green-400"
                  >
                    Aprovar
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
        {shots.length === 0 && !showNewForm && (
          <Card className="border-2 border-dashed border-border flex flex-col items-center justify-center text-muted min-h-[200px]">
            <span className="text-4xl mb-2">🎬</span>
            <span>Nenhum shot ainda</span>
          </Card>
        )}
      </div>

      {/* Preview Modal */}
      <Modal
        open={!!previewShot}
        onClose={() => setPreviewShot(null)}
        title={previewShot?.prompt_scene}
      >
        {previewShot?.image_url && (
          <div>
            <img
              src={previewShot.image_url}
              alt={previewShot.prompt_scene}
              className="w-full rounded-lg mb-4"
            />
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted">Cena (PT): </span>
                {previewShot.prompt_scene}
              </p>
              <p>
                <span className="text-muted">Prompt completo: </span>
                {previewShot.prompt_full}
              </p>
              <p>
                <span className="text-muted">Status: </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${statusColors[previewShot.status]}`}
                >
                  {statusLabels[previewShot.status]}
                </span>
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
