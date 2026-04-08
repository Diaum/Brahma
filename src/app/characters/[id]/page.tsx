"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui";

interface Character {
  id: string;
  name: string;
  age: number;
  description_pt: string;
  prompt_base_en: string;
  cover_image_url: string | null;
}

interface Episode {
  id: string;
  title: string;
  script: string | null;
  format: string;
  order: number;
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

  const [character, setCharacter] = useState<Character | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [shotsByEp, setShotsByEp] = useState<Record<string, Shot[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New episode
  const [newEpTitle, setNewEpTitle] = useState("");
  const [creatingEp, setCreatingEp] = useState(false);

  // Script editing per episode
  const [scriptDrafts, setScriptDrafts] = useState<Record<string, string>>({});
  const [savingScript, setSavingScript] = useState<string | null>(null);

  async function saveScript(epId: string) {
    setSavingScript(epId);
    try {
      const res = await fetch(`/api/episodes/${epId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: scriptDrafts[epId] || "" }),
      });
      if (res.ok) {
        const updated = await res.json();
        setEpisodes((prev) =>
          prev.map((e) => (e.id === epId ? { ...e, script: updated.script } : e))
        );
      }
    } finally {
      setSavingScript(null);
    }
  }

  // New shot (per episode)
  const [activeEpForm, setActiveEpForm] = useState<string | null>(null);
  const [sceneInput, setSceneInput] = useState("");
  const [composedPrompt, setComposedPrompt] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [creatingShot, setCreatingShot] = useState(false);

  // Generate & preview
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [previewShot, setPreviewShot] = useState<Shot | null>(null);

  // Regen
  const [regenShot, setRegenShot] = useState<Shot | null>(null);
  const [regenExtra, setRegenExtra] = useState("");

  // Collapsed episodes
  const [collapsedEps, setCollapsedEps] = useState<Set<string>>(new Set());

  // Edit character
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingChar, setSavingChar] = useState(false);

  function startEditing() {
    if (!character) return;
    setEditName(character.name);
    setEditAge(String(character.age));
    setEditDesc(character.description_pt);
    setEditing(true);
  }

  async function saveCharacter() {
    if (!character) return;
    setSavingChar(true);
    setError(null);

    try {
      const res = await fetch(`/api/characters/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          age: parseInt(editAge),
          description_pt: editDesc.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao salvar");
      }

      const updated = await res.json();
      setCharacter(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSavingChar(false);
    }
  }

  function toggleCollapse(epId: string) {
    setCollapsedEps((prev) => {
      const next = new Set(prev);
      if (next.has(epId)) next.delete(epId);
      else next.add(epId);
      return next;
    });
  }

  const loadData = useCallback(async () => {
    try {
      const [charRes, epsRes] = await Promise.all([
        fetch(`/api/characters/${id}`),
        fetch(`/api/characters/${id}/episodes`),
      ]);

      if (charRes.ok) setCharacter(await charRes.json());

      if (epsRes.ok) {
        const epList: Episode[] = await epsRes.json();
        setEpisodes(epList);

        // Init script drafts
        const drafts: Record<string, string> = {};
        epList.forEach((ep) => {
          drafts[ep.id] = ep.script || "";
        });
        setScriptDrafts((prev) => ({ ...drafts, ...prev }));

        // Load shots for each episode
        const shotsMap: Record<string, Shot[]> = {};
        await Promise.all(
          epList.map(async (ep) => {
            const res = await fetch(
              `/api/characters/${id}/episodes/${ep.id}/shots`
            );
            if (res.ok) shotsMap[ep.id] = await res.json();
          })
        );
        setShotsByEp(shotsMap);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Stats ---
  const allShots = Object.values(shotsByEp).flat();
  const approvedCount = allShots.filter((s) => s.status === "approved").length;
  const totalShots = allShots.length;

  // --- Create episode ---
  async function handleCreateEpisode() {
    if (!newEpTitle.trim()) return;
    setCreatingEp(true);
    setError(null);

    try {
      const res = await fetch(`/api/characters/${id}/episodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newEpTitle.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao criar episodio");
      }

      const ep = await res.json();
      setEpisodes((prev) => [...prev, ep]);
      setShotsByEp((prev) => ({ ...prev, [ep.id]: [] }));
      setNewEpTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setCreatingEp(false);
    }
  }

  // Delete episode triggers confirmation
  function handleDeleteEpisode(epId: string, title: string) {
    setDeleteTarget({ type: "episode", epId, title });
  }

  // --- Open shot form for episode ---
  function openShotForm(epId: string) {
    setActiveEpForm(epId);
    setSceneInput(character ? `${character.name} esta ` : "");
    setComposedPrompt(null);
  }

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
    if (!composedPrompt || !sceneInput.trim() || !activeEpForm) return;
    setCreatingShot(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/characters/${id}/episodes/${activeEpForm}/shots`,
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
      setShotsByEp((prev) => ({
        ...prev,
        [activeEpForm]: [...(prev[activeEpForm] || []), newShot],
      }));

      setSceneInput(character ? `${character.name} esta ` : "");
      setComposedPrompt(null);
      setActiveEpForm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setCreatingShot(false);
    }
  }

  // --- Generate image ---
  async function handleGenerate(shot: Shot, extraPrompt?: string) {
    setGeneratingId(shot.id);
    setRegenShot(null);
    setRegenExtra("");
    setError(null);

    try {
      let prompt = shot.prompt_full || shot.prompt_scene;
      if (extraPrompt?.trim()) {
        const translateRes = await fetch(
          `/api/characters/${id}/compose-prompt`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt_scene: extraPrompt.trim() }),
          }
        );
        if (translateRes.ok) {
          const data = await translateRes.json();
          prompt = data.prompt_full;
        }
      }

      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId: shot.id,
          prompt,
          aspectRatio: "9:16",
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
  async function handleApprove(shot: Shot) {
    const res = await fetch(
      `/api/characters/${id}/episodes/${shot.episode_id}/shots/${shot.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      }
    );
    if (res.ok) {
      setShotsByEp((prev) => ({
        ...prev,
        [shot.episode_id]: (prev[shot.episode_id] || []).map((s) =>
          s.id === shot.id ? { ...s, status: "approved" } : s
        ),
      }));
      if (previewShot?.id === shot.id) {
        setPreviewShot({ ...previewShot, status: "approved" });
      }
    }
  }

  // --- Delete shot (with confirmation) ---
  const [deleteTarget, setDeleteTarget] = useState<{ type: "shot"; shot: Shot } | { type: "episode"; epId: string; title: string } | null>(null);

  async function confirmDelete() {
    if (!deleteTarget) return;

    if (deleteTarget.type === "shot") {
      const shot = deleteTarget.shot;
      const res = await fetch(
        `/api/characters/${id}/episodes/${shot.episode_id}/shots/${shot.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setShotsByEp((prev) => ({
          ...prev,
          [shot.episode_id]: (prev[shot.episode_id] || []).filter(
            (s) => s.id !== shot.id
          ),
        }));
        if (previewShot?.id === shot.id) setPreviewShot(null);
      }
    } else {
      const res = await fetch(`/api/episodes/${deleteTarget.epId}`, { method: "DELETE" });
      if (res.ok) {
        setEpisodes((prev) => prev.filter((e) => e.id !== deleteTarget.epId));
        setShotsByEp((prev) => {
          const updated = { ...prev };
          delete updated[deleteTarget.epId];
          return updated;
        });
      }
    }

    setDeleteTarget(null);
  }

  // --- Download ---
  async function handleDownload(shot: Shot, format: "original" | "landscape" = "original") {
    if (!shot.image_url) return;
    try {
      const res = await fetch(shot.image_url);
      const blob = await res.blob();

      if (format === "landscape") {
        // Convert to 16:9 using canvas
        const img = new Image();
        const imgUrl = URL.createObjectURL(blob);
        img.src = imgUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        URL.revokeObjectURL(imgUrl);

        const canvas = document.createElement("canvas");
        const targetW = Math.max(img.width, Math.round(img.height * (16 / 9)));
        const targetH = Math.round(targetW * (9 / 16));
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, targetW, targetH);
        const x = Math.round((targetW - img.width) / 2);
        const y = Math.round((targetH - img.height) / 2);
        ctx.drawImage(img, x, y);

        canvas.toBlob((b) => {
          if (!b) return;
          const url = URL.createObjectURL(b);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${character?.name || "shot"}-${shot.id.slice(0, 8)}-16x9.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, "image/png");
      } else {
        // Download original - open in new tab as fallback
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${character?.name || "shot"}-${shot.id.slice(0, 8)}-9x16.png`;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      }
    } catch {
      setError("Erro ao baixar imagem");
    }
  }

  if (loading) {
    return <p className="text-muted p-8">Carregando...</p>;
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Left Sidebar — Character Info */}
      <div className="w-64 shrink-0 space-y-6">
        {/* Character card */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex flex-col items-center text-center">
            {character?.cover_image_url ? (
              <img
                src={character.cover_image_url}
                alt={character.name}
                className="w-24 h-24 rounded-full object-cover border-2 border-accent/30 mb-3"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-accent/10 border-2 border-accent/30 flex items-center justify-center text-accent text-3xl font-bold mb-3">
                {character?.name?.charAt(0) || "?"}
              </div>
            )}

            {editing ? (
              <div className="w-full space-y-2 mt-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome"
                  className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:border-accent transition"
                />
                <input
                  type="number"
                  value={editAge}
                  onChange={(e) => setEditAge(e.target.value)}
                  placeholder="Idade"
                  min={1}
                  max={120}
                  className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:border-accent transition"
                />
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Descricao fisica"
                  rows={3}
                  className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-accent transition resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveCharacter}
                    disabled={savingChar || !editName.trim()}
                    className="flex-1 text-xs bg-accent text-black font-semibold py-1.5 rounded-lg hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                  >
                    {savingChar ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 text-xs text-muted hover:text-foreground py-1.5 rounded-lg border border-border transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold">{character?.name}</h2>
                <p className="text-muted text-sm">{character?.age} anos</p>
                <p className="text-muted text-xs mt-3 line-clamp-4">
                  {character?.description_pt}
                </p>
                <button
                  onClick={startEditing}
                  className="text-xs text-muted hover:text-accent transition mt-3 cursor-pointer"
                >
                  Editar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Episodios</span>
            <span className="text-sm font-semibold">{episodes.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Shots criados</span>
            <span className="text-sm font-semibold">{totalShots}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Aprovados</span>
            <span className="text-sm font-semibold text-green-400">
              {approvedCount}
            </span>
          </div>
        </div>

        {/* Create episode */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Novo Episodio</h3>
          <input
            type="text"
            value={newEpTitle}
            onChange={(e) => setNewEpTitle(e.target.value)}
            placeholder="Titulo do episodio"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent transition mb-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateEpisode();
            }}
          />
          <Button
            onClick={handleCreateEpisode}
            disabled={!newEpTitle.trim() || creatingEp}
            size="sm"
            className="w-full"
          >
            {creatingEp ? "Criando..." : "+ Criar Episodio"}
          </Button>
        </div>

        {/* Back */}
        <a
          href="/"
          className="block text-center text-muted hover:text-foreground text-sm transition"
        >
          Voltar aos personagens
        </a>
      </div>

      {/* Main — Episodes + Shots */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-300 hover:text-red-100 ml-3">
              ✕
            </button>
          </div>
        )}

        {episodes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted">
            <span className="text-5xl mb-4">🎬</span>
            <span className="text-lg">Crie seu primeiro episodio</span>
            <span className="text-sm mt-1">Use o painel a esquerda</span>
          </div>
        )}

        {episodes.map((ep, epIndex) => {
          const epShots = shotsByEp[ep.id] || [];

          return (
            <div
              key={ep.id}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              {/* Episode header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <button
                  onClick={() => toggleCollapse(ep.id)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <span
                    className={`text-muted text-xs transition-transform ${collapsedEps.has(ep.id) ? "" : "rotate-90"}`}
                  >
                    ▶
                  </span>
                  <span className="text-accent font-mono text-sm font-bold">
                    EP {String(epIndex + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-semibold">{ep.title}</h3>
                  <span className="text-xs text-muted">
                    {epShots.length} shot{epShots.length !== 1 ? "s" : ""}
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  {!collapsedEps.has(ep.id) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        activeEpForm === ep.id
                          ? setActiveEpForm(null)
                          : openShotForm(ep.id)
                      }
                    >
                      {activeEpForm === ep.id ? "Cancelar" : "+ Shot"}
                    </Button>
                  )}
                  <button
                    onClick={() => handleDeleteEpisode(ep.id, ep.title)}
                    className="text-muted hover:text-red-400 transition text-sm cursor-pointer px-1"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Collapsible content */}
              {!collapsedEps.has(ep.id) && <>
              {/* Script slot */}
              <div className="px-5 py-4 border-b border-border bg-background/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted uppercase tracking-wide">
                    Roteiro
                  </span>
                  {scriptDrafts[ep.id] !== (ep.script || "") && (
                    <button
                      onClick={() => saveScript(ep.id)}
                      disabled={savingScript === ep.id}
                      className="text-xs text-accent hover:text-accent/80 transition cursor-pointer font-medium"
                    >
                      {savingScript === ep.id ? "Salvando..." : "Salvar"}
                    </button>
                  )}
                </div>
                <textarea
                  value={scriptDrafts[ep.id] ?? ""}
                  onChange={(e) =>
                    setScriptDrafts((prev) => ({
                      ...prev,
                      [ep.id]: e.target.value,
                    }))
                  }
                  placeholder="Escreva o roteiro deste episodio... Descreva a narrativa, cenas e acoes que vao guiar os shots."
                  rows={3}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent transition resize-y font-mono leading-relaxed"
                />
              </div>

              {/* New shot form (inline) */}
              {activeEpForm === ep.id && (
                <div className="px-5 py-4 border-b border-border bg-background/50">
                  <div className="space-y-3">
                    <textarea
                      value={sceneInput}
                      onChange={(e) => {
                        setSceneInput(e.target.value);
                        setComposedPrompt(null);
                      }}
                      placeholder={`${character?.name || "Personagem"} esta sentado na cadeira, close up, olhar cansado...`}
                      rows={2}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent transition"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCompose}
                        disabled={!sceneInput.trim() || composing}
                        variant="secondary"
                        size="sm"
                      >
                        {composing ? "Compondo..." : "Preview"}
                      </Button>
                      {composedPrompt && (
                        <Button
                          onClick={handleCreateShot}
                          disabled={creatingShot}
                          size="sm"
                        >
                          {creatingShot ? "Criando..." : "Criar Shot"}
                        </Button>
                      )}
                    </div>
                    {composedPrompt && (
                      <div className="bg-background border border-border rounded-lg p-3 text-xs text-foreground/60 max-h-24 overflow-y-auto font-mono">
                        {composedPrompt}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Shots grid */}
              <div className="p-4">
                {epShots.length === 0 && activeEpForm !== ep.id && (
                  <p className="text-muted text-sm text-center py-6">
                    Nenhum shot neste episodio
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {epShots.map((shot) => {
                    const isGenerating = generatingId === shot.id;

                    return (
                      <div
                        key={shot.id}
                        className="bg-background border border-border rounded-xl overflow-hidden group"
                      >
                        {/* Image */}
                        <div className="relative">
                          {shot.image_url ? (
                            <button
                              type="button"
                              onClick={() => !isGenerating && setPreviewShot(shot)}
                              className="cursor-pointer w-full"
                            >
                              <img
                                src={shot.image_url}
                                alt={shot.prompt_scene}
                                className={`w-full aspect-[9/16] object-cover transition ${isGenerating ? "opacity-40" : ""}`}
                              />
                            </button>
                          ) : (
                            <div className="w-full aspect-[9/16] flex items-center justify-center text-muted bg-card">
                              {isGenerating ? null : (
                                <span className="text-sm">Sem imagem</span>
                              )}
                            </div>
                          )}
                          {isGenerating && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-t-xl">
                              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                              <span className="text-xs text-white mt-2">Gerando...</span>
                            </div>
                          )}
                        </div>

                        {/* Info + actions */}
                        <div className="p-3">
                          <p className="text-xs line-clamp-2 text-foreground/80 mb-2">
                            {shot.prompt_scene}
                          </p>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <div
                                className={`w-2 h-2 rounded-full ${statusDotColors[shot.status]}`}
                              />
                              <span className="text-[11px] text-muted">
                                {statusLabels[shot.status]}
                              </span>
                            </div>
                            <button
                              onClick={() => setDeleteTarget({ type: "shot", shot })}
                              className="text-muted hover:text-red-400 text-xs cursor-pointer opacity-0 group-hover:opacity-100 transition"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="flex gap-1.5">
                            {shot.status === "pending" && (
                              <button
                                onClick={() => handleGenerate(shot)}
                                disabled={isGenerating}
                                className="flex-1 text-[11px] bg-accent text-black font-semibold py-1.5 rounded-md hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                              >
                                {isGenerating ? "..." : "Gerar"}
                              </button>
                            )}
                            {shot.status === "generated" && (
                              <>
                                <button
                                  onClick={() => {
                                    setRegenShot(shot);
                                    setRegenExtra(shot.prompt_scene);
                                  }}
                                  className="flex-1 text-[11px] bg-accent text-black font-semibold py-1.5 rounded-md hover:opacity-90 transition cursor-pointer"
                                >
                                  Regerar
                                </button>
                                <button
                                  onClick={() => handleApprove(shot)}
                                  className="flex-1 text-[11px] bg-green-600 text-white font-semibold py-1.5 rounded-md hover:bg-green-700 transition cursor-pointer"
                                >
                                  Aprovar
                                </button>
                              </>
                            )}
                            {shot.status === "approved" && shot.image_url && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDownload(shot, "original"); }}
                                  className="flex-1 text-[11px] bg-accent text-black font-semibold py-1.5 rounded-md hover:opacity-90 transition cursor-pointer"
                                >
                                  Download 9:16
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDownload(shot, "landscape"); }}
                                  className="flex-1 text-[11px] bg-card border border-border font-medium py-1.5 rounded-md hover:bg-card-hover transition cursor-pointer"
                                >
                                  Download 16:9
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              </>}
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-3">
                Excluir {deleteTarget.type === "shot" ? "shot" : "episodio"}?
              </h2>
              <p className="text-muted text-sm mb-6">
                {deleteTarget.type === "shot" ? (
                  <>
                    O shot{" "}
                    <strong className="text-foreground">
                      &quot;{deleteTarget.shot.prompt_scene.slice(0, 50)}
                      {deleteTarget.shot.prompt_scene.length > 50 ? "..." : ""}
                      &quot;
                    </strong>{" "}
                    {deleteTarget.shot.image_url
                      ? "e sua imagem serao removidos."
                      : "sera removido."}{" "}
                    Esta acao nao pode ser desfeita.
                  </>
                ) : (
                  <>
                    O episodio{" "}
                    <strong className="text-foreground">
                      &quot;{deleteTarget.title}&quot;
                    </strong>{" "}
                    e todos os seus shots serao removidos. Esta acao nao pode
                    ser desfeita.
                  </>
                )}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 text-sm text-muted hover:text-foreground transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="bg-red-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-red-700 transition cursor-pointer text-sm"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Regen Modal */}
      {regenShot && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setRegenShot(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl max-w-lg w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-lg font-semibold">Regerar shot</h2>
                <button
                  onClick={() => setRegenShot(null)}
                  className="text-muted hover:text-foreground text-xl cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>
              <p className="text-muted text-sm mb-4">
                Edite ou complemente a descricao para ajustar a geracao.
              </p>
              <textarea
                value={regenExtra}
                onChange={(e) => setRegenExtra(e.target.value)}
                rows={4}
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent transition mb-4"
                placeholder={`${character?.name || "Personagem"} esta ...`}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => handleGenerate(regenShot, regenExtra)}
                  disabled={generatingId === regenShot.id}
                  className="bg-accent text-black font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50 cursor-pointer text-sm"
                >
                  {generatingId === regenShot.id ? "Gerando..." : "Regerar"}
                </button>
                <button
                  onClick={() => setRegenShot(null)}
                  className="text-muted hover:text-foreground text-sm px-3 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal — vertical layout */}
      {previewShot && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewShot(null)}
        >
          <div
            className="flex gap-6 max-h-[90vh] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image — vertical */}
            {previewShot.image_url && (
              <div className="shrink-0">
                <img
                  src={previewShot.image_url}
                  alt={previewShot.prompt_scene}
                  className="h-[80vh] w-auto rounded-2xl object-cover shadow-2xl"
                />
              </div>
            )}

            {/* Info panel */}
            <div className="bg-card border border-border rounded-2xl w-80 shrink-0 flex flex-col max-h-[80vh] overflow-y-auto">
              <div className="p-5 flex-1">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${statusDotColors[previewShot.status]}`}
                    />
                    <span className="text-sm text-muted">
                      {statusLabels[previewShot.status]}
                    </span>
                  </div>
                  <button
                    onClick={() => setPreviewShot(null)}
                    className="text-muted hover:text-foreground text-xl cursor-pointer p-1"
                  >
                    ✕
                  </button>
                </div>

                {/* Scene */}
                <h2 className="text-base font-semibold mb-4">
                  {previewShot.prompt_scene}
                </h2>

                {/* Prompt */}
                <div className="bg-background rounded-lg p-3 mb-4">
                  <p className="text-[10px] text-muted mb-1 font-medium uppercase tracking-wide">
                    Prompt
                  </p>
                  <p className="text-[11px] text-foreground/50 font-mono leading-relaxed">
                    {previewShot.prompt_full}
                  </p>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  {previewShot.status === "generated" && (
                    <>
                      <button
                        onClick={() => handleApprove(previewShot)}
                        className="w-full bg-green-600 text-white font-semibold px-4 py-2.5 rounded-lg hover:bg-green-700 transition cursor-pointer text-sm"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => {
                          setPreviewShot(null);
                          setRegenShot(previewShot);
                          setRegenExtra(previewShot.prompt_scene);
                        }}
                        className="w-full bg-accent text-black font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition cursor-pointer text-sm"
                      >
                        Regerar
                      </button>
                    </>
                  )}
                  {previewShot.status === "approved" &&
                    previewShot.image_url && (
                      <>
                        <button
                          onClick={() => handleDownload(previewShot, "original")}
                          className="w-full bg-accent text-black font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition cursor-pointer text-sm"
                        >
                          Download 9:16
                        </button>
                        <button
                          onClick={() => handleDownload(previewShot, "landscape")}
                          className="w-full bg-card border border-border text-foreground font-medium px-4 py-2.5 rounded-lg hover:bg-card-hover transition cursor-pointer text-sm"
                        >
                          Download 16:9
                        </button>
                      </>
                    )}
                  <button
                    onClick={() =>
                      setDeleteTarget({ type: "shot", shot: previewShot })
                    }
                    className="w-full text-muted hover:text-red-400 text-sm py-2 transition cursor-pointer"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
