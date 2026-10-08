import { avatarHue, initials } from "@/lib/chat";
import { cn } from "@/lib/utils";

const sizes = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-11 w-11 text-sm",
};

const dots = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-3 w-3",
};

/** Initials on a colour that stays the same for a person everywhere, plus an online dot. */
const ChatAvatar = ({
  id,
  name,
  online,
  size = "md",
}: {
  id: string;
  name: string;
  online?: boolean;
  size?: keyof typeof sizes;
}) => {
  const hue = avatarHue(id);
  return (
    <div className="relative shrink-0">
      <div
        aria-hidden
        className={cn("flex items-center justify-center rounded-full font-semibold text-white shadow-sm", sizes[size])}
        style={{ background: `linear-gradient(135deg, hsl(${hue} 65% 48%), hsl(${hue + 24} 70% 34%))` }}
      >
        {initials(name)}
      </div>
      {online && (
        <span
          aria-label="Online"
          className={cn("absolute bottom-0 right-0 rounded-full bg-success ring-2 ring-card", dots[size])}
        />
      )}
    </div>
  );
};

export default ChatAvatar;

export const AdminBadge = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-primary",
      className,
    )}
  >
    Admin
  </span>
);
