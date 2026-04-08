"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Episode {
  id: string;
  title: string;
  character_id: string;
}

interface Character {
  id: string;
  name: string;
  prompt_base_en: string;
}

type Step = "form" | "generating" | "approval";

export default function NewCharacter() {
  const router = useRouter();

  // Form state
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [descriptionPt, setDescriptionPt] = useState("");
  const [promptBaseEn, setPromptBaseEn] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState("");
  const [episodes, setEpisodes] = useState<Episode[]>([]);

  // Flow state
  const [step, setStep] = useState<Step>("form");
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Created character + generated image
  const [createdCharacter, setCreatedCharacter] = useState<Character | null>(
    null
  );
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");

  // Fetch all episodes (across all characters) for the optional link
  useEffect(() => {
    async function fetchEpisodes() {
      try {
        // Fetch all characters first, then their episodes
        const charsRes = await fetch("/api/characters");
        if (!charsRes.ok) return;
        const chars: { id: string }[] = await charsRes.json();

        const allEpisodes: Episode[] = [];
        for (const char of chars) {
          const res = await fetch(`/api/characters/${char.id}/episodes`);
          if (res.ok) {
            const eps = await res.json();
            allEpisodes.push(...eps);
          }
        }
        setEpisodes(allEpisodes);
      } catch {
        // Silently fail — episode select is optional
      }
    }
    fetchEpisodes();
  }, []);

  async function handleGeneratePrompt() {
    if (!name || !age || !descriptionPt) {
      setError("Preencha nome, idade e descricao antes de gerar o prompt.");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const res = await fetch("/api/characters/preview-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          age: parseInt(age),
          description_pt: descriptionPt,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao gerar prompt");
      }

      const data = await res.json();
      setPromptBaseEn(data.prompt_base_en);
      setShowPrompt(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload: Record<string, unknown> = {
        name,
        age: parseInt(age),
        description_pt: descriptionPt,
      };

      if (showPrompt && promptBaseEn) {
        payload.prompt_base_en = promptBaseEn;
      }

      // 1. Create the character
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao criar personagem");
      }

      const character: Character = await res.json();
      setCreatedCharacter(character);

      // 2. Link to episode if selected
      if (selectedEpisodeId) {
        await fetch(`/api/episodes/${selectedEpisodeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ character_id: character.id }),
        });
      }

      // 3. Generate character image
      setStep("generating");
      await generateCharacterImage(character);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setStep("form");
    } finally {
      setLoading(false);
    }
  }

  async function generateCharacterImage(character: Character) {
    setError("");
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: character.id,
          prompt: character.prompt_base_en,
          aspectRatio: "1:1",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao gerar imagem");
      }

      const data = await res.json();
      setGeneratedImageUrl(data.image_url);
      setStep("approval");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setStep("approval");
    }
  }

  async function handleApprove() {
    if (!createdCharacter || !generatedImageUrl) return;
    setLoading(true);
    setError("");

    try {
      await fetch(`/api/characters/${createdCharacter.id}/references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: generatedImageUrl,
          approved: true,
        }),
      });

      router.push(`/characters/${createdCharacter.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerate() {
    if (!createdCharacter) return;
    setStep("generating");
    setGeneratedImageUrl("");
    await generateCharacterImage(createdCharacter);
  }

  function handleSkip() {
    if (!createdCharacter) return;
    router.push(`/characters/${createdCharacter.id}`);
  }

  // --- Generating state ---
  if (step === "generating") {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="animate-pulse mb-6">
          <div className="w-24 h-24 bg-accent/20 rounded-full mx-auto flex items-center justify-center">
            <svg
              className="w-12 h-12 text-accent animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-2">Gerando imagem...</h2>
        <p className="text-muted">
          O Brahma esta criando a imagem do personagem usando IA. Isso pode
          levar alguns segundos.
        </p>
      </div>
    );
  }

  // --- Approval state ---
  if (step === "approval") {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Aprovar Imagem</h1>
        <p className="text-muted mb-8">
          Confira a imagem gerada para{" "}
          <strong className="text-foreground">
            {createdCharacter?.name}
          </strong>
          . Voce pode aprovar ou gerar novamente.
        </p>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {generatedImageUrl ? (
          <div className="mb-8">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <img
                src={generatedImageUrl}
                alt={`Imagem gerada de ${createdCharacter?.name}`}
                className="w-full max-w-md mx-auto block"
              />
            </div>
          </div>
        ) : (
          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6">
            Falha ao gerar imagem. Tente novamente.
          </div>
        )}

        <div className="flex gap-4">
          {generatedImageUrl && (
            <button
              onClick={handleApprove}
              disabled={loading}
              className="bg-green-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Salvando..." : "Aprovar"}
            </button>
          )}
          <button
            onClick={handleRegenerate}
            disabled={loading}
            className="bg-accent text-black font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
          >
            Gerar Novamente
          </button>
          <button
            onClick={handleSkip}
            className="px-6 py-3 rounded-lg border border-border text-muted hover:text-foreground hover:border-foreground transition cursor-pointer"
          >
            Pular
          </button>
        </div>
      </div>
    );
  }

  // --- Form state ---
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Novo Personagem</h1>
      <p className="text-muted mb-8">
        Descreva seu personagem em portugues. O Brahma vai gerar o prompt
        cinematografico em ingles automaticamente.
      </p>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            Nome do personagem
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Joao"
            required
            className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition"
          />
        </div>

        <div>
          <label htmlFor="age" className="block text-sm font-medium mb-2">
            Idade
          </label>
          <input
            id="age"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Ex: 30"
            required
            min={1}
            max={120}
            className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium mb-2"
          >
            Descricao fisica (em portugues)
          </label>
          <textarea
            id="description"
            value={descriptionPt}
            onChange={(e) => setDescriptionPt(e.target.value)}
            placeholder="Ex: magro, barba por fazer, cabelo baguncado, camiseta de banda antiga, shorts roxo escuro, chinelo"
            required
            rows={4}
            className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition resize-none"
          />
          <p className="text-muted text-sm mt-2">
            Descreva aparencia, roupas, expressao, postura — quanto mais
            detalhe, melhor a consistencia.
          </p>
        </div>

        {episodes.length > 0 && (
          <div>
            <label
              htmlFor="episode"
              className="block text-sm font-medium mb-2"
            >
              Vincular a episodio (opcional)
            </label>
            <select
              id="episode"
              value={selectedEpisodeId}
              onChange={(e) => setSelectedEpisodeId(e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-accent transition"
            >
              <option value="">Nenhum</option>
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.title}
                </option>
              ))}
            </select>
            <p className="text-muted text-sm mt-2">
              Selecione um episodio existente para vincular este personagem.
            </p>
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={handleGeneratePrompt}
            disabled={generating || !name || !age || !descriptionPt}
            className="text-accent border border-accent font-semibold px-4 py-2 rounded-lg hover:bg-accent/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? "Gerando..." : "Visualizar Prompt"}
          </button>
        </div>

        {showPrompt && (
          <div>
            <label
              htmlFor="prompt"
              className="block text-sm font-medium mb-2"
            >
              Prompt cinematografico (ingles)
            </label>
            <textarea
              id="prompt"
              value={promptBaseEn}
              onChange={(e) => setPromptBaseEn(e.target.value)}
              rows={8}
              className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition resize-none font-mono text-sm"
            />
            <p className="text-muted text-sm mt-2">
              Voce pode editar o prompt gerado antes de criar o personagem.
            </p>
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-accent text-black font-semibold px-6 py-3 rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Criando..." : "Criar Personagem"}
          </button>
          <a
            href="/"
            className="px-6 py-3 rounded-lg border border-border text-muted hover:text-foreground hover:border-foreground transition"
          >
            Cancelar
          </a>
        </div>
      </form>
    </div>
  );
}
