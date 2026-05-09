import { describe, expect, it } from 'vitest';
import { buildMcpServerPayload, isMcpServerFormReady } from './agent-platform-mcp';

describe('agent platform MCP helpers', () => {
  it('builds a stdio MCP server payload with command args', () => {
    expect(buildMcpServerPayload({
      name: 'Filesystem MCP',
      transport: 'stdio',
      url: 'https://ignored.example.com/mcp',
      command: 'npx',
      args: '-y, @modelcontextprotocol/server-filesystem, /tmp/docs',
      toolNames: 'read_file, list_directory',
    })).toEqual({
      name: 'Filesystem MCP',
      transport: 'stdio',
      url: '',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp/docs'],
      tool_names: ['read_file', 'list_directory'],
    });
  });

  it('requires the active transport target before saving', () => {
    expect(isMcpServerFormReady({ name: 'Docs MCP', transport: 'streamable_http', url: '', command: 'npx' })).toBe(false);
    expect(isMcpServerFormReady({ name: 'Docs MCP', transport: 'streamable_http', url: 'https://docs.example.com/mcp', command: '' })).toBe(true);
    expect(isMcpServerFormReady({ name: 'Filesystem MCP', transport: 'stdio', url: '', command: '' })).toBe(false);
    expect(isMcpServerFormReady({ name: 'Filesystem MCP', transport: 'stdio', url: '', command: 'npx' })).toBe(true);
  });
});
