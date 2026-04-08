import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; episodeId: string; shotId: string }> }
) {
  const { shotId } = await params;

  const { data, error } = await supabase
    .from("shots")
    .select("*")
    .eq("id", shotId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; episodeId: string; shotId: string }> }
) {
  const { shotId } = await params;
  const body = await request.json();

  const { data, error } = await supabase
    .from("shots")
    .update(body)
    .eq("id", shotId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; episodeId: string; shotId: string }> }
) {
  const { shotId } = await params;

  const { error } = await supabase
    .from("shots")
    .delete()
    .eq("id", shotId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
