import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { MatchWeekDto, WeekParticipationDto } from "@/lib/api";
import { sortWeeks, weekLabel } from "@/lib/weeks";

// Categorical slots 1–3 stepped for the dark card (#11151d); checked with the dataviz validator.
const BLUE = "#3987e5";
const ORANGE = "#d95926";
const AQUA = "#199e70";
// Card background, used as the 2px gap between slices and stacked segments.
const GAP = "hsl(var(--card))";

const participationConfig = {
  complete: { label: "All predicted", color: AQUA },
  partial: { label: "Some predicted", color: ORANGE },
  none: { label: "None yet", color: BLUE },
} satisfies ChartConfig;

type ParticipationKey = keyof typeof participationConfig;

export const ParticipationChart = ({ participation }: { participation: WeekParticipationDto }) => {
  const { players, fixtureCount } = participation;
  const counts: Record<ParticipationKey, number> = { complete: 0, partial: 0, none: 0 };
  for (const p of players) {
    counts[p.predicted >= fixtureCount ? "complete" : p.predicted > 0 ? "partial" : "none"]++;
  }
  const data = (Object.keys(participationConfig) as ParticipationKey[]).map((key) => ({
    key,
    name: participationConfig[key].label,
    value: counts[key],
  }));
  const percent = players.length > 0 ? Math.round((counts.complete / players.length) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold">Predictions this week</p>
      <p className="text-xs text-muted-foreground">{participation.weekName}</p>
      {players.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No players yet</p>
      ) : (
        <div className="mt-2 flex items-center gap-4">
          <div className="relative h-36 w-36 shrink-0">
            <ChartContainer config={participationConfig} className="aspect-square h-full w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="key"
                  innerRadius="62%"
                  outerRadius="100%"
                  stroke={GAP}
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {data.map((d) => (
                    <Cell key={d.key} fill={`var(--color-${d.key})`} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold">{percent}%</span>
              <span className="text-[10px] text-muted-foreground">done</span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-2 text-sm">
            {data.map((d) => (
              <li key={d.key} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: participationConfig[d.key].color }} />
                <span className="flex-1 truncate text-muted-foreground">{d.name}</span>
                <span className="font-semibold tabular-nums">{d.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const fixturesConfig = {
  played: { label: "Played", color: BLUE },
  toPlay: { label: "To play", color: ORANGE },
} satisfies ChartConfig;

// The last weeks up to the one being predicted now.
const WEEKS_SHOWN = 8;

export const FixturesChart = ({ weeks, currentWeekId }: { weeks: MatchWeekDto[]; currentWeekId?: string }) => {
  const sorted = sortWeeks(weeks);
  const current = sorted.findIndex((w) => w.id === currentWeekId);
  const end = current >= 0 ? current + 1 : sorted.length;
  const data = sorted.slice(Math.max(end - WEEKS_SHOWN, 0), end).map((w) => ({
    week: weekLabel(w),
    // Postponed and cancelled fixtures are left out of both.
    played: w.fixtures.filter((f) => f.status === "ended").length,
    toPlay: w.fixtures.filter((f) => f.status === "pre_match" || f.status === "live").length,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Fixtures by week</p>
          <p className="text-xs text-muted-foreground">Up to the current week</p>
        </div>
        <ul className="flex gap-3 text-xs text-muted-foreground">
          {(Object.keys(fixturesConfig) as (keyof typeof fixturesConfig)[]).map((key) => (
            <li key={key} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: fixturesConfig[key].color }} />
              {fixturesConfig[key].label}
            </li>
          ))}
        </ul>
      </div>
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No fixtures yet</p>
      ) : (
        <ChartContainer config={fixturesConfig} className="mt-3 aspect-auto h-44 w-full">
          <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={6} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={48} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <Bar dataKey="played" stackId="f" fill="var(--color-played)" stroke={GAP} strokeWidth={2} maxBarSize={32} isAnimationActive={false} />
            <Bar dataKey="toPlay" stackId="f" fill="var(--color-toPlay)" stroke={GAP} strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
};
