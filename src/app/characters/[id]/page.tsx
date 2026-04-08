import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui";
import { Card } from "@/components/ui";

export default async function CharacterEpisodes({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <PageHeader
        title="Episódios"
        description={`Personagem: ${id}`}
        action={
          <a href={`/characters/${id}/episodes/new`}>
            <Button>+ Novo Episódio</Button>
          </a>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          href={`/characters/${id}/episodes/new`}
          className="border-2 border-dashed border-border flex flex-col items-center justify-center text-muted hover:text-accent min-h-[200px]"
        >
          <span className="text-4xl mb-2">+</span>
          <span>Criar episódio</span>
        </Card>
      </div>
    </div>
  );
}
