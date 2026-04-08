"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCharacter() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [descriptionPt, setDescriptionPt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/characters", {
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
