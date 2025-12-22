export const DocumentStatus = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
} as const
export type DocumentStatus = typeof DocumentStatus[keyof typeof DocumentStatus]

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
} as const
export type ResourceType = typeof ResourceType[keyof typeof ResourceType]

export interface Document {
    document_id: string
    original_file_name: string
    guid_file_name: string
    file_name: string
    file_size: string
    type: string
    resource_type: ResourceType
    url?: string
    added_by: string
    full_name?: string
    upload_time: string
    status: DocumentStatus
    is_processing: boolean
    processed: boolean
    progress: number
    error_message?: string
    latest_status?: string
    is_owner: boolean
    user_role: string
    isShowDownload?: boolean
}

export interface DocumentUploadCommand {
    collection_id: string
    files?: File[]
    urls?: string[]
}

export interface DocumentStatusUpdate {
    document_id: string
    status: DocumentStatus
    progress: number
    error?: string
}

export interface CollectionDetail {
    collection_id: string
    collection_name: string
    description?: string
    created_at: string
    created_by: string
    full_name?: string
    public: boolean
    document_count: number
    shared_with: CollectionShare[]
    is_owner: boolean
    user_role: string
    file_types: FileTypeCount
}

export interface CollectionShare {
    username: string
    email?: string
    role: 'viewer' | 'contributor' | 'admin'
}

export interface FileTypeCount {
    Word_Document?: number
    PDF_Document?: number
    Video_File?: number
    CSV_File?: number
    Excel_Spreadsheet?: number
    Text_File?: number
    Web_Page?: number
    Youtube?: number
    Audio_File?: number
}

export interface ShareCollectionCommand {
    collection_id: string
    user: string
    role: string
}

export interface UpdateCollectionCommand {
    collection_id: string
    name?: string
    tenant_id?: string
    public?: boolean
}
