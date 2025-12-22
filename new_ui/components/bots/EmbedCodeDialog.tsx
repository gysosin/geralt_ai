import React, { useState } from 'react';
import Modal from '../Modal';
import { Copy, Check, Code } from 'lucide-react';

interface EmbedCodeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    embedCode: string;
    botName: string;
}

const EmbedCodeDialog: React.FC<EmbedCodeDialogProps> = ({
    isOpen,
    onClose,
    embedCode,
    botName
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(embedCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Embed ${botName}`}
        >
            <div className="space-y-6">
                <div>
                    <p className="text-sm text-gray-400 mb-4">
                        Copy and paste this code snippet into your website's HTML to embed the chatbot widget.
                    </p>

                    <div className="relative group">
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={handleCopy}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${copied
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-white/10 text-white hover:bg-white/20'
                                    }`}
                            >
                                {copied ? (
                                    <>
                                        <Check size={14} /> Copied
                                    </>
                                ) : (
                                    <>
                                        <Copy size={14} /> Copy Code
                                    </>
                                )}
                            </button>
                        </div>

                        <pre className="w-full bg-[#09090b] border border-white/10 rounded-xl p-4 overflow-x-auto text-xs font-mono text-gray-300 leading-relaxed custom-scrollbar">
                            <code>{embedCode}</code>
                        </pre>
                    </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex gap-3 items-start">
                    <Code className="text-violet-400 mt-1 shrink-0" size={18} />
                    <div>
                        <h4 className="text-sm font-medium text-white mb-1">Developer Note</h4>
                        <p className="text-xs text-gray-400">
                            The widget will automatically inherit your bot's theme and welcome message.
                            Ensure your domain is whitelisted in the security settings if configured.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-white/5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 bg-white text-black text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default EmbedCodeDialog;
