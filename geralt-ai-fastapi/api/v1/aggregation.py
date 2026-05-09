"""
Aggregation API Routes

Endpoints for structured data aggregation, collection summaries, and extraction data.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel

from core.security.jwt import get_optional_user


router = APIRouter(prefix="/aggregation", tags=["aggregation"])


# Request/Response Models
class AggregationQueryRequest(BaseModel):
    """Request for aggregation query."""
    collection_id: str
    query: str


class AggregationResponse(BaseModel):
    """Response from aggregation query."""
    answer: str
    data: list = []
    metadata: dict = {}


class CollectionSummaryResponse(BaseModel):
    """Response from collection summary."""
    summary: str
    document_count: int
    key_findings: list = []
    document_types: list = []


class ExtractionResponse(BaseModel):
    """Response from document extraction."""
    document_id: str
    document_type: str
    extracted_at: str
    summary: Optional[str] = None
    entities: list = []
    amounts: list = []
    dates: list = []


class CollectionStatsResponse(BaseModel):
    """Statistics for a collection."""
    total_documents: int
    total_amount: float
    document_types: list = []
    entities_count: int = 0


# Endpoints
@router.post("/query", response_model=AggregationResponse)
async def aggregation_query(
    request: AggregationQueryRequest,
    current_user: Optional[str] = Depends(get_optional_user),
):
    """
    Run an aggregation query on a collection's extracted data.

    Examples:
    - "What is the total payment amount across all POs?"
    - "List all vendors and their invoice counts"
    - "Show contracts expiring this month"
    """
    from core.rag.aggregation_engine import get_aggregation_engine

    engine = get_aggregation_engine()
    result = await engine.aggregate(
        query=request.query,
        collection_ids=[request.collection_id],
    )

    return AggregationResponse(
        answer=result.get("answer", ""),
        data=result.get("data", []),
        metadata=result.get("metadata", {}),
    )


@router.get("/collections/{collection_id}/summary", response_model=CollectionSummaryResponse)
async def get_collection_summary(
    collection_id: str,
    max_docs: int = Query(default=50, le=100),
    current_user: Optional[str] = Depends(get_optional_user),
):
    """
    Get a summary of the entire collection.

    Uses map-reduce approach to summarize all documents and extract key findings.
    """
    from core.rag.collection_summarizer import get_collection_summarizer

    summarizer = get_collection_summarizer()
    result = await summarizer.summarize(
        collection_id=collection_id,
        max_docs=max_docs,
    )

    return CollectionSummaryResponse(
        summary=result.get("summary", ""),
        document_count=result.get("document_count", 0),
        key_findings=result.get("key_findings", []),
        document_types=result.get("document_types", []),
    )


@router.get("/collections/{collection_id}/stats", response_model=CollectionStatsResponse)
async def get_collection_stats(
    collection_id: str,
    current_user: Optional[str] = Depends(get_optional_user),
):
    """
    Get statistics for a collection's extracted data.
    """
    from core.rag.aggregation_engine import get_aggregation_engine

    engine = get_aggregation_engine()
    stats = await engine.get_collection_stats([collection_id])

    return CollectionStatsResponse(
        total_documents=stats.get("total_documents", 0),
        total_amount=stats.get("total_amount", 0),
        document_types=stats.get("document_types", []),
        entities_count=stats.get("entities_count", 0),
    )


@router.get("/documents/{document_id}/extraction", response_model=ExtractionResponse)
async def get_document_extraction(
    document_id: str,
    current_user: Optional[str] = Depends(get_optional_user),
):
    """
    Get the structured extraction for a specific document.
    """
    from models.database import extraction_collection

    extraction = extraction_collection.find_one({"document_id": document_id})

    if not extraction:
        raise HTTPException(
            status_code=404,
            detail=f"No extraction found for document {document_id}"
        )

    return ExtractionResponse(
        document_id=extraction.get("document_id", ""),
        document_type=extraction.get("document_type", "unknown"),
        extracted_at=str(extraction.get("extracted_at", "")),
        summary=extraction.get("summary"),
        entities=extraction.get("entities", []),
        amounts=extraction.get("amounts", []),
        dates=extraction.get("dates", []),
    )


@router.get("/collections/{collection_id}/extractions")
async def list_collection_extractions(
    collection_id: str,
    limit: int = Query(default=50, le=100),
    skip: int = Query(default=0, ge=0),
    current_user: Optional[str] = Depends(get_optional_user),
):
    """
    List all extractions for a collection.
    """
    from models.database import extraction_collection

    extractions = list(
        extraction_collection.find(
            {"collection_id": collection_id},
            {
                "document_id": 1,
                "document_type": 1,
                "title": 1,
                "summary": 1,
                "total_amount": 1,
                "extracted_at": 1,
            }
        ).skip(skip).limit(limit)
    )

    # Convert ObjectId to string for JSON serialization
    for ext in extractions:
        if "_id" in ext:
            ext["_id"] = str(ext["_id"])
        if "extracted_at" in ext:
            ext["extracted_at"] = str(ext["extracted_at"])

    total = extraction_collection.count_documents({"collection_id": collection_id})

    return {
        "extractions": extractions,
        "total": total,
        "skip": skip,
        "limit": limit,
    }
