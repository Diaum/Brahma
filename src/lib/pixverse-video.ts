import crypto from "crypto";

const BASE_URL = "https://app-api.pixverse.ai/openapi/v2";

function getApiKey(): string {
  const key = process.env.PIXEL_VERSE_KEY;
  if (!key) throw new Error("PIXEL_VERSE_KEY nao configurada");
  return key;
}

function newTraceId(): string {
  return crypto.randomUUID();
}

interface PixVerseError {
  ErrCode: number;
  ErrMsg: string;
}

interface UploadResponse extends PixVerseError {
  Resp?: {
    img_id: number;
    img_url: string;
  };
}

interface GenerateResponse extends PixVerseError {
  Resp?: {
    video_id: number;
  };
}

interface StatusResponse extends PixVerseError {
  Resp?: {
    id: number;
    status: number; // 1: success, 5: in progress, 7: moderation failed, 8: failed
    url: string;
    prompt: string;
  };
}

export async function uploadImage(
  base64Data: string,
  mimeType: string
): Promise<number> {
  const apiKey = getApiKey();
  const buffer = Buffer.from(base64Data, "base64");

  // Build multipart/form-data manually to send file
  const ext = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
  const formData = new FormData();
  formData.append("image", blob, `upload.${ext}`);

  const res = await fetch(`${BASE_URL}/image/upload`, {
    method: "POST",
    headers: {
      "API-KEY": apiKey,
      "Ai-trace-id": newTraceId(),
    },
    body: formData,
  });

  const data: UploadResponse = await res.json();
  console.log("[pixverse upload]", JSON.stringify(data).slice(0, 300));

  if (data.ErrCode !== 0 || !data.Resp?.img_id) {
    throw new Error(`PixVerse upload error: ${data.ErrMsg || "unknown"}`);
  }

  return data.Resp.img_id;
}

interface StartVideoOptions {
  imgId: number;
  prompt: string;
  duration?: 5 | 8;
  quality?: "360p" | "540p" | "720p" | "1080p";
  motionMode?: "normal" | "fast";
  negativePrompt?: string;
  cameraMovement?: string;
}

export async function startImageToVideo(
  options: StartVideoOptions
): Promise<number> {
  const apiKey = getApiKey();

  // 1080p only supports 5s and normal motion (per PixVerse docs)
  const quality = options.quality ?? "1080p";
  const duration = quality === "1080p" ? 5 : (options.duration ?? 5);
  const motionMode = quality === "1080p" ? "normal" : (options.motionMode ?? "normal");

  const body: Record<string, unknown> = {
    img_id: options.imgId,
    prompt: options.prompt,
    model: "v4.5",
    duration,
    quality,
    motion_mode: motionMode,
  };

  if (options.negativePrompt) body.negative_prompt = options.negativePrompt;
  if (options.cameraMovement) body.camera_movement = options.cameraMovement;

  const res = await fetch(`${BASE_URL}/video/img/generate`, {
    method: "POST",
    headers: {
      "API-KEY": apiKey,
      "Ai-trace-id": newTraceId(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data: GenerateResponse = await res.json();
  console.log("[pixverse generate]", JSON.stringify(data).slice(0, 300));

  if (data.ErrCode !== 0 || !data.Resp?.video_id) {
    throw new Error(`PixVerse generate error: ${data.ErrMsg || "unknown"}`);
  }

  return data.Resp.video_id;
}

export interface PixVerseStatus {
  done: boolean;
  videoId: number;
  url?: string;
  error?: string;
}

export async function pollVideoStatus(videoId: number): Promise<PixVerseStatus> {
  const apiKey = getApiKey();

  const res = await fetch(`${BASE_URL}/video/result/${videoId}`, {
    method: "GET",
    headers: {
      "API-KEY": apiKey,
      "Ai-trace-id": newTraceId(),
    },
  });

  const data: StatusResponse = await res.json();
  console.log("[pixverse poll]", JSON.stringify(data).slice(0, 300));

  if (data.ErrCode !== 0 || !data.Resp) {
    return { done: false, videoId, error: data.ErrMsg };
  }

  const { status, url } = data.Resp;

  // 1: success, 5: in progress, 7: moderation failed, 8: failed
  if (status === 1) {
    return { done: true, videoId, url };
  }

  if (status === 7) {
    return {
      done: true,
      videoId,
      error: "Bloqueado pela moderacao de conteudo",
    };
  }

  if (status === 8) {
    return { done: true, videoId, error: "Falha na geracao" };
  }

  return { done: false, videoId };
}

export async function downloadPixVerseVideo(
  url: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download error: ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") || "video/mp4";
  return { buffer, mimeType };
}
