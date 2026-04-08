import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import {
  translateDescription,
  buildCinematicPrompt,
} from "@/lib/prompt-generator";

export async function POST() {
  const { data: characters, error } = await supabase
    .from("characters")
    .select("id, name, age, description_pt");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];

  for (const char of characters || []) {
    const descEn = await translateDescription(char.description_pt);
    const prompt_base_en = buildCinematicPrompt(char.name, char.age, descEn);

    const { error: updateError } = await supabase
      .from("characters")
      .update({ prompt_base_en })
      .eq("id", char.id);

    results.push({
      id: char.id,
      name: char.name,
      success: !updateError,
    });
  }

  return NextResponse.json({ updated: results.length, results });
}
