import { describe, expect, it } from 'vitest';
import { getAdkManifestSummary, getAdkToolsetTarget } from './agent-platform-adk';

describe('agent platform ADK helpers', () => {
  const manifest = {
    name: 'GeraltAI Agent Platform',
    version: '1.0.0',
    mcp: {
      toolset_name: 'geraltai_mcp_tools',
      tools: [{ name: 'rag.search' }, { name: 'rag.aggregate' }],
    },
    agents: [{ agent_id: 'agent-1' }],
    workflows: [{ workflow_id: 'workflow-1' }],
    external_mcp_servers: [{ server_id: 'mcp-1' }, { server_id: 'mcp-2' }],
    adk_toolsets: [
      {
        server_id: 'mcp-1',
        name: 'Docs MCP',
        transport: 'streamable_http',
        tool_filter: ['search_docs'],
        connection_params: {
          type: 'StreamableHTTPConnectionParams',
          url: 'https://docs.example.com/mcp',
        },
      },
      {
        server_id: 'mcp-2',
        name: 'Filesystem MCP',
        transport: 'stdio',
        tool_filter: ['read_file', 'list_directory'],
        connection_params: {
          type: 'StdioConnectionParams',
          server_params: {
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          },
        },
      },
    ],
  };

  it('summarizes ADK manifest records and transport split', () => {
    expect(getAdkManifestSummary(manifest)).toEqual({
      tools: 2,
      agents: 1,
      workflows: 1,
      externalMcpServers: 2,
      toolsets: 2,
      httpToolsets: 1,
      stdioToolsets: 1,
    });
  });

  it('formats ADK toolset connection targets for preview rows', () => {
    expect(getAdkToolsetTarget(manifest.adk_toolsets[0])).toBe('https://docs.example.com/mcp');
    expect(getAdkToolsetTarget(manifest.adk_toolsets[1])).toBe(
      'npx -y @modelcontextprotocol/server-filesystem /tmp'
    );
  });
});
