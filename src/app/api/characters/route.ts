import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import {
  translateDescription,
  buildCinematicPrompt,
} from "@/lib/prompt-generator";

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
  const { name, age, description_pt, prompt_base_en: manualPrompt } = body;

  if (!name || !age || !description_pt) {
    return NextResponse.json(
      { error: "Nome, idade e descricao sao obrigatorios" },
      { status: 400 }
    );
  }

  let prompt_base_en: string;
  if (manualPrompt) {
    // User edited the prompt manually
    prompt_base_en = manualPrompt;
  } else {
    // Auto-generate from Portuguese description
    const descriptionEn = await translateDescription(description_pt);
    prompt_base_en = buildCinematicPrompt(name, age, descriptionEn);
  }

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
