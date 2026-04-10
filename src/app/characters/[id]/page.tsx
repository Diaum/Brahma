"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import JSZip from "jszip";
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
  cover_image_url: string | null;
}

interface Shot {
  id: string;
  prompt_scene: string;
  prompt_full: string;
  status: string;
  image_url: string | null;
  video_url: string | null;
  video_operation: string | null;
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

  // Selected episode (when null, shows episode list; when set, shows shots)
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);

  // Load shots only when an episode is selected (lazy)
  useEffect(() => {
    if (!selectedEpisodeId) return;
    if (shotsByEp[selectedEpisodeId]) return; // already loaded

    fetch(`/api/characters/${id}/episodes/${selectedEpisodeId}/shots`)
      .then((res) => res.ok ? res.json() : [])
      .then((shots) => {
        setShotsByEp((prev) => ({ ...prev, [selectedEpisodeId]: shots }));
      });
  }, [selectedEpisodeId, id]);

  // New episode
  const [newEpTitle, setNewEpTitle] = useState("");
  const [creatingEp, setCreatingEp] = useState(false);

  // Editing episode title
  const [editingEpId, setEditingEpId] = useState<string | null>(null);
  const [editingEpTitle, setEditingEpTitle] = useState("");

  function startEditEpTitle(ep: Episode) {
    setEditingEpId(ep.id);
    setEditingEpTitle(ep.title);
  }

  async function saveEpTitle(epId: string) {
    if (!editingEpTitle.trim()) {
      setEditingEpId(null);
      return;
    }
    const res = await fetch(`/api/episodes/${epId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editingEpTitle.trim() }),
    });
    if (res.ok) {
      setEpisodes((prev) =>
        prev.map((e) =>
          e.id === epId ? { ...e, title: editingEpTitle.trim() } : e
        )
      );
    }
    setEditingEpId(null);
  }

  // Set as cover
  async function handleSetCover(shot: Shot) {
    const res = await fetch(`/api/episodes/${shot.episode_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cover_image_url: shot.image_url }),
    });
    if (res.ok) {
      setEpisodes((prev) =>
        prev.map((e) =>
          e.id === shot.episode_id
            ? { ...e, cover_image_url: shot.image_url }
            : e
        )
      );
    }
  }

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

  // Script generator
  interface GeneratedScene {
    narration: string;
    description: string;
    image_prompt: string;
  }
  const [scriptGenEp, setScriptGenEp] = useState<string | null>(null);
  const [scriptTheme, setScriptTheme] = useState("");
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatedScenes, setGeneratedScenes] = useState<GeneratedScene[]>([]);
  const [reviewingScript, setReviewingScript] = useState(false);
  const [creatingShotsFromScript, setCreatingShotsFromScript] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  function openScriptGenerator(epId: string) {
    setScriptGenEp(epId);
    setScriptTheme("");
    setGeneratedScenes([]);
    setReviewingScript(false);
  }

  async function handleGenerateScript() {
    if (!scriptGenEp || !scriptTheme.trim()) return;
    setGeneratingScript(true);
    setError(null);

    const epIndex = episodes.findIndex((e) => e.id === scriptGenEp);
    const epNumber = epIndex + 1;

    try {
      const res = await fetch(
        `/api/characters/${id}/episodes/${scriptGenEp}/generate-script`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            theme: scriptTheme.trim(),
            episode_number: epNumber,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao gerar roteiro");
      }

      const data = await res.json();
      setGeneratedScenes(data.scenes);
      setReviewingScript(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setGeneratingScript(false);
    }
  }

  function updateScene(index: number, field: keyof GeneratedScene, value: string) {
    setGeneratedScenes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function removeScene(index: number) {
    setGeneratedScenes((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleApproveScript() {
    if (!scriptGenEp || generatedScenes.length === 0) return;
    setCreatingShotsFromScript(true);
    setError(null);

    try {
      const existingShots = shotsByEp[scriptGenEp] || [];
      const startOrder = existingShots.length > 0
        ? Math.max(...existingShots.map((s) => s.order)) + 1
        : 0;

      for (let i = 0; i < generatedScenes.length; i++) {
        const scene = generatedScenes[i];
        await fetch(
          `/api/characters/${id}/episodes/${scriptGenEp}/shots`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt_scene: `${scene.narration}\n\n${scene.description}`,
              prompt_full: scene.image_prompt,
              order: startOrder + i,
            }),
          }
        );
      }

      // Also save the full script text to the episode
      const fullScript = generatedScenes
        .map(
          (s, i) =>
            `[CENA ${i + 1}]\n\n🎧 Narração:\n${s.narration}\n\n🎥 Descrição:\n${s.description}\n\n🧾 Prompt:\n${s.image_prompt}`
        )
        .join("\n\n---\n\n");

      await fetch(`/api/episodes/${scriptGenEp}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: fullScript }),
      });

      setScriptGenEp(null);
      setGeneratedScenes([]);
      setReviewingScript(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setCreatingShotsFromScript(false);
    }
  }

  async function handleBatchGenerate(epId: string) {
    const epShots = shotsByEp[epId] || [];
    const pending = epShots.filter(
      (s) => s.status === "pending" && !s.image_url
    );
    if (pending.length === 0) return;

    setBatchGenerating(true);
    setBatchProgress({ current: 0, total: pending.length });
    setError(null);

    for (let i = 0; i < pending.length; i++) {
      setBatchProgress({ current: i + 1, total: pending.length });
      try {
        await fetch("/api/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shotId: pending[i].id,
            prompt: pending[i].prompt_full || pending[i].prompt_scene,
            aspectRatio: "16:9",
          }),
        });
      } catch {
        // Continue with next shot
      }
    }

    setBatchGenerating(false);
    setBatchProgress({ current: 0, total: 0 });
    await loadData();
  }

  // Helper: get episode number (1-indexed)
  function getEpisodeNumber(epId: string): number {
    return episodes.findIndex((e) => e.id === epId) + 1;
  }

  // Helper: add cache-buster to URL
  function withCacheBuster(url: string | null): string {
    if (!url) return "";
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}t=${Date.now()}`;
  }

  // Download all assets as ZIP
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

  async function downloadAllAssets() {
    if (!character) return;
    setDownloadingAll(true);
    setError(null);

    try {
      const allShots = Object.values(shotsByEp).flat();
      const assetsToDownload: Array<{ url: string; path: string }> = [];

      // Cover image
      if (character.cover_image_url) {
        const charSlug = (character.name || "personagem")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        assetsToDownload.push({
          url: character.cover_image_url,
          path: `${charSlug}/cover.png`,
        });
      }

      // Episode covers
      for (const ep of episodes) {
        if (ep.cover_image_url) {
          const epIdx = episodes.findIndex((e) => e.id === ep.id);
          assetsToDownload.push({
            url: ep.cover_image_url,
            path: `episodios/ep${String(epIdx + 1).padStart(2, "0")}-capa.png`,
          });
        }
      }

      // All shots: image + video
      for (const shot of allShots) {
        if (shot.image_url) {
          assetsToDownload.push({
            url: shot.image_url,
            path: buildAssetPath(shot, "png"),
          });
        }
        if (shot.video_url) {
          assetsToDownload.push({
            url: shot.video_url,
            path: buildAssetPath(shot, "mp4"),
          });
        }
      }

      if (assetsToDownload.length === 0) {
        setError("Nenhum asset para baixar");
        setDownloadingAll(false);
        return;
      }

      setDownloadProgress({ current: 0, total: assetsToDownload.length });

      const zip = new JSZip();
      let i = 0;
      for (const asset of assetsToDownload) {
        try {
          const res = await fetch(asset.url);
          if (res.ok) {
            const blob = await res.blob();
            zip.file(asset.path, blob);
          }
        } catch {
          // Skip failed downloads
        }
        i++;
        setDownloadProgress({ current: i, total: assetsToDownload.length });
      }

      const content = await zip.generateAsync({ type: "blob" });
      const charSlug = (character.name || "personagem")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-");
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${charSlug}.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao baixar");
    } finally {
      setDownloadingAll(false);
      setDownloadProgress({ current: 0, total: 0 });
    }
  }

  // Helper: build asset path inside the ZIP
  function buildAssetPath(shot: Shot, ext: string): string {
    const epIdx = episodes.findIndex((e) => e.id === shot.episode_id);
    const epShots = (shotsByEp[shot.episode_id] || []).sort(
      (a, b) => a.order - b.order
    );
    const shotIdx = epShots.findIndex((s) => s.id === shot.id);
    const epNum = String(epIdx + 1).padStart(2, "0");
    const shotNum = String(shotIdx + 1).padStart(2, "0");
    const folder = ext === "mp4" ? "videos" : "imagens";
    return `episodios/ep${epNum}/${folder}/shot${shotNum}.${ext}`;
  }

  // Helper: build a clean filename for downloads
  function buildFileName(shot: Shot, ext: string): string {
    const charName = (character?.name || "personagem")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "");
    const epNum = String(getEpisodeNumber(shot.episode_id)).padStart(2, "0");
    const epShots = (shotsByEp[shot.episode_id] || []).sort(
      (a, b) => a.order - b.order
    );
    const shotIdx = epShots.findIndex((s) => s.id === shot.id);
    const shotNum = String(shotIdx + 1).padStart(2, "0");
    return `${charName}-ep${epNum}-shot${shotNum}.${ext}`;
  }

  // Download script (narration + description only)
  const [copied, setCopied] = useState(false);

  function copyNarration(ep: Episode) {
    const epShots = (shotsByEp[ep.id] || []).sort((a, b) => a.order - b.order);
    if (epShots.length === 0) return;

    const lines = epShots.map((shot) => {
      const narration = shot.prompt_scene.split("\n\n")[0] || shot.prompt_scene;
      return narration;
    });

    const text = lines.join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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

  const [shotsSummary, setShotsSummary] = useState<Record<string, { total: number; approved: number }>>({});

  const loadData = useCallback(async () => {
    try {
      const [charRes, epsRes, summaryRes] = await Promise.all([
        fetch(`/api/characters/${id}`),
        fetch(`/api/characters/${id}/episodes`),
        fetch(`/api/characters/${id}/shots-summary`),
      ]);

      if (charRes.ok) setCharacter(await charRes.json());

      if (summaryRes.ok) {
        setShotsSummary(await summaryRes.json());
      }

      if (epsRes.ok) {
        const epList: Episode[] = await epsRes.json();
        setEpisodes(epList);

        // Init script drafts
        const drafts: Record<string, string> = {};
        epList.forEach((ep) => {
          drafts[ep.id] = ep.script || "";
        });
        setScriptDrafts((prev) => ({ ...drafts, ...prev }));
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Stats (from summary, not full shots) ---
  const totalShots = Object.values(shotsSummary).reduce((sum, s) => sum + s.total, 0);
  const approvedCount = Object.values(shotsSummary).reduce((sum, s) => sum + s.approved, 0);

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
      const epNumber = activeEpForm ? getEpisodeNumber(activeEpForm) : 1;
      const res = await fetch(`/api/characters/${id}/compose-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt_scene: sceneInput.trim(), episode_number: epNumber }),
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
      const currentShots = shotsByEp[activeEpForm] || [];
      const nextOrder = currentShots.length > 0
        ? Math.max(...currentShots.map((s) => s.order)) + 1
        : 0;

      const res = await fetch(
        `/api/characters/${id}/episodes/${activeEpForm}/shots`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt_scene: sceneInput.trim(),
            prompt_full: composedPrompt,
            order: nextOrder,
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

      // Always use the extraPrompt when provided (regen flow)
      if (extraPrompt !== undefined && extraPrompt.trim()) {
        const epNumber = getEpisodeNumber(shot.episode_id);
        const translateRes = await fetch(
          `/api/characters/${id}/compose-prompt`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt_scene: extraPrompt.trim(), episode_number: epNumber }),
          }
        );
        if (translateRes.ok) {
          const data = await translateRes.json();
          prompt = data.prompt_full;

          // Also update the shot's prompt in the database
          await fetch(
            `/api/characters/${id}/episodes/${shot.episode_id}/shots/${shot.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt_scene: extraPrompt.trim(),
                prompt_full: data.prompt_full,
              }),
            }
          );
        }
      }

      console.log("[regen] Using prompt:", prompt.slice(0, 200));

      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId: shot.id,
          prompt,
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

  // --- Animate shot (Veo / PixVerse) ---
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [animatingOp, setAnimatingOp] = useState<string | null>(null);
  const [animDuration, setAnimDuration] = useState<number>(4);
  const [animPromptDraft, setAnimPromptDraft] = useState<string>("");
  const [animProvider, setAnimProvider] = useState<"veo" | "pixverse">("veo");
  const [animUseRawPrompt, setAnimUseRawPrompt] = useState(false);
  const [showRegenVideoPanel, setShowRegenVideoPanel] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  function openAnimatePrompt(shot: Shot) {
    // Default to a clean minimal animation prompt
    setAnimPromptDraft(
      "Animar levemente a imagem com leve movimento de camera (push-in lento ou pan suave). Personagem com micro-movimentos naturais como respiração e piscar."
    );
  }

  async function handleAnimate(shot: Shot, customPrompt?: string) {
    if (!shot.image_url) return;
    setAnimatingId(shot.id);
    setError(null);

    try {
      const res = await fetch("/api/animate-shot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shotId: shot.id,
          prompt: customPrompt || shot.prompt_full || shot.prompt_scene,
          duration: animDuration,
          provider: animProvider,
          useRawPrompt: animUseRawPrompt,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao iniciar animacao");
      }

      const data = await res.json();
      setAnimatingOp(data.operationName);

      // Start polling
      pollAnimation(shot.id, data.operationName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setAnimatingId(null);
    }
  }

  function pollAnimation(shotId: string, opName: string) {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/animate-shot?shotId=${shotId}&operation=${encodeURIComponent(opName)}`
        );
        const data = await res.json();

        if (data.done) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setAnimatingId(null);
          setAnimatingOp(null);

          if (data.video_url) {
            // Append cache buster to bypass browser/CDN cache
            const freshUrl = `${data.video_url}?t=${Date.now()}`;
            // Update shot in local state
            setShotsByEp((prev) => {
              const updated = { ...prev };
              for (const epId in updated) {
                updated[epId] = updated[epId].map((s) =>
                  s.id === shotId
                    ? { ...s, video_url: freshUrl, video_operation: null, status: "animated" }
                    : s
                );
              }
              return updated;
            });
            // Also update previewShot if it's the same one
            setPreviewShot((prev) =>
              prev && prev.id === shotId
                ? { ...prev, video_url: freshUrl, video_operation: null, status: "animated" }
                : prev
            );
          } else if (data.error) {
            setError(`Animacao falhou: ${data.error}`);
            // Clear video_operation in local state to prevent auto-retry
            setShotsByEp((prev) => {
              const updated = { ...prev };
              for (const epId in updated) {
                updated[epId] = updated[epId].map((s) =>
                  s.id === shotId
                    ? { ...s, video_operation: null, status: "approved" }
                    : s
                );
              }
              return updated;
            });
          }
        }
      } catch {
        // Keep polling on network errors
      }
    }, 10000); // Poll every 10s
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Resume polling for shots with pending operations on load (only once)
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    const allShots = Object.values(shotsByEp).flat();
    const pendingAnim = allShots.find((s) => s.video_operation);
    if (pendingAnim && pendingAnim.video_operation) {
      resumedRef.current = true;
      setAnimatingId(pendingAnim.id);
      pollAnimation(pendingAnim.id, pendingAnim.video_operation);
    }
  }, [shotsByEp]);

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

  // --- Download video ---
  async function handleDownloadVideo(shot: Shot) {
    if (!shot.video_url) return;
    try {
      const res = await fetch(shot.video_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildFileName(shot, "mp4");
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch {
      setError("Erro ao baixar video");
    }
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
          a.download = buildFileName(shot, "png");
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
        a.download = buildFileName(shot, "png");
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
        {/* Top bar with download all */}
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            onClick={downloadAllAssets}
            disabled={downloadingAll}
          >
            {downloadingAll
              ? `Baixando ${downloadProgress.current}/${downloadProgress.total}...`
              : "↓ Baixar tudo (.zip)"}
          </Button>
        </div>

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

        {/* Episode list view (when no ep selected) */}
        {!selectedEpisodeId && episodes.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {episodes.map((ep, epIndex) => {
              const summary = shotsSummary[ep.id] || { total: 0, approved: 0 };
              const epShotsCount = summary.total;
              const approvedCount = summary.approved;

              return (
                <button
                  key={ep.id}
                  onClick={() => setSelectedEpisodeId(ep.id)}
                  className="group relative bg-card border border-border rounded-2xl overflow-hidden hover:border-accent/50 transition cursor-pointer text-left"
                >
                  {/* Cover image */}
                  <div className="relative aspect-[9/16] bg-background">
                    {ep.cover_image_url ? (
                      <img
                        src={ep.cover_image_url}
                        alt={ep.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted">
                        <span className="text-5xl mb-2">🎬</span>
                        <span className="text-xs">Sem capa</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2.5">
                      <h3 className="font-bold text-sm text-white drop-shadow-lg mb-0.5 line-clamp-2">
                        <span className="text-accent">EP {epIndex + 1}</span>{" "}
                        {ep.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[10px] text-white/80">
                        <span>{epShotsCount} shots</span>
                        {approvedCount > 0 && (
                          <span className="text-green-400">
                            • {approvedCount}✓
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Selected episode view (filtered to one ep) */}
        {selectedEpisodeId && (
          <div className="mb-4">
            <button
              onClick={() => setSelectedEpisodeId(null)}
              className="text-muted hover:text-accent transition text-sm cursor-pointer flex items-center gap-2"
            >
              ← Voltar aos episodios
            </button>
          </div>
        )}

        {selectedEpisodeId && episodes
          .map((ep, epIndex) => ({ ep, epIndex }))
          .filter(({ ep }) => ep.id === selectedEpisodeId)
          .map(({ ep, epIndex }) => {
          const epShots = (shotsByEp[ep.id] || []).sort((a, b) => a.order - b.order);

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
                    EP {epIndex + 1}
                  </span>
                  {editingEpId === ep.id ? (
                    <input
                      type="text"
                      value={editingEpTitle}
                      onChange={(e) => setEditingEpTitle(e.target.value)}
                      onBlur={() => saveEpTitle(ep.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEpTitle(ep.id);
                        if (e.key === "Escape") setEditingEpId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="bg-background border border-accent rounded-md px-2 py-1 text-sm font-semibold focus:outline-none"
                    />
                  ) : (
                    <h3
                      className="font-semibold hover:text-accent transition"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditEpTitle(ep);
                      }}
                      title="Clique para editar"
                    >
                      {ep.title}
                    </h3>
                  )}
                  <span className="text-xs text-muted">
                    {epShots.length} shot{epShots.length !== 1 ? "s" : ""}
                  </span>
                </button>
                <div className="flex items-center gap-2">
                  {!collapsedEps.has(ep.id) && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openScriptGenerator(ep.id)}
                      >
                        Gerar Roteiro
                      </Button>
                      {(shotsByEp[ep.id] || []).length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyNarration(ep)}
                        >
                          {copied ? "Copiado!" : "Copiar Falas"}
                        </Button>
                      )}
                      {(shotsByEp[ep.id] || []).some(
                        (s) => s.status === "pending" && !s.image_url
                      ) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleBatchGenerate(ep.id)}
                          disabled={batchGenerating}
                        >
                          {batchGenerating &&
                          batchProgress.total > 0
                            ? `Gerando ${batchProgress.current}/${batchProgress.total}`
                            : "Gerar Todas"}
                        </Button>
                      )}
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
                    </>
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

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
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
                                loading="lazy"
                                decoding="async"
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
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                              {shot.image_url && (shot.status === "approved" || shot.status === "animated") && (
                                <button
                                  onClick={() => handleSetCover(shot)}
                                  className={`text-xs cursor-pointer transition ${
                                    ep.cover_image_url === shot.image_url
                                      ? "text-accent"
                                      : "text-muted hover:text-accent"
                                  }`}
                                  title={
                                    ep.cover_image_url === shot.image_url
                                      ? "Capa atual"
                                      : "Usar como capa"
                                  }
                                >
                                  {ep.cover_image_url === shot.image_url ? "★" : "☆"}
                                </button>
                              )}
                              <button
                                onClick={() => setDeleteTarget({ type: "shot", shot })}
                                className="text-muted hover:text-red-400 text-xs cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
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
                                  onClick={(e) => { e.stopPropagation(); handleAnimate(shot); }}
                                  disabled={animatingId === shot.id}
                                  className="flex-1 text-[11px] bg-accent text-black font-semibold py-1.5 rounded-md hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                                >
                                  {animatingId === shot.id ? "Animando..." : "Animar"}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDownload(shot, "original"); }}
                                  className="flex-1 text-[11px] bg-card border border-border font-medium py-1.5 rounded-md hover:bg-card-hover transition cursor-pointer"
                                >
                                  Download
                                </button>
                              </>
                            )}
                            {shot.status === "animated" && (
                              <>
                                {shot.video_url ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadVideo(shot);
                                    }}
                                    className="flex-1 text-[11px] bg-accent text-black font-semibold py-1.5 rounded-md hover:opacity-90 transition cursor-pointer"
                                  >
                                    Download Video
                                  </button>
                                ) : animatingId === shot.id ? (
                                  <span className="flex-1 text-[11px] text-muted text-center py-1.5">
                                    Animando...
                                  </span>
                                ) : (
                                  <span className="flex-1 text-[11px] text-muted text-center py-1.5">
                                    Processando...
                                  </span>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDownload(shot, "original"); }}
                                  className="flex-1 text-[11px] bg-card border border-border font-medium py-1.5 rounded-md hover:bg-card-hover transition cursor-pointer"
                                >
                                  Imagem
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

      {/* Script Generator Modal */}
      {scriptGenEp && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => !generatingScript && !creatingShotsFromScript && setScriptGenEp(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-lg font-semibold">
                  {reviewingScript ? "Revisar Roteiro" : "Gerar Roteiro"}
                </h2>
                <p className="text-sm text-muted">
                  EP {String((episodes.findIndex((e) => e.id === scriptGenEp) + 1)).padStart(2, "0")} — {episodes.find((e) => e.id === scriptGenEp)?.title}
                </p>
              </div>
              <button
                onClick={() => setScriptGenEp(null)}
                disabled={generatingScript || creatingShotsFromScript}
                className="text-muted hover:text-foreground text-xl cursor-pointer p-1 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {!reviewingScript ? (
                /* Theme input */
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Tema / Ideia do episodio
                    </label>
                    <textarea
                      value={scriptTheme}
                      onChange={(e) => setScriptTheme(e.target.value)}
                      placeholder="Ex: Vício em pornografia. Ele está no almoço de família, parece tudo normal, mas a vontade aparece e ele não consegue resistir. Vai pro banheiro e recai."
                      rows={5}
                      className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent transition"
                    />
                    <p className="text-muted text-xs mt-2">
                      Descreva a ideia geral. A IA vai gerar ~15 cenas seguindo o arco narrativo do episodio {episodes.findIndex((e) => e.id === scriptGenEp) + 1} automaticamente.
                    </p>
                  </div>

                  {generatingScript && (
                    <div className="flex items-center gap-3 text-accent">
                      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm">Gerando roteiro com IA... Isso pode levar ~30s</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Scene review */
                <div className="space-y-4">
                  <p className="text-sm text-muted mb-2">
                    {generatedScenes.length} cenas geradas. Edite, reordene ou remova antes de aprovar.
                  </p>

                  {generatedScenes.map((scene, i) => (
                    <div
                      key={i}
                      className="bg-background border border-border rounded-xl p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-accent font-mono text-xs font-bold">
                          CENA {String(i + 1).padStart(2, "0")}
                        </span>
                        <button
                          onClick={() => removeScene(i)}
                          className="text-muted hover:text-red-400 text-xs cursor-pointer"
                        >
                          Remover
                        </button>
                      </div>

                      <div>
                        <label className="text-[11px] text-muted uppercase tracking-wide block mb-1">
                          Narracao
                        </label>
                        <textarea
                          value={scene.narration}
                          onChange={(e) => updateScene(i, "narration", e.target.value)}
                          rows={2}
                          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent transition resize-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-muted uppercase tracking-wide block mb-1">
                          Descricao visual
                        </label>
                        <textarea
                          value={scene.description}
                          onChange={(e) => updateScene(i, "description", e.target.value)}
                          rows={2}
                          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent transition resize-none"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-muted uppercase tracking-wide block mb-1">
                          Prompt de imagem (EN)
                        </label>
                        <textarea
                          value={scene.image_prompt}
                          onChange={(e) => updateScene(i, "image_prompt", e.target.value)}
                          rows={3}
                          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-accent transition resize-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border shrink-0 flex gap-3">
              {!reviewingScript ? (
                <Button
                  onClick={handleGenerateScript}
                  disabled={!scriptTheme.trim() || generatingScript}
                >
                  {generatingScript ? "Gerando..." : "Gerar Roteiro"}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleApproveScript}
                    disabled={creatingShotsFromScript || generatedScenes.length === 0}
                  >
                    {creatingShotsFromScript
                      ? "Criando shots..."
                      : `Aprovar ${generatedScenes.length} cenas`}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setReviewingScript(false)}
                    disabled={creatingShotsFromScript}
                  >
                    Voltar
                  </Button>
                </>
              )}
              <button
                onClick={() => setScriptGenEp(null)}
                disabled={generatingScript || creatingShotsFromScript}
                className="text-muted hover:text-foreground text-sm px-3 cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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
            {(previewShot.video_url || previewShot.image_url) && (
              <div className="shrink-0">
                {previewShot.video_url ? (
                  <video
                    key={previewShot.video_url}
                    src={previewShot.video_url}
                    controls
                    autoPlay
                    loop
                    className="h-[80vh] w-auto rounded-2xl shadow-2xl"
                  />
                ) : (
                  <img
                    src={previewShot.image_url!}
                    alt={previewShot.prompt_scene}
                    className="h-[80vh] w-auto rounded-2xl object-cover shadow-2xl"
                  />
                )}
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
                        <div>
                          <label className="text-[11px] text-muted uppercase tracking-wide block mb-1.5">
                            Provider
                          </label>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setAnimProvider("veo")}
                              className={`flex-1 text-xs py-2 rounded-lg border transition cursor-pointer ${
                                animProvider === "veo"
                                  ? "bg-accent text-black border-accent font-semibold"
                                  : "bg-card border-border text-muted hover:text-foreground"
                              }`}
                            >
                              Veo
                            </button>
                            <button
                              onClick={() => setAnimProvider("pixverse")}
                              className={`flex-1 text-xs py-2 rounded-lg border transition cursor-pointer ${
                                animProvider === "pixverse"
                                  ? "bg-accent text-black border-accent font-semibold"
                                  : "bg-card border-border text-muted hover:text-foreground"
                              }`}
                            >
                              PixVerse
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] text-muted uppercase tracking-wide block mb-1.5">
                            Prompt da animacao
                          </label>
                          <textarea
                            value={animPromptDraft || ""}
                            onFocus={() => {
                              if (!animPromptDraft) openAnimatePrompt(previewShot);
                            }}
                            onChange={(e) => setAnimPromptDraft(e.target.value)}
                            placeholder="Como o video deve se mover... (clique para editar)"
                            rows={3}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-accent transition resize-none"
                          />
                          <p className="text-[10px] text-muted mt-1">
                            Sera enviado ao {animProvider === "veo" ? "Veo" : "PixVerse"}. Edite se a cena estiver sendo bloqueada.
                          </p>
                          <label className="flex items-center gap-2 mt-2 cursor-pointer text-[11px] text-muted">
                            <input
                              type="checkbox"
                              checked={animUseRawPrompt}
                              onChange={(e) => setAnimUseRawPrompt(e.target.checked)}
                              className="cursor-pointer"
                            />
                            Usar prompt completo (sem template)
                          </label>
                        </div>
                        <div>
                          <label className="text-[11px] text-muted uppercase tracking-wide block mb-1.5">
                            Duracao do video
                          </label>
                          <div className="flex gap-2">
                            {[4, 6, 8].map((sec) => (
                              <button
                                key={sec}
                                onClick={() => setAnimDuration(sec)}
                                className={`flex-1 text-xs py-2 rounded-lg border transition cursor-pointer ${
                                  animDuration === sec
                                    ? "bg-accent text-black border-accent font-semibold"
                                    : "bg-card border-border text-muted hover:text-foreground"
                                }`}
                              >
                                {sec}s
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAnimate(previewShot, animPromptDraft || undefined)}
                          disabled={animatingId === previewShot.id}
                          className="w-full bg-accent text-black font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50 cursor-pointer text-sm"
                        >
                          {animatingId === previewShot.id ? "Animando..." : `Animar (${animDuration}s)`}
                        </button>
                        <button
                          onClick={() => handleDownload(previewShot, "original")}
                          className="w-full bg-card border border-border text-foreground font-medium px-4 py-2.5 rounded-lg hover:bg-card-hover transition cursor-pointer text-sm"
                        >
                          Download Imagem
                        </button>
                      </>
                    )}
                  {previewShot.status === "animated" && (
                    <>
                      {previewShot.video_url && (
                        <button
                          onClick={() => handleDownloadVideo(previewShot)}
                          className="w-full bg-accent text-black font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition cursor-pointer text-sm"
                        >
                          Download Video
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(previewShot, "original")}
                        className="w-full bg-card border border-border text-foreground font-medium px-4 py-2.5 rounded-lg hover:bg-card-hover transition cursor-pointer text-sm"
                      >
                        Download Imagem
                      </button>

                      {!showRegenVideoPanel ? (
                        <button
                          onClick={() => setShowRegenVideoPanel(true)}
                          className="w-full bg-card border border-border text-muted hover:text-foreground font-medium px-4 py-2.5 rounded-lg hover:bg-card-hover transition cursor-pointer text-sm"
                        >
                          Gerar Novo Video
                        </button>
                      ) : (
                        <div className="space-y-3 border-t border-border pt-3">
                          <div>
                            <label className="text-[11px] text-muted uppercase tracking-wide block mb-1.5">
                              Provider
                            </label>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setAnimProvider("veo")}
                                className={`flex-1 text-xs py-2 rounded-lg border transition cursor-pointer ${
                                  animProvider === "veo"
                                    ? "bg-accent text-black border-accent font-semibold"
                                    : "bg-card border-border text-muted hover:text-foreground"
                                }`}
                              >
                                Veo
                              </button>
                              <button
                                onClick={() => setAnimProvider("pixverse")}
                                className={`flex-1 text-xs py-2 rounded-lg border transition cursor-pointer ${
                                  animProvider === "pixverse"
                                    ? "bg-accent text-black border-accent font-semibold"
                                    : "bg-card border-border text-muted hover:text-foreground"
                                }`}
                              >
                                PixVerse
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] text-muted uppercase tracking-wide block mb-1.5">
                              Prompt da animacao
                            </label>
                            <textarea
                              value={animPromptDraft || ""}
                              onFocus={() => {
                                if (!animPromptDraft) openAnimatePrompt(previewShot);
                              }}
                              onChange={(e) => setAnimPromptDraft(e.target.value)}
                              placeholder="Como o video deve se mover..."
                              rows={3}
                              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-accent transition resize-none"
                            />
                            <label className="flex items-center gap-2 mt-2 cursor-pointer text-[11px] text-muted">
                              <input
                                type="checkbox"
                                checked={animUseRawPrompt}
                                onChange={(e) => setAnimUseRawPrompt(e.target.checked)}
                                className="cursor-pointer"
                              />
                              Usar prompt completo (sem template)
                            </label>
                          </div>
                          <div>
                            <label className="text-[11px] text-muted uppercase tracking-wide block mb-1.5">
                              Duracao
                            </label>
                            <div className="flex gap-2">
                              {[4, 5, 6, 8].map((sec) => (
                                <button
                                  key={sec}
                                  onClick={() => setAnimDuration(sec)}
                                  className={`flex-1 text-xs py-2 rounded-lg border transition cursor-pointer ${
                                    animDuration === sec
                                      ? "bg-accent text-black border-accent font-semibold"
                                      : "bg-card border-border text-muted hover:text-foreground"
                                  }`}
                                >
                                  {sec}s
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                handleAnimate(previewShot, animPromptDraft || undefined);
                                setShowRegenVideoPanel(false);
                              }}
                              disabled={animatingId === previewShot.id}
                              className="flex-1 bg-accent text-black font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50 cursor-pointer text-sm"
                            >
                              {animatingId === previewShot.id ? "Animando..." : "Gerar"}
                            </button>
                            <button
                              onClick={() => setShowRegenVideoPanel(false)}
                              className="text-muted hover:text-foreground text-sm px-3 cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
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
