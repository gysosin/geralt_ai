import React, { useState } from 'react';
import { MOCK_COLLECTIONS } from '../constants';
import { 
  Database, UploadCloud, FileText, Clock, MoreHorizontal, 
  Trash2, Folder, Search, Filter, HardDrive, Plus, File, X
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';

const CollectionCard = ({ col }: any) => {
  const navigate = useNavigate();

  return (
    <motion.div 
      whileHover={{ y: -4 }}
      onClick={() => navigate(`/collections/${col.id}`)}
      className="group bg-surface/30 backdrop-blur-sm border border-white/5 rounded-2xl p-5 hover:border-violet-500/30 hover:bg-white/[0.03] transition-all cursor-pointer relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-16 bg-gradient-to-br from-violet-500/10 to-transparent blur-2xl rounded-full -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          col.type === 'finance' ? 'bg-emerald-500/10 text-emerald-400' :
          col.type === 'legal' ? 'bg-blue-500/10 text-blue-400' :
          col.type === 'tech' ? 'bg-violet-500/10 text-violet-400' :
          'bg-orange-500/10 text-orange-400'
        }`}>
          <Folder size={20} />
        </div>
        <button onClick={(e) => e.stopPropagation()} className="text-gray-500 hover:text-white transition-colors">
          <MoreHorizontal size={16} />
        </button>
      </div>

      <h3 className="font-semibold text-white text-base mb-1 truncate pr-4 relative z-10">{col.name}</h3>
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-4 relative z-10">
        <span>{col.fileCount} files</span>
        <span className="w-1 h-1 rounded-full bg-gray-600" />
        <span>{col.size}</span>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
         <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-md uppercase tracking-wider">{col.type}</span>
         <span className="text-[10px] text-gray-600 flex items-center gap-1">
           <Clock size={10} /> {col.lastUpdated}
         </span>
      </div>
    </motion.div>
  );
};

const StorageMeter = () => (
  <div className="bg-gradient-to-br from-violet-900/40 to-indigo-900/40 border border-white/10 rounded-2xl p-6 relative overflow-hidden">
     <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/20 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none" />
     <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-white/10 rounded-lg text-white">
           <HardDrive size={20} />
        </div>
        <div>
          <h3 className="text-white font-medium text-sm">Storage Usage</h3>
          <p className="text-xs text-gray-400">45% of 50GB used</p>
        </div>
     </div>
     
     <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden mb-2">
       <div className="h-full w-[45%] bg-gradient-to-r from-violet-500 to-indigo-400 rounded-full shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
     </div>
     <div className="flex justify-between text-[10px] text-gray-400 font-mono">
       <span>22.5 GB Used</span>
       <span>50 GB Total</span>
     </div>
  </div>
);

const Collections: React.FC = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Knowledge Base</h1>
          <p className="text-gray-400">Manage vector stores and document collections.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-white/5">
             <Filter size={16} /> Filter
          </button>
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
           <StorageMeter />
           
           <div className="bg-surface/30 border border-white/5 rounded-2xl p-5">
              <h4 className="text-sm font-semibold text-white mb-4">Quick Stats</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-400 flex items-center gap-2"><File size={14}/> Total Documents</span>
                   <span className="text-white font-mono">1,248</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                   <span className="text-gray-400 flex items-center gap-2"><Database size={14}/> Vector Index</span>
                   <span className="text-white font-mono">14.2M</span>
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
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all placeholder-gray-600"
              />
           </div>

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

              {MOCK_COLLECTIONS.map((col) => (
                <CollectionCard key={col.id} col={col} />
              ))}
           </div>
        </div>
      </div>

      <Modal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        title="Create New Collection"
      >
        <div className="space-y-6">
           <div>
             <label className="block text-sm font-medium text-gray-400 mb-2">Collection Name</label>
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
               className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500 transition-colors min-h-[100px] resize-none"
             />
           </div>

           <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Collection Type</label>
              <div className="grid grid-cols-2 gap-3">
                 {['Finance', 'Legal', 'Technical', 'General'].map(type => (
                   <label key={type} className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer">
                      <input type="radio" name="type" className="text-violet-500 bg-gray-800 border-gray-600 focus:ring-violet-500" />
                      <span className="text-sm text-gray-200">{type}</span>
                   </label>
                 ))}
              </div>
           </div>

           <div className="flex justify-end gap-3 pt-4">
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="px-5 py-2.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-xl shadow-lg shadow-violet-900/20 transition-all"
              >
                Create Collection
              </button>
           </div>
        </div>
      </Modal>
    </div>
  );
};

export default Collections;