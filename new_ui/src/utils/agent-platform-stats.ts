type PlatformStatsInput = {
  tools: Array<unknown>;
  agents: Array<unknown>;
  workflows: Array<unknown>;
  mcpServers: Array<{ last_health_status?: string | null }>;
  runs: Array<{ status?: string | null }>;
  pendingApprovals: Array<unknown>;
  platformStats?: unknown;
};

export type AgentPlatformDisplayStats = {
  tools: number;
  agents: number;
  workflows: number;
  mcpServers: number;
  reachableMcpServers: number;
  runs: number;
  activeRuns: number;
  pendingApprovals: number;
};

export const getAgentPlatformStats = ({
  tools,
  agents,
  workflows,
  mcpServers,
  runs,
  pendingApprovals,
}: PlatformStatsInput): AgentPlatformDisplayStats => ({
  tools: tools.length,
  agents: agents.length,
  workflows: workflows.length,
  mcpServers: mcpServers.length,
  reachableMcpServers: mcpServers.filter((server) => server.last_health_status === 'reachable').length,
  runs: runs.length,
  activeRuns: runs.filter((run) => ['planned', 'pending'].includes(run.status || '')).length,
  pendingApprovals: pendingApprovals.length,
});
