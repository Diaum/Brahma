"use client";

import { usePathname } from "next/navigation";

const labels: Record<string, string> = {
  "": "Home",
  characters: "Personagens",
  episodes: "Episódios",
  shots: "Shots",
  new: "Novo",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = labels[seg] || decodeURIComponent(seg);
    const isLast = i === segments.length - 1;

    return (
      <span key={href} className="flex items-center gap-2">
        <span className="text-muted">/</span>
        {isLast ? (
          <span className="text-foreground font-medium">{label}</span>
        ) : (
          <a href={href} className="text-muted hover:text-foreground transition">
            {label}
          </a>
        )}
      </span>
    );
  });

  return (
    <nav className="flex items-center gap-1 text-sm mb-6">
      <a href="/" className="text-muted hover:text-foreground transition">
        Home
      </a>
      {crumbs}
    </nav>
  );
}
