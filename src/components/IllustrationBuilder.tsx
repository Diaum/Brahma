"use client";

import { useState } from "react";
import JSZip from "jszip";

interface IllustrationSlide {
  headline: string;
  subtext: string;
  scene: string;
  image_url?: string;
  generating?: boolean;
}

interface IllustrationBuilderProps {
  open: boolean;
  onClose: () => void;
  characterId: string;
  characterName: string;
}

const COLOR_PALETTES = [
  { label: "Verde", value: "dark green gradient background with teal accents" },
  { label: "Azul", value: "dark blue gradient background with navy accents" },
  { label: "Roxo", value: "dark purple gradient background with indigo accents" },
  { label: "Laranja", value: "dark orange gradient background with warm amber accents" },
];

export function IllustrationBuilder({
  open,
  onClose,
  characterId,
  characterName,
}: IllustrationBuilderProps) {
  // Step 1: input
  const [inputText, setInputText] = useState("");
  const [colorPalette, setColorPalette] = useState(COLOR_PALETTES[0].value);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2: review + generate
  const [slides, setSlides] = useState<IllustrationSlide[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [downloading, setDownloading] = useState(false);

  async function handlePlan() {
    if (inputText.trim().length < 20) {
      setError("Cole um texto com pelo menos 20 caracteres");
      return;
    }
    setPlanning(true);
    setError(null);

    try {
      const res = await fetch("/api/generate-illustration/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText.trim(),
          color_palette: colorPalette,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao gerar plano");
      }

      const data = await res.json();
      setSlides(data.slides.map((s: IllustrationSlide) => ({ ...s })));
      setActiveIdx(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setPlanning(false);
    }
  }

  async function generateImage(idx: number) {
    const slide = slides[idx];
    if (!slide) return;

    setSlides((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, generating: true } : s))
    );

    try {
      const res = await fetch("/api/generate-illustration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene: slide.scene,
          headline: slide.headline,
          subtext: slide.subtext,
          color_palette: colorPalette,
          character_id: characterId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao gerar");
      }

      const data = await res.json();
      setSlides((prev) =>
        prev.map((s, i) =>
          i === idx ? { ...s, image_url: data.image_url, generating: false } : s
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
      setSlides((prev) =>
        prev.map((s, i) => (i === idx ? { ...s, generating: false } : s))
      );
    }
  }

  async function generateAll() {
    for (let i = 0; i < slides.length; i++) {
      if (!slides[i].image_url) {
        await generateImage(i);
      }
    }
  }

  async function downloadAll() {
    const generated = slides.filter((s) => s.image_url);
    if (generated.length === 0) return;
    setDownloading(true);

    try {
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i++) {
        if (slides[i].image_url) {
          try {
            const res = await fetch(
              `/api/proxy-image?url=${encodeURIComponent(slides[i].image_url!)}`
            );
            if (res.ok) {
              const blob = await res.blob();
              zip.file(`ilustracao-${String(i + 1).padStart(2, "0")}.png`, blob);
            }
          } catch {
            // skip
          }
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const slug = characterName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-");
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-ilustracoes.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } finally {
      setDownloading(false);
    }
  }

  function handleClose() {
    setSlides([]);
    setInputText("");
    setError(null);
    setActiveIdx(0);
    onClose();
  }

  if (!open) return null;

  const hasSlides = slides.length > 0;
  const generatedCount = slides.filter((s) => s.image_url).length;
  const anyGenerating = slides.some((s) => s.generating);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-5xl mx-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-semibold">🎨 Ilustracoes</h2>
            <p className="text-sm text-muted">
              {hasSlides
                ? `${generatedCount}/${slides.length} geradas — ${characterName}`
                : "Crie ilustracoes para Instagram"}
            </p>
          </div>
          <button onClick={handleClose} className="text-muted hover:text-foreground text-xl cursor-pointer p-1">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {!hasSlides ? (
            /* Step 1: Input */
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="text-sm font-medium block mb-2">
                  Texto de referencia
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Cole um artigo, noticia, ideia ou texto sobre o tema. A IA vai extrair 4 insights e criar cenas visuais para cada um..."
                  rows={12}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent transition resize-y"
                />
                <p className="text-[10px] text-muted mt-1">{inputText.length} caracteres</p>
              </div>

              <div>
                <label className="text-sm font-medium block mb-2">Paleta de cores</label>
                <div className="grid grid-cols-4 gap-2">
                  {COLOR_PALETTES.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setColorPalette(p.value)}
                      className={`text-xs py-2.5 rounded-lg border transition cursor-pointer ${
                        colorPalette === p.value
                          ? "bg-accent text-black border-accent font-semibold"
                          : "bg-card border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {planning && (
                <div className="flex items-center gap-3 text-accent bg-accent/10 border border-accent/30 rounded-lg p-4">
                  <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">IA planejando as 4 ilustracoes... (~15s)</span>
                </div>
              )}
            </div>
          ) : (
            /* Step 2: Review + Generate */
            <>
              {/* Left: slide list */}
              <div className="w-48 shrink-0 border-r border-border overflow-y-auto p-3 space-y-2">
                {slides.map((s, i) => (
                  <div
                    key={i}
                    onClick={() => setActiveIdx(i)}
                    className={`rounded-lg border-2 cursor-pointer transition overflow-hidden ${
                      i === activeIdx
                        ? "border-accent"
                        : "border-border hover:border-muted"
                    }`}
                  >
                    <div className="aspect-[4/5] bg-background flex items-center justify-center text-muted">
                      {s.image_url ? (
                        <img
                          src={s.image_url}
                          alt={s.headline}
                          className="w-full h-full object-cover"
                        />
                      ) : s.generating ? (
                        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="text-[10px] p-2 text-center line-clamp-3">
                          {s.headline || `Slide ${i + 1}`}
                        </span>
                      )}
                    </div>
                    <div className="p-1.5 bg-card">
                      <span className="text-[10px] text-muted">{i + 1}/4</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Center: preview */}
              <div className="flex-1 overflow-y-auto bg-background/30 flex items-center justify-center p-6">
                {slides[activeIdx]?.image_url ? (
                  <img
                    src={slides[activeIdx].image_url}
                    alt={slides[activeIdx].headline}
                    className="max-h-[70vh] w-auto rounded-lg shadow-2xl"
                    style={{ aspectRatio: "4/5" }}
                  />
                ) : slides[activeIdx]?.generating ? (
                  <div className="flex flex-col items-center gap-4 text-muted">
                    <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin" />
                    <span>Gerando ilustracao...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-muted">
                    <span className="text-5xl">🎨</span>
                    <span>Clique em "Gerar" para criar</span>
                  </div>
                )}
              </div>

              {/* Right: editor */}
              <div className="w-80 shrink-0 border-l border-border overflow-y-auto p-5 space-y-4">
                {slides[activeIdx] && (
                  <>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                      Slide {activeIdx + 1}
                    </h3>

                    <div>
                      <label className="text-xs text-muted block mb-1.5">Headline</label>
                      <textarea
                        value={slides[activeIdx].headline}
                        onChange={(e) =>
                          setSlides((prev) =>
                            prev.map((s, i) =>
                              i === activeIdx ? { ...s, headline: e.target.value } : s
                            )
                          )
                        }
                        rows={2}
                        maxLength={50}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none"
                      />
                      <p className="text-[10px] text-muted mt-1">
                        {slides[activeIdx].headline.length}/50
                      </p>
                    </div>

                    <div>
                      <label className="text-xs text-muted block mb-1.5">Subtext</label>
                      <textarea
                        value={slides[activeIdx].subtext}
                        onChange={(e) =>
                          setSlides((prev) =>
                            prev.map((s, i) =>
                              i === activeIdx ? { ...s, subtext: e.target.value } : s
                            )
                          )
                        }
                        rows={3}
                        maxLength={100}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none"
                      />
                      <p className="text-[10px] text-muted mt-1">
                        {slides[activeIdx].subtext.length}/100
                      </p>
                    </div>

                    <div>
                      <label className="text-xs text-muted block mb-1.5">
                        Prompt da cena (EN)
                      </label>
                      <textarea
                        value={slides[activeIdx].scene}
                        onChange={(e) =>
                          setSlides((prev) =>
                            prev.map((s, i) =>
                              i === activeIdx ? { ...s, scene: e.target.value } : s
                            )
                          )
                        }
                        rows={5}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-accent resize-none"
                      />
                    </div>

                    <button
                      onClick={() => generateImage(activeIdx)}
                      disabled={slides[activeIdx].generating}
                      className="w-full bg-accent text-black font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition disabled:opacity-50 cursor-pointer text-sm"
                    >
                      {slides[activeIdx].generating
                        ? "Gerando..."
                        : slides[activeIdx].image_url
                          ? "Regerar"
                          : "🎨 Gerar Ilustracao"}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between">
          <p className="text-xs text-muted">
            {hasSlides
              ? `${generatedCount} de ${slides.length} ilustracoes geradas`
              : "Cole um texto para comecar"}
          </p>
          <div className="flex gap-3">
            <button onClick={handleClose} className="text-muted hover:text-foreground text-sm px-3 cursor-pointer">
              Fechar
            </button>
            {!hasSlides ? (
              <button
                onClick={handlePlan}
                disabled={planning || inputText.trim().length < 20}
                className="bg-accent text-black font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50 cursor-pointer text-sm"
              >
                {planning ? "Planejando..." : "🎨 Planejar Ilustracoes"}
              </button>
            ) : (
              <>
                {generatedCount < slides.length && (
                  <button
                    onClick={generateAll}
                    disabled={anyGenerating}
                    className="bg-card border border-border text-foreground font-medium px-5 py-2 rounded-lg hover:bg-card-hover transition disabled:opacity-50 cursor-pointer text-sm"
                  >
                    {anyGenerating ? "Gerando..." : "Gerar Todas"}
                  </button>
                )}
                {generatedCount > 0 && (
                  <button
                    onClick={downloadAll}
                    disabled={downloading}
                    className="bg-accent text-black font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50 cursor-pointer text-sm"
                  >
                    {downloading ? "Baixando..." : "↓ Baixar (.zip)"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
