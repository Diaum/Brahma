import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  href?: string;
}

export function Card({ href, className = "", children, ...props }: CardProps) {
  const classes = `bg-card border border-border rounded-xl p-4 hover:bg-card-hover hover:border-accent/30 transition ${className}`;

  if (href) {
    return (
      <a href={href} className={`block ${classes}`}>
        {children}
      </a>
    );
  }

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
