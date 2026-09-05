import {
  useGetLatestCadLayout,
  useCreateCadLayout,
  getGetLatestCadLayoutQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CadCanvas } from "./CadCanvas";
import { CadCompliancePanel } from "./CadCompliancePanel";
import { useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { validateCadLayoutCompliance } from "@/lib/cad-compliance";
import {
  BoxSelect,
  Info,
  AlertTriangle,
  Layers,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function CadWorkspace({ quoteId }: { quoteId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const {
    data: layoutWrapper,
    isLoading,
    error,
  } = useGetLatestCadLayout(quoteId, {
    query: {
      enabled: !!quoteId,
      queryKey: getGetLatestCadLayoutQueryKey(quoteId),
      retry: false,
    },
  });
  const createLayout = useCreateCadLayout();

  const is404 =
    error &&
    typeof error === "object" &&
    "status" in error &&
    error.status === 404;

  const spatialCompliance = useMemo(() => {
    if (layoutWrapper?.layout) {
      return validateCadLayoutCompliance(layoutWrapper.layout);
    }
    return null;
  }, [layoutWrapper?.layout]);

  const canvasCompliance = useMemo(() => {
    if (!spatialCompliance || !layoutWrapper?.compliance) return null;

    return {
      ...spatialCompliance,
      warningComponentIds: new Set([
        ...spatialCompliance.warningComponentIds,
        ...layoutWrapper.compliance.findings.flatMap(
          ({ componentIds }) => componentIds,
        ),
      ]),
    };
  }, [layoutWrapper?.compliance, spatialCompliance]);

  function handleGenerate(event: FormEvent) {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    createLayout.mutate(
      { quoteId, data: { prompt: trimmedPrompt } },
      {
        onSuccess: (created) => {
          queryClient.setQueryData(
            getGetLatestCadLayoutQueryKey(quoteId),
            created,
          );
          setPrompt("");
        },
        onError: () => {
          toast({
            title: "Could not generate layout",
            description: "Check the layout description and try again.",
            variant: "destructive",
          });
        },
      },
    );
  }

  const generationForm = (
    <form
      onSubmit={handleGenerate}
      className="flex w-full flex-col gap-2 sm:flex-row"
    >
      <Input
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="e.g. 6x4m timber deck with electrical conduit"
        aria-label="Trade layout description"
        maxLength={2000}
        disabled={createLayout.isPending}
      />
      <Button
        type="submit"
        disabled={!prompt.trim() || createLayout.isPending}
        className="sm:min-w-28"
      >
        {createLayout.isPending && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        )}
        {layoutWrapper ? "Update" : "Generate"}
      </Button>
    </form>
  );

  if (isLoading) {
    return (
      <Card
        className="border-2 shadow-sm overflow-hidden"
        data-testid="cad-workspace-loading"
      >
        <CardHeader className="bg-muted/30 border-b pb-4">
          <CardTitle className="font-display font-black uppercase flex items-center gap-2 text-muted-foreground text-lg">
            <BoxSelect className="w-5 h-5" />
            3D Structural Workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Skeleton className="w-full h-[400px] rounded-none" />
        </CardContent>
      </Card>
    );
  }

  if (is404) {
    return (
      <Card
        className="border-2 shadow-sm border-dashed"
        data-testid="cad-workspace-empty"
      >
        <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
          <Layers className="w-12 h-12 mb-4 opacity-20" />
          <h3 className="font-display font-black uppercase tracking-tight text-lg mb-2">
            No 3D Layout Generated
          </h3>
          <p className="max-w-md mx-auto text-sm">
            Describe the carpentry, electrical, or plumbing layout to create a
            deterministic CAD v1 workspace for this quote.
          </p>
          <div className="mt-6 w-full max-w-2xl">{generationForm}</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !layoutWrapper || !spatialCompliance || !canvasCompliance) {
    return (
      <Card
        className="border-2 shadow-sm border-destructive/50 bg-destructive/5"
        data-testid="cad-workspace-error"
      >
        <CardContent className="p-6 text-destructive flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <div className="font-black uppercase text-sm">
              Failed to load layout
            </div>
            <div className="text-sm opacity-90">
              There was a problem loading the 3D workspace. Please try again
              later.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="border-2 shadow-sm overflow-hidden flex flex-col"
      data-testid="cad-workspace"
    >
      <CardHeader className="bg-muted/30 border-b pb-4">
        <CardTitle className="font-display font-black uppercase flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <BoxSelect className="w-5 h-5 text-primary" />
            3D Structural Workspace
          </div>
          <span className="text-xs font-mono font-bold text-muted-foreground px-2 py-1 bg-background border rounded">
            v{layoutWrapper.layout.version}
          </span>
        </CardTitle>
      </CardHeader>

      <div className="border-b bg-muted/10 p-3">{generationForm}</div>

      <div className="flex flex-col lg:flex-row h-[600px] lg:h-[500px]">
        {/* Canvas Area */}
        <div
          className="flex-1 relative bg-secondary/5 border-b lg:border-b-0 lg:border-r"
          data-testid="cad-canvas-container"
        >
          <CadCanvas
            layout={layoutWrapper.layout}
            complianceResult={canvasCompliance}
          />

          <div className="absolute bottom-4 left-4 right-4 pointer-events-none flex justify-between items-end">
            <div className="bg-background/80 backdrop-blur border px-3 py-2 rounded-md shadow-sm pointer-events-auto hidden md:block">
              <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1 tracking-wider">
                Controls
              </div>
              <div className="text-xs grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 items-center">
                <span className="font-medium">Left Click</span>
                <span className="text-muted-foreground">Rotate</span>
                <span className="font-medium">Right Click</span>
                <span className="text-muted-foreground">Pan</span>
                <span className="font-medium">Scroll</span>
                <span className="text-muted-foreground">Zoom</span>
              </div>
            </div>

            <div className="bg-background/80 backdrop-blur border px-3 py-2 rounded-md shadow-sm text-xs pointer-events-auto flex items-center gap-2 max-w-[220px] ml-auto">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <span className="text-muted-foreground font-medium leading-tight text-[11px]">
                Dimensions in metres.
                <br />
                Preliminary check only.
              </span>
            </div>
          </div>
        </div>

        {/* Compliance Panel */}
        <div className="w-full lg:w-80 flex flex-col bg-background h-[300px] lg:h-auto overflow-hidden">
          <CadCompliancePanel
            compliance={layoutWrapper.compliance}
            spatialCompliance={spatialCompliance}
          />
        </div>
      </div>
    </Card>
  );
}
