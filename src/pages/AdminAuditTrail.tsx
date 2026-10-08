import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { BrandLoader } from "@/components/Brand";
import { api } from "@/lib/api";
import AdminLayout from "@/components/AdminLayout";
import { useApp } from "@/context/AppContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const PAGE_SIZE = 20;

const actionColors: Record<string, string> = {
  Register: "bg-success/20 text-success",
  Login: "bg-secondary text-muted-foreground",
  ProfileUpdated: "bg-primary/20 text-primary",
  PasswordChanged: "bg-primary/20 text-primary",
  RoleChanged: "bg-primary/20 text-primary",
  StatusChanged: "bg-destructive/20 text-destructive",
  UserDeleted: "bg-destructive/20 text-destructive",
};

const AdminAuditTrail = () => {
  const { currentUser } = useApp();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading, isPlaceholderData, error } = useQuery({
    queryKey: ["admin-audit", debouncedSearch, page],
    queryFn: () => api.admin.audit.list({ search: debouncedSearch || undefined, page, pageSize: PAGE_SIZE }),
    enabled: currentUser?.role === "admin",
    placeholderData: keepPreviousData,
  });

  const entries = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <AdminLayout permission="audit.view">
      <div className="mx-auto max-w-6xl px-6 pt-8 pb-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Audit Trail</h1>
          <p className="text-sm text-muted-foreground">Recent account activity across all users</p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, action, field, value…"
            className="pl-9"
          />
        </div>

        {isLoading && !data && (
          <BrandLoader className="h-32" />
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive font-medium">Failed to load audit trail</p>
          </div>
        )}

        {data && (
          <>
            <div className={`rounded-xl border border-border bg-card overflow-hidden ${isPlaceholderData ? "opacity-60" : ""}`}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead>Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {format(new Date(e.createdAt), "MMM d, HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium ${
                            actionColors[e.action] ?? "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {e.action}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{e.userName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {e.actorUserId === e.userId ? "Self" : e.actorName ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{e.field ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {e.previousValue !== null || e.newValue !== null ? (
                          <span className="flex items-center gap-1.5">
                            <span className="text-muted-foreground line-through decoration-destructive/50">
                              {e.previousValue ?? "—"}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-medium text-success">{e.newValue ?? "—"}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{e.details ?? "—"}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {entries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {debouncedSearch ? "No activity matches your search." : "No activity recorded yet."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {totalCount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Prev
                  </Button>
                  <span className="text-muted-foreground text-xs">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminAuditTrail;
