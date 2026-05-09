import type { AdkManifest, AdkToolset } from '../services/agent-platform.service';

export type AdkManifestSummary = {
  tools: number;
  agents: number;
  workflows: number;
  externalMcpServers: number;
  toolsets: number;
  httpToolsets: number;
  stdioToolsets: number;
};

export const getAdkManifestSummary = (manifest: Partial<AdkManifest> | null): AdkManifestSummary => {
  const adkToolsets = manifest?.adk_toolsets || [];

  return {
    tools: manifest?.mcp?.tools?.length || 0,
    agents: manifest?.agents?.length || 0,
    workflows: manifest?.workflows?.length || 0,
    externalMcpServers: manifest?.external_mcp_servers?.length || 0,
    toolsets: adkToolsets.length,
    httpToolsets: adkToolsets.filter((toolset) => toolset.transport === 'streamable_http').length,
    stdioToolsets: adkToolsets.filter((toolset) => toolset.transport === 'stdio').length,
  };
};

export const getAdkToolsetTarget = (toolset: Partial<AdkToolset>) => {
  const params = toolset.connection_params || {};
  if (params.type === 'StdioConnectionParams') {
    const serverParams = params.server_params || {};
    return [serverParams.command, ...(serverParams.args || [])].filter(Boolean).join(' ') || 'stdio';
  }

  return params.url || 'streamable_http';
};
