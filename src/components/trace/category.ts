import type { Category, Status } from "@/lib/subscriptions/types";

export const CATEGORY_DOT: Record<Category, string> = {
  entertainment: "bg-cat-entertainment",
  software: "bg-cat-software",
  cloud: "bg-cat-cloud",
  health: "bg-cat-health",
  utilities: "bg-cat-utilities",
  news: "bg-cat-news",
  education: "bg-cat-education",
  finance: "bg-cat-finance",
  other: "bg-cat-other",
};

export const CATEGORY_FILL: Record<Category, string> = {
  entertainment: "var(--color-cat-entertainment)",
  software: "var(--color-cat-software)",
  cloud: "var(--color-cat-cloud)",
  health: "var(--color-cat-health)",
  utilities: "var(--color-cat-utilities)",
  news: "var(--color-cat-news)",
  education: "var(--color-cat-education)",
  finance: "var(--color-cat-finance)",
  other: "var(--color-cat-other)",
};

export function statusVariant(
  status: Status,
): "active" | "trial" | "paused" | "cancelled" {
  return status;
}
