"""
Extraction Schemas

Pydantic models for structured data extraction from documents.
Uses a flexible, LLM-driven approach where the model determines document type
and extracts relevant fields dynamically.
"""
from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class ExtractedField(BaseModel):
    """A single extracted field with metadata."""
    name: str
    value: Any
    confidence: float = 1.0
    source_text: Optional[str] = None  # Original text this was extracted from


class ExtractedEntity(BaseModel):
    """An extracted entity (person, company, etc.)."""
    name: str
    type: str  # person, company, organization, etc.
    role: Optional[str] = None  # buyer, seller, vendor, contractor, etc.
    attributes: Dict[str, Any] = Field(default_factory=dict)


class ExtractedAmount(BaseModel):
    """A monetary amount with currency."""
    value: float
    currency: str = "USD"
    label: Optional[str] = None  # "total", "tax", "subtotal", etc.


class ExtractedDate(BaseModel):
    """A date with context."""
    date: Optional[datetime] = None
    date_string: Optional[str] = None  # Original string if parsing fails
    label: Optional[str] = None  # "order_date", "due_date", "expiry", etc.


class ExtractedLineItem(BaseModel):
    """A line item from tables/lists in document."""
    description: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    total: Optional[float] = None
    unit: Optional[str] = None
    attributes: Dict[str, Any] = Field(default_factory=dict)


class DocumentExtraction(BaseModel):
    """
    Flexible extraction model - LLM determines what to extract.

    This is the primary extraction schema. The LLM analyzes the document
    and populates whichever fields are relevant.
    """
    # Identification (set by system)
    document_id: str
    collection_id: str
    extracted_at: datetime = Field(default_factory=datetime.utcnow)
    extraction_model: str = ""

    # LLM-determined document classification
    document_type: str = ""  # LLM decides: "purchase_order", "invoice", "contract", "report", etc.
    document_subtype: Optional[str] = None  # More specific: "service_contract", "nda", etc.
    confidence: float = 0.0

    # Document identifiers (LLM extracts what it finds)
    document_number: Optional[str] = None  # PO#, Invoice#, Contract#, etc.
    reference_numbers: List[str] = Field(default_factory=list)  # Related doc refs

    # Title/Summary
    title: Optional[str] = None
    summary: Optional[str] = None  # LLM-generated brief summary

    # Entities (parties involved)
    entities: List[ExtractedEntity] = Field(default_factory=list)

    # Dates
    dates: List[ExtractedDate] = Field(default_factory=list)

    # Monetary values
    amounts: List[ExtractedAmount] = Field(default_factory=list)
    total_amount: Optional[float] = None  # Primary total if identified
    currency: Optional[str] = None

    # Line items (if document has tables/itemized lists)
    line_items: List[ExtractedLineItem] = Field(default_factory=list)

    # Key terms/clauses (for contracts, agreements)
    key_terms: List[str] = Field(default_factory=list)

    # Status (if applicable)
    status: Optional[str] = None  # active, pending, paid, expired, etc.

    # Flexible additional fields (LLM can add anything here)
    additional_fields: Dict[str, Any] = Field(default_factory=dict)

    # Raw extraction (the structured JSON from LLM before normalization)
    raw_extraction: Dict[str, Any] = Field(default_factory=dict)

    # Processing info
    processing_errors: List[str] = Field(default_factory=list)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }


# For aggregation queries - what fields are aggregatable
AGGREGATABLE_FIELDS = [
    "total_amount",
    "amounts",
    "document_type",
    "entities",
    "dates",
    "status",
]

# Common date labels the LLM might use
COMMON_DATE_LABELS = [
    "order_date", "invoice_date", "due_date", "delivery_date",
    "effective_date", "expiry_date", "signature_date", "created_date",
]

# Common amount labels
COMMON_AMOUNT_LABELS = [
    "total", "subtotal", "tax", "discount", "shipping",
    "amount_due", "amount_paid", "contract_value",
]
