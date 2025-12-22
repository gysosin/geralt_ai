export interface User {
  id: string;
  name: string;
  firstname?: string;
  lastname?: string;
  email: string;
  avatar: string;
  role: 'admin' | 'user';
  tenant_id?: string;
}

export interface Bot {
  id: string;
  name: string;
  description: string;
  icon: string; // URL or emoji
  collectionIds: string[];
  stats: {
    chats: number;
    rating: number;
  };
  // API fields
  bot_token?: string;
  bot_name?: string;
  icon_url?: string;
  welcome_message?: string;
  welcome_buttons?: WelcomeButton[];
  collection_ids?: string[];
  created_at?: string;
  updated_at?: string;
  owner_id?: string;
}

export interface WelcomeButton {
  id: string;
  label: string;
  action: string;
}

export interface CreateBotCommand {
  bot_name: string;
  icon_url?: string;
  welcome_message?: string;
  welcome_buttons?: Array<{ label: string; action: string }>;
  collection_ids?: string[];
}

export interface UpdateBotCommand extends Partial<CreateBotCommand> {
  bot_token: string;
}

export interface ShareBotCommand {
  bot_token: string;
  user_email: string;
  role: 'viewer' | 'contributor' | 'admin';
}

export interface BotEmbedCode {
  bot_token: string;
  embed_code: string;
}

export interface Collection {
  id: string;
  name: string;
  fileCount: number;
  size: string;
  lastUpdated: string;
  type: 'finance' | 'legal' | 'tech' | 'general';
  // API fields
  collection_name?: string;
  description?: string;
  file_count?: number;
  document_count?: number;
  created_at?: string;
  tenant_id?: string;
}

// Document Status Constants
export const DocumentStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
export type DocumentStatus = typeof DocumentStatus[keyof typeof DocumentStatus];

// Resource Type Constants
export const ResourceType = {
  PDF: 'PDF_Document',
  WORD: 'Word_Document',
  EXCEL: 'Excel_Spreadsheet',
  CSV: 'CSV_File',
  TEXT: 'Text_File',
  VIDEO: 'Video_File',
  AUDIO: 'Audio_File',
  WEB_PAGE: 'Web_Page',
  YOUTUBE: 'Youtube',
} as const;
export type ResourceType = typeof ResourceType[keyof typeof ResourceType];

// Document Interface
export interface Document {
  document_id: string;
  original_file_name: string;
  guid_file_name: string;
  file_name: string;
  file_size: string;
  type: string;
  resource_type: ResourceType;
  url?: string;
  added_by: string;
  full_name?: string;
  upload_time: string;
  status: DocumentStatus;
  is_processing: boolean;
  processed: boolean;
  progress: number;
  error_message?: string;
  latest_status?: string;
  is_owner: boolean;
  user_role: string;
  isShowDownload?: boolean;
}

// Collection Detail (extended)
export interface CollectionDetail {
  collection_id: string;
  collection_name: string;
  description?: string;
  created_at: string;
  created_by: string;
  full_name?: string;
  public: boolean;
  document_count: number;
  shared_with: CollectionShare[];
  is_owner: boolean;
  user_role: string;
  file_types: FileTypeCount;
}

// Collection Share Interface
export interface CollectionShare {
  username: string;
  email?: string;
  role: 'viewer' | 'contributor' | 'admin';
}

// File Type Counts
export interface FileTypeCount {
  Word_Document?: number;
  PDF_Document?: number;
  Video_File?: number;
  CSV_File?: number;
  Excel_Spreadsheet?: number;
  Text_File?: number;
  Web_Page?: number;
  Youtube?: number;
  Audio_File?: number;
}

// Document Upload Command
export interface DocumentUploadCommand {
  collection_id: string;
  files?: File[];
  urls?: string[];
}

// Document Status Update
export interface DocumentStatusUpdate {
  document_id: string;
  status: DocumentStatus;
  progress: number;
  error?: string;
}

// Share Collection Command
export interface ShareCollectionCommand {
  collection_id: string;
  user: string;
  role: string;
}

// Update Collection Command
export interface UpdateCollectionCommand {
  collection_id: string;
  name?: string;
  tenant_id?: string;
  public?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[] | Source[];
  suggestions?: string[];
  isLoading?: boolean;
}

export interface Source {
  id: string;
  title: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface ConversationSummary {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  botId?: string;
  // API fields
  conversation_id?: string;
  first_message?: string;
  created_at?: string;
  updated_at?: string;
  bot_token?: string;
  messageCount?: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  collectionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChartData {
  name: string;
  tokens: number;
  cost: number;
}

// Analytics Types
export interface TokenUsageLog {
  log_id: string;
  user_id: string;
  username: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost?: number;
  timestamp: string;
  bot_token?: string;
  bot_name?: string;
}

export interface UsageSummary {
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  total_requests: number;
  period: string;
}

export interface DailyUsage {
  date: string;
  tokens: number;
  requests: number;
  cost?: number;
}

export interface TopUser {
  user_id: string;
  username: string;
  total_tokens: number;
  total_requests: number;
}

export interface TopModel {
  model: string;
  total_tokens: number;
  total_requests: number;
  percentage: number;
  cost?: number;
}

export interface AnalyticsDashboard {
  summary: UsageSummary;
  daily_usage: DailyUsage[];
  top_users: TopUser[];
  top_models: TopModel[];
}

// Search Types
export interface SearchResponse {
  answer?: string;
  response?: string;
  sources?: Source[];
  top_documents?: any[];  // Backend RAG response documents
  conversationId?: string;
  conversation_id?: string;
  metadata?: Record<string, unknown>;
  suggestions?: string[];
  mode?: 'rag' | 'direct_chat';
}

// Dashboard Stats
export interface DashboardStats {
  conversations: number;
  bots: number;
  collections: number;
  documents: number;
}

// API Configuration Types (for admin settings)
export interface APIConfiguration {
  id?: string;
  name: string;
  provider: 'openai' | 'gemini' | 'mistral' | 'anthropic' | 'custom';
  apiKey: string;
  baseUrl?: string;
  model?: string;
  isDefault: boolean;
  isActive: boolean;
  rateLimit?: number;
  created_at?: string;
  updated_at?: string;
}

export interface WebhookConfiguration {
  id?: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  isActive: boolean;
  created_at?: string;
}