import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import {
  startVideoGeneration,
  pollVideoOperation,
  downloadVideo,
} from "@/lib/veo-video";
import {
  uploadImage as pixUploadImage,
  startImageToVideo as pixStartVideo,
  pollVideoStatus as pixPollStatus,
  downloadPixVerseVideo,
} from "@/lib/pixverse-video";
import { getShotContext } from "@/lib/storage-paths";

// POST: Start video generation for a shot
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { shotId, prompt, duration, provider = "veo", useRawPrompt = false } = body;

    if (!shotId) {
      return NextResponse.json(
        { error: "shotId e obrigatorio" },
        { status: 400 }
      );
    }

    // Get the shot's image
    const { data: shot, error: shotError } = await supabase
      .from("shots")
      .select("image_url, prompt_full, prompt_scene")
      .eq("id", shotId)
      .single();

    if (shotError || !shot) {
      return NextResponse.json(
        { error: "Shot nao encontrado" },
        { status: 404 }
      );
    }

    // Fetch the shot image as base64
    let imageBase64: string | undefined;
    let imageMimeType: string | undefined;

    if (shot.image_url) {
      try {
        const imgRes = await fetch(shot.image_url);
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          imageBase64 = Buffer.from(buffer).toString("base64");
          imageMimeType = imgRes.headers.get("content-type") || "image/png";
        }
      } catch (err) {
        console.error("[animate-shot] Failed to fetch image:", err);
      }
    }

    const rawPrompt = prompt || shot.prompt_full || shot.prompt_scene;

    // Sanitize prompt — both APIs are strict
    const visualPrompt = rawPrompt
      .replace(/pornografi[ao]/gi, "compulsive screen behavior")
      .replace(/porn[ôo]/gi, "screen content")
      .replace(/sexu/gi, "compulsive")
      .replace(/masturba[çc][aã]o?/gi, "isolation behavior")
      .replace(/v[ií]cio/gi, "compulsion")
      .replace(/addiction/gi, "compulsion")
      .replace(/pornography/gi, "compulsive screen behavior");

    // If useRawPrompt is true, send exactly what user wrote. Otherwise wrap it.
    let animationPrompt: string;
    if (useRawPrompt) {
      animationPrompt = visualPrompt;
    } else {
      // Pull the character appearance from the shot's prompt_full (first sentence)
      const charContext = (shot.prompt_full || "").split(/\.\s/)[0] || "";
      animationPrompt = `Animate this image with natural cinematic motion. The character moves and acts according to the scene — natural body movement, head turns, gestures, micro-expressions, environmental motion (people, objects, light shifts). Use subtle camera work (slow push-in, gentle pan, or handheld sway) to enhance the cinematic feel. No dialogue, no speech, no text, no audio overlays. Keep visual style, lighting and character identical to the source image. Character: ${charContext}. Scene action: ${visualPrompt}`;
    }

    let opIdentifier: string;

    if (provider === "pixverse") {
      if (!imageBase64) {
        return NextResponse.json(
          { error: "PixVerse requer uma imagem" },
          { status: 400 }
        );
      }

      const imgId = await pixUploadImage(imageBase64, imageMimeType || "image/png");
      const videoId = await pixStartVideo({
        imgId,
        prompt: animationPrompt,
        duration: (duration ?? 5) === 8 ? 8 : 5,
        quality: "540p",
        motionMode: "normal",
      });

      opIdentifier = `pixverse:${videoId}`;
    } else {
      // Veo (default)
      const operationName = await startVideoGeneration({
        prompt: animationPrompt,
        imageBase64,
        imageMimeType,
        aspectRatio: "16:9",
        duration: duration ?? 4,
      });
      opIdentifier = `veo:${operationName}`;
    }

    // Save operation identifier to shot
    await supabase
      .from("shots")
      .update({ video_operation: opIdentifier, status: "animated" })
      .eq("id", shotId);

    return NextResponse.json({ operationName: opIdentifier, shotId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[animate-shot] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET: Poll video status and download when ready
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shotId = searchParams.get("shotId");
    const operationName = searchParams.get("operation");

    if (!shotId || !operationName) {
      return NextResponse.json(
        { error: "shotId e operation sao obrigatorios" },
        { status: 400 }
      );
    }

    console.log("[animate-shot GET] Polling:", operationName);

    // Determine provider from prefix
    const isPixVerse = operationName.startsWith("pixverse:");
    const isVeo = operationName.startsWith("veo:") || (!isPixVerse && operationName.includes("operations/"));

    let done = false;
    let videoBuffer: Buffer | null = null;
    let videoMime = "video/mp4";
    let errorMsg: string | null = null;

    if (isPixVerse) {
      const videoId = parseInt(operationName.replace("pixverse:", ""), 10);
      const status = await pixPollStatus(videoId);

      if (!status.done) {
        return NextResponse.json({ done: false, shotId });
      }

      if (status.error) {
        errorMsg = status.error;
      } else if (status.url) {
        const { buffer, mimeType } = await downloadPixVerseVideo(status.url);
        videoBuffer = buffer;
        videoMime = mimeType;
      }
      done = true;
    } else if (isVeo) {
      const veoOpName = operationName.startsWith("veo:")
        ? operationName.replace("veo:", "")
        : operationName;
      const status = await pollVideoOperation(veoOpName);

      if (!status.done) {
        return NextResponse.json({ done: false, shotId });
      }

      if (status.error) {
        errorMsg = status.error;
      } else if (status.videoUri) {
        const { buffer, mimeType } = await downloadVideo(status.videoUri);
        videoBuffer = buffer;
        videoMime = mimeType;
      }
      done = true;
    }

    if (!done) {
      return NextResponse.json({ done: false, shotId });
    }

    if (errorMsg) {
      console.error("[animate-shot GET] Error:", errorMsg);
      await supabase
        .from("shots")
        .update({ video_operation: null, status: "approved" })
        .eq("id", shotId);
      return NextResponse.json(
        { done: true, error: errorMsg },
        { status: 500 }
      );
    }

    if (videoBuffer) {
      const ctx = await getShotContext(shotId);
      const fileName = ctx
        ? `${ctx.characterSlug}/ep${String(ctx.episodeNumber).padStart(2, "0")}/video-shot${String(ctx.shotNumber).padStart(2, "0")}-${Date.now()}.mp4`
        : `videos/${shotId}/${Date.now()}.mp4`;

      const { error: uploadError } = await supabase.storage
        .from("brahma-images")
        .upload(fileName, videoBuffer, {
          contentType: videoMime,
          upsert: true,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: `Upload error: ${uploadError.message}` },
          { status: 500 }
        );
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("brahma-images").getPublicUrl(fileName);

      await supabase
        .from("shots")
        .update({ video_url: publicUrl, video_operation: null })
        .eq("id", shotId);

      return NextResponse.json({ done: true, video_url: publicUrl, shotId });
    }

    return NextResponse.json({ done: true, error: "No video data" }, { status: 500 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[animate-shot] Poll error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
