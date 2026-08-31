import { useEffect, useState, useRef } from "react";
import { useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetQuotePortal,
  getGetQuotePortalQueryKey,
  useUpdateQuotePortal,
  useSetQuotePortalStatus,
} from "@workspace/api-client-react";
import type { QuoteEstimate, DeckSpecInput } from "@workspace/api-client-react";
import { Check, ChevronRight, HardHat, Info, Hammer, MapPin, Ruler, FileText, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function QuotePortalPage() {
  const params = useParams();
  const token = params.token ?? "";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: quote, isLoading, isError } = useGetQuotePortal(token, {
    query: { enabled: !!token, queryKey: getGetQuotePortalQueryKey(token) },
  });

  const [activeSpec, setActiveSpec] = useState<DeckSpecInput | null>(null);
  const [estimate, setEstimate] = useState<QuoteEstimate | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  const updateQuote = useUpdateQuotePortal();
  const setQuoteStatus = useSetQuotePortalStatus();

  // Initialize state when quote loads
  const initializedForId = useRef<number | null>(null);

  useEffect(() => {
    if (quote && initializedForId.current !== quote.id) {
      initializedForId.current = quote.id;
      setActiveSpec(quote.spec);
      setEstimate(null); // Clear any previous estimate, fallback to quote totals
    }
  }, [quote]);

  const handleSpecChange = (updates: Partial<DeckSpecInput>) => {
    if (!activeSpec) return;
    const newSpec = { ...activeSpec, ...updates };
    setActiveSpec(newSpec);

    updateQuote.mutate(
      {
        token,
        data: {
          ...(updates.deckBoardType !== undefined
            ? { deckBoardType: updates.deckBoardType }
            : {}),
          ...(updates.balustradeType !== undefined
            ? { balustradeType: updates.balustradeType }
            : {}),
        },
      },
      {
        onSuccess: (data) => {
          setEstimate({
            spec: data.spec,
            lines: data.lineItems,
            materialsSubtotal: data.materialsSubtotal,
            labourCost: data.labourCost,
            gst: data.gst,
            total: data.total,
            complianceWarnings: [],
          });
        },
        onError: () => {
          toast({
            title: "Price update unavailable",
            description: "Please try your selection again before accepting the quote.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleAccept = () => {
    if (!quote || !activeSpec) return;
    setIsAccepting(true);

    const markAccepted = () => {
      setQuoteStatus.mutate(
        { token, data: { status: "accepted" } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetQuotePortalQueryKey(token) });
            setIsAccepting(false);
          },
          onError: () => {
            setIsAccepting(false);
            toast({
              title: "We could not accept this quote",
              description: "Please try again. Your selection has not been accepted.",
              variant: "destructive",
            });
          },
        },
      );
    };

    const hasSelectedUpgrade =
      activeSpec.deckBoardType !== quote.spec.deckBoardType ||
      activeSpec.balustradeType !== quote.spec.balustradeType;

    if (!hasSelectedUpgrade) {
      markAccepted();
      return;
    }

    updateQuote.mutate(
      {
        token,
        data: {
          deckBoardType: activeSpec.deckBoardType,
          balustradeType: activeSpec.balustradeType,
        },
      },
      {
        onSuccess: markAccepted,
        onError: () => {
          setIsAccepting(false);
          toast({
            title: "We could not save your selection",
            description: "Please try again before accepting the quote.",
            variant: "destructive",
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-6">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-6 text-muted-foreground font-medium animate-pulse">Preparing your quote...</p>
      </div>
    );
  }

  if (isError || !quote) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-6">
        <div className="bg-white p-8 rounded-xl shadow-sm border max-w-md w-full text-center">
          <div className="w-16 h-16 bg-destructive/10 text-destructive flex items-center justify-center rounded-full mx-auto mb-6">
            <Info className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">Quote Unavailable</h2>
          <p className="text-muted-foreground mb-6">
            We couldn't load this quote. The link may have expired or is incorrect.
          </p>
        </div>
      </div>
    );
  }

  const isAccepted = quote.status === "accepted";

  // Use the live estimate if available, otherwise fall back to the original quote data
  const displayTotal = estimate ? estimate.total : quote.total;
  const displaySubtotal = estimate ? estimate.materialsSubtotal + estimate.labourCost : quote.materialsSubtotal + quote.labourCost;
  const displayGst = estimate ? estimate.gst : quote.gst;
  const displayLineItems = estimate ? estimate.lines : quote.lineItems;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(val);

  return (
    <div className="min-h-[100dvh] bg-background selection:bg-primary/20 selection:text-primary">
      {/* Header */}
      <header className="bg-secondary text-secondary-foreground py-6 px-6 md:px-12 sticky top-0 z-10 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-md">
              <HardHat className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="font-display font-black text-xl tracking-tight uppercase">QUOTE MASTER</span>
          </div>
          {isAccepted && (
            <div className="flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-1.5 rounded-full font-medium text-sm border border-green-500/30">
              <CheckCircle2 className="w-4 h-4" />
              <span>Accepted</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 md:px-12 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Left Column: Details & Upgrades */}
        <div className="lg:col-span-7 space-y-10">
          
          {/* Intro Section */}
          <section>
            <h1 className="text-4xl md:text-5xl font-display font-black text-foreground mb-4 leading-tight">
              {quote.title}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
              Hi {quote.customerName?.split(' ')[0] || 'there'}, here is the detailed breakdown for your new deck. 
              Review the specifications below and customise your materials to see real-time pricing updates.
            </p>
          </section>

          {/* Site Details Card */}
          <section className="bg-white rounded-2xl shadow-sm border p-6 md:p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none transition-transform duration-700 group-hover:scale-110 group-hover:rotate-12">
              <Hammer className="w-32 h-32" />
            </div>
            
            <h3 className="text-xl font-display font-bold text-foreground mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Project Details
            </h3>
            
            <div className="grid sm:grid-cols-2 gap-6 relative z-10">
              {quote.siteAddress && (
                <div className="flex gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Site Address</p>
                    <p className="text-muted-foreground mt-1 leading-snug">{quote.siteAddress}</p>
                  </div>
                </div>
              )}
              
              <div className="flex gap-3">
                <Ruler className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Dimensions</p>
                  <p className="text-muted-foreground mt-1">
                    {quote.spec.lengthM}m &times; {quote.spec.widthM}m
                    <br />
                    <span className="text-xs text-muted-foreground/80">Approx {(quote.spec.lengthM * quote.spec.widthM).toFixed(1)}m&sup2; area</span>
                  </p>
                </div>
              </div>
            </div>

            {quote.notes && (
              <div className="mt-8 pt-6 border-t">
                <p className="text-sm font-semibold text-foreground mb-2">Scope Notes</p>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8">
            <h3 className="text-lg font-display font-bold text-foreground mb-3">
              Australian Building Compliance
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {quote.complianceDisclaimer}
            </p>
            {quote.contractorLicenseNumber && (
              <p className="mt-4 text-sm font-bold text-foreground">
                Builder / Contractor Licence: {quote.contractorLicenseNumber}
              </p>
            )}
          </section>

          {/* Upgrades Section */}
          {activeSpec && !isAccepted && (
            <section className="space-y-6">
              <div>
                <h3 className="text-2xl font-display font-bold text-foreground mb-2">Customise Your Deck</h3>
                <p className="text-muted-foreground">Select your preferred materials below. The price will update automatically.</p>
              </div>

              {/* Decking Material Toggle */}
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="p-5 md:p-6 border-b bg-muted/30">
                  <h4 className="font-semibold text-foreground">Decking Board Material</h4>
                  <p className="text-sm text-muted-foreground mt-1">Choose between natural timber or low-maintenance composite.</p>
                </div>
                <div className="p-5 md:p-6 grid sm:grid-cols-2 gap-4">
                  
                  <button
                    onClick={() => handleSpecChange({ deckBoardType: "treated_pine" })}
                    className={`relative p-5 rounded-xl border-2 text-left transition-all duration-200 ${
                      activeSpec.deckBoardType === "treated_pine" || (!activeSpec.deckBoardType && quote.spec.deckBoardType === "treated_pine")
                        ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                        : "border-border hover:border-primary/40 bg-white"
                    }`}
                  >
                    {(activeSpec.deckBoardType === "treated_pine" || (!activeSpec.deckBoardType && quote.spec.deckBoardType === "treated_pine")) && (
                      <div className="absolute top-4 right-4 bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
                        <Check className="w-3 h-3" strokeWidth={3} />
                      </div>
                    )}
                    <h5 className="font-bold text-foreground">Treated Pine</h5>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      Classic natural timber look. Requires regular oiling and maintenance to preserve its colour and lifespan.
                    </p>
                  </button>

                  <button
                    onClick={() => handleSpecChange({ deckBoardType: "composite" })}
                    className={`relative p-5 rounded-xl border-2 text-left transition-all duration-200 ${
                      activeSpec.deckBoardType === "composite"
                        ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                        : "border-border hover:border-primary/40 bg-white"
                    }`}
                  >
                    {activeSpec.deckBoardType === "composite" && (
                      <div className="absolute top-4 right-4 bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
                        <Check className="w-3 h-3" strokeWidth={3} />
                      </div>
                    )}
                    <h5 className="font-bold text-foreground">Premium Composite</h5>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      Highly durable, rot-resistant, and virtually maintenance-free. Never needs oiling or staining.
                    </p>
                  </button>

                </div>
              </div>

              {/* Handrails Toggle (only if included) */}
              {activeSpec.includeHandrails && (
                <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                  <div className="p-5 md:p-6 border-b bg-muted/30">
                    <h4 className="font-semibold text-foreground">Balustrade Style</h4>
                    <p className="text-sm text-muted-foreground mt-1">Select the infill style for your handrails.</p>
                  </div>
                  <div className="p-5 md:p-6 grid sm:grid-cols-2 gap-4">
                    
                    <button
                      onClick={() => handleSpecChange({ balustradeType: "timber" })}
                      className={`relative p-5 rounded-xl border-2 text-left transition-all duration-200 ${
                        activeSpec.balustradeType === "timber" || (!activeSpec.balustradeType && quote.spec.balustradeType === "timber")
                          ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                          : "border-border hover:border-primary/40 bg-white"
                      }`}
                    >
                      {(activeSpec.balustradeType === "timber" || (!activeSpec.balustradeType && quote.spec.balustradeType === "timber")) && (
                        <div className="absolute top-4 right-4 bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
                          <Check className="w-3 h-3" strokeWidth={3} />
                        </div>
                      )}
                      <h5 className="font-bold text-foreground">Timber Pickets</h5>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                        Traditional vertical timber slats for a robust, classic enclosure.
                      </p>
                    </button>

                    <button
                      onClick={() => handleSpecChange({ balustradeType: "stainless_cable" })}
                      className={`relative p-5 rounded-xl border-2 text-left transition-all duration-200 ${
                        activeSpec.balustradeType === "stainless_cable"
                          ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                          : "border-border hover:border-primary/40 bg-white"
                      }`}
                    >
                      {activeSpec.balustradeType === "stainless_cable" && (
                        <div className="absolute top-4 right-4 bg-primary text-primary-foreground rounded-full p-1 shadow-sm">
                          <Check className="w-3 h-3" strokeWidth={3} />
                        </div>
                      )}
                      <h5 className="font-bold text-foreground">Stainless Steel Cable</h5>
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                        Sleek horizontal wire balustrades that preserve your view and offer a modern finish.
                      </p>
                    </button>

                  </div>
                </div>
              )}
            </section>
          )}

          {isAccepted && (
            <div className="bg-green-50 rounded-2xl border border-green-200 p-8 flex items-start gap-4">
              <div className="bg-green-500 text-white rounded-full p-1.5 shrink-0 mt-1">
                <Check className="w-5 h-5" strokeWidth={3} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-green-900 mb-2">Quote Accepted</h3>
                <p className="text-green-800 leading-relaxed">
                  Thank you for accepting this quote! Your chosen specifications have been locked in. 
                  Our team will be in touch shortly to finalise the timeline and arrange your booking.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Pricing Summary Sticky */}
        <div className="lg:col-span-5 relative">
          <div className="sticky top-32 space-y-6">
            
            <div className="bg-secondary rounded-2xl shadow-xl overflow-hidden border border-secondary-border">
              <div className="p-6 md:p-8 text-secondary-foreground">
                <h3 className="font-display font-bold text-2xl mb-6">Investment Summary</h3>
                
                <div className="space-y-4">
                  {displayLineItems.map((item, i) => (
                    <div key={i} className="flex justify-between items-start border-b border-secondary-foreground/10 pb-4 last:border-0 last:pb-0">
                      <div className="pr-4">
                        <p className="font-medium text-secondary-foreground">{item.description}</p>
                        {item.quantity > 1 && (
                          <p className="text-xs text-secondary-foreground/60 mt-1">
                            {item.quantity} {item.unit} &times; {formatCurrency(item.unitPrice)}
                          </p>
                        )}
                      </div>
                      <p className="font-semibold shrink-0">{formatCurrency(item.lineTotal)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-secondary-foreground/5 p-6 md:p-8">
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-secondary-foreground/80">
                    <span>Subtotal (ex GST)</span>
                    <span>{formatCurrency(displaySubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-secondary-foreground/80">
                    <span>GST (10%)</span>
                    <span>{formatCurrency(displayGst)}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-end border-t border-secondary-foreground/10 pt-6 mb-8 relative">
                  <div>
                    <span className="block text-sm font-medium text-secondary-foreground/80 mb-1">Total Due</span>
                    <span className="text-4xl md:text-5xl font-display font-black tracking-tight text-white transition-all duration-300">
                      {formatCurrency(displayTotal)}
                    </span>
                  </div>
                  {updateQuote.isPending && (
                    <div className="absolute right-0 top-6">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>

                {!isAccepted ? (
                  <button
                    onClick={handleAccept}
                    disabled={isAccepting || updateQuote.isPending}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg py-4 rounded-xl shadow-[0_4px_14px_0_rgba(234,88,12,0.39)] hover:shadow-[0_6px_20px_rgba(234,88,12,0.23)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none flex justify-center items-center gap-2"
                  >
                    {isAccepting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Accepting...</span>
                      </>
                    ) : (
                      <>
                        Accept &amp; Proceed <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                ) : (
                  <div className="w-full bg-secondary-foreground/10 text-secondary-foreground/60 font-bold text-lg py-4 rounded-xl flex justify-center items-center gap-2 cursor-not-allowed border border-secondary-foreground/10">
                    <Check className="w-5 h-5" />
                    Quote Accepted
                  </div>
                )}
                
                {!isAccepted && (
                  <p className="text-center text-xs text-secondary-foreground/50 mt-4">
                    By accepting, you agree to the scope and pricing above.
                  </p>
                )}
              </div>
            </div>

            {/* Help Box */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-start gap-4">
              <div className="bg-muted p-2 rounded-full shrink-0">
                <Info className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">Have questions?</h4>
                <p className="text-sm text-muted-foreground">
                  If you need any adjustments to the dimensions or scope not listed above, please contact your builder directly before accepting.
                </p>
              </div>
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}
