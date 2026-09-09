import React, { useState, useMemo } from "react";
import { Check, ChevronsUpDown, X, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface TradeCatalogueEntry {
  value: string;
  quotingFunctions?: string[];
  quotingParameters?: string[];
}

export interface TradeMultiSelectProps {
  entries: TradeCatalogueEntry[];
  selected: string[];
  maxSelections: number | null;
  disabled?: boolean;
  onChange: (selected: string[]) => void;
}

export function TradeMultiSelect({
  entries,
  selected,
  maxSelections,
  disabled = false,
  onChange,
}: TradeMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const isAtMax = maxSelections !== null && selected.length >= maxSelections;

  const availableEntries = useMemo(() => {
    return entries.filter((e) => !selected.includes(e.value));
  }, [entries, selected]);

  const add = (value: string) => {
    if (isAtMax) return;
    if (!selected.includes(value)) {
      onChange([...selected, value]);
    }
    setOpen(false);
  };

  const remove = (value: string) => {
    onChange(selected.filter((v) => v !== value));
  };

  const makePrimary = (value: string) => {
    const newSelected = [value, ...selected.filter((v) => v !== value)];
    onChange(newSelected);
  };

  return (
    <div className="flex flex-col space-y-4 w-full">
      <div className="flex flex-col space-y-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "w-full justify-between h-12 bg-card font-medium border-2",
                isAtMax
                  ? "border-dashed border-border"
                  : "border-border hover:border-primary/50 transition-colors"
              )}
              disabled={disabled || isAtMax}
            >
              <span
                className={cn(
                  "truncate",
                  selected.length === 0
                    ? "text-muted-foreground"
                    : "text-foreground"
                )}
              >
                {isAtMax
                  ? `Maximum of ${maxSelections} trades selected`
                  : "Search and add trades..."}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          {!isAtMax && !disabled && (
            <PopoverContent
              className="p-0"
              style={{ width: "var(--radix-popover-trigger-width)" }}
              align="start"
            >
              <Command>
                <CommandInput placeholder="Search trades..." className="h-11" />
                <CommandList>
                  <CommandEmpty>No trade found.</CommandEmpty>
                  <CommandGroup>
                    {availableEntries.map((entry) => (
                      <CommandItem
                        key={entry.value}
                        value={entry.value}
                        onSelect={() => add(entry.value)}
                        className="font-medium cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selected.includes(entry.value)
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        {entry.value}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          )}
        </Popover>

        {isAtMax && (
          <p className="text-xs font-medium text-amber-600 dark:text-amber-500 animate-in fade-in slide-in-from-top-1">
            You have reached the maximum of {maxSelections} trades. Remove one to
            add another.
          </p>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Selected Trades
          </h4>
          <div className="flex flex-col gap-2">
            {selected.map((val, idx) => {
              const entry = entries.find((e) => e.value === val);
              const isPrimary = idx === 0;

              return (
                <div
                  key={val}
                  className={cn(
                    "flex items-start justify-between p-3.5 rounded-lg border-2 transition-all",
                    isPrimary
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:border-border/80"
                  )}
                >
                  <div className="flex flex-col gap-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-foreground truncate">
                        {val}
                      </span>
                      {isPrimary && (
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm shrink-0">
                          Primary
                        </span>
                      )}
                    </div>

                    {(entry?.quotingFunctions?.length ||
                      entry?.quotingParameters?.length) ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-1">
                        {entry?.quotingFunctions &&
                          entry.quotingFunctions.length > 0 && (
                            <div className="flex items-start gap-1.5 text-[11px] font-medium text-muted-foreground">
                              <span className="uppercase tracking-wider opacity-70 shrink-0 mt-0.5">
                                Functions:
                              </span>
                              <span className="text-foreground/80 leading-relaxed">
                                {entry.quotingFunctions.join(", ")}
                              </span>
                            </div>
                          )}
                        {entry?.quotingParameters &&
                          entry.quotingParameters.length > 0 && (
                            <div className="flex items-start gap-1.5 text-[11px] font-medium text-muted-foreground">
                              <span className="uppercase tracking-wider opacity-70 shrink-0 mt-0.5">
                                Params:
                              </span>
                              <span className="text-foreground/80 leading-relaxed">
                                {entry.quotingParameters.join(", ")}
                              </span>
                            </div>
                          )}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-start gap-1.5 shrink-0 mt-0.5">
                    {!isPrimary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => makePrimary(val)}
                        className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                        disabled={disabled}
                        title="Make Primary"
                      >
                        <ArrowUp className="w-3.5 h-3.5 mr-1" />
                        Primary
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(val)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      disabled={disabled}
                      title="Remove"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
