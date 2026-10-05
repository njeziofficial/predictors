import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, Trash2, Upload, Eye, Copy, Check, FileDown } from "lucide-react";
import {
  api,
  type PreviousPointsImportRow,
  type PreviousPointsImportResult,
  type PreviousPointsImportAction,
} from "@/lib/api";
import { parseCsv } from "@/lib/csv";
import AdminLayout from "@/components/AdminLayout";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const DEFAULT_LABEL = "Before the app";
const SAMPLE_CSV = "email,points,name,phone,whatsapp\njane@example.com,120,Jane Doe,08012345678,Jane D\n";

// Accepted header spellings → import field. Matching ignores case, spaces, underscores and dashes.
const HEADER_ALIASES: Record<string, keyof PreviousPointsImportRow> = {
  email: "email",
  emailaddress: "email",
  points: "points",
  pts: "points",
  totalpoints: "points",
  name: "name",
  fullname: "name",
  phone: "phoneNumber",
  phonenumber: "phoneNumber",
  whatsapp: "whatsAppName",
  whatsappname: "whatsAppName",
};

const ACTION_STYLES: Record<PreviousPointsImportAction, { label: string; className: string }> = {
  add: { label: "add", className: "bg-success/20 text-success" },
  update: { label: "update", className: "bg-warning/20 text-warning" },
  create_user: { label: "new account", className: "bg-primary/20 text-primary" },
  unchanged: { label: "unchanged", className: "bg-secondary text-muted-foreground" },
  error: { label: "error", className: "bg-destructive/20 text-destructive" },
};

// Turns the CSV into import rows, or a list of problems that stop it being sent at all.
const toImportRows = (text: string): { rows: PreviousPointsImportRow[]; problems: string[] } => {
  // Strip the byte-order mark Excel adds to "CSV UTF-8" exports.
  const table = parseCsv(text.startsWith("﻿") ? text.slice(1) : text);
  if (table.length < 2) return { rows: [], problems: ["Add a header row and at least one data row."] };

  const columns = table[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase().replace(/[\s_-]/g, "")]);
  if (!columns.includes("email") || !columns.includes("points"))
    return { rows: [], problems: ["The header row needs at least an \"email\" and a \"points\" column."] };

  const problems: string[] = [];
  const rows = table.slice(1).map((cells, i) => {
    const row: PreviousPointsImportRow = { email: "", points: 0 };
    columns.forEach((col, c) => {
      const value = (cells[c] ?? "").trim();
      if (!col || value === "") return;
      if (col === "points") {
        if (!/^-?\d+$/.test(value)) problems.push(`Row ${i + 1}: points "${value}" is not a whole number.`);
        row.points = Number(value);
      } else {
        row[col] = value;
      }
    });
    return row;
  });
  return { rows, problems };
};

const AdminPreviousPoints = () => {
  const queryClient = useQueryClient();
  const { currentUser } = useApp();
  const isSystemUser = currentUser?.isSystemUser === true;

  const [label, setLabel] = useState(DEFAULT_LABEL);
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<PreviousPointsImportResult | null>(null);
  const [created, setCreated] = useState<PreviousPointsImportResult["createdAccounts"]>([]);
  const [copied, setCopied] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { data: entries, isLoading, error } = useQuery({
    queryKey: ["admin-previous-points"],
    queryFn: api.admin.previousPoints.list,
    enabled: currentUser?.role === "admin",
  });

  const parsed = useMemo(() => (csvText.trim() ? toImportRows(csvText) : null), [csvText]);

  // Any edit to the input invalidates the preview, so what gets imported is always what was previewed.
  const resetPreview = () => setPreview(null);

  const { mutate: runImport, isPending: isImporting } = useMutation({
    mutationFn: (dryRun: boolean) => api.admin.previousPoints.import(label.trim(), parsed!.rows, dryRun),
    onSuccess: (res) => {
      if (res.committed) {
        queryClient.invalidateQueries({ queryKey: ["admin-previous-points"] });
        queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
        const changed = res.rows.filter((r) => r.action !== "unchanged").length;
        toast.success(`Imported previous points for ${changed} user${changed === 1 ? "" : "s"}.`);
        setPreview(null);
        setCsvText("");
        if (res.createdAccounts.length > 0) {
          setCreated(res.createdAccounts);
          setCopied(false);
        }
      } else {
        setPreview(res);
        if (!res.dryRun) toast.error("Nothing was imported — fix the errors below first.");
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Import failed."),
  });

  const { mutate: removeEntry, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => api.admin.previousPoints.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-previous-points"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      toast.success("Previous points removed.");
      setPendingDeleteId(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to remove entry."),
  });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setCsvText(await file.text());
    resetPreview();
  };

  const counts = useMemo(() => {
    const c: Record<PreviousPointsImportAction, number> = { add: 0, update: 0, create_user: 0, unchanged: 0, error: 0 };
    preview?.rows.forEach((r) => c[r.action]++);
    return c;
  }, [preview]);

  const totalPoints = entries?.reduce((s, e) => s + e.points, 0) ?? 0;
  const pendingDelete = entries?.find((e) => e.id === pendingDeleteId);
  const canPreview = !!parsed && parsed.problems.length === 0 && label.trim() !== "";

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl px-6 pt-8 pb-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Previous Points</h1>
          <p className="text-sm text-muted-foreground">
            Points users earned before the app. They count towards the overall leaderboard and users can see them
            on their history page.
          </p>
        </div>

        {isSystemUser && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">Import from CSV</h2>
                <p className="text-xs text-muted-foreground">
                  Columns: <code>email</code>, <code>points</code>, and optionally <code>name</code>,{" "}
                  <code>phone</code>, <code>whatsapp</code>. Emails without an account get one created if a name is
                  given. Importing the same label again replaces those users' points instead of adding to them.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: "text/csv" }));
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "previous-points-template.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <FileDown className="h-3.5 w-3.5 mr-1" /> Template
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <div className="space-y-1.5">
                <Label htmlFor="pp-label">Label</Label>
                <Input
                  id="pp-label"
                  value={label}
                  maxLength={100}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    resetPreview();
                  }}
                />
                <p className="text-[11px] text-muted-foreground">Shown to users next to these points.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pp-file">CSV file</Label>
                <Input id="pp-file" type="file" accept=".csv,text/csv" onChange={(e) => handleFile(e.target.files?.[0])} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pp-csv">…or paste the CSV</Label>
              <Textarea
                id="pp-csv"
                rows={6}
                className="font-mono text-xs"
                placeholder={SAMPLE_CSV}
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  resetPreview();
                }}
              />
            </div>

            {parsed && parsed.problems.length > 0 && (
              <ul className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive space-y-0.5">
                {parsed.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" disabled={!canPreview || isImporting} onClick={() => runImport(true)}>
                {isImporting && !preview ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Eye className="h-3.5 w-3.5 mr-1" />
                )}
                Preview {parsed && parsed.problems.length === 0 ? `${parsed.rows.length} rows` : ""}
              </Button>
              {preview && (
                <Button disabled={preview.errorCount > 0 || isImporting} onClick={() => runImport(false)}>
                  {isImporting ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 mr-1" />
                  )}
                  Import
                </Button>
              )}
              {preview && (
                <p className="text-xs text-muted-foreground">
                  {counts.add} new · {counts.update} updated · {counts.create_user} new accounts · {counts.unchanged}{" "}
                  unchanged
                  {preview.errorCount > 0 && (
                    <span className="text-destructive font-medium"> · {preview.errorCount} errors — fix and preview again</span>
                  )}
                </p>
              )}
            </div>

            {preview && (
              <div className="rounded-lg border border-border overflow-hidden max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((r) => (
                      <TableRow key={r.rowNumber}>
                        <TableCell className="text-muted-foreground text-xs">{r.rowNumber}</TableCell>
                        <TableCell className="text-sm">{r.email || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.name ?? "—"}</TableCell>
                        <TableCell className="text-right font-medium">
                          {r.action === "update" && (
                            <span className="text-muted-foreground font-normal line-through mr-1.5">{r.currentPoints}</span>
                          )}
                          {r.points}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${ACTION_STYLES[r.action].className}`}>
                            {ACTION_STYLES[r.action].label}
                          </span>
                          {r.error && <span className="ml-2 text-xs text-destructive">{r.error}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive font-medium">Failed to load previous points</p>
          </div>
        )}

        {entries && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {entries.length} entries · {totalPoints} points in total
            </p>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                    <TableHead>Updated</TableHead>
                    {isSystemUser && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isSystemUser ? 6 : 5} className="h-24 text-center text-sm text-muted-foreground">
                        No previous points imported yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.userName}</TableCell>
                      <TableCell className="text-muted-foreground">{e.userEmail}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{e.label}</TableCell>
                      <TableCell className="text-right font-semibold">{e.points}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(e.updatedAt), "MMM d, yyyy")}
                      </TableCell>
                      {isSystemUser && (
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => setPendingDeleteId(e.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {pendingDelete?.userName}'s previous points?</AlertDialogTitle>
              <AlertDialogDescription>
                Their {pendingDelete?.points} points labelled "{pendingDelete?.label}" will no longer count towards the
                overall leaderboard. You can re-import them later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={isDeleting} onClick={() => pendingDelete && removeEntry(pendingDelete.id)}>
                {isDeleting && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={created.length > 0} onOpenChange={(open) => !open && setCreated([])}>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>{created.length} new accounts created</AlertDialogTitle>
              <AlertDialogDescription>
                Share each temporary password with its owner through a secure channel. They won't be shown again, and
                users will be forced to change them before submitting predictions.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="rounded-lg border border-border bg-secondary max-h-64 overflow-y-auto divide-y divide-border">
              {created.map((a) => (
                <div key={a.email} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                  </div>
                  <code className="font-mono">{a.temporaryPassword}</code>
                </div>
              ))}
            </div>
            <AlertDialogFooter>
              <Button
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    created.map((a) => `${a.name}\t${a.email}\t${a.temporaryPassword}`).join("\n"),
                  );
                  setCopied(true);
                  toast.success("Copied to clipboard.");
                }}
              >
                {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                Copy all
              </Button>
              <AlertDialogAction onClick={() => setCreated([])}>Done</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
};

export default AdminPreviousPoints;
