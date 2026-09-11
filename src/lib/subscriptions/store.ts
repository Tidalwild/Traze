import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { advanceBilling } from "./calc";
import { createSample } from "./seed";
import type { Currency, Subscription } from "./types";

type LedgerState = {
  items: Subscription[];
  displayCurrency: Currency;
  initialized: boolean;
  dismissedKeys: string[];
  lastScanAt: string | null;
  setDisplayCurrency: (currency: Currency) => void;
  addItem: (item: Subscription) => void;
  updateItem: (id: string, patch: Partial<Subscription>) => void;
  removeItem: (id: string) => void;
  setStatus: (id: string, status: Subscription["status"]) => void;
  markCharged: (id: string) => void;
  loadSample: () => void;
  clearAll: () => void;
  dismissDiscovery: (key: string) => void;
  setLastScanAt: (iso: string | null) => void;
};

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useLedger = create<LedgerState>()(
  persist(
    (set, get) => ({
      items: createSample(),
      displayCurrency: "HKD",
      initialized: true,
      dismissedKeys: [],
      lastScanAt: null,
      setDisplayCurrency: (currency) => set({ displayCurrency: currency }),
      addItem: (item) =>
        set({
          items: [item, ...get().items],
          initialized: true,
        }),
      updateItem: (id, patch) =>
        set({
          items: get().items.map((item) =>
            item.id === id ? { ...item, ...patch } : item,
          ),
        }),
      removeItem: (id) =>
        set({ items: get().items.filter((item) => item.id !== id) }),
      setStatus: (id, status) =>
        set({
          items: get().items.map((item) =>
            item.id === id ? { ...item, status } : item,
          ),
        }),
      markCharged: (id) =>
        set({
          items: get().items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  nextBillingDate: advanceBilling(
                    item.nextBillingDate,
                    item.cycle,
                  ),
                }
              : item,
          ),
        }),
      loadSample: () => set({ items: createSample(), initialized: true }),
      clearAll: () => set({ items: [], initialized: true }),
      dismissDiscovery: (key) =>
        set({
          dismissedKeys: get().dismissedKeys.includes(key)
            ? get().dismissedKeys
            : [...get().dismissedKeys, key],
        }),
      setLastScanAt: (iso) => set({ lastScanAt: iso }),
    }),
    {
      name: "trace-ledger-v1",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? noopStorage : localStorage,
      ),
      skipHydration: true,
      partialize: (state) => ({
        items: state.items,
        displayCurrency: state.displayCurrency,
        initialized: state.initialized,
        dismissedKeys: state.dismissedKeys,
        lastScanAt: state.lastScanAt,
      }),
    },
  ),
);

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sub-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function rehydrateLedger(): void {
  void useLedger.persist.rehydrate();
}
