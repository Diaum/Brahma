"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui";

const FORMAT_OPTIONS = [
  { value: "16:9", label: "16:9", sublabel: "Widescreen", w: 160, h: 90 },
  { value: "9:16", label: "9:16", sublabel: "Stories / Reels", w: 90, h: 160 },
  { value: "1:1", label: "1:1", sublabel: "Feed", w: 120, h: 120 },
] as const;

export default function NewEpisode() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const characterId = params.id;

  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [format, setFormat] = useState("9:16");
  const [order, setOrder] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character_id: characterId,
          title,
          script: script || null,
          format,
          order: order ? parseInt(order) : 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao criar episodio");
      }

      router.push(`/characters/${characterId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Novo Episodio</h1>
      <p className="text-muted mb-8">
        Crie um episodio com titulo, roteiro e formato de video.
      </p>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-2">
            Titulo do episodio
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Capitulo 1 - O Inicio"
            required
            className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition"
          />
        </div>

        <div>
          <label htmlFor="script" className="block text-sm font-medium mb-2">
            Roteiro
          </label>
          <textarea
            id="script"
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Descreva o roteiro completo do episodio..."
            rows={8}
            className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition resize-none"
          />
          <p className="text-muted text-sm mt-2">
            Opcional. Descreva cenas, dialogos e acoes do episodio.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-3">Formato</label>
          <div className="grid grid-cols-3 gap-4">
            {FORMAT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFormat(opt.value)}
                className={`flex flex-col items-center gap-3 p-4 rounded-lg border-2 transition cursor-pointer ${
                  format === opt.value
                    ? "border-accent bg-accent/10"
                    : "border-border bg-card hover:border-muted"
                }`}
              >
                <div
                  className={`border-2 rounded ${
                    format === opt.value ? "border-accent" : "border-muted"
                  }`}
                  style={{
                    width: `${opt.w * 0.5}px`,
                    height: `${opt.h * 0.5}px`,
                  }}
                />
                <div className="text-center">
                  <div className="font-semibold text-sm">{opt.label}</div>
                  <div className="text-muted text-xs">{opt.sublabel}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="order" className="block text-sm font-medium mb-2">
            Ordem do episodio
          </label>
          <input
            id="order"
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            placeholder="Ex: 1"
            min={0}
            className="w-full bg-card border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition"
          />
          <p className="text-muted text-sm mt-2">
            Define a posicao do episodio na sequencia. Padrao: 0.
          </p>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading} size="lg">
            {loading ? "Criando..." : "Criar Episodio"}
          </Button>
          <a
            href={`/characters/${characterId}`}
            className="px-6 py-3 rounded-lg border border-border text-muted hover:text-foreground hover:border-foreground transition"
          >
            Cancelar
          </a>
        </div>
      </form>
    </div>
  );
}
