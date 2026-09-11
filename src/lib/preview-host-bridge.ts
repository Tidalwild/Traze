/** No-op outside the Grok preview iframe. */
export type PreviewHostBridgeOptions = {
  navigate?: (path: string) => void;
  getRoutePaths?: () => string[];
};

export function installPreviewHostBridge(
  _options: PreviewHostBridgeOptions = {},
): () => void {
  return () => {};
}

export function collectRoutePathsFromTree(_routeTree: unknown): string[] {
  return ["/"];
}
