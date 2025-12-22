import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SuggestionChipsProps {
    suggestions: string[]
    onSelect: (suggestion: string) => void
    className?: string
    disabled?: boolean
}

export function SuggestionChips({
    suggestions,
    onSelect,
    className,
    disabled = false
}: SuggestionChipsProps) {
    if (!suggestions || suggestions.length === 0) {
        return null
    }

    return (
        <div className={cn("mt-3 pt-3 border-t border-border/50", className)}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Sparkles className="h-4 w-4" />
                <span className="font-medium">Follow-up suggestions</span>
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
                        className={cn(
                            "px-3 py-1.5 text-sm rounded-full border border-border",
                            "bg-background hover:bg-muted/50 hover:border-primary/30",
                            "transition-colors text-left",
                            "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                    >
                        {suggestion}
                    </motion.button>
                ))}
            </div>
        </div>
    )
}

export default SuggestionChips
