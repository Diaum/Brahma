import { NextResponse } from "next/server";
import { generateImage } from "@/lib/gemini-image";
import { supabase } from "@/lib/supabase";

const ILLUSTRATION_STYLE = `cartoon vector illustration in the style of Scratch AI Instagram infographics, bold thick outlines, cel-shaded flat colors, exaggerated proportions, simple rounded character design, clean background with solid gradient and simple geometric accents, social media carousel slide format, 4:5 aspect ratio, infographic style, bold typography integrated into the image composition, startup illustration aesthetic, friendly approachable characters with minimal facial details, warm earthy tones for characters, educational visual storytelling. NO realistic style, NO 3D rendering, NO photorealism, NO complex textures, NO watermarks`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { scene, headline, subtext, color_palette, character_id } = body;

    if (!scene) {
      return NextResponse.json(
        { error: "scene e obrigatorio" },
        { status: 400 }
      );
    }

    // Sanitize
    const sanitize = (text: string) =>
      text
        .replace(/pornografi[ao]/gi, "digital content dependency")
        .replace(/porn[ôo]/gi, "digital content")
        .replace(/sexu/gi, "compulsive")
        .replace(/masturba[çc][aã]o?/gi, "compulsive behavior")
        .replace(/v[ií]cio/gi, "dependency")
        .replace(/addiction/gi, "dependency");

    const palette = color_palette || "dark green gradient background";

    // Build prompt with text integration (like Scratch AI style)
    let prompt = `${ILLUSTRATION_STYLE}, ${palette}.

scene: ${sanitize(scene)}`;

    // Add text to be rendered IN the image (like the reference images)
    if (headline) {
      prompt += `

text on image (bold, large headline at the top, white or light color, uppercase):
"${sanitize(headline).toUpperCase()}"`;
    }

    if (subtext) {
      prompt += `

subtext (smaller text below headline or at bottom, white or light):
"${sanitize(subtext)}"`;
    }

    const result = await generateImage({
      prompt,
      aspectRatio: "4:5",
    });

    const imageBuffer = Buffer.from(result.imageBase64, "base64");

    // Upload to storage
    const slug = character_id ? character_id.slice(0, 8) : "general";
    const fileName = `illustrations/${slug}/${Date.now()}.png`;

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
