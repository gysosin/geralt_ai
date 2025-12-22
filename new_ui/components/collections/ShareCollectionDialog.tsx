import React, { useState, useEffect } from 'react';
import { Share2, X, UserPlus, Loader2, Trash2, Mail } from 'lucide-react';
import Modal from '../Modal';
import { documentService } from '../../src/services';
import type { CollectionShare } from '../../types';

interface ShareCollectionDialogProps {
    open: boolean;
    onClose: () => void;
    collectionId: string;
    collectionName: string;
}

export function ShareCollectionDialog({
    open,
    onClose,
    collectionId,
    collectionName,
}: ShareCollectionDialogProps) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'viewer' | 'contributor' | 'admin'>('viewer');
    const [sharedUsers, setSharedUsers] = useState<CollectionShare[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSharedUsers = async () => {
        setIsLoading(true);
        try {
            const users = await documentService.getSharedUsers(collectionId);
            setSharedUsers(users);
        } catch (err) {
            console.error('Failed to fetch shared users:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchSharedUsers();
        }
    }, [open, collectionId]);

    const handleShare = async () => {
        if (!email.trim()) return;

        setIsSharing(true);
        setError(null);
        try {
            await documentService.shareCollection({
                collection_id: collectionId,
                user: email.trim(),
                role,
            });
            setEmail('');
            fetchSharedUsers();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to share collection');
        } finally {
            setIsSharing(false);
        }
    };

    const handleRemove = async (user: string) => {
        if (!confirm(`Remove access for ${user}?`)) return;

        try {
            await documentService.removeSharedUser(collectionId, user);
            fetchSharedUsers();
        } catch (err) {
            console.error('Failed to remove user:', err);
        }
    };

    const getRoleBadgeClass = (role: string) => {
        switch (role) {
            case 'admin':
                return 'bg-violet-500/10 text-violet-400 border-violet-500/20';
            case 'contributor':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            default:
                return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
        }
    };

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={`Share "${collectionName}"`}
            maxWidth="max-w-lg"
        >
            <div className="space-y-6">
                {/* Share Form */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Email Address
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="user@example.com"
                                className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Permission Level
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['viewer', 'contributor', 'admin'] as const).map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setRole(r)}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${role === r
                                            ? 'bg-violet-600 border-violet-500 text-white'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    {r.charAt(0).toUpperCase() + r.slice(1)}
                                </button>
                            ))}
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            {role === 'viewer' && 'Can view documents and chat with the collection'}
                            {role === 'contributor' && 'Can view, upload, and process documents'}
                            {role === 'admin' && 'Full access including sharing and deletion'}
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleShare}
                        disabled={!email.trim() || isSharing}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSharing ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Sharing...
                            </>
                        ) : (
                            <>
                                <UserPlus size={16} />
                                Share Collection
                            </>
                        )}
                    </button>
                </div>

                {/* Shared Users List */}
                <div>
                    <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                        Shared With ({sharedUsers.length})
                    </h4>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                        </div>
                    ) : sharedUsers.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Share2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Not shared with anyone yet</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                            {sharedUsers.map((user, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-3 bg-white/5 rounded-xl group"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm font-medium">
                                            {(user.username || user.email || '?')[0].toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm text-white truncate">
                                                {user.username || user.email}
                                            </p>
                                            {user.email && user.username && (
                                                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 rounded-md text-xs font-medium border ${getRoleBadgeClass(user.role)}`}>
                                            {user.role}
                                        </span>
                                        <button
                                            onClick={() => handleRemove(user.username || user.email || '')}
                                            className="p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Close Button */}
                <div className="flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export default ShareCollectionDialog;
