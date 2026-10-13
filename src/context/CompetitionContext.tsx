import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/context/AppContext";
import { api, type CompetitionDto, type MatchWeekDto } from "@/lib/api";

export const LA_LIGA = "la-liga";
const STORAGE_KEY = "op_competition";

/**
 * Which competition the pages show: its weeks, its season table, its live matches. While only
 * La Liga is on there's nothing to choose and no switcher, so the app looks as it always did.
 * The choice is kept in this browser, shared by the game and the back office.
 */
interface CompetitionState {
  // As the API sends them: the ones switched on, plus (for admins) the ones switched off.
  all: CompetitionDto[];
  selectedId: string;
  setCompetition: (id: string) => void;
}

const CompetitionContext = createContext<CompetitionState | undefined>(undefined);

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? LA_LIGA;
  } catch {
    return LA_LIGA;
  }
};

export const CompetitionProvider = ({ children }: { children: ReactNode }) => {
  const { currentUser } = useApp();
  const [selectedId, setSelectedId] = useState(readStored);
  const { data: all = [] } = useQuery({
    queryKey: ["competitions"],
    queryFn: api.competitions.list,
    enabled: !!currentUser,
    staleTime: 5 * 60_000,
  });

  const setCompetition = useCallback((id: string) => {
    setSelectedId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage unavailable (private mode): the choice lasts until the page reloads.
    }
  }, []);

  return <CompetitionContext.Provider value={{ all, selectedId, setCompetition }}>{children}</CompetitionContext.Provider>;
};

/**
 * The competition to show. "game": only competitions players can predict, which is what the
 * game pages offer even to an admin. "admin": every one the API sent, including any switched off,
 * so the back office can set one up before it opens. A choice that isn't on offer falls back to
 * the first (La Liga), as does everything while the list is loading.
 */
export function useCompetition(scope: "game" | "admin" = "game") {
  const context = useContext(CompetitionContext);
  if (!context) throw new Error("useCompetition must be used inside CompetitionProvider");
  const { all, selectedId, setCompetition } = context;

  const options = scope === "game" ? all.filter((c) => c.enabled) : all;
  const competitionId = options.some((c) => c.id === selectedId) ? selectedId : (options[0]?.id ?? LA_LIGA);
  const competition = options.find((c) => c.id === competitionId);

  // For useQuery's `select` on the weeks list; stable per competition so results stay cached.
  const selectWeeks = useCallback(
    (weeks: MatchWeekDto[]) => weeks.filter((w) => (w.competitionId ?? LA_LIGA) === competitionId),
    [competitionId],
  );

  return {
    options,
    competitionId,
    competitionName: competition?.name ?? "La Liga",
    setCompetition,
    // Only worth a switcher when there's more than one.
    hasChoice: options.length > 1,
    selectWeeks,
  };
}
