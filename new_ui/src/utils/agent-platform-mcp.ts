export type McpTransport = 'streamable_http' | 'stdio';

type McpServerForm = {
  name: string;
  transport: string;
  url?: string;
  command?: string;
  args?: string;
  toolNames?: string;
};

const splitCommaSeparated = (value = '') =>
  value.split(',').map((item) => item.trim()).filter(Boolean);

export const isMcpServerFormReady = ({ name, transport, url = '', command = '' }: McpServerForm) => {
  if (!name.trim()) return false;
  if (transport === 'streamable_http') return Boolean(url.trim());
  if (transport === 'stdio') return Boolean(command.trim());
  return false;
};

export const buildMcpServerPayload = ({
  name,
  transport,
  url = '',
  command = '',
  args = '',
  toolNames = '',
}: McpServerForm) => {
  const normalizedTransport = transport === 'stdio' ? 'stdio' : 'streamable_http';

  return {
    name: name.trim(),
    transport: normalizedTransport,
    url: normalizedTransport === 'streamable_http' ? url.trim() : '',
    command: normalizedTransport === 'stdio' ? command.trim() : '',
    args: normalizedTransport === 'stdio' ? splitCommaSeparated(args) : [],
    tool_names: splitCommaSeparated(toolNames),
  };
};
