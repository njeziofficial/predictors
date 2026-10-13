import { useCompetition } from "@/context/CompetitionContext";

/**
 * Picks the competition every page shows. Renders nothing unless there's a choice, so with only
 * La Liga on the app looks exactly as before. In the back office, competitions that are switched
 * off are offered too (marked "off"), so admins can prepare them.
 */
const CompetitionSwitcher = ({ scope = "game", className = "" }: { scope?: "game" | "admin"; className?: string }) => {
  const { options, competitionId, setCompetition, hasChoice } = useCompetition(scope);
  if (!hasChoice) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Competition"
      className={`flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-secondary p-1 [scrollbar-width:none] ${className}`}
    >
      {options.map((c) => {
        const active = c.id === competitionId;
        return (
          <button
            key={c.id}
            role="radio"
            aria-checked={active}
            onClick={() => setCompetition(c.id)}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.name}
            {!c.enabled && (
              <span className="rounded bg-muted px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                off
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default CompetitionSwitcher;
