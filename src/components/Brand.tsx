import { cn } from "@/lib/utils";

// The octopus emblem (transparent WebP, 256px source) used wherever the app shows its brand.
const MARK_SRC = "/brand/logo-mark.webp";

export const BrandMark = ({ className, alt = "Octopus Prediction" }: { className?: string; alt?: string }) => (
  <img src={MARK_SRC} alt={alt} draggable={false} className={cn("h-8 w-8 shrink-0 select-none object-contain", className)} />
);

// Emblem plus the name, for headers. `size` scales both together.
export const BrandLogo = ({
  label = "Octopus Prediction",
  size = "sm",
  className,
}: {
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) => (
  <div className={cn("flex items-center", size === "md" ? "gap-2.5" : "gap-2", className)}>
    <BrandMark alt="" className={size === "md" ? "h-10 w-10 drop-shadow-[0_0_12px_hsl(var(--primary)/0.35)]" : "h-8 w-8"} />
    <span className={cn("font-bold tracking-wide text-foreground", size === "md" ? "text-base" : "text-sm")}>{label}</span>
  </div>
);

// Branded loading state for pages and panels: the emblem breathing inside a spinning arc.
// Small inline spinners (buttons, counters) stay as the plain Loader2 icon.
export const BrandLoader = ({
  label,
  size = "md",
  className,
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) => {
  const box = { sm: "h-10 w-10", md: "h-14 w-14", lg: "h-20 w-20" }[size];
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <div className={cn("relative", box)}>
        <span className="absolute inset-0 rounded-full border-2 border-primary/15 border-t-primary motion-safe:animate-spin" />
        <BrandMark alt="" className="absolute left-[18%] top-[18%] h-[64%] w-[64%] motion-safe:animate-brand-pulse" />
      </div>
      <span className={label ? "text-xs font-medium text-muted-foreground" : "sr-only"}>{label ?? "Loading…"}</span>
    </div>
  );
};
