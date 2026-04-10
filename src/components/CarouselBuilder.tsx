"use client";

import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import {
  Slide,
  CoverSlide,
  TextSlide,
  CoverLayout,
  TextLayout,
  renderSlide,
  canvasToBlob,
  SLIDE_W,
  SLIDE_H,
} from "@/lib/carousel-render";

interface ShotOption {
  id: string;
  image_url: string;
  prompt_scene: string;
}

interface CarouselBuilderProps {
  open: boolean;
  onClose: () => void;
  characterName: string;
  availableShots: ShotOption[];
}

const DEFAULT_COVER: CoverSlide = {
  type: "cover",
  imageUrl: "",
  title: "",
  subtitle: "",
  layout: "bottom-gradient",
};

const DEFAULT_TEXT: TextSlide = {
  type: "text",
  title: "",
  body: "",
  bgColor: "#000000",
  textColor: "#ffffff",
  layout: "centered",
};

// Small canvas thumbnail for the left sidebar
function SlideThumbnail({ slide }: { slide: Slide }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderSlide(canvas, slide).catch(() => {});
  }, [slide]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full object-cover"
      style={{ aspectRatio: "4/5" }}
    />
  );
}

const MAX_TITLE = 80;
const MAX_BODY = 280;
const MIN_SLIDES = 4;
const MAX_SLIDES = 8;

export function CarouselBuilder({
  open,
  onClose,
  characterName,
  availableShots,
}: CarouselBuilderProps) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [pickingCover, setPickingCover] = useState(false);
  const [pickingBgFor, setPickingBgFor] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize with 4 slides when opened
  useEffect(() => {
    if (open && slides.length === 0) {
      setSlides([
        { ...DEFAULT_COVER },
        { ...DEFAULT_TEXT },
        { ...DEFAULT_TEXT },
        { ...DEFAULT_TEXT },
      ]);
      setActiveIdx(0);
    }
  }, [open]);

  // Render preview whenever active slide changes
  useEffect(() => {
    if (!open) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const slide = slides[activeIdx];
    if (!slide) return;
    renderSlide(canvas, slide);
  }, [activeIdx, slides, open]);

  function updateSlide(idx: number, patch: Partial<Slide>) {
    setSlides((prev) =>
      prev.map((s, i) => (i === idx ? ({ ...s, ...patch } as Slide) : s))
    );
  }

  function addSlide() {
    if (slides.length >= MAX_SLIDES) return;
    setSlides((prev) => [...prev, { ...DEFAULT_TEXT }]);
    setActiveIdx(slides.length);
  }

  function removeSlide(idx: number) {
    if (slides.length <= MIN_SLIDES) return;
    if (idx === 0) return; // can't remove cover
    setSlides((prev) => prev.filter((_, i) => i !== idx));
    if (activeIdx >= idx) setActiveIdx(Math.max(0, activeIdx - 1));
  }

  function moveSlide(idx: number, dir: -1 | 1) {
    if (idx === 0) return; // cover stays first
    const targetIdx = idx + dir;
    if (targetIdx <= 0 || targetIdx >= slides.length) return;
    setSlides((prev) => {
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
    setActiveIdx(targetIdx);
  }

  function pickCoverImage(shot: ShotOption) {
    updateSlide(0, { type: "cover", imageUrl: shot.image_url } as Partial<Slide>);
    setPickingCover(false);
  }

  function pickBgImage(shot: ShotOption) {
    if (pickingBgFor === null) return;
    updateSlide(pickingBgFor, { imageUrl: shot.image_url } as Partial<Slide>);
    setPickingBgFor(null);
  }

  async function downloadAll() {
    setDownloading(true);
    try {
      const zip = new JSZip();
      const renderCanvas = document.createElement("canvas");
      renderCanvas.width = SLIDE_W;
      renderCanvas.height = SLIDE_H;

      for (let i = 0; i < slides.length; i++) {
        await renderSlide(renderCanvas, slides[i]);
        const blob = await canvasToBlob(renderCanvas);
        if (blob) {
          zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, blob);
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
      a.download = `${slug}-carrossel.zip`;
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
    setActiveIdx(0);
    setPickingCover(false);
    onClose();
  }

  if (!open) return null;

  const slide = slides[activeIdx];
  const coverIsValid = slides[0]?.type === "cover" && (slides[0] as CoverSlide).imageUrl;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-6xl mx-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Criar Carrossel Instagram</h2>
            <p className="text-sm text-muted">
              {slides.length} slides — {characterName}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-muted hover:text-foreground text-xl cursor-pointer p-1"
          >
            ✕
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: slide list */}
          <div className="w-48 shrink-0 border-r border-border overflow-y-auto p-3 space-y-2">
            {slides.map((s, i) => (
              <div
                key={i}
                className={`group relative rounded-lg border-2 cursor-pointer transition ${
                  i === activeIdx
                    ? "border-accent"
                    : "border-border hover:border-muted"
                }`}
                onClick={() => setActiveIdx(i)}
              >
                <div className="aspect-[4/5] bg-background rounded-md overflow-hidden flex items-center justify-center text-muted text-[10px]">
                  {s.type === "cover" && !(s as CoverSlide).imageUrl ? (
                    <span className="p-2 text-center">Escolha uma capa</span>
                  ) : s.type === "text" && !(s as TextSlide).title && !(s as TextSlide).body && !(s as TextSlide).imageUrl ? (
                    <span className="p-2 text-center">Slide {i + 1}</span>
                  ) : (
                    <SlideThumbnail slide={s} />
                  )}
                </div>
                <div className="absolute top-1 left-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                  {i + 1}
                </div>
                {i > 0 && slides.length > MIN_SLIDES && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSlide(i);
                    }}
                    className="absolute top-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded hover:bg-red-600 opacity-0 group-hover:opacity-100 transition"
                  >
                    ✕
                  </button>
                )}
                {i > 0 && (
                  <div className="absolute bottom-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveSlide(i, -1);
                      }}
                      className="bg-black/70 text-white text-[10px] px-1 rounded hover:bg-accent hover:text-black"
                    >
                      ↑
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveSlide(i, 1);
                      }}
                      className="bg-black/70 text-white text-[10px] px-1 rounded hover:bg-accent hover:text-black"
                    >
                      ↓
                    </button>
                  </div>
                )}
              </div>
            ))}

            {slides.length < MAX_SLIDES && (
              <button
                onClick={addSlide}
                className="w-full aspect-[4/5] border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center text-muted hover:text-accent hover:border-accent transition cursor-pointer"
              >
                <span className="text-2xl">+</span>
                <span className="text-xs mt-1">Slide</span>
              </button>
            )}
          </div>

          {/* Center: preview */}
          <div className="flex-1 overflow-y-auto bg-background/30 flex items-center justify-center p-6">
            <div className="relative">
              <canvas
                ref={previewCanvasRef}
                className="max-h-[70vh] w-auto rounded-lg shadow-2xl bg-black"
                style={{ aspectRatio: "4/5" }}
              />
            </div>
          </div>

          {/* Right: editor */}
          <div className="w-80 shrink-0 border-l border-border overflow-y-auto p-5 space-y-4">
            {slide?.type === "cover" && (
              <>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Capa
                </h3>

                <div>
                  <label className="text-xs text-muted block mb-1.5">
                    Imagem base
                  </label>
                  {(slide as CoverSlide).imageUrl ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={(slide as CoverSlide).imageUrl}
                        alt="cover"
                        className="w-16 h-20 object-cover rounded-md border border-border"
                      />
                      <button
                        onClick={() => setPickingCover(true)}
                        className="text-xs text-accent hover:underline cursor-pointer"
                      >
                        Trocar imagem
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPickingCover(true)}
                      className="w-full py-3 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted hover:text-accent hover:border-accent transition text-sm cursor-pointer"
                    >
                      Escolher shot
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-xs text-muted block mb-1.5">
                    Layout
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["bottom-gradient", "top-strip"] as CoverLayout[]).map(
                      (layout) => (
                        <button
                          key={layout}
                          onClick={() =>
                            updateSlide(activeIdx, { layout } as Partial<Slide>)
                          }
                          className={`text-xs py-2 rounded-lg border transition cursor-pointer ${
                            ((slide as CoverSlide).layout || "bottom-gradient") === layout
                              ? "bg-accent text-black border-accent font-semibold"
                              : "bg-card border-border text-muted hover:text-foreground"
                          }`}
                        >
                          {layout === "bottom-gradient"
                            ? "Gradient"
                            : "Strip Top"}
                        </button>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted block mb-1.5">
                    Titulo (opcional)
                  </label>
                  <input
                    type="text"
                    value={(slide as CoverSlide).title || ""}
                    onChange={(e) =>
                      updateSlide(activeIdx, { title: e.target.value } as Partial<Slide>)
                    }
                    maxLength={MAX_TITLE}
                    placeholder="Titulo sobre a imagem"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                  />
                  <p className="text-[10px] text-muted mt-1">
                    {((slide as CoverSlide).title || "").length}/{MAX_TITLE}
                  </p>
                </div>

                <div>
                  <label className="text-xs text-muted block mb-1.5">
                    Subtitulo (opcional)
                  </label>
                  <input
                    type="text"
                    value={(slide as CoverSlide).subtitle || ""}
                    onChange={(e) =>
                      updateSlide(activeIdx, {
                        subtitle: e.target.value,
                      } as Partial<Slide>)
                    }
                    maxLength={120}
                    placeholder="Texto menor abaixo"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                  />
                </div>
              </>
            )}

            {slide?.type === "text" && (
              <>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Slide {activeIdx + 1}
                </h3>

                <div>
                  <label className="text-xs text-muted block mb-1.5">
                    Layout
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["centered", "top-strip"] as TextLayout[]).map((lay) => (
                      <button
                        key={lay}
                        onClick={() =>
                          updateSlide(activeIdx, { layout: lay } as Partial<Slide>)
                        }
                        className={`text-xs py-2 rounded-lg border transition cursor-pointer ${
                          ((slide as TextSlide).layout || "centered") === lay
                            ? "bg-accent text-black border-accent font-semibold"
                            : "bg-card border-border text-muted hover:text-foreground"
                        }`}
                      >
                        {lay === "centered" ? "Centralizado" : "Strip Top"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted block mb-1.5">
                    Titulo (negrito)
                  </label>
                  <textarea
                    value={(slide as TextSlide).title}
                    onChange={(e) =>
                      updateSlide(activeIdx, { title: e.target.value } as Partial<Slide>)
                    }
                    maxLength={MAX_TITLE}
                    rows={2}
                    placeholder="Titulo impactante"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none"
                  />
                  <p className="text-[10px] text-muted mt-1">
                    {(slide as TextSlide).title.length}/{MAX_TITLE}
                  </p>
                </div>

                <div>
                  <label className="text-xs text-muted block mb-1.5">Texto</label>
                  <textarea
                    value={(slide as TextSlide).body}
                    onChange={(e) =>
                      updateSlide(activeIdx, { body: e.target.value } as Partial<Slide>)
                    }
                    maxLength={MAX_BODY}
                    rows={5}
                    placeholder="Corpo do texto"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent resize-none"
                  />
                  <p className="text-[10px] text-muted mt-1">
                    {(slide as TextSlide).body.length}/{MAX_BODY}
                  </p>
                </div>

                <div>
                  <label className="text-xs text-muted block mb-1.5">
                    Imagem de fundo (opcional)
                  </label>
                  {(slide as TextSlide).imageUrl ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={(slide as TextSlide).imageUrl}
                        alt="bg"
                        className="w-16 h-20 object-cover rounded-md border border-border"
                      />
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => setPickingBgFor(activeIdx)}
                          className="text-xs text-accent hover:underline cursor-pointer text-left"
                        >
                          Trocar
                        </button>
                        <button
                          onClick={() =>
                            updateSlide(activeIdx, {
                              imageUrl: undefined,
                            } as Partial<Slide>)
                          }
                          className="text-xs text-red-400 hover:underline cursor-pointer text-left"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPickingBgFor(activeIdx)}
                      className="w-full py-3 border-2 border-dashed border-border rounded-lg flex items-center justify-center text-muted hover:text-accent hover:border-accent transition text-xs cursor-pointer"
                    >
                      + Adicionar imagem
                    </button>
                  )}
                </div>

                {(slide as TextSlide).imageUrl && (
                  <div>
                    <label className="text-xs text-muted block mb-1.5">
                      Escurecimento do fundo (
                      {Math.round(((slide as TextSlide).overlayOpacity ?? 0.65) * 100)}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.95"
                      step="0.05"
                      value={(slide as TextSlide).overlayOpacity ?? 0.65}
                      onChange={(e) =>
                        updateSlide(activeIdx, {
                          overlayOpacity: parseFloat(e.target.value),
                        } as Partial<Slide>)
                      }
                      className="w-full accent-accent cursor-pointer"
                    />
                  </div>
                )}

                {!(slide as TextSlide).imageUrl && (
                  <div>
                    <label className="text-xs text-muted block mb-1.5">Fundo</label>
                    <input
                      type="color"
                      value={(slide as TextSlide).bgColor}
                      onChange={(e) =>
                        updateSlide(activeIdx, {
                          bgColor: e.target.value,
                        } as Partial<Slide>)
                      }
                      className="w-full h-10 bg-background border border-border rounded-lg cursor-pointer"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs text-muted block mb-1.5">
                    Cor do texto
                  </label>
                  <input
                    type="color"
                    value={(slide as TextSlide).textColor}
                    onChange={(e) =>
                      updateSlide(activeIdx, {
                        textColor: e.target.value,
                      } as Partial<Slide>)
                    }
                    className="w-full h-10 bg-background border border-border rounded-lg cursor-pointer"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between">
          <p className="text-xs text-muted">
            Minimo {MIN_SLIDES} • Maximo {MAX_SLIDES} slides • Formato 1080x1350
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="text-muted hover:text-foreground text-sm px-3 cursor-pointer"
            >
              Fechar
            </button>
            <button
              onClick={downloadAll}
              disabled={downloading || !coverIsValid}
              className="bg-accent text-black font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50 cursor-pointer text-sm"
            >
              {downloading ? "Gerando PNGs..." : "Baixar (.zip)"}
            </button>
          </div>
        </div>
      </div>

      {/* Shot picker modal (for cover OR background) */}
      {(pickingCover || pickingBgFor !== null) && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => {
            setPickingCover(false);
            setPickingBgFor(null);
          }}
        >
          <div
            className="bg-card border border-border rounded-2xl max-w-4xl w-full mx-4 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="font-semibold">
                {pickingCover ? "Escolher imagem de capa" : "Escolher imagem de fundo"}
              </h3>
              <button
                onClick={() => {
                  setPickingCover(false);
                  setPickingBgFor(null);
                }}
                className="text-muted hover:text-foreground text-xl cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {availableShots.length === 0 ? (
                <p className="text-center text-muted py-10">
                  Nenhum shot aprovado disponivel. Aprove alguns shots primeiro.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                  {availableShots.map((shot) => (
                    <button
                      key={shot.id}
                      onClick={() => {
                        if (pickingCover) pickCoverImage(shot);
                        else pickBgImage(shot);
                      }}
                      className="group bg-background border border-border rounded-lg overflow-hidden hover:border-accent transition cursor-pointer"
                    >
                      <img
                        src={shot.image_url}
                        alt={shot.prompt_scene}
                        loading="lazy"
                        className="w-full aspect-[9/16] object-cover"
                      />
                      <p className="text-[10px] text-muted p-2 line-clamp-2 text-left">
                        {shot.prompt_scene}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
