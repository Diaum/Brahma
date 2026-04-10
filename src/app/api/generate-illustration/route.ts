import { NextResponse } from "next/server";
import { generateImage } from "@/lib/gemini-image";
import { supabase } from "@/lib/supabase";

const ILLUSTRATION_STYLE = `flat vector illustration, minimalist cartoon style, educational infographic, clean composition, simple shapes, soft shadows, modern corporate illustration, social media carousel slide, friendly character design, rounded shapes, vector art, flat colors, minimal details, high contrast, instagram carousel format, 4:5 ratio, infographic style, carousel slide, bold typography space, startup illustration style. no realistic style, no 3D, no photorealism, no complex details, no text on image, no words, no letters, no typography`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { scene, color_palette, character_id } = body;

    if (!scene) {
      return NextResponse.json(
        { error: "scene e obrigatorio" },
        { status: 400 }
      );
    }

    // Sanitize
    const sanitizedScene = scene
      .replace(/pornografi[ao]/gi, "digital content dependency")
      .replace(/porn[ôo]/gi, "digital content")
      .replace(/sexu/gi, "compulsive")
      .replace(/masturba[çc][aã]o?/gi, "compulsive behavior")
      .replace(/v[ií]cio/gi, "dependency")
      .replace(/addiction/gi, "dependency");

    const palette = color_palette || "dark green and teal color palette";

    const prompt = `${ILLUSTRATION_STYLE}, ${palette}.

scene: ${sanitizedScene}

background: solid gradient with simple geometric shapes, clean and modern`;

    const result = await generateImage({
      prompt,
      aspectRatio: "4:5",
    });

    const imageBuffer = Buffer.from(result.imageBase64, "base64");

    // Upload to Supabase storage
    const charSlug = character_id ? character_id.slice(0, 8) : "illustrations";
    const fileName = `illustrations/${charSlug}/${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("brahma-images")
      .upload(fileName, imageBuffer, {
        contentType: result.mimeType,
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

    return NextResponse.json({ image_url: publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[generate-illustration] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
