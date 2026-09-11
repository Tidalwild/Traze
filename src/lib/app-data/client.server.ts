import { getRequest } from "@tanstack/react-start/server";
import {
  assertSameSiteRequest,
  CrossSiteRequestError,
} from "../auth/isolation.server.ts";
import { env, isWorkspacePreview } from "../env.server.ts";
import { assertAppDataServerOnly } from "./server-only.ts";
import {
  CONNECTOR_TOKEN_HEADER,
  CONNECTOR_TOKEN_PENDING_CODE,
  ConnectorType,
  type CallToolOptions,
  type CallToolResult,
  type ToolArgs,
} from "./types.ts";

assertAppDataServerOnly("app-data/client.server");

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function tryGetRequest(): Request | null {
  try {
    return getRequest() ?? null;
  } catch {
    return null;
  }
}

export async function callTool(
  _name: string,
  _args: ToolArgs,
  options: CallToolOptions,
): Promise<CallToolResult> {
  try {
    assertSameSiteRequest();
  } catch (err) {
    if (err instanceof CrossSiteRequestError) {
      return { ok: false, data: null, errorMessage: err.message };
    }
    throw err;
  }
  const req = tryGetRequest();
  const host = (req?.headers.get("host") || "localhost").split(":")[0] ?? "localhost";
  if (isLoopbackHost(host) || isWorkspacePreview()) {
    const token =
      req?.headers.get(CONNECTOR_TOKEN_HEADER)?.trim() ||
      env("GROK_CONNECTOR_ACCESS_TOKEN");
    if (!token) {
      return {
        ok: false,
        data: null,
        errorMessage: "not_connected",
      };
    }
  }
  return {
    ok: false,
    data: null,
    errorMessage: `not_connected: ${options.connectorType} is not available outside Grok`,
  };
}

export { ConnectorType };
export { CONNECTOR_TOKEN_PENDING_CODE };
