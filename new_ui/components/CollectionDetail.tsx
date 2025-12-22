import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MOCK_COLLECTIONS } from '../constants';
import { 
  ArrowLeft, FileText, UploadCloud, Search, MoreHorizontal, 
  CheckCircle, Clock, AlertCircle, Trash2, Download, FileUp
} from 'lucide-react';
import { motion } from 'framer-motion';
import Modal from './Modal';

// Mock files for the detail view
const MOCK_FILES = [
  { id: 'f1', name: 'Q3_Financial_Report_Final_v2.pdf', size: '2.4 MB', type: 'PDF', status: 'indexed', date: 'Oct 15, 2024' },
  { id: 'f2', name: 'Board_Meeting_Minutes_Sept.docx', size: '1.1 MB', type: 'DOCX', status: 'indexed', date: 'Oct 12, 2024' },
  { id: 'f3', name: 'Revenue_Forecast_Model_2025.xlsx', size: '4.5 MB', type: 'XLSX', status: 'processing', date: 'Oct 20, 2024' },
  { id: 'f4', name: 'Competitor_Analysis_Raw_Data.csv', size: '12.8 MB', type: 'CSV', status: 'error', date: 'Oct 18, 2024' },
];

const StatusBadge = ({ status }: { status: string }) => {
  if (status === 'indexed') return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
      <CheckCircle size={12} /> Indexed
    </span>
  );
  if (status === 'processing') return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/10">
      <Clock size={12} className="animate-spin" /> Processing
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/10">
      <AlertCircle size={12} /> Error
    </span>
  );
};

const CollectionDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const collection = MOCK_COLLECTIONS.find(c => c.id === id);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  if (!collection) return <div className="text-center p-10 text-gray-500">Collection not found</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-6xl mx-auto space-y-6"
    >
      {/* Navigation & Header */}
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => navigate('/collections')} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
             {collection.name}
             <span className="text-xs font-normal text-gray-500 bg-white/5 px-2 py-1 rounded uppercase tracking-wider">{collection.type}</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">Managed vector store • Last updated {collection.lastUpdated}</p>
        </div>
        <div className="ml-auto flex gap-3">
           <button 
             onClick={() => setIsUploadModalOpen(true)}
             className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-500 transition-colors shadow-lg shadow-violet-900/20"
           >
             <UploadCloud size={18} /> Add Documents
           </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-surface/30 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
               <FileText size={20} />
            </div>
            <div>
               <p className="text-gray-400 text-xs font-medium uppercase">Total Files</p>
               <p className="text-xl font-bold text-white">{collection.fileCount}</p>
            </div>
         </div>
         <div className="bg-surface/30 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
               <CheckCircle size={20} />
            </div>
            <div>
               <p className="text-gray-400 text-xs font-medium uppercase">Vectorized</p>
               <p className="text-xl font-bold text-white">98.5%</p>
            </div>
         </div>
         <div className="bg-surface/30 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
               <UploadCloud size={20} />
            </div>
            <div>
               <p className="text-gray-400 text-xs font-medium uppercase">Total Size</p>
               <p className="text-xl font-bold text-white">{collection.size}</p>
            </div>
         </div>
      </div>

      {/* Content Area */}
      <div className="bg-surface/30 border border-white/5 rounded-3xl overflow-hidden min-h-[500px] flex flex-col">
         {/* Toolbar */}
         <div className="p-4 border-b border-white/5 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
               <input 
                 type="text" 
                 placeholder="Search documents..." 
                 className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all placeholder-gray-600"
               />
            </div>
            <div className="flex items-center gap-2">
               <button className="text-xs font-medium text-gray-400 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">Select All</button>
               <button className="text-xs font-medium text-red-400 hover:text-red-300 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors">Delete Selected</button>
            </div>
         </div>

         {/* File List */}
         <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="text-xs text-gray-500 border-b border-white/5">
                     <th className="font-medium p-4 w-12 text-center">#</th>
                     <th className="font-medium p-4">Name</th>
                     <th className="font-medium p-4">Size</th>
                     <th className="font-medium p-4">Date Uploaded</th>
                     <th className="font-medium p-4">Status</th>
                     <th className="font-medium p-4 text-right">Actions</th>
                  </tr>
               </thead>
               <tbody>
                  {MOCK_FILES.map((file, i) => (
                     <tr key={file.id} className="group border-b border-white/5 hover:bg-white/[0.02] transition-colors last:border-0">
                        <td className="p-4 text-center text-gray-600 text-sm">{i + 1}</td>
                        <td className="p-4">
                           <div className="flex items-center gap-3">
                              <div className="p-2 rounded bg-white/5 text-violet-400">
                                 <FileText size={16} />
                              </div>
                              <span className="text-sm font-medium text-gray-200">{file.name}</span>
                           </div>
                        </td>
                        <td className="p-4 text-sm text-gray-400 font-mono">{file.size}</td>
                        <td className="p-4 text-sm text-gray-400">{file.date}</td>
                        <td className="p-4">
                           <StatusBadge status={file.status} />
                        </td>
                        <td className="p-4 text-right">
                           <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="p-1.5 text-gray-400 hover:text-white bg-white/5 rounded hover:bg-white/10" title="Download">
                                 <Download size={14} />
                              </button>
                              <button className="p-1.5 text-gray-400 hover:text-white bg-white/5 rounded hover:bg-white/10" title="More">
                                 <MoreHorizontal size={14} />
                              </button>
                              <button className="p-1.5 text-gray-400 hover:text-red-400 bg-white/5 rounded hover:bg-white/10" title="Delete">
                                 <Trash2 size={14} />
                              </button>
                           </div>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Documents"
        maxWidth="max-w-xl"
      >
        <div className="space-y-6">
           <div className="border-2 border-dashed border-white/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center bg-white/[0.02] hover:bg-white/[0.05] transition-colors cursor-pointer group">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                 <FileUp size={32} className="text-violet-400" />
              </div>
              <p className="text-white font-medium mb-1">Click to upload or drag and drop</p>
              <p className="text-sm text-gray-500">PDF, DOCX, TXT or CSV (max 25MB)</p>
           </div>
           
           <div className="bg-white/5 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Processing Options</h4>
              <div className="space-y-3">
                 <label className="flex items-center gap-3">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-600 text-violet-600 focus:ring-violet-500 bg-gray-800" defaultChecked />
                    <span className="text-sm text-gray-300">Automatic OCR for images</span>
                 </label>
                 <label className="flex items-center gap-3">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-600 text-violet-600 focus:ring-violet-500 bg-gray-800" defaultChecked />
                    <span className="text-sm text-gray-300">Generate summaries immediately</span>
                 </label>
              </div>
           </div>

           <div className="flex justify-end gap-3">
              <button 
                onClick={() => setIsUploadModalOpen(false)}
                className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => setIsUploadModalOpen(false)}
                className="px-5 py-2.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-xl shadow-lg shadow-violet-900/20 transition-all"
              >
                Start Upload
              </button>
           </div>
        </div>
      </Modal>
    </motion.div>
  );
};

export default CollectionDetail;