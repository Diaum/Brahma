// Canvas renderer for Instagram carousel slides (1080x1350 = 4:5)

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;
export const WATERMARK = "@diaum_app";

export type CoverLayout = "bottom-gradient" | "top-strip" | "magazine";

export interface CoverSlide {
  type: "cover";
  imageUrl: string;
  title?: string;
  subtitle?: string;
  layout?: CoverLayout;
}

export type TextLayout = "centered" | "top-strip" | "magazine";

export interface TextSlide {
  type: "text";
  title: string;
  body: string;
  bgColor: string;
  textColor: string;
  imageUrl?: string; // optional background image
  overlayOpacity?: number; // 0-1, default 0.65
  layout?: TextLayout;
}

export interface CtaSlide {
  type: "cta";
  headline: string;
  body: string;
}

export type Slide = CoverSlide | TextSlide | CtaSlide;

export const DEFAULT_CTA_HEADLINE = "Diaum";
export const DEFAULT_CTA_BODY =
  "Um app que te ajuda a combater seu vicio em conteudo adulto de forma anonima e acolhedora.";
export const DIAUM_LOGO_URL = "/diaum-logo.png";

// Load image via proxy → blob → object URL (bypasses CORS)
async function loadImage(url: string): Promise<HTMLImageElement> {
  // Strip cache-buster query to avoid duplicate fetches
  const cleanUrl = url.split("?")[0];

  // Relative URL (local asset): fetch directly
  if (cleanUrl.startsWith("/")) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = cleanUrl;
    });
  }

  // Absolute URL: go through proxy (avoids CORS with Supabase)
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

  const layout: CoverLayout = slide.layout || "bottom-gradient";
  const stripH = 420;

  // Define image draw area based on layout
  const imgAreaY = layout === "top-strip" && slide.title ? stripH : 0;
  const imgAreaH = SLIDE_H - imgAreaY;

  // Only try to load image if URL is set (avoid 400 on empty state)
  if (slide.imageUrl) {
    try {
      const img = await loadImage(slide.imageUrl);

      // Cover fit within the image area (crop to fill)
      const imgRatio = img.width / img.height;
      const areaRatio = SLIDE_W / imgAreaH;

      let sx = 0;
      let sy = 0;
      let sw = img.width;
      let sh = img.height;

      if (imgRatio > areaRatio) {
        sw = img.height * areaRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / areaRatio;
        sy = (img.height - sh) / 2;
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, imgAreaY, SLIDE_W, imgAreaH);
    } catch (err) {
      console.error("Failed to load cover image:", err);
      ctx.fillStyle = "#333";
      ctx.fillRect(0, imgAreaY, SLIDE_W, imgAreaH);
      ctx.fillStyle = "#666";
      ctx.font = "40px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Imagem nao carregada", SLIDE_W / 2, imgAreaY + imgAreaH / 2);
    }
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
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 4;

      // Measure title
      const titleFontSize = 110;
      const titleLineH = 120;
      ctx.font = `900 ${titleFontSize}px system-ui, sans-serif`;
      const titleLines = wrapText(ctx, slide.title, SLIDE_W - 120);
      const titleTotalH = titleLines.length * titleLineH;

      // Measure subtitle
      const subLineH = 54;
      let subLines: string[] = [];
      if (slide.subtitle) {
        ctx.font = "500 42px system-ui, sans-serif";
        subLines = wrapText(ctx, slide.subtitle, SLIDE_W - 160);
      }
      const subTotalH = subLines.length * subLineH;
      const gap = subLines.length > 0 ? 30 : 0;

      // Watermark reserved area: ~140px from bottom
      const watermarkReserve = 160;
      const blockBottom = SLIDE_H - watermarkReserve;
      const blockTop = blockBottom - subTotalH - gap - titleTotalH;

      // Draw title
      ctx.font = `900 ${titleFontSize}px system-ui, sans-serif`;
      titleLines.forEach((line, i) => {
        ctx.fillText(
          line,
          SLIDE_W / 2,
          blockTop + (i + 1) * titleLineH - (titleLineH - titleFontSize) / 2
        );
      });

      // Draw subtitle
      if (slide.subtitle) {
        ctx.font = "500 42px system-ui, sans-serif";
        ctx.shadowBlur = 15;
        ctx.globalAlpha = 0.95;
        const subStart = blockTop + titleTotalH + gap;
        subLines.forEach((line, i) => {
          ctx.fillText(line, SLIDE_W / 2, subStart + (i + 1) * subLineH - 10);
        });
        ctx.globalAlpha = 1;
      }

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    } else if (layout === "magazine") {
      // Style 3: editorial magazine cover with giant quote mark and serif title
      // Completely override the image — use solid dark background
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);

      const marginX = 110;

      // Giant decorative quote mark (yellow, translucent)
      ctx.fillStyle = "#fbbf24";
      ctx.globalAlpha = 0.15;
      ctx.font = "900 700px Georgia, serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("\u201C", 40, 560);
      ctx.globalAlpha = 1;

      // Vertical yellow bar on the left
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(60, 280, 10, 720);

      // Small label at top
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.5;
      ctx.font = "700 26px system-ui, sans-serif";
      ctx.fillText("— MAGAZINE —", marginX, 220);
      ctx.globalAlpha = 1;

      // Title in big serif italic
      ctx.fillStyle = "#ffffff";
      const titleFontSize = 96;
      const titleLineH = 110;
      ctx.font = `italic 700 ${titleFontSize}px Georgia, serif`;
      const titleLines = wrapText(ctx, slide.title, SLIDE_W - marginX - 100);
      const titleStartY = 380;
      titleLines.forEach((line, i) => {
        ctx.fillText(line, marginX, titleStartY + i * titleLineH);
      });

      // Yellow dots separator
      const afterTitleY = titleStartY + titleLines.length * titleLineH + 60;
      ctx.fillStyle = "#fbbf24";
      [0, 32, 64].forEach((offset) => {
        ctx.beginPath();
        ctx.arc(marginX + 8 + offset, afterTitleY, 8, 0, Math.PI * 2);
        ctx.fill();
      });

      // Subtitle in serif
      if (slide.subtitle) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "400 42px Georgia, serif";
        ctx.globalAlpha = 0.85;
        const subLines = wrapText(ctx, slide.subtitle, SLIDE_W - marginX - 100);
        const subStart = afterTitleY + 80;
        subLines.forEach((line, i) => {
          ctx.fillText(line, marginX, subStart + i * 56);
        });
        ctx.globalAlpha = 1;
      }
    } else if (layout === "top-strip") {
      // Style 2: solid color strip at top (image is already placed below it)
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, SLIDE_W, stripH);

      // Title left-aligned, white — anchored to bottom of strip
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 110px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      const titleLines = wrapText(ctx, slide.title, SLIDE_W - 160);
      const titleLineH = 120;
      // Bottom baseline of last line sits at stripH - 70 (gives ~50px padding below)
      const lastLineY = stripH - 70;
      const firstLineY = lastLineY - (titleLines.length - 1) * titleLineH;
      titleLines.forEach((line, i) => {
        ctx.fillText(line, 80, firstLineY + i * titleLineH);
      });

      // Accent line just below the title
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(80, stripH - 20, 120, 6);

      // Subtitle below the strip — pushed down a bit for more breathing room
      if (slide.subtitle) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "500 42px system-ui, sans-serif";
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 25;
        ctx.shadowOffsetY = 3;
        const subLines = wrapText(ctx, slide.subtitle, SLIDE_W - 160);
        subLines.forEach((line, i) => {
          ctx.fillText(line, 80, stripH + 130 + i * 54);
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

  const layout: TextLayout = slide.layout || "centered";
  const stripH = 420;
  const hasImage = !!slide.imageUrl;

  // Fill base background first
  ctx.fillStyle = slide.bgColor || "#000";
  ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);

  // Define image draw area based on layout
  let imgAreaY = 0;
  let imgAreaH = SLIDE_H;
  if (hasImage) {
    if (layout === "top-strip") {
      imgAreaY = stripH;
      imgAreaH = SLIDE_H - stripH;
    } else if (layout === "magazine") {
      // Image on top 50% only
      imgAreaY = 0;
      imgAreaH = Math.round(SLIDE_H * 0.5);
    }
  }

  // Background image
  if (hasImage) {
    try {
      const img = await loadImage(slide.imageUrl!);
      const imgRatio = img.width / img.height;
      const areaRatio = SLIDE_W / imgAreaH;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgRatio > areaRatio) {
        sw = img.height * areaRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / areaRatio;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, imgAreaY, SLIDE_W, imgAreaH);

      // Dark overlay over the image area (only where text overlaps the image)
      // Magazine layout has text below image, so no overlay needed
      if (layout !== "magazine") {
        const overlayOpacity = slide.overlayOpacity ?? 0.65;
        ctx.fillStyle = `rgba(0,0,0,${overlayOpacity})`;
        ctx.fillRect(0, imgAreaY, SLIDE_W, imgAreaH);
      }
    } catch {
      // Fallback handled by base background fill
    }
  }

  ctx.fillStyle = slide.textColor || "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  if (layout === "magazine") {
    // Style 3: giant quote mark + serif typography with vertical yellow bar
    // Completely distinct from centered and top-strip

    // Reset: fill solid background (ignore image for this layout — keep it clean)
    ctx.fillStyle = slide.bgColor || "#0a0a0a";
    ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);

    const marginX = 110;
    const textColor = slide.textColor || "#ffffff";

    // Giant decorative quote mark (pale background)
    ctx.fillStyle = "#fbbf24";
    ctx.globalAlpha = 0.15;
    ctx.font = "900 700px Georgia, serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("\u201C", 40, 560);
    ctx.globalAlpha = 1;

    // Vertical yellow bar on the left
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(60, 360, 10, 600);

    // Small label at top
    ctx.fillStyle = textColor;
    ctx.globalAlpha = 0.5;
    ctx.font = "700 26px system-ui, sans-serif";
    ctx.letterSpacing = "4px";
    ctx.fillText("— REFLEXAO —", marginX, 260);
    ctx.globalAlpha = 1;

    // Title in big serif italic
    ctx.fillStyle = textColor;
    const titleFontSize = 84;
    const titleLineH = 100;
    ctx.font = `italic 700 ${titleFontSize}px Georgia, serif`;
    const titleLines = wrapText(ctx, slide.title, SLIDE_W - marginX - 100);
    const titleStartY = 420;
    titleLines.forEach((line, i) => {
      ctx.fillText(line, marginX, titleStartY + i * titleLineH);
    });

    // Double separator (yellow dots)
    const afterTitleY = titleStartY + titleLines.length * titleLineH + 60;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(marginX + 8, afterTitleY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(marginX + 40, afterTitleY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(marginX + 72, afterTitleY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Body in regular sans-serif
    if (slide.body) {
      ctx.fillStyle = textColor;
      ctx.font = "400 40px system-ui, sans-serif";
      ctx.globalAlpha = 0.85;
      const bodyLines = wrapText(ctx, slide.body, SLIDE_W - marginX - 100);
      const bodyStart = afterTitleY + 80;
      const bodyLineH = 56;
      bodyLines.forEach((line, i) => {
        ctx.fillText(line, marginX, bodyStart + i * bodyLineH);
      });
      ctx.globalAlpha = 1;
    }
  } else if (layout === "top-strip") {
    // Black strip at top with title
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, SLIDE_W, stripH);

    // Title in strip — anchored to bottom of strip
    ctx.fillStyle = slide.textColor || "#ffffff";
    ctx.font = "900 100px system-ui, sans-serif";
    const titleLines = wrapText(ctx, slide.title, SLIDE_W - 160);
    const titleLineH = 110;
    const lastLineY = stripH - 70;
    const firstLineY = lastLineY - (titleLines.length - 1) * titleLineH;
    titleLines.forEach((line, i) => {
      ctx.fillText(line, 80, firstLineY + i * titleLineH);
    });

    // Accent line just below the title
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(80, stripH - 20, 120, 6);

    // Body below strip (pushed down for breathing room)
    if (slide.body) {
      ctx.fillStyle = slide.textColor || "#ffffff";
      ctx.font = "500 44px system-ui, sans-serif";
      if (hasImage) {
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 25;
        ctx.shadowOffsetY = 3;
      }
      const bodyLines = wrapText(ctx, slide.body, SLIDE_W - 160);
      const bodyLineH = 60;
      bodyLines.forEach((line, i) => {
        ctx.fillText(line, 80, stripH + 130 + i * bodyLineH);
      });
    }
  } else {
    // Centered layout (default)
    if (hasImage) {
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
    }

    ctx.font = "bold 80px system-ui, sans-serif";
    const titleLines = wrapText(ctx, slide.title, SLIDE_W - 160);
    const titleLineH = 92;

    ctx.font = "400 44px system-ui, sans-serif";
    const bodyLines = wrapText(ctx, slide.body, SLIDE_W - 160);
    const bodyLineH = 60;

    const totalHeight =
      titleLines.length * titleLineH + 60 + bodyLines.length * bodyLineH;
    const startY = (SLIDE_H - totalHeight) / 2;

    ctx.font = "bold 80px system-ui, sans-serif";
    titleLines.forEach((line, i) => {
      ctx.fillText(line, 80, startY + (i + 1) * titleLineH);
    });

    ctx.font = "400 44px system-ui, sans-serif";
    ctx.globalAlpha = 0.85;
    const bodyStartY = startY + titleLines.length * titleLineH + 60;
    bodyLines.forEach((line, i) => {
      ctx.fillText(line, 80, bodyStartY + (i + 1) * bodyLineH - 20);
    });
    ctx.globalAlpha = 1;
  }

  // Reset shadow before watermark
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  drawWatermark(ctx, slide.textColor || "#ffffff");
}

export async function renderCtaSlide(
  canvas: HTMLCanvasElement,
  slide: CtaSlide
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = SLIDE_W;
  canvas.height = SLIDE_H;

  // Dark gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, SLIDE_H);
  gradient.addColorStop(0, "#0a0a0a");
  gradient.addColorStop(1, "#000000");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SLIDE_W, SLIDE_H);

  // Try to load and center logo
  try {
    const logo = await loadImage(DIAUM_LOGO_URL);
    const logoSize = 360;
    const logoX = (SLIDE_W - logoSize) / 2;
    const logoY = 260;
    ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
  } catch {
    // Fallback: simple circle
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(SLIDE_W / 2, 440, 180, 0, Math.PI * 2);
    ctx.fill();
  }

  // Headline
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 100px system-ui, sans-serif";
  ctx.fillText(slide.headline, SLIDE_W / 2, 720);

  // Body text
  ctx.font = "500 42px system-ui, sans-serif";
  ctx.globalAlpha = 0.85;
  const bodyLines = wrapText(ctx, slide.body, SLIDE_W - 160);
  const bodyLineH = 56;
  const bodyStartY = 830;
  bodyLines.forEach((line, i) => {
    ctx.fillText(line, SLIDE_W / 2, bodyStartY + i * bodyLineH);
  });
  ctx.globalAlpha = 1;

  drawWatermark(ctx, "#ffffff");
}

export async function renderSlide(
  canvas: HTMLCanvasElement,
  slide: Slide
): Promise<void> {
  if (slide.type === "cover") {
    await renderCoverSlide(canvas, slide);
  } else if (slide.type === "cta") {
    await renderCtaSlide(canvas, slide);
  } else {
    await renderTextSlide(canvas, slide);
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 0.95);
  });
}
