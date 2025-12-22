"""
Semantic Chunker

Industry-standard document chunking with semantic awareness and configurable overlap.
"""
from typing import List, Optional
from pydantic import BaseModel, Field

from langchain_text_splitters import RecursiveCharacterTextSplitter

from core.config import settings


class ChunkMetadata(BaseModel):
    """Metadata for a document chunk."""
    document_id: Optional[str] = None
    chunk_index: int = 0
    total_chunks: Optional[int] = None
    page_number: Optional[int] = None
    source: Optional[str] = None
    extra: dict = Field(default_factory=dict)


class Chunk(BaseModel):
    """A single chunk of text with metadata."""
    content: str
    metadata: ChunkMetadata
    
    @property
    def chunk_id(self) -> str:
        """Generate unique chunk ID from document_id and index."""
        doc_id = self.metadata.document_id or "unknown"
        return f"{doc_id}_{self.metadata.chunk_index}"


class ChunkConfig(BaseModel):
    """Configuration for chunking."""
    chunk_size: int = Field(default=512, ge=100, le=4000)
    chunk_overlap: int = Field(default=128, ge=0, le=500)
    separators: List[str] = Field(
        default=["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " ", ""]
    )


class SemanticChunker:
    """
    Industry-standard semantic chunking with configurable overlap.
    
    Features:
    - Recursive text splitting respecting semantic boundaries
    - Configurable chunk size and overlap
    - Metadata preservation and augmentation
    
    Usage:
        chunker = SemanticChunker()
        chunks = chunker.chunk(text, document_id="doc123")
    """
    
    def __init__(self, config: Optional[ChunkConfig] = None):
        """
        Initialize chunker with configuration.
        
        Args:
            config: Chunking configuration, uses settings defaults if None
        """
        if config is None:
            config = ChunkConfig(
                chunk_size=settings.CHUNK_SIZE,
                chunk_overlap=settings.CHUNK_OVERLAP,
            )
        
        self.config = config
        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=config.chunk_size,
            chunk_overlap=config.chunk_overlap,
            separators=config.separators,
            length_function=len,
            is_separator_regex=False,
        )
    
    def chunk(
        self,
        text: str,
        document_id: Optional[str] = None,
        page_number: Optional[int] = None,
        source: Optional[str] = None,
        extra_metadata: Optional[dict] = None,
    ) -> List[Chunk]:
        """
        Split text into semantic chunks.
        
        Args:
            text: Text content to chunk
            document_id: Parent document ID
            page_number: Page number (for multi-page documents)
            source: Source identifier (filename, URL, etc.)
            extra_metadata: Additional metadata to include
            
        Returns:
            List of Chunk objects with metadata
        """
        if not text or not text.strip():
            return []
        
        # Split text into chunks
        text_chunks = self._splitter.split_text(text)
        total_chunks = len(text_chunks)
        
        # Create Chunk objects with metadata
        chunks = []
        for i, content in enumerate(text_chunks):
            metadata = ChunkMetadata(
                document_id=document_id,
                chunk_index=i,
                total_chunks=total_chunks,
                page_number=page_number,
                source=source,
                extra=extra_metadata or {},
            )
            chunks.append(Chunk(content=content, metadata=metadata))
        
        return chunks
    
    def chunk_documents(
        self,
        documents: List[dict],
    ) -> List[Chunk]:
        """
        Chunk multiple documents.
        
        Args:
            documents: List of dicts with 'content' and optional 'metadata'
            
        Returns:
            Flattened list of all chunks
        """
        all_chunks = []
        
        for doc in documents:
            content = doc.get("content", "")
            metadata = doc.get("metadata", {})
            
            doc_chunks = self.chunk(
                text=content,
                document_id=metadata.get("document_id"),
                page_number=metadata.get("page_number"),
                source=metadata.get("source"),
                extra_metadata=metadata,
            )
            all_chunks.extend(doc_chunks)
        
        return all_chunks


# Convenience function
def chunk_text(
    text: str,
    chunk_size: int = 512,
    chunk_overlap: int = 128,
    **kwargs,
) -> List[Chunk]:
    """
    Quick function to chunk text with custom settings.
    
    Args:
        text: Text to chunk
        chunk_size: Maximum chunk size
        chunk_overlap: Overlap between chunks
        **kwargs: Additional metadata to pass to chunker
        
    Returns:
        List of Chunk objects
    """
    config = ChunkConfig(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    chunker = SemanticChunker(config)
    return chunker.chunk(text, **kwargs)
