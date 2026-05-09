import { Bot, Collection, ConversationSummary, ChartData, Message } from './types';
import { 
  BarChart3, 
  MessageSquare, 
  Bot as BotIcon, 
  Files, 
  Settings, 
  PieChart, 
  History,
  BrainCircuit,
  ShieldCheck,
  Zap,
  Workflow
} from 'lucide-react';
import React from 'react';

export const APP_NAME = "Geralt AI";

export const MENU_ITEMS = [
  { label: 'Dashboard', icon: <BarChart3 size={20} />, path: '/' },
  { label: 'Chat', icon: <MessageSquare size={20} />, path: '/chat' },
  { label: 'Agents', icon: <BotIcon size={20} />, path: '/bots' },
  { label: 'Agent Platform', icon: <Workflow size={20} />, path: '/agent-platform' },
  { label: 'Knowledge', icon: <Files size={20} />, path: '/collections' },
  { label: 'Analytics', icon: <PieChart size={20} />, path: '/analytics' },
  { label: 'History', icon: <History size={20} />, path: '/history' },
  { label: 'Settings', icon: <Settings size={20} />, path: '/settings' },
];

export const MOCK_BOTS: Bot[] = [
  {
    id: '1',
    name: 'FinTech Analyst',
    description: 'Expert in financial reporting, market trends, and risk assessment.',
    icon: 'https://picsum.photos/id/1/200/200',
    collectionIds: ['101', '102'],
    stats: { chats: 1240, rating: 4.9 }
  },
  {
    id: '2',
    name: 'Legal Eagle',
    description: 'Specializes in contract review, compliance, and legal terminology.',
    icon: 'https://picsum.photos/id/20/200/200',
    collectionIds: ['103'],
    stats: { chats: 856, rating: 4.7 }
  },
  {
    id: '3',
    name: 'Code Wizard',
    description: 'Assists with architectural patterns, debugging, and code generation.',
    icon: 'https://picsum.photos/id/60/200/200',
    collectionIds: ['104'],
    stats: { chats: 3421, rating: 5.0 }
  },
  {
    id: '4',
    name: 'Creative Writer',
    description: 'Helps with marketing copy, blog posts, and creative content.',
    icon: 'https://picsum.photos/id/96/200/200',
    collectionIds: [],
    stats: { chats: 543, rating: 4.5 }
  }
];

export const MOCK_COLLECTIONS: Collection[] = [
  { id: '101', name: 'Q3 Financial Reports', fileCount: 12, size: '45 MB', lastUpdated: '2h ago', type: 'finance' },
  { id: '102', name: 'Market Analysis 2024', fileCount: 8, size: '12 MB', lastUpdated: '1d ago', type: 'finance' },
  { id: '103', name: 'Vendor Contracts', fileCount: 24, size: '89 MB', lastUpdated: '3d ago', type: 'legal' },
  { id: '104', name: 'API Documentation', fileCount: 156, size: '240 MB', lastUpdated: '1w ago', type: 'tech' },
  { id: '105', name: 'Employee Handbook', fileCount: 1, size: '2 MB', lastUpdated: '1mo ago', type: 'general' },
];

export const MOCK_CHATS: ConversationSummary[] = [
  { id: 'c1', title: 'Q3 Revenue Analysis', lastMessage: 'The EBITDA margins have improved by 2%...', timestamp: '10:42 AM', botId: '1' },
  { id: 'c2', title: 'React Component Refactor', lastMessage: 'Here is the updated useEffect hook...', timestamp: 'Yesterday', botId: '3' },
  { id: 'c3', title: 'NDA Review', lastMessage: 'Clause 4.2 seems slightly ambiguous regarding...', timestamp: 'Oct 24', botId: '2' },
  { id: 'c4', title: 'Blog Post Ideas', lastMessage: 'Sure, here are 5 titles for the article...', timestamp: 'Oct 22', botId: '4' },
];

export const MOCK_CHART_DATA: ChartData[] = [
  { name: 'Mon', tokens: 4000, cost: 2.4 },
  { name: 'Tue', tokens: 3000, cost: 1.8 },
  { name: 'Wed', tokens: 2000, cost: 1.2 },
  { name: 'Thu', tokens: 2780, cost: 1.6 },
  { name: 'Fri', tokens: 1890, cost: 1.1 },
  { name: 'Sat', tokens: 2390, cost: 1.4 },
  { name: 'Sun', tokens: 3490, cost: 2.1 },
];

export const MOCK_MESSAGES: Message[] = [
  { id: 'm1', role: 'user', content: 'Analyze the revenue growth for Q3 based on the uploaded reports.', timestamp: new Date(Date.now() - 100000) },
  { id: 'm2', role: 'assistant', content: 'Based on the **Q3 Financial Reports**, revenue has grown by 14% year-over-year. The primary drivers were:\n\n1. Enterprise subscription uptake.\n2. Reduced churn in the SMB sector.\n\nWould you like a breakdown by region?', timestamp: new Date(Date.now() - 50000), sources: ['Q3_Report_Final.pdf', 'Oct_Revenue_Sheet.xlsx'] },
];

export const FEATURES = [
  { icon: <BrainCircuit className="text-violet-400" />, title: "Semantic Search", desc: "Retrieve context, not just keywords." },
  { icon: <ShieldCheck className="text-emerald-400" />, title: "Enterprise Security", desc: "SOC2 compliant with private deployments." },
  { icon: <Zap className="text-amber-400" />, title: "Real-time RAG", desc: "Chat with your data instantly as it updates." },
];
