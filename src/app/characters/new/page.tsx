"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function NewCharacter() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [descriptionPt, setDescriptionPt] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg("");

    const ageNum = parseInt(age, 10);
    if (!name.trim()) {
      setErrorMsg("Nome é obrigatório.");
      setStatus("error");
      return;
    }
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 200) {
      setErrorMsg("Idade deve ser um número entre 0 e 200.");
      setStatus("error");
      return;
    }
    if (!descriptionPt.trim()) {
      setErrorMsg("Descrição física é obrigatória.");
      setStatus("error");
      return;
    }

    const { error } = await supabase.from("characters").insert({
      name: name.trim(),
      age: ageNum,
      description_pt: descriptionPt.trim(),
      prompt_base_en: "",
    });

    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
      return;
    }

    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-green-900/30 border border-green-700 rounded-xl p-8 text-center">
          <p className="text-green-400 text-xl font-semibold mb-2">
            Personagem criado com sucesso!
          </p>
          <p className="text-muted mb-6">
            &quot;{name}&quot; foi adicionado à sua lista de personagens.
          </p>
          <div className="flex gap-3 justify-center">
            <a
              href="/characters/new"
              className="border border-border px-4 py-2 rounded-lg hover:border-accent transition"
            >
              Criar outro
            </a>
            <a
              href="/"
              className="bg-accent text-black font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition"
            >
              Ver personagens
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8">
        <a href="/" className="text-muted hover:text-accent transition text-sm">
          &larr; Voltar
        </a>
        <h1 className="text-3xl font-bold mt-2">Novo Personagem</h1>
        <p className="text-muted mt-1">
          Preencha os dados do seu personagem para produção de vídeo.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Nome
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: João"
            className="w-full bg-card border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-accent transition"
          />
        </div>

        <div>
          <label htmlFor="age" className="block text-sm font-medium mb-1">
            Idade
          </label>
          <input
            id="age"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="Ex: 30"
            min={0}
            max={200}
            className="w-full bg-card border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-accent transition"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1">
            Descrição física
          </label>
          <textarea
            id="description"
            value={descriptionPt}
            onChange={(e) => setDescriptionPt(e.target.value)}
            placeholder='Ex: "magro, barba por fazer, cabelo bagunçado, camiseta de banda antiga, shorts roxo escuro, chinelo"'
            rows={4}
            className="w-full bg-card border border-border rounded-lg px-4 py-2 focus:outline-none focus:border-accent transition resize-y"
          />
        </div>

        {status === "error" && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-400 text-sm">
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={status === "saving"}
          className="w-full bg-accent text-black font-semibold py-3 rounded-lg hover:opacity-90 transition disabled:opacity-50"
        >
          {status === "saving" ? "Salvando..." : "Criar Personagem"}
        </button>
      </form>
    </div>
  );
}
