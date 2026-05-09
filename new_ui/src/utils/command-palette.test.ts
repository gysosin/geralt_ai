import { describe, expect, it } from 'vitest';
import { filterCommandPaletteRecords } from './command-palette';

const commands = [
  {
    id: 'dashboard',
    label: 'Open dashboard',
    description: 'Review workspace performance',
    group: 'Navigation',
    keywords: ['home', 'overview'],
  },
  {
    id: 'chat',
    label: 'Start new chat',
    description: 'Ask questions against collections',
    group: 'RAG and Chat',
    keywords: ['conversation', 'assistant'],
  },
  {
    id: 'agents',
    label: 'Manage agents',
    description: 'Configure bots and automation agents',
    group: 'Agent Platform',
    keywords: ['bots', 'automation'],
  },
];

describe('filterCommandPaletteRecords', () => {
  it('returns grouped records when the query is empty', () => {
    expect(filterCommandPaletteRecords(commands, '').map((command) => command.id)).toEqual([
      'agents',
      'dashboard',
      'chat',
    ]);
  });

  it('prioritizes label prefix matches over description matches', () => {
    expect(filterCommandPaletteRecords(commands, 'sta').map((command) => command.id)).toEqual([
      'chat',
    ]);
  });

  it('matches keywords and descriptions case-insensitively', () => {
    expect(filterCommandPaletteRecords(commands, 'BOT').map((command) => command.id)).toEqual([
      'agents',
    ]);
    expect(filterCommandPaletteRecords(commands, 'collections').map((command) => command.id)).toEqual([
      'chat',
    ]);
  });
});
