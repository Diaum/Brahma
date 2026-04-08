"use client";

import { useEffect, useState, useCallback, useRef, MouseEvent } from "react";
import { useParams } from "next/navigation";
import { PageHeader, Button } from "@/components/ui";

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

const CARD_W = 320;
const CARD_GAP = 24;
const CARD_COLS = 3;

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

const statusBorderColors: Record<string, string> = {
  pending: "border-muted/40",
  generated: "border-amber-500/50",
  approved: "border-green-500/50",
  animated: "border-blue-500/50",
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

  // Dragging state
  const [dragging, setDragging] = useState<string | null>(null);
  const dragState = useRef({ offsetX: 0, offsetY: 0, moved: false });

  // Default episode
  const [episodeId, setEpisodeId] = useState<string | null>(null);

  // Set pre-prompt when character loads
  useEffect(() => {
    if (character && !sceneInput) {
      setSceneInput(`${character.name} esta `);
    }
  }, [character]);

  function defaultPositions(shotList: Shot[]) {
    const pos: Record<string, ShotPosition> = {};
    shotList.forEach((shot, i) => {
      const col = i % CARD_COLS;
      const row = Math.floor(i / CARD_COLS);
      pos[shot.id] = {
        x: CARD_GAP + col * (CARD_W + CARD_GAP),
        y: CARD_GAP + row * 340,
      };
    });
    return pos;
  }

  function loadPositions(shotList: Shot[]) {
    const saved = localStorage.getItem(`brahma-positions-${id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure all shots have positions
        const merged = { ...defaultPositions(shotList), ...parsed };
        return merged;
      } catch {
        // ignore
      }
    }
    return defaultPositions(shotList);
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

  // --- Drag handlers (fixed with scroll offset) ---
  function handleMouseDown(e: MouseEvent, shotId: string) {
    if ((e.target as HTMLElement).closest("button, a")) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = positions[shotId];
    if (!pos) return;

    const rect = canvas.getBoundingClientRect();
    dragState.current = {
      offsetX: e.clientX - rect.left + canvas.scrollLeft - pos.x,
      offsetY: e.clientY - rect.top + canvas.scrollTop - pos.y,
      moved: false,
    };
    setDragging(shotId);
  }

  useEffect(() => {
    if (!dragging) return;

    function handleMouseMove(e: globalThis.MouseEvent) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      dragState.current.moved = true;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left + canvas.scrollLeft - dragState.current.offsetX;
      const y = e.clientY - rect.top + canvas.scrollTop - dragState.current.offsetY;

      setPositions((prev) => ({
        ...prev,
        [dragging!]: { x: Math.max(0, x), y: Math.max(0, y) },
      }));
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
      const newPos = {
        x: CARD_GAP + (shots.length % CARD_COLS) * (CARD_W + CARD_GAP),
        y: CARD_GAP + Math.floor(shots.length / CARD_COLS) * 340,
      };

      setPositions((prev) => {
        const updated = { ...prev, [newShot.id]: newPos };
        savePositions(updated);
        return updated;
      });

      setShots((prev) => [...prev, newShot]);
      setSceneInput(character ? `${character.name} esta ` : "");
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

  // --- Approve shot ---
  async function handleApprove(shotId: string) {
    if (!episodeId) return;
    const res = await fetch(
      `/api/characters/${id}/episodes/${episodeId}/shots/${shotId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      }
    );
    if (res.ok) {
      setShots((prev) =>
        prev.map((s) => (s.id === shotId ? { ...s, status: "approved" } : s))
      );
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
      if (previewShot?.id === shotId) setPreviewShot(null);
    }
  }

  // --- Download image ---
  async function handleDownload(shot: Shot) {
    if (!shot.image_url) return;
    try {
      const res = await fetch(shot.image_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${character?.name || "shot"}-${shot.id.slice(0, 8)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Erro ao baixar imagem");
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
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-300 hover:text-red-100 ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* New Shot Form */}
      {showNewForm && (
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Novo Shot</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Descreva a cena
              </label>
              <textarea
                value={sceneInput}
                onChange={(e) => {
                  setSceneInput(e.target.value);
                  setComposedPrompt(null);
                }}
                placeholder={`${character?.name || "Personagem"} esta sentado na cadeira em frente ao computador, close up, mao no teclado, olhar cansado`}
                rows={3}
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent transition"
              />
              <p className="text-muted text-xs mt-1.5">
                O que o personagem esta fazendo, onde esta, angulo de camera. A estetica cinematografica e mantida automaticamente.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleCompose}
                disabled={!sceneInput.trim() || composing}
                variant="secondary"
              >
                {composing ? "Compondo..." : "Preview do prompt"}
              </Button>
            </div>

            {composedPrompt && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-muted mb-1.5">
                    Prompt composto (EN)
                  </label>
                  <div className="bg-background border border-border rounded-lg p-4 text-xs text-foreground/70 max-h-40 overflow-y-auto font-mono leading-relaxed">
                    {composedPrompt}
                  </div>
                </div>
                <Button onClick={handleCreateShot} disabled={creating}>
                  {creating ? "Criando..." : "Criar Shot"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Free Canvas */}
      <div
        ref={canvasRef}
        className="relative bg-background/30 border border-border rounded-xl overflow-auto"
        style={{ minHeight: "650px", height: "calc(100vh - 260px)" }}
      >
        {shots.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted">
            <span className="text-5xl mb-4">🎬</span>
            <span className="text-lg">Crie seu primeiro shot</span>
            <span className="text-sm mt-1">
              Clique em &quot;+ Novo Shot&quot; acima
            </span>
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
              className={`absolute select-none border-2 ${statusBorderColors[shot.status]} bg-card rounded-xl transition-shadow ${
                isDragging
                  ? "z-50 shadow-2xl shadow-accent/10 scale-[1.02]"
                  : "z-10 shadow-lg hover:shadow-xl"
              }`}
              style={{
                left: pos.x,
                top: pos.y,
                width: CARD_W,
                cursor: isDragging ? "grabbing" : "grab",
              }}
            >
              {/* Image */}
              <div className="p-2.5 pb-0">
                {shot.image_url ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!dragState.current.moved) setPreviewShot(shot);
                    }}
                    className="cursor-pointer w-full"
                  >
                    <img
                      src={shot.image_url}
                      alt={shot.prompt_scene}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </button>
                ) : (
                  <div className="w-full h-48 bg-background rounded-lg flex items-center justify-center text-muted">
                    {isGenerating ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Gerando...</span>
                      </div>
                    ) : (
                      <span className="text-sm">Sem imagem</span>
                    )}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="px-3 pt-2.5 pb-2">
                <p className="text-sm line-clamp-2 text-foreground/80 mb-2">
                  {shot.prompt_scene}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${statusDotColors[shot.status]}`}
                    />
                    <span className="text-xs text-muted">
                      {statusLabels[shot.status]}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteShot(shot.id)}
                    className="text-muted hover:text-red-400 transition text-sm cursor-pointer px-1"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="px-2.5 pb-2.5 flex gap-2">
                {(shot.status === "pending" || shot.status === "generated") && (
                  <button
                    onClick={() => handleGenerate(shot)}
                    disabled={isGenerating}
                    className="flex-1 text-xs bg-accent text-black font-semibold py-1.5 rounded-lg hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isGenerating
                      ? "Gerando..."
                      : shot.image_url
                        ? "Regerar"
                        : "Gerar imagem"}
                  </button>
                )}
                {shot.status === "generated" && (
                  <button
                    onClick={() => handleApprove(shot.id)}
                    className="flex-1 text-xs bg-green-600 text-white font-semibold py-1.5 rounded-lg hover:bg-green-700 transition cursor-pointer"
                  >
                    Aprovar
                  </button>
                )}
                {shot.status === "approved" && shot.image_url && (
                  <button
                    onClick={() => handleDownload(shot)}
                    className="flex-1 text-xs bg-card border border-border text-foreground font-medium py-1.5 rounded-lg hover:bg-card-hover transition cursor-pointer"
                  >
                    Download
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview Modal — centered */}
      {previewShot && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewShot(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    {previewShot.prompt_scene}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${statusDotColors[previewShot.status]}`}
                    />
                    <span className="text-sm text-muted">
                      {statusLabels[previewShot.status]}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewShot(null)}
                  className="text-muted hover:text-foreground transition text-xl cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>

              {/* Image */}
              {previewShot.image_url && (
                <img
                  src={previewShot.image_url}
                  alt={previewShot.prompt_scene}
                  className="w-full rounded-xl mb-4"
                />
              )}

              {/* Prompt */}
              <div className="bg-background rounded-lg p-4 mb-4">
                <p className="text-xs text-muted mb-1 font-medium uppercase tracking-wide">
                  Prompt
                </p>
                <p className="text-xs text-foreground/60 font-mono leading-relaxed">
                  {previewShot.prompt_full}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                {previewShot.status === "generated" && (
                  <>
                    <button
                      onClick={() => {
                        handleApprove(previewShot.id);
                        setPreviewShot({
                          ...previewShot,
                          status: "approved",
                        });
                      }}
                      className="bg-green-600 text-white font-semibold px-5 py-2 rounded-lg hover:bg-green-700 transition cursor-pointer text-sm"
                    >
                      Aprovar
                    </button>
                    <button
                      onClick={() => {
                        setPreviewShot(null);
                        handleGenerate(previewShot);
                      }}
                      className="bg-accent text-black font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition cursor-pointer text-sm"
                    >
                      Regerar
                    </button>
                  </>
                )}
                {previewShot.status === "approved" &&
                  previewShot.image_url && (
                    <button
                      onClick={() => handleDownload(previewShot)}
                      className="bg-accent text-black font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition cursor-pointer text-sm"
                    >
                      Download
                    </button>
                  )}
                <button
                  onClick={() => {
                    handleDeleteShot(previewShot.id);
                  }}
                  className="text-muted hover:text-red-400 transition text-sm px-3 cursor-pointer"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
