"use client";

import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Personagens", icon: "👤" },
];

export function Sidebar() {
  const pathname = usePathname();

  // Hide sidebar on character detail pages (they have their own sidebar)
  if (pathname.match(/^\/characters\/[^/]+$/)) {
    return null;
  }

  return (
    <aside className="hidden md:flex flex-col w-56 border-r border-border bg-card/50 p-4 gap-1">
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                isActive
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-muted hover:text-foreground hover:bg-card"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
