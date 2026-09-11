import { useEffect, useState } from "react";
import { isFramed } from "./login.ts";

export type ConnectorWaitStatus =
  | "idle"
  | "waiting"
  | "timed_out"
  | "not_embedded";

export function useRefetchWhenConnectorReady(
  waiting: boolean,
  _refetch: () => unknown,
): ConnectorWaitStatus {
  const [notEmbedded, setNotEmbedded] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    if (!isFramed()) {
      setNotEmbedded(true);
      return () => setNotEmbedded(false);
    }
  }, [waiting]);
  if (!waiting) return "idle";
  if (notEmbedded) return "not_embedded";
  return "waiting";
}
