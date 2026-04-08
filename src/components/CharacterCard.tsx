interface CharacterCardProps {
  id: string;
  name: string;
  age: number;
  description_pt?: string;
}

export function CharacterCard({ id, name, age, description_pt }: CharacterCardProps) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <a
      href={`/characters/${id}`}
      className="block bg-card border border-border rounded-xl p-4 hover:bg-card-hover hover:border-accent/30 transition group"
    >
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-20 h-20 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center text-accent text-2xl font-bold group-hover:bg-accent/20 transition">
          {initials}
        </div>
        <div>
          <h3 className="font-semibold text-lg leading-tight">{name}</h3>
          <p className="text-muted text-sm mt-0.5">{age} anos</p>
        </div>
        {description_pt && (
          <p className="text-muted text-xs line-clamp-2">{description_pt}</p>
        )}
      </div>
    </a>
  );
}
