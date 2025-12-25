"""
Hierarchical Chunker

Implements the "Parent Document Retriever" pattern:
- Splits text into large "Parent" chunks (for context)
- Splits parents into small "Child" chunks (for vector search)
- Links children to parents via metadata IDs

Storage alignment:
- Parents → Elasticsearch (keyword search + full context)
- Children → Milvus (vector search with parent_chunk_id reference)
"""
import hashlib
import logging
from typing import List, Optional, Literal, Tuple
from pydantic import BaseModel, Field

from langchain_text_splitters import RecursiveCharacterTextSplitter

from core.config import settings

logger = logging.getLogger(__name__)


class ChunkMetadata(BaseModel):
    """Metadata for a document chunk."""
    document_id: Optional[str] = None
    collection_id: Optional[str] = None
    chunk_index: int = 0
    total_chunks: Optional[int] = None
    page_number: Optional[int] = None
    source: Optional[str] = None
    
    # Hierarchical fields
    chunk_type: Literal["parent", "child"] = "parent"
    parent_chunk_id: Optional[str] = None  # ID of the parent chunk (if child)
    
    # Additional extraction metadata
    extra: dict = Field(default_factory=dict)


class Chunk(BaseModel):
    """A single chunk of text with metadata."""
    chunk_id: str
    content: str
    metadata: ChunkMetadata


class HierarchicalChunkConfig(BaseModel):
    """Configuration for hierarchical chunking."""
    parent_chunk_size: int = Field(default=1000, ge=500, le=8000)
    parent_chunk_overlap: int = Field(default=100, ge=0, le=500)
    
    child_chunk_size: int = Field(default=200, ge=50, le=1000)
    child_chunk_overlap: int = Field(default=50, ge=0, le=200)
    
    separators: List[str] = Field(
        default=["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " ", ""]
    )


class HierarchicalChunker:
    """
    Splits text into a hierarchy of Parent and Child chunks.
    
    The parent-child relationship enables:
    - Vector search on small children (better semantic matching)
    - Return larger parent context (better for LLM generation)
    
    Usage:
        chunker = HierarchicalChunker()
        parents, children = chunker.chunk(text, document_id="doc1")
    """
    
    def __init__(self, config: Optional[HierarchicalChunkConfig] = None):
        if config is None:
            config = HierarchicalChunkConfig()
        
        self.config = config
        self.logger = logging.getLogger(f"{self.__class__.__name__}")
        
        self._parent_splitter = RecursiveCharacterTextSplitter(
            chunk_size=config.parent_chunk_size,
            chunk_overlap=config.parent_chunk_overlap,
            separators=config.separators,
            length_function=len,
            is_separator_regex=False,
        )
        
        self._child_splitter = RecursiveCharacterTextSplitter(
            chunk_size=config.child_chunk_size,
            chunk_overlap=config.child_chunk_overlap,
            separators=config.separators,
            length_function=len,
            is_separator_regex=False,
        )
        
        self.logger.debug(
            f"Initialized with parent_size={config.parent_chunk_size}, "
            f"child_size={config.child_chunk_size}"
        )
    
    def chunk(
        self,
        text: str,
        document_id: Optional[str] = None,
        collection_id: Optional[str] = None,
        page_number: Optional[int] = None,
        source: Optional[str] = None,
        extra_metadata: Optional[dict] = None,
    ) -> Tuple[List[Chunk], List[Chunk]]:
        """
        Split text into Parent and Child chunks.
        
        Args:
            text: Text content to chunk
            document_id: Associated document ID
            collection_id: Collection this document belongs to
            page_number: Optional page number
            source: Optional source identifier
            extra_metadata: Additional metadata to include
            
        Returns:
            Tuple of (parent_chunks, child_chunks)
        """
        if not text or not text.strip():
            self.logger.debug("Empty text provided, returning empty chunks")
            return [], []
        
        text_length = len(text)
        parent_texts = self._parent_splitter.split_text(text)
        total_parents = len(parent_texts)
        
        self.logger.debug(
            f"Chunking {text_length} chars -> {total_parents} parents "
            f"(doc_id={document_id}, page={page_number})"
        )
        
        parents = []
        children = []
        
        for i, p_content in enumerate(parent_texts):
            # Generate deterministic Parent ID
            # content hash + index ensures uniqueness but stability across runs
            content_hash = hashlib.md5(p_content.encode("utf-8")).hexdigest()[:6]
            p_id = f"{document_id or 'unknown'}_p_{i}_{content_hash}"
            
            # Create Parent Chunk
            p_meta = ChunkMetadata(
                document_id=document_id,
                collection_id=collection_id,
                chunk_index=i,
                total_chunks=total_parents,
                page_number=page_number,
                source=source,
                chunk_type="parent",
                extra=extra_metadata or {},
            )
            
            parent_chunk = Chunk(
                chunk_id=p_id,
                content=p_content,
                metadata=p_meta
            )
            parents.append(parent_chunk)
            
            # Split Parent into Children
            child_texts = self._child_splitter.split_text(p_content)
            total_children_in_parent = len(child_texts)
            
            for j, c_content in enumerate(child_texts):
                c_id = f"{p_id}_c_{j}"
                
                c_meta = ChunkMetadata(
                    document_id=document_id,
                    collection_id=collection_id,
                    chunk_index=j,
                    total_chunks=total_children_in_parent,
                    page_number=page_number,
                    source=source,
                    chunk_type="child",
                    parent_chunk_id=p_id,
                    extra=extra_metadata or {},
                )
                
                child_chunk = Chunk(
                    chunk_id=c_id,
                    content=c_content,
                    metadata=c_meta
                )
                children.append(child_chunk)
        
        total_children = len(children)
        self.logger.debug(f"Created {total_parents} parents, {total_children} children")
        
        return parents, children

    def chunk_documents(
        self, 
        documents: List[dict]
    ) -> Tuple[List[Chunk], List[Chunk]]:
        """
        Chunk multiple extracted documents.
        
        Args:
            documents: List of dicts with 'content' and 'metadata' keys
                      (format from extractors)
        
        Returns:
            Tuple of (all_parent_chunks, all_child_chunks)
        """
        all_parents = []
        all_children = []
        
        self.logger.info(f"Chunking {len(documents)} extracted documents")
        
        for doc in documents:
            content = doc.get("content", "")
            metadata = doc.get("metadata", {})
            
            if not content or not content.strip():
                continue
            
            p, c = self.chunk(
                text=content,
                document_id=metadata.get("document_id"),
                collection_id=metadata.get("collection_id"),
                page_number=metadata.get("page_number"),
                source=metadata.get("source"),
                extra_metadata=metadata,
            )
            all_parents.extend(p)
            all_children.extend(c)
        
        self.logger.info(
            f"Chunking complete: {len(all_parents)} parents, {len(all_children)} children "
            f"from {len(documents)} documents"
        )
        
        return all_parents, all_children