// Canvas renderer for Instagram carousel slides (1080x1350 = 4:5)

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;
export const WATERMARK = "@diaum_app";

export type CoverLayout = "bottom-gradient" | "top-strip";

export interface CoverSlide {
  type: "cover";
  imageUrl: string;
  title?: string;
  subtitle?: string;
  layout?: CoverLayout;
}

export interface TextSlide {
  type: "text";
  title: string;
  body: string;
  bgColor: string;
  textColor: string;
  imageUrl?: string; // optional background image
  overlayOpacity?: number; // 0-1, default 0.65
}

export type Slide = CoverSlide | TextSlide;

// Load image via proxy → blob → object URL (bypasses CORS)
async function loadImage(url: string): Promise<HTMLImageElement> {
  // Strip cache-buster query to avoid duplicate fetches
  const cleanUrl = url.split("?")[0];

  // Always use proxy (avoids CORS issues with Supabase public URLs)
  const proxyRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(cleanUrl)}`);
  if (!proxyRes.ok) {
    throw new Error(`Proxy HTTP ${proxyRes.status}`);
  }
  const blob = await proxyRes.blob();
  const objectUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(objectUrl);
      reject(e);
    };
    img.src = objectUrl;
  });
}

// Word wrap for canvas text
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Draw watermark at bottom center
function drawWatermark(ctx: CanvasRenderingContext2D, color = "#ffffff") {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = "600 40px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = 0.85;
  ctx.fillText(WATERMARK, SLIDE_W / 2, SLIDE_H - 70);
  ctx.restore();
}

export async function renderCoverSlide(
  canvas: HTMLCanvasElement,
  slide: CoverSlide
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = SLIDE_W;
  canvas.height = SLIDE_H;

  // Fill black background
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);

  try {
    const img = await loadImage(slide.imageUrl);

    // Cover fit (crop to fill 1080x1350)
    const imgRatio = img.width / img.height;
    const slideRatio = SLIDE_W / SLIDE_H;

    let sx = 0;
    let sy = 0;
    let sw = img.width;
    let sh = img.height;

    if (imgRatio > slideRatio) {
      // Image is wider — crop horizontally
      sw = img.height * slideRatio;
      sx = (img.width - sw) / 2;
    } else {
      // Image is taller — crop vertically
      sh = img.width / slideRatio;
      sy = (img.height - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SLIDE_W, SLIDE_H);
  } catch (err) {
    console.error("Failed to load cover image:", err);
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
    ctx.fillStyle = "#666";
    ctx.font = "40px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Imagem nao carregada", SLIDE_W / 2, SLIDE_H / 2);
  }

  // Optional title overlay
  if (slide.title) {
    const layout: CoverLayout = slide.layout || "bottom-gradient";

    if (layout === "bottom-gradient") {
      // Style 1: title at bottom with gradient overlay
      const gradient = ctx.createLinearGradient(0, SLIDE_H * 0.5, 0, SLIDE_H);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, SLIDE_H * 0.5, SLIDE_W, SLIDE_H * 0.5);

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 120px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 4;
      const titleLines = wrapText(ctx, slide.title, SLIDE_W - 100);
      const titleLineH = 130;
      const subHeight = slide.subtitle ? 80 : 0;
      const startY =
        SLIDE_H - 240 - subHeight - (titleLines.length - 1) * titleLineH;
      titleLines.forEach((line, i) => {
        ctx.fillText(line, SLIDE_W / 2, startY + i * titleLineH);
      });

      if (slide.subtitle) {
        ctx.font = "500 44px system-ui, sans-serif";
        ctx.shadowBlur = 15;
        ctx.globalAlpha = 0.95;
        const subLines = wrapText(ctx, slide.subtitle, SLIDE_W - 160);
        const subStartY = startY + titleLines.length * titleLineH + 30;
        subLines.forEach((line, i) => {
          ctx.fillText(line, SLIDE_W / 2, subStartY + i * 54);
        });
        ctx.globalAlpha = 1;
      }

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    } else if (layout === "top-strip") {
      // Style 2: solid color strip at top with title left-aligned
      const stripH = 420;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, SLIDE_W, stripH);

      // Accent line
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(80, stripH - 8, 120, 6);

      // Title left-aligned, white
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 110px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      const titleLines = wrapText(ctx, slide.title, SLIDE_W - 160);
      const titleLineH = 120;
      const totalTitleH = titleLines.length * titleLineH;
      const startY = (stripH - totalTitleH) / 2 + 90;
      titleLines.forEach((line, i) => {
        ctx.fillText(line, 80, startY + i * titleLineH);
      });

      // Subtitle below the strip
      if (slide.subtitle) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "500 42px system-ui, sans-serif";
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 25;
        ctx.shadowOffsetY = 3;
        const subLines = wrapText(ctx, slide.subtitle, SLIDE_W - 160);
        subLines.forEach((line, i) => {
          ctx.fillText(line, 80, stripH + 90 + i * 54);
        });
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      }
    }
  }

  drawWatermark(ctx, "#ffffff");
}

export async function renderTextSlide(
  canvas: HTMLCanvasElement,
  slide: TextSlide
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = SLIDE_W;
  canvas.height = SLIDE_H;

  // Background: image or solid color
  if (slide.imageUrl) {
    try {
      const img = await loadImage(slide.imageUrl);
      const imgRatio = img.width / img.height;
      const slideRatio = SLIDE_W / SLIDE_H;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgRatio > slideRatio) {
        sw = img.height * slideRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / slideRatio;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SLIDE_W, SLIDE_H);

      // Dark overlay so text is readable
      const overlayOpacity = slide.overlayOpacity ?? 0.65;
      ctx.fillStyle = `rgba(0,0,0,${overlayOpacity})`;
      ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
    } catch {
      // Fallback to solid background
      ctx.fillStyle = slide.bgColor || "#000";
      ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
    }
  } else {
    ctx.fillStyle = slide.bgColor || "#000";
    ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);
  }

  ctx.fillStyle = slide.textColor || "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Add text shadow for readability when using background image
  if (slide.imageUrl) {
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;
  }

  // Title (bold, large)
  ctx.font = "bold 80px system-ui, sans-serif";
  const titleLines = wrapText(ctx, slide.title, SLIDE_W - 160);
  const titleLineH = 92;

  // Calculate total height to center everything vertically
  ctx.font = "400 44px system-ui, sans-serif";
  const bodyLines = wrapText(ctx, slide.body, SLIDE_W - 160);
  const bodyLineH = 60;

  const totalHeight =
    titleLines.length * titleLineH + 60 + bodyLines.length * bodyLineH;
  const startY = (SLIDE_H - totalHeight) / 2;

  // Draw title
  ctx.font = "bold 80px system-ui, sans-serif";
  titleLines.forEach((line, i) => {
    ctx.fillText(line, 80, startY + (i + 1) * titleLineH);
  });

  // Draw body
  ctx.font = "400 44px system-ui, sans-serif";
  ctx.globalAlpha = 0.85;
  const bodyStartY = startY + titleLines.length * titleLineH + 60;
  bodyLines.forEach((line, i) => {
    ctx.fillText(line, 80, bodyStartY + (i + 1) * bodyLineH - 20);
  });
  ctx.globalAlpha = 1;

  // Reset shadow before watermark
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  drawWatermark(ctx, slide.textColor || "#ffffff");
}

export async function renderSlide(
  canvas: HTMLCanvasElement,
  slide: Slide
): Promise<void> {
  if (slide.type === "cover") {
    await renderCoverSlide(canvas, slide);
  } else {
    await renderTextSlide(canvas, slide);
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 0.95);
  });
}
