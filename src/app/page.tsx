export default function Home() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Personagens</h1>
          <p className="text-muted mt-1">
            Crie e gerencie seus personagens para producao de video
          </p>
        </div>
        <a
          href="/characters/new"
          className="bg-accent text-black font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition"
        >
          + Novo Personagem
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <a
          href="/characters/new"
          className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center text-muted hover:border-accent hover:text-accent transition min-h-[200px]"
        >
          <span className="text-4xl mb-2">+</span>
          <span>Criar personagem</span>
        </a>
      </div>
    </div>
  );
}
