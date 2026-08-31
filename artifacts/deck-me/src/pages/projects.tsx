import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  getGetMasterProjectQueryKey,
  getListMasterProjectsQueryKey,
  getListQuotesQueryKey,
  useCreateMasterProject,
  useDeleteMasterProject,
  useGetMasterProject,
  useListCustomers,
  useListMasterProjects,
  useListQuotes,
  useRegenerateMasterProjectPortalToken,
  useRevokeMasterProjectPortalToken,
  useSetMasterProjectQuotes,
  useUpdateMasterProject,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  FileLock2,
  FolderKanban,
  Layers,
  Link2,
  LockKeyhole,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { useProfileAccess } from "@/lib/access";
import { useToast } from "@/hooks/use-toast";

export default function Projects() {
  const { isMasterBuilder } = useProfileAccess();
  const [, params] = useRoute("/projects/:id");
  if (!isMasterBuilder) return <UpgradeRequired />;
  return params?.id ? <ProjectDetail id={Number(params.id)} /> : <ProjectList />;
}

function ProjectList() {
  const queryClient = useQueryClient();
  const { data: projects, isLoading, isError } = useListMasterProjects({
    query: { queryKey: getListMasterProjectsQueryKey(), retry: false },
  });
  const { data: customers } = useListCustomers();
  const createProject = useCreateMasterProject({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getListMasterProjectsQueryKey() }),
    },
  });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");

  if (isError) return <AccessDenied />;
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Master Proposals</h1>
          <p className="text-muted-foreground font-medium">
            One client proposal, built from multiple trade quotes.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="font-bold uppercase">
              <Plus className="w-4 h-4 mr-2" /> Create Combined Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Combined Project</DialogTitle>
              <DialogDescription>
                Choose one customer now, then link that customer's trade quotes.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!title.trim() || !customerId) return;
                createProject.mutate(
                  {
                    data: {
                      title: title.trim(),
                      customerId: Number(customerId),
                      builderMarginPct: 0,
                    },
                  },
                  {
                    onSuccess: () => {
                      setOpen(false);
                      setTitle("");
                      setCustomerId("");
                    },
                  },
                );
              }}
            >
              <div>
                <Label htmlFor="project-title">Project title</Label>
                <Input
                  id="project-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="project-customer">Customer</Label>
                <select
                  id="project-customer"
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  required
                >
                  <option value="">Select customer</option>
                  {customers?.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="submit"
                className="w-full font-bold uppercase"
                disabled={createProject.isPending}
              >
                Create Master Proposal
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? (
        <div className="h-44 rounded-lg bg-muted animate-pulse" />
      ) : projects?.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center">
            <FolderKanban className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-bold text-xl">No Master Proposals</h2>
            <p className="text-muted-foreground mt-2">
              Create a combined project and add existing trade quotes.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects?.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="h-full cursor-pointer border-2 hover:border-primary transition-colors">
                <CardContent className="p-5">
                  <div className="flex justify-between gap-4">
                    <div>
                      <h2 className="font-black text-lg">{project.title}</h2>
                      <p className="text-sm text-muted-foreground">
                        {project.customerName} · {project.quoteCount} trade quote
                        {project.quoteCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="text-xs font-bold uppercase px-2 py-1 h-fit bg-muted rounded">
                      {project.status}
                    </span>
                  </div>
                  <div className="mt-5 flex justify-between border-t pt-4">
                    <span className="text-sm text-muted-foreground">Incl. GST</span>
                    <strong className="font-mono text-lg">
                      {formatCurrency(project.total)}
                    </strong>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectDetail({ id }: { id: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: project, isLoading, isError } = useGetMasterProject(id, {
    query: { queryKey: getGetMasterProjectQueryKey(id), retry: false },
  });
  const { data: quotes } = useListQuotes();
  const refreshProjectCaches = () => {
    queryClient.invalidateQueries({ queryKey: getGetMasterProjectQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListMasterProjectsQueryKey() });
  };
  const updateProject = useUpdateMasterProject({
    mutation: { onSuccess: refreshProjectCaches },
  });
  const setQuotes = useSetMasterProjectQuotes({
    mutation: {
      onSuccess: () => {
        refreshProjectCaches();
        queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
      },
    },
  });
  const deleteProject = useDeleteMasterProject();
  const regeneratePortal = useRegenerateMasterProjectPortalToken();
  const revokePortal = useRevokeMasterProjectPortalToken();
  const [margin, setMargin] = useState("0");
  const [selected, setSelected] = useState<number[]>([]);
  const [lastPortalToken, setLastPortalToken] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      setMargin(String(project.builderMarginPct));
      setSelected(project.quotes.map((quote) => quote.id));
    }
  }, [project]);

  if (isError) return <AccessDenied />;
  if (isLoading || !project) {
    return <div className="max-w-6xl mx-auto h-60 rounded-lg bg-muted animate-pulse" />;
  }

  const available =
    quotes?.filter(
      (quote) =>
        quote.customerId === project.customerId &&
        (quote.masterProjectId === null || quote.masterProjectId === project.id),
    ) ?? [];
  const toggleQuote = (quoteId: number) =>
    setSelected((current) =>
      current.includes(quoteId)
        ? current.filter((selectedId) => selectedId !== quoteId)
        : [...current, quoteId],
    );
  const copyPortalLink = async () => {
    const response = await regeneratePortal.mutateAsync({ id });
    setLastPortalToken(response.portalToken);
    refreshProjectCaches();
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
    const portalLink = new URL(
      `${basePath}/master-project/${response.portalToken}`,
      window.location.origin,
    ).toString();
    try {
      await navigator.clipboard.writeText(portalLink);
      toast({ title: "Master proposal link copied" });
    } catch {
      window.prompt("Copy this client portal link:", portalLink);
    }
  };
  const revokePortalLink = () =>
    revokePortal.mutate(
      { id },
      {
        onSuccess: () => {
          setLastPortalToken(null);
          refreshProjectCaches();
          toast({ title: "Master proposal link revoked" });
        },
      },
    );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/projects">
          <Button variant="ghost" className="px-0 font-bold">
            <ArrowLeft className="w-4 h-4 mr-2" /> All Projects
          </Button>
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="font-bold uppercase" onClick={copyPortalLink}>
            <Link2 className="w-4 h-4 mr-2" /> Copy Client Portal
          </Button>
          <Button
            variant="outline"
            className="font-bold uppercase"
            onClick={() => window.open(`/api/master-projects/${id}/pdf`, "_blank")}
          >
            <Download className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button
            variant="ghost"
            className="font-bold uppercase text-muted-foreground"
            onClick={revokePortalLink}
            disabled={revokePortal.isPending || !project.hasActivePortalLink}
            title={
              project.hasActivePortalLink
                ? "Revoke the most recently issued portal link"
                : "No active client portal link"
            }
          >
            <FileLock2 className="w-4 h-4 mr-2" /> Revoke Link
          </Button>
          <Button
            variant="ghost"
            className="font-bold uppercase text-destructive"
            onClick={() => {
              if (!window.confirm("Delete this Master Project? Linked quotes will remain.")) return;
              deleteProject.mutate(
                { id },
                {
                  onSuccess: () => {
                    queryClient.invalidateQueries({
                      queryKey: getListMasterProjectsQueryKey(),
                    });
                    window.location.assign(`${import.meta.env.BASE_URL}projects`);
                  },
                },
              );
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">{project.title}</h1>
          <p className="text-muted-foreground font-medium">
            {project.customerName} · {project.quotes.length} linked trade quote
            {project.quotes.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="text-left md:text-right">
          <p className="text-xs font-bold uppercase text-muted-foreground">
            Unified proposal, incl. GST
          </p>
          <p className="font-mono text-3xl font-black">{formatCurrency(project.total)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Materials", project.materialsSubtotal],
          ["Labour", project.labourSubtotal],
          ["Builder margin", project.marginAmount],
          ["GST", project.gst],
        ].map(([label, amount]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-xs uppercase font-bold text-muted-foreground">{label}</p>
              <p className="mt-1 font-mono font-bold">{formatCurrency(Number(amount))}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" /> Select Trade Quotes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {available.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No available quotes for this customer.
              </p>
            ) : (
              available.map((quote) => (
                <label
                  key={quote.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3 cursor-pointer"
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(quote.id)}
                      onChange={() => toggleQuote(quote.id)}
                    />
                    <span>
                      <span className="block font-bold">{quote.title}</span>
                      <span className="text-xs text-muted-foreground uppercase">
                        {quote.tradeType?.trim() || "Other trade"}
                      </span>
                    </span>
                  </span>
                  <strong className="font-mono text-sm">{formatCurrency(quote.total)}</strong>
                </label>
              ))
            )}
            <Button
              className="w-full font-bold uppercase"
              disabled={setQuotes.isPending}
              onClick={() => setQuotes.mutate({ id, data: { quoteIds: selected } })}
            >
              Update Project Quotes
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Builder Margin</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                updateProject.mutate({ id, data: { builderMarginPct: Number(margin) } });
              }}
            >
              <div>
                <Label htmlFor="margin">Gross margin percentage</Label>
                <Input
                  id="margin"
                  type="number"
                  min="0"
                  max="99.99"
                  step="0.01"
                  value={margin}
                  onChange={(event) => setMargin(event.target.value)}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Applied once across the combined materials and labour total, before GST.
                </p>
              </div>
              <Button
                type="submit"
                className="font-bold uppercase"
                disabled={updateProject.isPending}
              >
                Apply Margin
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" /> Proposal by Trade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {project.tradeGroups.map((group) => (
            <section key={group.tradeType} className="rounded-lg border overflow-hidden">
              <div className="bg-secondary text-secondary-foreground px-4 py-3">
                <h3 className="font-black uppercase">{group.label}</h3>
              </div>
              <div className="divide-y">
                {group.quotes.map((quote) => (
                  <div key={quote.id} className="p-4 space-y-3">
                    <div className="flex justify-between gap-4">
                      <div>
                        <h4 className="font-bold">{quote.title}</h4>
                        <p className="text-xs uppercase text-muted-foreground">{quote.status}</p>
                      </div>
                      <strong className="font-mono">{formatCurrency(quote.total)}</strong>
                    </div>
                    <div className="space-y-1 text-sm">
                      {quote.lineItems.map((line) => (
                        <div key={line.id} className="flex justify-between gap-4">
                          <span className="text-muted-foreground">
                            {line.description} · {line.quantity} {line.unit}
                          </span>
                          <span className="font-mono">{formatCurrency(line.lineTotal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {project.tradeGroups.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              Select trade quotes to build the combined proposal.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-primary" /> Master Bill of Materials
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground uppercase text-xs">
              <tr>
                <th className="pb-3">Material</th>
                <th className="pb-3 text-right">Qty</th>
                <th className="pb-3 text-right">Unit price</th>
                <th className="pb-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {project.billOfMaterials.map((line, index) => (
                <tr
                  key={`${line.materialId ?? line.description}-${index}`}
                  className="border-b last:border-0"
                >
                  <td className="py-3">
                    <span className="font-medium block">{line.description}</span>
                    <span className="text-xs text-muted-foreground">
                      {line.quoteCount} quote{line.quoteCount === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td className="py-3 text-right font-mono">
                    {line.quantity} {line.unit}
                  </td>
                  <td className="py-3 text-right font-mono">
                    {formatCurrency(line.unitPrice)}
                  </td>
                  <td className="py-3 text-right font-mono font-bold">
                    {formatCurrency(line.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {project.billOfMaterials.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              Add trade quotes to produce the master bill of materials.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UpgradeRequired() {
  return (
    <div className="max-w-xl mx-auto py-20">
      <Card className="border-2 border-dashed">
        <CardContent className="py-12 text-center">
          <LockKeyhole
            className="w-12 h-12 mx-auto text-muted-foreground mb-4"
            aria-hidden="true"
          />
          <h1 className="text-2xl font-black uppercase">Upgrade Required</h1>
          <p className="mt-3 text-muted-foreground">
            Combined Master Proposals are available to Owner accounts with Master Builder
            access. You can still create and send standard quotes.
          </p>
          <Button className="mt-6" variant="outline" disabled aria-label="Upgrade required">
            <LockKeyhole className="w-4 h-4 mr-2" /> Create Combined Project
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="max-w-xl mx-auto py-24 text-center">
      <FolderKanban className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
      <h1 className="text-2xl font-black uppercase">Master Proposals unavailable</h1>
      <p className="mt-3 text-muted-foreground">
        Your account could not be authorised for Master Builder access.
      </p>
    </div>
  );
}