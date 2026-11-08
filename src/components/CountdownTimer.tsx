import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Lock } from "lucide-react";

const CountdownTimer = ({ lockTime, label, onElapsed }: { lockTime: Date; label: string; onElapsed?: () => void }) => {
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, lockTime.getTime() - Date.now()));
  const elapsed = useRef(onElapsed);
  elapsed.current = onElapsed;

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, lockTime.getTime() - Date.now());
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        elapsed.current?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockTime]);

  const totalSecs = Math.floor(timeLeft / 1000);
  const days = Math.floor(totalSecs / 86_400);
  const hours = Math.floor((totalSecs % 86_400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  // Drop leading zero units so a match minutes away reads "04m 12s", not "0d 0h 04m 12s".
  const units = [
    { value: days, unit: "d" },
    { value: hours, unit: "h" },
    { value: mins, unit: "m" },
    { value: secs, unit: "s" },
  ];
  const firstNonZero = units.findIndex((u) => u.value > 0);
  const firstShown = firstNonZero === -1 ? 2 : Math.min(firstNonZero, 2);
  const shown = units.slice(firstShown);

  if (timeLeft <= 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 rounded-lg bg-card border border-border">
      <div className="flex items-center gap-2 min-w-0">
        <Lock className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground leading-tight">{label}</p>
          <p className="text-[11px] text-muted-foreground/70 leading-tight">{format(lockTime, "EEE, MMM d · h:mm a")}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5" aria-label={`${days} days ${hours} hours ${mins} minutes ${secs} seconds`}>
        {shown.map((u, i) => (
          <div
            key={u.unit}
            className="flex items-baseline gap-0.5 rounded-md bg-primary/10 border border-primary/30 px-2 py-1"
          >
            <span className="font-mono font-bold text-primary text-base tabular-nums">
              {i === 0 && u.unit === "d" ? u.value : pad(u.value)}
            </span>
            <span className="text-[10px] font-medium text-primary/70">{u.unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CountdownTimer;
