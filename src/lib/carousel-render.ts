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
      // Style 3: split-half — image on top 60%, solid black bottom 40% with text
      // Image area is full 100% but text lives on bottom black strip
      const stripTop = Math.round(SLIDE_H * 0.62);
      const stripHeight = SLIDE_H - stripTop;

      // Bottom black strip
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, stripTop, SLIDE_W, stripHeight);

      // Small accent marker above strip
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(80, stripTop + 50, 60, 5);

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      // Title
      ctx.fillStyle = "#ffffff";
      const titleFontSize = 84;
      const titleLineH = 96;
      ctx.font = `900 ${titleFontSize}px system-ui, sans-serif`;
      const titleLines = wrapText(ctx, slide.title, SLIDE_W - 160);
      const titleStartY = stripTop + 140;
      titleLines.forEach((line, i) => {
        ctx.fillText(line, 80, titleStartY + i * titleLineH);
      });

      // Subtitle
      if (slide.subtitle) {
        ctx.font = "500 36px system-ui, sans-serif";
        ctx.globalAlpha = 0.85;
        const subLines = wrapText(ctx, slide.subtitle, SLIDE_W - 160);
        const subStart = titleStartY + titleLines.length * titleLineH + 20;
        subLines.forEach((line, i) => {
          ctx.fillText(line, 80, subStart + i * 48);
        });
        ctx.globalAlpha = 1;
      }
    } else if (layout === "top-strip") {
      // Style 2: solid color strip at top (image is already placed below it)
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
      const startY = (stripH - 40 - totalTitleH) / 2 + 90;
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
    // Style 3: editorial magazine — big number/accent, title below, body after
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // If there's an image, show it on top 50% with overlay
    if (hasImage) {
      const imgBottomY = Math.round(SLIDE_H * 0.5);
      // Solid dark strip below image
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, imgBottomY, SLIDE_W, SLIDE_H - imgBottomY);
      // Thin accent line between image and text
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(0, imgBottomY, SLIDE_W, 4);
    }

    // Content area: if image, below split; else full
    const contentTop = hasImage ? Math.round(SLIDE_H * 0.5) + 80 : 220;
    const marginX = 80;

    // Accent marker
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(marginX, contentTop, 60, 5);

    // Editorial label (small uppercase)
    ctx.fillStyle = slide.textColor || "#ffffff";
    ctx.font = "700 28px system-ui, sans-serif";
    ctx.globalAlpha = 0.6;
    ctx.fillText("EDITORIAL", marginX, contentTop + 55);
    ctx.globalAlpha = 1;

    // Title
    const titleFontSize = hasImage ? 68 : 88;
    const titleLineH = hasImage ? 80 : 102;
    ctx.font = `900 ${titleFontSize}px system-ui, sans-serif`;
    const titleLines = wrapText(ctx, slide.title, SLIDE_W - marginX * 2);
    const titleStartY = contentTop + 100;
    titleLines.forEach((line, i) => {
      ctx.fillText(line, marginX, titleStartY + i * titleLineH);
    });

    // Separator line
    const afterTitleY = titleStartY + titleLines.length * titleLineH + 30;
    ctx.fillStyle = slide.textColor || "#ffffff";
    ctx.globalAlpha = 0.3;
    ctx.fillRect(marginX, afterTitleY, 180, 2);
    ctx.globalAlpha = 1;

    // Body
    if (slide.body) {
      ctx.fillStyle = slide.textColor || "#ffffff";
      ctx.font = "400 38px Georgia, serif";
      ctx.globalAlpha = 0.9;
      const bodyLines = wrapText(ctx, slide.body, SLIDE_W - marginX * 2);
      const bodyStart = afterTitleY + 50;
      const bodyLineH = 52;
      bodyLines.forEach((line, i) => {
        ctx.fillText(line, marginX, bodyStart + i * bodyLineH);
      });
      ctx.globalAlpha = 1;
    }
  } else if (layout === "top-strip") {
    // Black strip at top with title
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, SLIDE_W, stripH);

    // Accent line
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(80, stripH - 8, 120, 6);

    // Title in strip
    ctx.fillStyle = slide.textColor || "#ffffff";
    ctx.font = "900 100px system-ui, sans-serif";
    const titleLines = wrapText(ctx, slide.title, SLIDE_W - 160);
    const titleLineH = 110;
    const totalTitleH = titleLines.length * titleLineH;
    const titleStartY = (stripH - 40 - totalTitleH) / 2 + 80;
    titleLines.forEach((line, i) => {
      ctx.fillText(line, 80, titleStartY + i * titleLineH);
    });

    // Body below strip (over image if present)
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
        ctx.fillText(line, 80, stripH + 90 + i * bodyLineH);
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
