import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { advanceBilling } from "./calc";
import { createSample } from "./seed";
import {
  MAX_MAILBOXES,
  MAX_SAVED_CARDS,
  isLast4,
  takeLast4,
  type Currency,
  type SavedCard,
  type SavedMailbox,
  type Subscription,
} from "./types";

type LedgerState = {
  items: Subscription[];
  cards: SavedCard[];
  mailboxes: SavedMailbox[];
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
  addCard: (card: Omit<SavedCard, "id"> & { id?: string }) => "ok" | "invalid" | "duplicate" | "full";
  removeCard: (id: string) => void;
  addMailbox: (box: Omit<SavedMailbox, "id"> & { id?: string }) => "ok" | "invalid" | "duplicate" | "full";
  removeMailbox: (id: string) => void;
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
      cards: [],
      mailboxes: [],
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
      addCard: (card) => {
        const last4 = takeLast4(card.last4);
        if (!isLast4(last4)) return "invalid";
        const cards = get().cards;
        if (cards.length >= MAX_SAVED_CARDS) return "full";
        const nickname = card.nickname?.trim() || undefined;
        if (
          cards.some(
            (existing) =>
              existing.network === card.network && existing.last4 === last4,
          )
        ) {
          return "duplicate";
        }
        set({
          cards: [
            ...cards,
            {
              id: card.id ?? newId(),
              network: card.network,
              last4,
              nickname,
            },
          ],
        });
        return "ok";
      },
      removeCard: (id) =>
        set({ cards: get().cards.filter((card) => card.id !== id) }),
      addMailbox: (box) => {
        const host = box.host.trim().toLowerCase();
        const user = box.user.trim();
        if (!host || !user) return "invalid";
        const mailboxes = get().mailboxes;
        if (mailboxes.length >= MAX_MAILBOXES) return "full";
        if (mailboxes.some((existing) => existing.user === user && existing.host === host)) {
          return "duplicate";
        }
        set({
          mailboxes: [
            ...mailboxes,
            {
              id: box.id ?? newId(),
              label: box.label.trim() || user,
              host,
              port: box.port === 143 ? 143 : 993,
              user,
            },
          ],
        });
        return "ok";
      },
      removeMailbox: (id) =>
        set({ mailboxes: get().mailboxes.filter((box) => box.id !== id) }),
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
        cards: state.cards,
        mailboxes: state.mailboxes,
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
