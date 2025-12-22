import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

interface CodeBlockProps {
    children?: React.ReactNode;
    className?: string;
    inline?: boolean;
}

function CodeBlock({ children, className, inline }: CodeBlockProps) {
    const [copied, setCopied] = useState(false);
    const codeContent = String(children).replace(/\n$/, '');

    const handleCopy = async () => {
        await navigator.clipboard.writeText(codeContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Inline code
    if (inline || !className) {
        return (
            <code className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-sm text-violet-300">
                {children}
            </code>
        );
    }

    return (
        <div className="relative group my-4">
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Copy code"
            >
                {copied ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                    <Copy className="h-4 w-4 text-gray-400" />
                )}
            </button>
            <code className={`${className} block rounded-lg p-4 overflow-x-auto text-sm bg-black/40 border border-white/5`}>
                {children}
            </code>
        </div>
    );
}

// Simple markdown parser for common patterns
function parseMarkdown(content: string): React.ReactNode[] {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLang = '';

    lines.forEach((line, lineIndex) => {
        // Code block handling
        if (line.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeBlockLang = line.slice(3).trim();
                codeBlockContent = [];
            } else {
                inCodeBlock = false;
                elements.push(
                    <CodeBlock key={`code-${lineIndex}`} className={`language-${codeBlockLang}`}>
                        {codeBlockContent.join('\n')}
                    </CodeBlock>
                );
            }
            return;
        }

        if (inCodeBlock) {
            codeBlockContent.push(line);
            return;
        }

        // Empty line
        if (!line.trim()) {
            elements.push(<br key={`br-${lineIndex}`} />);
            return;
        }

        // Headers
        if (line.startsWith('### ')) {
            elements.push(
                <h3 key={`h3-${lineIndex}`} className="text-base font-semibold mt-3 mb-1 text-gray-100">
                    {parseInlineMarkdown(line.slice(4))}
                </h3>
            );
            return;
        }
        if (line.startsWith('## ')) {
            elements.push(
                <h2 key={`h2-${lineIndex}`} className="text-lg font-bold mt-4 mb-2 text-gray-100">
                    {parseInlineMarkdown(line.slice(3))}
                </h2>
            );
            return;
        }
        if (line.startsWith('# ')) {
            elements.push(
                <h1 key={`h1-${lineIndex}`} className="text-xl font-bold mt-4 mb-2 text-gray-100">
                    {parseInlineMarkdown(line.slice(2))}
                </h1>
            );
            return;
        }

        // Blockquote
        if (line.startsWith('> ')) {
            elements.push(
                <blockquote key={`bq-${lineIndex}`} className="border-l-4 border-violet-500/50 pl-4 italic my-2 text-gray-400">
                    {parseInlineMarkdown(line.slice(2))}
                </blockquote>
            );
            return;
        }

        // Unordered list
        if (line.match(/^[\-\*]\s/)) {
            elements.push(
                <li key={`li-${lineIndex}`} className="ml-4 list-disc text-gray-300 my-1">
                    {parseInlineMarkdown(line.slice(2))}
                </li>
            );
            return;
        }

        // Ordered list
        const orderedMatch = line.match(/^(\d+)\.\s/);
        if (orderedMatch) {
            elements.push(
                <li key={`oli-${lineIndex}`} className="ml-4 list-decimal text-gray-300 my-1">
                    {parseInlineMarkdown(line.slice(orderedMatch[0].length))}
                </li>
            );
            return;
        }

        // Horizontal rule
        if (line.match(/^[\-\*\_]{3,}$/)) {
            elements.push(<hr key={`hr-${lineIndex}`} className="my-4 border-white/10" />);
            return;
        }

        // Normal paragraph
        elements.push(
            <p key={`p-${lineIndex}`} className="my-2 leading-relaxed text-gray-300">
                {parseInlineMarkdown(line)}
            </p>
        );
    });

    return elements;
}

// Parse inline markdown (bold, italic, code, links)
function parseInlineMarkdown(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    let currentText = text;
    let keyIndex = 0;

    // Process text with regex patterns
    const patterns = [
        // Bold: **text** or __text__
        {
            regex: /\*\*([^*]+)\*\*|__([^_]+)__/g, render: (match: string, g1: string, g2: string) =>
                <strong key={`bold-${keyIndex++}`} className="font-semibold text-white">{g1 || g2}</strong>
        },
        // Italic: *text* or _text_
        {
            regex: /\*([^*]+)\*|_([^_]+)_/g, render: (match: string, g1: string, g2: string) =>
                <em key={`italic-${keyIndex++}`} className="italic">{g1 || g2}</em>
        },
        // Inline code: `code`
        {
            regex: /`([^`]+)`/g, render: (match: string, g1: string) =>
                <code key={`code-${keyIndex++}`} className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-sm text-violet-300">{g1}</code>
        },
        // Links: [text](url)
        {
            regex: /\[([^\]]+)\]\(([^)]+)\)/g, render: (match: string, text: string, url: string) =>
                <a key={`link-${keyIndex++}`} href={url} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">{text}</a>
        },
    ];

    // Simple replacement without full parsing - just handle bold and inline code for now
    const result: React.ReactNode[] = [];

    // Split by bold markers
    const boldParts = currentText.split(/(\*\*[^*]+\*\*)/g);
    boldParts.forEach((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            result.push(
                <strong key={`bold-${i}`} className="font-semibold text-white">
                    {part.slice(2, -2)}
                </strong>
            );
        } else {
            // Check for inline code
            const codeParts = part.split(/(`[^`]+`)/g);
            codeParts.forEach((codePart, j) => {
                if (codePart.startsWith('`') && codePart.endsWith('`')) {
                    result.push(
                        <code key={`code-${i}-${j}`} className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-sm text-violet-300">
                            {codePart.slice(1, -1)}
                        </code>
                    );
                } else if (codePart) {
                    result.push(codePart);
                }
            });
        }
    });

    return result.length > 0 ? result : text;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
    return (
        <div className={`prose prose-sm prose-invert max-w-none ${className}`}>
            {parseMarkdown(content)}
        </div>
    );
}

export default MarkdownRenderer;
