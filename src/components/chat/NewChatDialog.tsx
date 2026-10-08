import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { api, type ChatUserDto } from "@/lib/api";
import { chatKeys } from "@/lib/chat";
import { useChat } from "@/context/ChatContext";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import ChatAvatar from "./ChatAvatar";

const Person = ({ user, onSelect, disabled }: { user: ChatUserDto; onSelect: () => void; disabled: boolean }) => {
  const { isOnline } = useChat();
  const online = isOnline(user.id, user.isOnline);
  return (
    <CommandItem
      value={`${user.name} ${user.whatsAppName ?? ""} ${user.id}`}
      onSelect={onSelect}
      disabled={disabled}
      className="gap-3 rounded-lg py-2"
    >
      <ChatAvatar id={user.id} name={user.name} online={online} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        {user.whatsAppName && user.whatsAppName !== user.name && (
          <p className="truncate text-xs text-muted-foreground">{user.whatsAppName}</p>
        )}
      </div>
      {online && <span className="text-[11px] text-success">Online</span>}
    </CommandItem>
  );
};

/** Pick anyone to message. Admins are listed first so players can find help quickly. */
const NewChatDialog = ({
  open,
  onOpenChange,
  onPick,
  pendingUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (user: ChatUserDto) => void;
  pendingUserId: string | null;
}) => {
  const { data: users = [], isLoading } = useQuery({
    queryKey: chatKeys.directory,
    queryFn: api.chat.directory,
    enabled: open,
    staleTime: 60_000,
  });

  const admins = users.filter((u) => u.isAdmin);
  const players = users.filter((u) => !u.isAdmin);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="px-5 pb-3 pt-5">
          <DialogTitle>New chat</DialogTitle>
          <DialogDescription className="mt-1">Who do you want to message?</DialogDescription>
        </div>
        <Command className="rounded-none border-t border-border">
          <CommandInput placeholder="Search by name or WhatsApp name" />
          <CommandList className="max-h-[min(420px,60vh)] p-1">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>Nobody by that name.</CommandEmpty>
                {admins.length > 0 && (
                  <CommandGroup heading="Admins">
                    {admins.map((u) => (
                      <Person key={u.id} user={u} onSelect={() => onPick(u)} disabled={!!pendingUserId} />
                    ))}
                  </CommandGroup>
                )}
                {players.length > 0 && (
                  <CommandGroup heading="Players">
                    {players.map((u) => (
                      <Person key={u.id} user={u} onSelect={() => onPick(u)} disabled={!!pendingUserId} />
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
        {pendingUserId && (
          <div className="flex items-center justify-center gap-2 border-t border-border py-2.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Opening chat…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewChatDialog;
