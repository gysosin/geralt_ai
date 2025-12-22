import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface SuggestionChipsProps {
    suggestions: string[];
    onSelect: (suggestion: string) => void;
    className?: string;
    disabled?: boolean;
}

export function SuggestionChips({
    suggestions,
    onSelect,
    className = '',
    disabled = false
}: SuggestionChipsProps) {
    if (!suggestions || suggestions.length === 0) {
        return null;
    }

    return (
        <div className={`mt-3 pt-3 border-t border-white/10 ${className}`}>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <Sparkles className="h-4 w-4 text-violet-400" />
                <span className="font-medium text-xs">Follow-up suggestions</span>
            </div>

            <div className="flex flex-wrap gap-2">
                {suggestions.slice(0, 4).map((suggestion, index) => (
                    <motion.button
                        key={suggestion}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => !disabled && onSelect(suggestion)}
                        disabled={disabled}
                        className={`
              px-3 py-1.5 text-sm rounded-full border border-white/10
              bg-white/5 hover:bg-violet-500/20 hover:border-violet-500/30
              transition-all text-left text-gray-300
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
                    >
                        {suggestion}
                    </motion.button>
                ))}
            </div>
        </div>
    );
}

export default SuggestionChips;
