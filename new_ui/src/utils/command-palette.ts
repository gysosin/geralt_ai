export type CommandPaletteRecord = {
  id: string;
  label: string;
  description: string;
  group: string;
  keywords?: string[];
};

const normalize = (value: string) => value.trim().toLowerCase();

const scoreCommand = (command: CommandPaletteRecord, normalizedQuery: string): number => {
  const label = normalize(command.label);
  const group = normalize(command.group);
  const description = normalize(command.description);
  const keywords = (command.keywords || []).map(normalize);

  if (label === normalizedQuery) return 100;
  if (label.startsWith(normalizedQuery)) return 80;
  if (keywords.some((keyword) => keyword === normalizedQuery || keyword.startsWith(normalizedQuery))) return 70;
  if (label.includes(normalizedQuery)) return 60;
  if (keywords.some((keyword) => keyword.includes(normalizedQuery))) return 50;
  if (group.includes(normalizedQuery)) return 40;
  if (description.includes(normalizedQuery)) return 30;
  return 0;
};

export const filterCommandPaletteRecords = <T extends CommandPaletteRecord>(
  commands: T[],
  query: string,
): T[] => {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return [...commands].sort((first, second) => first.group.localeCompare(second.group));
  }

  return commands
    .map((command) => ({ command, score: scoreCommand(command, normalizedQuery) }))
    .filter(({ score }) => score > 0)
    .sort((first, second) => second.score - first.score || first.command.label.localeCompare(second.command.label))
    .map(({ command }) => command);
};
