import { MoreHorizontal, Plus, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CURRENCIES } from "@/lib/subscriptions/types";
import { useLedger } from "@/lib/subscriptions/store";
import { cn } from "@/lib/utils";

type HeaderProps = {
  onAdd: () => void;
  onScan: () => void;
  scanActive?: boolean;
};

export function TraceHeader({ onAdd, onScan, scanActive }: HeaderProps) {
  const displayCurrency = useLedger((s) => s.displayCurrency);
  const setDisplayCurrency = useLedger((s) => s.setDisplayCurrency);
  const loadSample = useLedger((s) => s.loadSample);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-xl font-medium tracking-tight italic">
            Traze
          </span>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            Recurring spend
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Display currency</DropdownMenuLabel>
                {CURRENCIES.map((code) => (
                  <DropdownMenuItem
                    key={code}
                    onClick={() => setDisplayCurrency(code)}
                  >
                    <span className="flex-1">{code}</span>
                    {displayCurrency === code ? (
                      <span className="text-muted-foreground">Current</span>
                    ) : null}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    loadSample();
                    toast("Loaded a sample ledger");
                  }}
                >
                  Load sample ledger
                </DropdownMenuItem>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem variant="destructive">
                    Clear all
                  </DropdownMenuItem>
                </AlertDialogTrigger>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear the ledger?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes every subscription stored on this device. It cannot
                  be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep them</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    useLedger.getState().clearAll();
                    toast("Ledger cleared");
                  }}
                >
                  Clear all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="outline"
            onClick={onScan}
            className={cn(scanActive && "bg-accent text-accent-foreground")}
            aria-pressed={scanActive}
          >
            <ScanSearch className="size-4" />
            Scan
          </Button>
          <Button onClick={onAdd} className="pl-3.5 pr-4">
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </div>
    </header>
  );
}
