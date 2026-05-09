import React, { useState, useEffect, useRef } from 'react';
import { FolderOpen, Check, ChevronDown, X, Loader2, Database } from 'lucide-react';
import { collectionService } from '../../services';
import type { Collection } from '@/types';
import { useAuthStore } from '../../store/auth.store';

interface CollectionPickerProps {
    selectedId: string | null;
    onSelect: (collectionId: string | null) => void;
    className?: string;
}

export function CollectionPicker({
    selectedId,
    onSelect,
    className = ''
}: CollectionPickerProps) {
    const [collections, setCollections] = useState<Collection[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuthStore();
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchCollections = async () => {
            setIsLoading(true);
            try {
                const tenantId = user?.tenant_id || 'default';
                const data = await collectionService.getAllCollections(tenantId);
                setCollections(data);
            } catch (error) {
                console.error('Failed to fetch collections', error);
            } finally {
                setIsLoading(false);
            }
        };

        if (collections.length === 0) {
            fetchCollections();
        }
    }, [user?.tenant_id, collections.length]);

    const selectedCollection = collections.find(c => c.id === selectedId);
    const displayName = selectedCollection?.name || selectedCollection?.collection_name;

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(null);
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            {/* Trigger Button - Compact design with integrated clear */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 h-8 px-3 rounded-lg transition-all text-sm ${selectedCollection
                        ? 'bg-violet-500/15 border border-violet-500/30 text-violet-300 hover:bg-violet-500/25'
                        : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                    }`}
            >
                <Database className={`h-3.5 w-3.5 ${selectedCollection ? 'text-violet-400' : 'text-gray-400'}`} />
                <span className="max-w-[120px] truncate font-medium">
                    {displayName || 'All Collections'}
                </span>

                {/* Clear button when collection selected */}
                {selectedCollection ? (
                    <button
                        onClick={handleClear}
                        className="p-0.5 hover:bg-violet-500/30 rounded-full transition-colors"
                    >
                        <X className="h-3 w-3" />
                    </button>
                ) : (
                    <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

                    <div className="absolute top-full left-0 mt-1.5 w-72 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                        {/* Header */}
                        <div className="px-3 py-2.5 border-b border-white/5 bg-white/[0.02]">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Select Knowledge Base</p>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                            </div>
                        ) : (
                            <div className="py-1">
                                {/* All Collections Option */}
                                <button
                                    onClick={() => {
                                        onSelect(null);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors ${!selectedId ? 'bg-violet-500/10' : 'hover:bg-white/5'
                                        }`}
                                >
                                    <div className={`p-1.5 rounded-lg ${!selectedId ? 'bg-violet-500/20' : 'bg-white/5'}`}>
                                        <Database className={`h-4 w-4 ${!selectedId ? 'text-violet-400' : 'text-gray-400'}`} />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className={`text-sm font-medium ${!selectedId ? 'text-violet-300' : 'text-gray-200'}`}>
                                            All Collections
                                        </p>
                                        <p className="text-xs text-gray-500">Search across all your data</p>
                                    </div>
                                    {!selectedId && <Check className="h-4 w-4 text-violet-400" />}
                                </button>

                                {collections.length > 0 && (
                                    <div className="border-t border-white/5 my-1" />
                                )}

                                {/* Collection List */}
                                <div className="max-h-56 overflow-y-auto scrollbar-thin">
                                    {collections.map((collection) => {
                                        const isSelected = selectedId === collection.id;
                                        const name = collection.name || collection.collection_name;
                                        const count = collection.fileCount || collection.file_count || 0;

                                        return (
                                            <button
                                                key={collection.id}
                                                onClick={() => {
                                                    onSelect(collection.id);
                                                    setIsOpen(false);
                                                }}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors ${isSelected ? 'bg-violet-500/10' : 'hover:bg-white/5'
                                                    }`}
                                            >
                                                <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-violet-500/20' : 'bg-white/5'}`}>
                                                    <FolderOpen className={`h-4 w-4 ${isSelected ? 'text-violet-400' : 'text-gray-400'}`} />
                                                </div>
                                                <div className="flex-1 min-w-0 text-left">
                                                    <p className={`text-sm font-medium truncate ${isSelected ? 'text-violet-300' : 'text-gray-200'}`}>
                                                        {name}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {count} {count === 1 ? 'document' : 'documents'}
                                                    </p>
                                                </div>
                                                {isSelected && <Check className="h-4 w-4 text-violet-400 shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>

                                {collections.length === 0 && (
                                    <div className="py-6 text-center">
                                        <FolderOpen className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                                        <p className="text-sm text-gray-500">No collections found</p>
                                        <p className="text-xs text-gray-600 mt-1">Upload documents to create a collection</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default CollectionPicker;
