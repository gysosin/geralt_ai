import { describe, expect, it } from 'vitest';
import { getAgentPlatformStats } from './agent-platform-stats';

describe('getAgentPlatformStats', () => {
  it('uses current client records instead of stale server stats', () => {
    const stats = getAgentPlatformStats({
      tools: [{ name: 'query.plan' }, { name: 'rag.search' }],
      agents: [{ agent_id: 'agent-1' }],
      workflows: [{ workflow_id: 'workflow-1' }, { workflow_id: 'workflow-2' }],
      mcpServers: [{ server_id: 'mcp-1', last_health_status: 'reachable' }],
      runs: [{ run_id: 'run-1', status: 'completed' }, { run_id: 'run-2', status: 'pending' }],
      pendingApprovals: [{ run_id: 'run-2', step_id: 'approve' }],
      platformStats: {
        tools: 9,
        agents: 0,
        workflows: 0,
        mcp_servers: 0,
        reachable_mcp_servers: 0,
        runs: 0,
        active_runs: 0,
        pending_approvals: 0,
        run_statuses: {},
      },
    });

    expect(stats).toEqual({
      tools: 2,
      agents: 1,
      workflows: 2,
      mcpServers: 1,
      reachableMcpServers: 1,
      runs: 2,
      activeRuns: 1,
      pendingApprovals: 1,
    });
  });
});
