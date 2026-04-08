import { NextResponse } from "next/server";
import {
  translateDescription,
  buildCinematicPrompt,
} from "@/lib/prompt-generator";

export async function POST(request: Request) {
  const body = await request.json();
  const { name, age, description_pt } = body;

  if (!name || !age || !description_pt) {
    return NextResponse.json(
      { error: "Nome, idade e descricao sao obrigatorios" },
      { status: 400 }
    );
  }

  const descriptionEn = await translateDescription(description_pt);
  const prompt_base_en = buildCinematicPrompt(name, age, descriptionEn);

  return NextResponse.json({ prompt_base_en });
}
