import React, { useState, useEffect } from 'react';
import {
  Database, FileText, Clock, MoreHorizontal,
  Trash2, Folder, Search, Filter, HardDrive, Plus, File, Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import { collectionService } from '../src/services';
import { useAuthStore } from '../src/store/auth.store';
import type { Collection } from '../types';

interface CollectionCardProps {
  col: Collection;
  onDelete: (id: string) => void;
}

const CollectionCard = ({ col, onDelete }: CollectionCardProps) => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${col.name || col.collection_name}"?`)) {
      onDelete(col.id);
    }
    setShowMenu(false);
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      onClick={() => navigate(`/collections/${col.id}`)}
      className="group bg-surface/30 backdrop-blur-sm border border-white/5 rounded-2xl p-5 hover:border-violet-500/30 hover:bg-white/[0.03] transition-all cursor-pointer relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-16 bg-gradient-to-br from-violet-500/10 to-transparent blur-2xl rounded-full -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${col.type === 'finance' ? 'bg-emerald-500/10 text-emerald-400' :
          col.type === 'legal' ? 'bg-blue-500/10 text-blue-400' :
            col.type === 'tech' ? 'bg-violet-500/10 text-violet-400' :
              'bg-orange-500/10 text-orange-400'
          }`}>
          <Folder size={20} />
        </div>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="text-gray-500 hover:text-white transition-colors p-1"
          >
            <MoreHorizontal size={16} />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
              <div className="absolute right-0 top-full mt-1 bg-[#1a1a1d] border border-white/10 rounded-lg shadow-xl z-50 py-1 min-w-[120px]">
                <button
                  onClick={handleDelete}
                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-white/5 flex items-center gap-2"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <h3 className="font-semibold text-white text-base mb-1 truncate pr-4 relative z-10">
        {col.name || col.collection_name}
      </h3>
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-4 relative z-10">
        <span>{col.fileCount || col.file_count || 0} files</span>
        <span className="w-1 h-1 rounded-full bg-gray-600" />
        <span>{col.size || 'Unknown'}</span>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
        <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-md uppercase tracking-wider">{col.type || 'general'}</span>
        <span className="text-[10px] text-gray-600 flex items-center gap-1">
          <Clock size={10} /> {col.lastUpdated || (col.created_at ? new Date(col.created_at).toLocaleDateString() : 'Unknown')}
        </span>
      </div>
    </motion.div>
  );
};

interface StorageStats {
  storage: {
    used_bytes: number;
    used_formatted: string;
    limit_bytes: number;
    limit_formatted: string;
    usage_percent: number;
    file_count: number;
  };
  vectors: {
    total_vectors: number;
    total_formatted: string;
    index_status: string;
  };
  documents: {
    total: number;
    processed: number;
    pending: number;
  };
}

const StorageMeter = ({ stats, isLoading }: { stats: StorageStats | null; isLoading: boolean }) => (
  <div className="space-y-4">
    {/* Storage Usage Card */}
    <div className="bg-gradient-to-br from-violet-900/40 to-indigo-900/40 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/20 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none" />
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-white/10 rounded-lg text-white">
          <HardDrive size={20} />
        </div>
        <div>
          <h3 className="text-white font-medium text-sm">Storage Usage</h3>
          <p className="text-xs text-gray-400">
            {isLoading ? 'Loading...' : `${stats?.storage.usage_percent || 0}% used`}
          </p>
        </div>
      </div>

      <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-indigo-400 rounded-full shadow-[0_0_10px_rgba(139,92,246,0.5)] transition-all duration-500"
          style={{ width: `${stats?.storage.usage_percent || 0}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 font-mono">
        <span>{stats?.storage.used_formatted || '0 B'} Used</span>
        <span>{stats?.storage.limit_formatted || '50 GB'} Total</span>
      </div>
    </div>

    {/* Vector Index Card */}
    <div className="bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none" />
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-white/10 rounded-lg text-emerald-400">
          <Database size={20} />
        </div>
        <div>
          <h3 className="text-white font-medium text-sm">Vector Index</h3>
          <p className="text-xs text-gray-400">
            {stats?.vectors.index_status === 'active' ? 'Active' : 'Inactive'}
          </p>
        </div>
      </div>
      <div className="text-2xl font-bold text-white font-mono">
        {stats?.vectors.total_formatted || '0'}
      </div>
      <p className="text-xs text-gray-500 mt-1">Total embeddings</p>
    </div>
  </div>
);

const DEFAULT_COLLECTION_TYPES = ['finance', 'legal', 'technical', 'general'];

const Collections: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [newCollectionType, setNewCollectionType] = useState<string>('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Compute dynamic filter types from collections
  const filterTypes = ['all', ...Array.from(new Set<string>([...DEFAULT_COLLECTION_TYPES, ...collections.map(c => (c.type || 'general').toLowerCase())]))];

  const tenantId = user?.tenant_id || 'default';

  const fetchCollections = async () => {
    setIsLoading(true);
    try {
      const data = await collectionService.getAllCollections(tenantId);
      setCollections(data);
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStorageStats = async () => {
    setIsStatsLoading(true);
    try {
      const stats = await collectionService.getStorageStats(tenantId);
      setStorageStats(stats);
    } catch (error) {
      console.error('Failed to fetch storage stats:', error);
    } finally {
      setIsStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
    fetchStorageStats();
  }, [tenantId]);

  const handleCreate = async () => {
    if (!newCollectionName.trim()) return;

    setIsSubmitting(true);
    try {
      await collectionService.createCollection(newCollectionName, tenantId, newCollectionDescription);
      setNewCollectionName('');
      setNewCollectionDescription('');
      setNewCollectionType('general');
      setIsCreateModalOpen(false);
      fetchCollections();
    } catch (error) {
      console.error('Failed to create collection:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (collectionId: string) => {
    try {
      await collectionService.deleteCollection(collectionId);
      fetchCollections();
    } catch (error) {
      console.error('Failed to delete collection:', error);
    }
  };

  const filteredCollections = collections.filter(col => {
    const name = col.name || col.collection_name || '';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
    const colType = (col.type || 'general').toLowerCase();
    const matchesFilter = activeFilter === 'all' || colType === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const totalDocs = collections.reduce((acc, col) => acc + (col.fileCount || col.file_count || 0), 0);

  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Knowledge Base</h1>
          <p className="text-gray-400">Manage vector stores and document collections.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className={`flex items-center gap-2 px-4 py-2 ${activeFilter !== 'all' ? 'bg-violet-600/20 text-violet-300 border-violet-500/30' : 'bg-white/5 text-gray-300 border-white/5'} hover:text-white hover:bg-white/10 rounded-xl transition-all border`}
            >
              <Filter size={16} />
              {activeFilter === 'all' ? 'Filter' : activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)}
            </button>
            {showFilterMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)} />
                <div className="absolute right-0 top-full mt-2 bg-[#1a1a1d] border border-white/10 rounded-xl shadow-xl z-50 py-2 min-w-[160px] max-h-60 overflow-y-auto">
                  {filterTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setActiveFilter(type);
                        setShowFilterMenu(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between gap-2 ${activeFilter === type ? 'text-violet-400 bg-violet-500/10' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                    >
                      <span>{type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}</span>
                      {activeFilter === type && <span className="text-violet-400">✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-500 transition-colors shadow-lg shadow-violet-900/20"
          >
            <Plus size={18} />
            New Collection
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Metrics */}
        <div className="lg:col-span-1 space-y-6">
          <StorageMeter stats={storageStats} isLoading={isStatsLoading} />

          <div className="bg-surface/30 border border-white/5 rounded-2xl p-5">
            <h4 className="text-sm font-semibold text-white mb-4">Quick Stats</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 flex items-center gap-2"><File size={14} /> Total Documents</span>
                <span className="text-white font-mono">{totalDocs.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400 flex items-center gap-2"><Database size={14} /> Collections</span>
                <span className="text-white font-mono">{collections.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="lg:col-span-3">
          {/* Search Bar */}
          <div className="mb-6 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Search collections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all placeholder-gray-600"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="border border-dashed border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-white hover:bg-white/5 hover:border-violet-500/30 transition-all group min-h-[160px]"
              >
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-violet-600 group-hover:text-white transition-colors">
                  <Plus size={20} />
                </div>
                <span className="font-medium text-sm">New Collection</span>
              </button>

              {filteredCollections.map((col) => (
                <CollectionCard key={col.id} col={col} onDelete={handleDelete} />
              ))}

              {filteredCollections.length === 0 && !isLoading && (
                <div className="col-span-2 text-center py-12 text-gray-500">
                  <Database size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No collections found</p>
                  <p className="text-sm mt-1">Create your first collection to get started</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Collection"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Collection Name *</label>
            <input
              type="text"
              placeholder="e.g. Q4 Financial Reports"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Description (Optional)</label>
            <textarea
              placeholder="What is this collection used for?"
              value={newCollectionDescription}
              onChange={(e) => setNewCollectionDescription(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors min-h-[100px] resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
            <input
              type="text"
              placeholder="e.g. Finance, Legal, Research, Marketing..."
              value={newCollectionType}
              onChange={(e) => setNewCollectionType(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors mb-3"
            />
            {/* Show existing categories as suggestions */}
            {(() => {
              const existingTypes = collections.map(c => (c.type || 'general').toLowerCase());
              const defaultTypes = ['finance', 'legal', 'technical', 'general'];
              const allTypes = Array.from(new Set<string>([...defaultTypes, ...existingTypes]));
              return (
                <div className="flex flex-wrap gap-2">
                  {allTypes.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewCollectionType(type)}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-all ${newCollectionType === type
                        ? 'bg-violet-600 text-white'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                        }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isSubmitting || !newCollectionName.trim()}
              className="px-5 py-2.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-xl shadow-lg shadow-violet-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting ? 'Creating...' : 'Create Collection'}
            </button>
          </div>
        </div>
      </Modal>
    </div >
  );
};

export default Collections;
