import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui";

export default async function EpisodeShots({
  params,
}: {
  params: Promise<{ id: string; episodeId: string }>;
}) {
  const { id, episodeId } = await params;

  return (
    <div>
      <PageHeader
        title="Shots"
        description={`Episódio: ${episodeId}`}
        action={
          <div className="flex gap-2">
            <a href={`/characters/${id}/episodes/${episodeId}/script`}>
              <Button variant="secondary">Roteiro</Button>
            </a>
            <Button>+ Gerar Shot</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <Card className="border-2 border-dashed border-border flex flex-col items-center justify-center text-muted min-h-[200px]">
          <span className="text-4xl mb-2">🎬</span>
          <span>Nenhum shot ainda</span>
        </Card>
      </div>
    </div>
  );
}
