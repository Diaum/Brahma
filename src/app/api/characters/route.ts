import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

function buildCinematicPrompt(name: string, age: number, description: string): string {
  return `Cinematic still frame of ${name}, a ${age}-year-old Brazilian man, ${description}. Shot on Arri Alexa with vintage anamorphic lens, shallow depth of field, heavy teal-green color grading, crushed blacks, desaturated skin tones, visible film grain, subtle lens vignette. Low-key lighting with dramatic contrast. Style: Brazilian neo-realism cinema, City of God and Elite Squad cinematography. Widescreen 16:9 cinematic aspect ratio, photorealistic, raw gritty atmosphere, documentary handheld camera feel. Hyperrealistic, 8K detail on skin texture and pores.`;
}

export async function GET() {
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, age, description_pt } = body;

  if (!name || !age || !description_pt) {
    return NextResponse.json(
      { error: "Nome, idade e descricao sao obrigatorios" },
      { status: 400 }
    );
  }

  const prompt_base_en = buildCinematicPrompt(name, age, description_pt);

  const { data, error } = await supabase
    .from("characters")
    .insert({ name, age, description_pt, prompt_base_en })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
