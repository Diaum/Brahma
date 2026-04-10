// Canvas renderer for Instagram carousel slides (1080x1350 = 4:5)

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;
export const WATERMARK = "@diaum_app";

export interface CoverSlide {
  type: "cover";
  imageUrl: string;
  title?: string;
  subtitle?: string;
}

export interface TextSlide {
  type: "text";
  title: string;
  body: string;
  bgColor: string;
  textColor: string;
}

export type Slide = CoverSlide | TextSlide;

// Load image as HTMLImageElement with CORS support
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
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
  ctx.font = "500 28px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.globalAlpha = 0.7;
  ctx.fillText(WATERMARK, SLIDE_W / 2, SLIDE_H - 50);
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

  // Optional title overlay (bottom, with dark gradient)
  if (slide.title) {
    // Gradient overlay
    const gradient = ctx.createLinearGradient(0, SLIDE_H * 0.5, 0, SLIDE_H);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, SLIDE_H * 0.5, SLIDE_W, SLIDE_H * 0.5);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 72px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const titleLines = wrapText(ctx, slide.title, SLIDE_W - 160);
    const titleLineH = 80;
    const startY = SLIDE_H - 280 - (titleLines.length - 1) * titleLineH;
    titleLines.forEach((line, i) => {
      ctx.fillText(line, SLIDE_W / 2, startY + i * titleLineH);
    });

    // Subtitle
    if (slide.subtitle) {
      ctx.font = "400 36px system-ui, sans-serif";
      ctx.globalAlpha = 0.9;
      const subLines = wrapText(ctx, slide.subtitle, SLIDE_W - 200);
      const subStartY = startY + titleLines.length * titleLineH + 20;
      subLines.forEach((line, i) => {
        ctx.fillText(line, SLIDE_W / 2, subStartY + i * 44);
      });
      ctx.globalAlpha = 1;
    }
  }

  drawWatermark(ctx, "#ffffff");
}

export function renderTextSlide(
  canvas: HTMLCanvasElement,
  slide: TextSlide
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = SLIDE_W;
  canvas.height = SLIDE_H;

  // Background
  ctx.fillStyle = slide.bgColor || "#000";
  ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);

  ctx.fillStyle = slide.textColor || "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

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

  drawWatermark(ctx, slide.textColor || "#ffffff");
}

export async function renderSlide(
  canvas: HTMLCanvasElement,
  slide: Slide
): Promise<void> {
  if (slide.type === "cover") {
    await renderCoverSlide(canvas, slide);
  } else {
    renderTextSlide(canvas, slide);
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 0.95);
  });
}
