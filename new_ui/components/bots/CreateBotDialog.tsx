import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { Bot, Collection, CreateBotCommand } from '../../types';
import { Plus, Trash2, Upload } from 'lucide-react';

interface CreateBotDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateBotCommand, iconFile?: File) => Promise<void>;
    bot?: Bot;
    initialDraft?: CreateBotCommand | null;
    collections: Collection[];
}

const CreateBotDialog: React.FC<CreateBotDialogProps> = ({
    isOpen,
    onClose,
    onSubmit,
    bot,
    initialDraft,
    collections
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
    const [welcomeButtons, setWelcomeButtons] = useState<{ label: string, action: string }[]>([]);
    const [iconFile, setIconFile] = useState<File | undefined>();
    const [iconPreview, setIconPreview] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (bot) {
                setName(bot.name || '');
                setDescription(bot.description || bot.welcome_message || '');
                setSelectedCollections(bot.collectionIds || bot.collection_ids || []);
                setWelcomeButtons(bot.welcome_buttons?.map(b => ({ label: b.label, action: b.action })) || []);
                setIconPreview(bot.icon || '');
            } else if (initialDraft) {
                setName(initialDraft.bot_name || '');
                setDescription(initialDraft.welcome_message || initialDraft.prompt || initialDraft.description || '');
                setSelectedCollections(initialDraft.collection_ids || []);
                setWelcomeButtons(initialDraft.welcome_buttons?.map(b => ({ label: b.label, action: b.action })) || []);
                setIconPreview(initialDraft.icon_url || '');
            } else {
                setName('');
                setDescription('');
                setSelectedCollections([]);
                setWelcomeButtons([]);
                setIconPreview('');
            }
            setIconFile(undefined);
            setError(null);
        }
    }, [isOpen, bot, initialDraft]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIconFile(file);
            setIconPreview(URL.createObjectURL(file));
        }
    };

    const handleAddButton = () => {
        setWelcomeButtons([...welcomeButtons, { label: '', action: '' }]);
    };

    const handleRemoveButton = (index: number) => {
        const newButtons = [...welcomeButtons];
        newButtons.splice(index, 1);
        setWelcomeButtons(newButtons);
    };

    const handleButtonChange = (index: number, field: 'label' | 'action', value: string) => {
        const newButtons = [...welcomeButtons];
        newButtons[index][field] = value;
        setWelcomeButtons(newButtons);
    };

    const handleCollectionToggle = (collectionId: string) => {
        if (selectedCollections.includes(collectionId)) {
            setSelectedCollections(selectedCollections.filter(id => id !== collectionId));
        } else {
            setSelectedCollections([...selectedCollections, collectionId]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('Bot name is required');
            return;
        }
        if (!bot && selectedCollections.length === 0) {
            setError('Please select at least one collection for the knowledge base');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const command: CreateBotCommand = {
            bot_name: name,
            welcome_message: description,
            collection_ids: selectedCollections,
            welcome_buttons: welcomeButtons.filter(b => b.label && b.action),
        };

        try {
            await onSubmit(command, iconFile);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save bot');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={bot ? 'Edit Agent' : 'Create New Agent'}
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                <div className="flex gap-6">
                    <div className="shrink-0">
                        <label className="block text-sm font-medium text-gray-400 mb-2">Icon</label>
                        <div
                            className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-colors overflow-hidden relative group"
                            onClick={() => document.getElementById('icon-upload')?.click()}
                        >
                            {iconPreview ? (
                                <img src={iconPreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <Upload className="text-gray-500 mb-1" size={24} />
                            )}
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-xs text-white">Change</span>
                            </div>
                        </div>
                        <input
                            id="icon-upload"
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    </div>

                    <div className="flex-1 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1.5">Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors"
                                placeholder="e.g. Financial Analyst"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1.5">System Instructions (Prompt)</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-violet-500 transition-colors h-24 resize-none"
                                placeholder="Describe how this agent should behave..."
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-3">Knowledge Base</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto custom-scrollbar p-1">
                        {collections.map(col => (
                            <label
                                key={col.id}
                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedCollections.includes(col.id) ? 'bg-violet-500/10 border-violet-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedCollections.includes(col.id)}
                                    onChange={() => handleCollectionToggle(col.id)}
                                    className="w-4 h-4 rounded border-gray-600 text-violet-600 focus:ring-violet-500 bg-gray-800"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-white truncate">{col.name}</div>
                                    <div className="text-xs text-gray-500">{col.fileCount} files</div>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-medium text-gray-400">Welcome Buttons</label>
                        <button
                            type="button"
                            onClick={handleAddButton}
                            className="text-xs flex items-center gap-1 text-violet-400 hover:text-violet-300 transition-colors"
                        >
                            <Plus size={14} /> Add Button
                        </button>
                    </div>
                    <div className="space-y-3">
                        {welcomeButtons.map((btn, idx) => (
                            <div key={idx} className="flex gap-3">
                                <input
                                    type="text"
                                    value={btn.label}
                                    onChange={(e) => handleButtonChange(idx, 'label', e.target.value)}
                                    placeholder="Label"
                                    className="flex-1 bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                                />
                                <input
                                    type="text"
                                    value={btn.action}
                                    onChange={(e) => handleButtonChange(idx, 'action', e.target.value)}
                                    placeholder="Action / Query"
                                    className="flex-[2] bg-black/20 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleRemoveButton(idx)}
                                    className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        {welcomeButtons.length === 0 && (
                            <div className="text-center py-6 border border-dashed border-white/10 rounded-xl text-gray-500 text-sm">
                                No welcome buttons configured
                            </div>
                        )}
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
                        className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-violet-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Saving...' : (bot ? 'Update Agent' : 'Create Agent')}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default CreateBotDialog;
