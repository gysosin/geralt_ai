import React, { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Command, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { filterCommandPaletteRecords, type CommandPaletteRecord } from '../utils/command-palette';

export type CommandPaletteItem = CommandPaletteRecord & {
  path: string;
  icon: ReactNode;
};

interface CommandPaletteProps {
  isOpen: boolean;
  items: CommandPaletteItem[];
  onClose: () => void;
  onNavigate: (path: string) => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, items, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredItems = useMemo(() => filterCommandPaletteRecords(items, query), [items, query]);

  useEffect(() => {
    if (!isOpen) return;

    setQuery('');
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (activeIndex >= filteredItems.length) {
      setActiveIndex(Math.max(filteredItems.length - 1, 0));
    }
  }, [activeIndex, filteredItems.length]);

  const runCommand = (item: CommandPaletteItem) => {
    onNavigate(item.path);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, filteredItems.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter' && filteredItems[activeIndex]) {
      event.preventDefault();
      runCommand(filteredItems[activeIndex]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 px-4 pt-[12vh] backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="Global command palette"
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#111113] shadow-2xl shadow-black/50"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <Search size={18} className="text-violet-300" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                className="h-11 flex-1 bg-transparent text-base text-white outline-none placeholder:text-gray-500"
                placeholder="Search pages, actions, and workspace tools"
              />
              <div className="hidden items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-gray-400 sm:flex">
                <Command size={12} />
                <span>K</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
                aria-label="Close command palette"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[58vh] overflow-y-auto p-2">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-gray-400">
                    <Search size={28} />
                  </div>
                  <h3 className="text-sm font-semibold text-white">No command found</h3>
                  <p className="mt-1 max-w-sm text-sm text-gray-500">
                    Try searching for chat, agents, documents, analytics, history, or settings.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredItems.map((item, index) => {
                    const isActive = index === activeIndex;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => runCommand(item)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                          isActive
                            ? 'bg-violet-500/15 text-white'
                            : 'text-gray-300 hover:bg-white/[0.04] hover:text-white'
                        }`}
                      >
                        <span className={`rounded-xl border p-2 ${isActive ? 'border-violet-400/30 bg-violet-500/15 text-violet-200' : 'border-white/10 bg-white/5 text-gray-400'}`}>
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{item.label}</span>
                          <span className="block truncate text-xs text-gray-500">{item.description}</span>
                        </span>
                        <span className="hidden rounded-full border border-white/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-500 sm:inline">
                          {item.group}
                        </span>
                        <ArrowRight size={16} className={isActive ? 'text-violet-300' : 'text-gray-600'} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
