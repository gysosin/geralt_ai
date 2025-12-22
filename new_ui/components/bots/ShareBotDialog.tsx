import React, { useState } from 'react';
import Modal from '../Modal';
import { ShareBotCommand } from '../../types';
import { Mail, Shield, AlertCircle } from 'lucide-react';

interface ShareBotDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: ShareBotCommand) => Promise<void>;
    botToken: string;
    botName: string;
}

const ShareBotDialog: React.FC<ShareBotDialogProps> = ({
    isOpen,
    onClose,
    onSubmit,
    botToken,
    botName
}) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'viewer' | 'contributor' | 'admin'>('viewer');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Please enter a valid email address');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await onSubmit({
                bot_token: botToken,
                user_email: email,
                role: role
            });
            setEmail('');
            setRole('viewer');
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to share bot');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Share ${botName}`}
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1.5">User Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors"
                                placeholder="colleague@example.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1.5">Role</label>
                        <div className="grid grid-cols-3 gap-3">
                            {(['viewer', 'contributor', 'admin'] as const).map((r) => (
                                <label
                                    key={r}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-all ${role === r ? 'bg-violet-500/20 border-violet-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                                >
                                    <input
                                        type="radio"
                                        name="role"
                                        value={r}
                                        checked={role === r}
                                        onChange={() => setRole(r)}
                                        className="hidden"
                                    />
                                    <Shield size={20} className={`mb-2 ${role === r ? 'text-violet-400' : 'text-gray-500'}`} />
                                    <span className="capitalize text-sm font-medium">{r}</span>
                                </label>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            {role === 'viewer' && 'Can only view the bot and chat with it.'}
                            {role === 'contributor' && 'Can view, chat, and edit the bot configuration.'}
                            {role === 'admin' && 'Full access including sharing and deletion.'}
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-violet-900/20 transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? 'Sharing...' : 'Share'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ShareBotDialog;
