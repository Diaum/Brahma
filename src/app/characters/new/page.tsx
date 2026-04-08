"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCharacter() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [descriptionPt, setDescriptionPt] = useState("");
  const [promptBaseEn, setPromptBaseEn] = useState("");
  const [showPrompt, setShowPrompt] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

      // Send the prompt if user previewed/edited it
      if (showPrompt && promptBaseEn) {
        payload.prompt_base_en = promptBaseEn;
      }

      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao criar personagem");
      }

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

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
