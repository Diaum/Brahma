"use client";

import { useEffect, useState, useCallback, useRef, MouseEvent } from "react";
import { useParams } from "next/navigation";
import { PageHeader, Button, Modal } from "@/components/ui";

interface Character {
  id: string;
  name: string;
  age: number;
  description_pt: string;
  prompt_base_en: string;
  cover_image_url: string | null;
}

interface Shot {
  id: string;
  prompt_scene: string;
  prompt_full: string;
  status: string;
  image_url: string | null;
  order: number;
  episode_id: string;
}

interface ShotPosition {
  x: number;
  y: number;
}

const statusColors: Record<string, string> = {
  pending: "border-muted/60",
  generated: "border-amber-500/60",
  approved: "border-green-500/60",
  animated: "border-blue-500/60",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  generated: "Gerado",
  approved: "Aprovado",
  animated: "Animado",
};

const statusDotColors: Record<string, string> = {
  pending: "bg-muted",
  generated: "bg-amber-500",
  approved: "bg-green-500",
  animated: "bg-blue-500",
};

export default function CharacterPage() {
  const { id } = useParams<{ id: string }>();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [character, setCharacter] = useState<Character | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [positions, setPositions] = useState<Record<string, ShotPosition>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New shot form
  const [showNewForm, setShowNewForm] = useState(false);
  const [sceneInput, setSceneInput] = useState("");
  const [composedPrompt, setComposedPrompt] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [creating, setCreating] = useState(false);

  // Generate & preview
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [previewShot, setPreviewShot] = useState<Shot | null>(null);

  // Dragging
  const [dragging, setDragging] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Default episode
  const [episodeId, setEpisodeId] = useState<string | null>(null);

  // Load saved positions from localStorage
  function loadPositions(shotList: Shot[]) {
    const saved = localStorage.getItem(`brahma-positions-${id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    // Default: grid layout
    const pos: Record<string, ShotPosition> = {};
    shotList.forEach((shot, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      pos[shot.id] = { x: 40 + col * 260, y: 40 + row * 280 };
    });
    return pos;
  }

  function savePositions(pos: Record<string, ShotPosition>) {
    localStorage.setItem(`brahma-positions-${id}`, JSON.stringify(pos));
  }

  const loadData = useCallback(async () => {
    try {
      const [charRes, epsRes] = await Promise.all([
        fetch(`/api/characters/${id}`),
        fetch(`/api/characters/${id}/episodes`),
      ]);

      if (charRes.ok) setCharacter(await charRes.json());

      let episodes: { id: string }[] = [];
      if (epsRes.ok) episodes = await epsRes.json();

      if (episodes.length === 0) {
        const createRes = await fetch(`/api/characters/${id}/episodes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Principal" }),
        });
        if (createRes.ok) {
          const ep = await createRes.json();
          episodes = [ep];
        }
      }

      if (episodes.length > 0) {
        setEpisodeId(episodes[0].id);
        const shotsRes = await fetch(
          `/api/characters/${id}/episodes/${episodes[0].id}/shots`
        );
        if (shotsRes.ok) {
          const shotList = await shotsRes.json();
          setShots(shotList);
          setPositions(loadPositions(shotList));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Drag handlers ---
  function handleMouseDown(e: MouseEvent, shotId: string) {
    if ((e.target as HTMLElement).closest("button")) return;
    const pos = positions[shotId];
    if (!pos) return;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    setDragging(shotId);
  }

  useEffect(() => {
    if (!dragging) return;

    function handleMouseMove(e: globalThis.MouseEvent) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;

      setPositions((prev) => {
        const updated = {
          ...prev,
          [dragging!]: {
            x: Math.max(0, newX - rect.left),
            y: Math.max(0, newY - rect.top),
          },
        };
        return updated;
      });
    }

    function handleMouseUp() {
      setPositions((prev) => {
        savePositions(prev);
        return prev;
      });
      setDragging(null);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  // --- Compose prompt ---
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

  // --- Create shot ---
  async function handleCreateShot() {
    if (!composedPrompt || !sceneInput.trim() || !episodeId) return;
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

      const newShot = await res.json();

      // Position the new shot
      const newPos = { x: 40 + (shots.length % 4) * 260, y: 40 + Math.floor(shots.length / 4) * 280 };
      setPositions((prev) => {
        const updated = { ...prev, [newShot.id]: newPos };
        savePositions(updated);
        return updated;
      });

      setShots((prev) => [...prev, newShot]);
      setSceneInput("");
      setComposedPrompt(null);
      setShowNewForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setCreating(false);
    }
  }

  // --- Generate image ---
  async function handleGenerate(shot: Shot) {
    setGeneratingId(shot.id);
    setError(null);

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId: shot.id,
          prompt: shot.prompt_full || shot.prompt_scene,
          aspectRatio: "16:9",
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

  // --- Delete shot ---
  async function handleDeleteShot(shotId: string) {
    if (!episodeId) return;
    const res = await fetch(
      `/api/characters/${id}/episodes/${episodeId}/shots/${shotId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setShots((prev) => prev.filter((s) => s.id !== shotId));
      setPositions((prev) => {
        const updated = { ...prev };
        delete updated[shotId];
        savePositions(updated);
        return updated;
      });
    }
  }

  if (loading) {
    return <p className="text-muted p-8">Carregando...</p>;
  }

  return (
    <div>
      <PageHeader
        title={character?.name || "Personagem"}
        description={
          character
            ? `${character.age} anos — ${character.description_pt}`
            : undefined
        }
        action={
          <Button onClick={() => setShowNewForm(!showNewForm)}>
            {showNewForm ? "Cancelar" : "+ Novo Shot"}
          </Button>
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
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <h3 className="text-lg font-semibold mb-3">Novo Shot</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">
                Descreva a cena em portugues
              </label>
              <textarea
                value={sceneInput}
                onChange={(e) => {
                  setSceneInput(e.target.value);
                  setComposedPrompt(null);
                }}
                placeholder="Ex: Sentado na cadeira em frente ao computador, close up, mao no teclado, olhar cansado"
                rows={3}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent transition"
              />
              <p className="text-muted text-xs mt-1">
                Cenario, acao, angulo de camera — a estetica e o personagem sao mantidos automaticamente.
              </p>
            </div>

            <Button
              onClick={handleCompose}
              disabled={!sceneInput.trim() || composing}
              variant="secondary"
              size="sm"
            >
              {composing ? "Compondo..." : "Preview do prompt"}
            </Button>

            {composedPrompt && (
              <div>
                <label className="block text-sm text-muted mb-1">
                  Prompt composto (EN)
                </label>
                <div className="bg-background border border-border rounded-lg p-3 text-xs text-foreground/80 max-h-32 overflow-y-auto font-mono">
                  {composedPrompt}
                </div>
                <div className="mt-3">
                  <Button onClick={handleCreateShot} disabled={creating} size="sm">
                    {creating ? "Criando..." : "Criar Shot"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Free Canvas */}
      <div
        ref={canvasRef}
        className="relative bg-background/50 border border-border rounded-xl overflow-auto"
        style={{ minHeight: "600px", height: "calc(100vh - 280px)" }}
      >
        {shots.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted">
            <span className="text-4xl mb-3">🎬</span>
            <span>Crie seu primeiro shot</span>
          </div>
        )}

        {shots.map((shot) => {
          const pos = positions[shot.id] || { x: 0, y: 0 };
          const isGenerating = generatingId === shot.id;
          const isDragging = dragging === shot.id;

          return (
            <div
              key={shot.id}
              onMouseDown={(e) => handleMouseDown(e, shot.id)}
              className={`absolute select-none border-2 ${statusColors[shot.status]} bg-card rounded-xl shadow-lg transition-shadow hover:shadow-xl ${
                isDragging ? "z-50 shadow-2xl scale-[1.02]" : "z-10"
              }`}
              style={{
                left: pos.x,
                top: pos.y,
                width: 230,
                cursor: isDragging ? "grabbing" : "grab",
              }}
            >
              {/* Image */}
              <div className="p-2">
                {shot.image_url ? (
                  <button
                    type="button"
                    onClick={() => setPreviewShot(shot)}
                    className="cursor-pointer w-full"
                  >
                    <img
                      src={shot.image_url}
                      alt={shot.prompt_scene}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  </button>
                ) : (
                  <div className="w-full h-32 bg-background rounded-lg flex items-center justify-center text-muted text-xs">
                    {isGenerating ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        <span>Gerando...</span>
                      </div>
                    ) : (
                      "Sem imagem"
                    )}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="px-3 pb-2">
                <p className="text-xs line-clamp-2 text-foreground/80 mb-2">
                  {shot.prompt_scene}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-2 h-2 rounded-full ${statusDotColors[shot.status]}`}
                    />
                    <span className="text-[10px] text-muted">
                      {statusLabels[shot.status]}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteShot(shot.id)}
                    className="text-muted hover:text-red-400 transition text-xs cursor-pointer opacity-0 group-hover:opacity-100"
                    style={{ opacity: undefined }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.opacity = "1")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.opacity = "0")
                    }
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="px-2 pb-2 flex gap-1">
                {(shot.status === "pending" ||
                  shot.status === "generated") && (
                  <button
                    onClick={() => handleGenerate(shot)}
                    disabled={isGenerating}
                    className="flex-1 text-[10px] bg-accent text-black font-semibold py-1 rounded-md hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isGenerating
                      ? "..."
                      : shot.image_url
                        ? "Regerar"
                        : "Gerar"}
                  </button>
                )}
                {shot.status === "generated" && (
                  <button
                    onClick={() => {
                      fetch(
                        `/api/characters/${id}/episodes/${episodeId}/shots/${shot.id}`,
                        {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "approved" }),
                        }
                      ).then(() =>
                        setShots((prev) =>
                          prev.map((s) =>
                            s.id === shot.id
                              ? { ...s, status: "approved" }
                              : s
                          )
                        )
                      );
                    }}
                    className="flex-1 text-[10px] bg-green-600 text-white font-semibold py-1 rounded-md hover:bg-green-700 transition cursor-pointer"
                  >
                    Aprovar
                  </button>
                )}
              </div>
            </div>
          );
        })}
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
                <span className="text-muted">Cena: </span>
                {previewShot.prompt_scene}
              </p>
              <p className="text-xs text-foreground/60 font-mono">
                {previewShot.prompt_full}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
