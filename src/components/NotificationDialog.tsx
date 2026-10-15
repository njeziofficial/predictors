import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowRight, BellRing, Megaphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { InboxItemDto } from "@/lib/api";
import { kindLabel } from "@/lib/notificationCount";
import { cn } from "@/lib/utils";

export const KindIcon = ({ kind, className }: { kind: InboxItemDto["kind"]; className?: string }) =>
  kind === "announcement" ? (
    <Megaphone className={cn("h-4 w-4 text-primary", className)} />
  ) : (
    <BellRing className={cn("h-4 w-4 text-primary", className)} />
  );

/**
 * One notification in full: the whole message, when it came, and a way to its page (when it
 * has one other than home) or to delete it.
 */
const NotificationDialog = ({
  item,
  onClose,
  onDelete,
}: {
  item: InboxItemDto | null;
  onClose: () => void;
  onDelete: (item: InboxItemDto) => void;
}) => {
  const navigate = useNavigate();
  const hasPage = !!item?.url && item.url !== "/";

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        {item && (
          <>
            <DialogHeader className="text-left">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <KindIcon kind={item.kind} className="h-3.5 w-3.5" />
                <span>{kindLabel(item.kind)}</span>
              </div>
              <DialogTitle className="break-words pr-6 leading-snug">{item.title}</DialogTitle>
              <DialogDescription className="text-xs" title={format(new Date(item.createdAt), "PPpp")}>
                {format(new Date(item.createdAt), "EEE d MMM yyyy, HH:mm")} ·{" "}
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </DialogDescription>
            </DialogHeader>
            <p className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed">
              {item.body}
            </p>
            <DialogFooter className="flex-row gap-2 sm:justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDelete(item)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
              </Button>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
                {hasPage && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onClose();
                      navigate(item.url);
                    }}
                  >
                    Open <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NotificationDialog;
