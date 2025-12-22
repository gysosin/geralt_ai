import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
    content: string
    className?: string
}

function CodeBlock({
    children,
    className,
    ...props
}: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
    const [copied, setCopied] = useState(false)
    const codeContent = String(children).replace(/\n$/, '')

    const handleCopy = async () => {
        await navigator.clipboard.writeText(codeContent)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // Inline code (no language class)
    if (!className) {
        return (
            <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm" {...props}>
                {children}
            </code>
        )
    }

    return (
        <div className="relative group my-4">
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/80 hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Copy code"
            >
                {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                ) : (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                )}
            </button>
            <code className={cn(className, "block rounded-lg p-4 overflow-x-auto text-sm")} {...props}>
                {children}
            </code>
        </div>
    )
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
    return (
        <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                    // Custom code block with copy button
                    code: CodeBlock,
                    // Style pre to remove default padding (handled by code)
                    pre: ({ children }) => (
                        <pre className="bg-muted rounded-lg overflow-hidden m-0 p-0">
                            {children}
                        </pre>
                    ),
                    // Enhanced table styling
                    table: ({ children }) => (
                        <div className="overflow-x-auto my-4">
                            <table className="min-w-full divide-y divide-border">
                                {children}
                            </table>
                        </div>
                    ),
                    th: ({ children }) => (
                        <th className="px-3 py-2 text-left text-sm font-semibold bg-muted">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="px-3 py-2 text-sm border-t border-border">
                            {children}
                        </td>
                    ),
                    // Links with proper styling
                    a: ({ children, href }) => (
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                        >
                            {children}
                        </a>
                    ),
                    // Lists with proper spacing
                    ul: ({ children }) => (
                        <ul className="list-disc list-inside space-y-1 my-2">
                            {children}
                        </ul>
                    ),
                    ol: ({ children }) => (
                        <ol className="list-decimal list-inside space-y-1 my-2">
                            {children}
                        </ol>
                    ),
                    // Blockquotes
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">
                            {children}
                        </blockquote>
                    ),
                    // Headings with proper sizing
                    h1: ({ children }) => (
                        <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>
                    ),
                    h2: ({ children }) => (
                        <h2 className="text-lg font-bold mt-3 mb-2">{children}</h2>
                    ),
                    h3: ({ children }) => (
                        <h3 className="text-base font-semibold mt-2 mb-1">{children}</h3>
                    ),
                    // Paragraph spacing
                    p: ({ children }) => (
                        <p className="my-2 leading-relaxed">{children}</p>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}

export default MarkdownRenderer
