"""
Structured Extractor

LLM-based service for extracting structured data from document content.
Uses flexible schema where the LLM determines document type and relevant fields.
"""
import json
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from core.ai.factory import AIProviderFactory
from core.extraction.schemas import (
    DocumentExtraction,
    ExtractedEntity,
    ExtractedAmount,
    ExtractedDate,
    ExtractedLineItem,
)

logger = logging.getLogger(__name__)


EXTRACTION_PROMPT = '''You are a document analysis expert. Analyze the following document and extract structured information.

Respond ONLY with valid JSON matching this schema:

{
  "document_type": "string - type of document (e.g., purchase_order, invoice, contract, report, memo, etc.)",
  "document_subtype": "string or null - more specific type if applicable",
  "confidence": "float 0-1 - how confident you are in the extraction",
  "document_number": "string or null - primary document identifier (PO#, Invoice#, etc.)",
  "reference_numbers": ["list of related document references"],
  "title": "string or null - document title if present",
  "summary": "string - 1-2 sentence summary of the document",
  "entities": [
    {
      "name": "entity name",
      "type": "person|company|organization|department",
      "role": "buyer|seller|vendor|contractor|employee|etc.",
      "attributes": {"address": "...", "phone": "...", "email": "..."}
    }
  ],
  "dates": [
    {
      "date": "YYYY-MM-DD or null",
      "date_string": "original date text if parsing unclear",
      "label": "order_date|due_date|delivery_date|effective_date|expiry_date|etc."
    }
  ],
  "amounts": [
    {
      "value": 123.45,
      "currency": "USD",
      "label": "total|subtotal|tax|discount|shipping|amount_due|etc."
    }
  ],
  "total_amount": "float or null - primary total amount",
  "currency": "string or null - primary currency",
  "line_items": [
    {
      "description": "item description",
      "quantity": 1.0,
      "unit_price": 100.00,
      "total": 100.00,
      "unit": "each|kg|hours|etc.",
      "attributes": {}
    }
  ],
  "key_terms": ["important terms, clauses, or conditions"],
  "status": "string or null - active|pending|paid|expired|etc.",
  "additional_fields": {"any other relevant fields": "values"}
}

IMPORTANT:
- Extract ALL relevant information you can find
- Use null for fields not present in the document
- Be precise with numbers and dates
- For dates, try to parse to YYYY-MM-DD format when possible

DOCUMENT CONTENT:
---
{content}
---

Respond with valid JSON only:'''


class StructuredExtractor:
    """
    Extract structured data from documents using LLM.

    The LLM analyzes document content and returns structured JSON
    matching the DocumentExtraction schema.
    """

    def __init__(self, model: str = None):
        """
        Initialize extractor.

        Args:
            model: Optional AI model to use. Defaults to configured LLM.
        """
        self.llm = AIProviderFactory.get_llm_provider()
        self.logger = logging.getLogger(f"{self.__class__.__name__}")

    async def extract(
        self,
        content: str,
        document_id: str,
        collection_id: str,
        max_content_length: int = 15000,
    ) -> DocumentExtraction:
        """
        Extract structured data from document content.

        Args:
            content: Document text content
            document_id: ID of the document
            collection_id: ID of the collection
            max_content_length: Max chars to send to LLM (truncate if longer)

        Returns:
            DocumentExtraction with populated fields
        """
        try:
            # Truncate content if too long
            if len(content) > max_content_length:
                self.logger.info(
                    f"Truncating content from {len(content)} to {max_content_length} chars"
                )
                content = content[:max_content_length] + "\n... [truncated]"

            # Build prompt
            prompt = EXTRACTION_PROMPT.format(content=content)

            # Call LLM
            self.logger.debug(f"Calling LLM for extraction: {len(content)} chars")
            response = await self.llm.complete(
                prompt=prompt,
                max_tokens=2000,
                temperature=0.1,  # Low temperature for structured output
            )

            # Parse JSON response
            raw_extraction = self._parse_json_response(response)

            # Convert to DocumentExtraction
            extraction = self._build_extraction(
                raw_extraction,
                document_id,
                collection_id,
            )

            self.logger.info(
                f"Extracted: type={extraction.document_type}, "
                f"entities={len(extraction.entities)}, "
                f"amounts={len(extraction.amounts)}"
            )

            return extraction

        except Exception as e:
            self.logger.error(f"Extraction failed: {e}", exc_info=True)

            # Return minimal extraction with error
            return DocumentExtraction(
                document_id=document_id,
                collection_id=collection_id,
                extraction_model=self.llm.model_name,
                processing_errors=[str(e)],
            )

    def _parse_json_response(self, response: str) -> Dict[str, Any]:
        """Parse LLM response as JSON, handling common issues."""
        # Clean response
        response = response.strip()

        # Remove markdown code blocks if present
        if response.startswith("```"):
            lines = response.split("\n")
            # Remove first line (```json) and last line (```)
            lines = [l for l in lines if not l.strip().startswith("```")]
            response = "\n".join(lines)

        try:
            return json.loads(response)
        except json.JSONDecodeError as e:
            self.logger.warning(f"JSON parse error: {e}")

            # Try to extract JSON from response
            import re
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass

            raise ValueError(f"Could not parse LLM response as JSON: {response[:200]}")

    def _build_extraction(
        self,
        raw: Dict[str, Any],
        document_id: str,
        collection_id: str,
    ) -> DocumentExtraction:
        """Build DocumentExtraction from raw LLM output."""

        # Parse entities
        entities = []
        for e in raw.get("entities", []):
            if isinstance(e, dict) and e.get("name"):
                entities.append(ExtractedEntity(
                    name=e.get("name", ""),
                    type=e.get("type", "unknown"),
                    role=e.get("role"),
                    attributes=e.get("attributes", {}),
                ))

        # Parse dates
        dates = []
        for d in raw.get("dates", []):
            if isinstance(d, dict):
                date_val = None
                if d.get("date"):
                    try:
                        date_val = datetime.fromisoformat(d["date"])
                    except (ValueError, TypeError):
                        pass

                dates.append(ExtractedDate(
                    date=date_val,
                    date_string=d.get("date_string") or d.get("date"),
                    label=d.get("label"),
                ))

        # Parse amounts
        amounts = []
        for a in raw.get("amounts", []):
            if isinstance(a, dict) and a.get("value") is not None:
                try:
                    amounts.append(ExtractedAmount(
                        value=float(a["value"]),
                        currency=a.get("currency", "USD"),
                        label=a.get("label"),
                    ))
                except (ValueError, TypeError):
                    pass

        # Parse line items
        line_items = []
        for item in raw.get("line_items", []):
            if isinstance(item, dict):
                line_items.append(ExtractedLineItem(
                    description=item.get("description"),
                    quantity=self._safe_float(item.get("quantity")),
                    unit_price=self._safe_float(item.get("unit_price")),
                    total=self._safe_float(item.get("total")),
                    unit=item.get("unit"),
                    attributes=item.get("attributes", {}),
                ))

        return DocumentExtraction(
            document_id=document_id,
            collection_id=collection_id,
            extracted_at=datetime.utcnow(),
            extraction_model=self.llm.model_name,
            document_type=raw.get("document_type", "unknown"),
            document_subtype=raw.get("document_subtype"),
            confidence=self._safe_float(raw.get("confidence")) or 0.0,
            document_number=raw.get("document_number"),
            reference_numbers=raw.get("reference_numbers", []),
            title=raw.get("title"),
            summary=raw.get("summary"),
            entities=entities,
            dates=dates,
            amounts=amounts,
            total_amount=self._safe_float(raw.get("total_amount")),
            currency=raw.get("currency"),
            line_items=line_items,
            key_terms=raw.get("key_terms", []),
            status=raw.get("status"),
            additional_fields=raw.get("additional_fields", {}),
            raw_extraction=raw,
        )

    def _safe_float(self, value: Any) -> Optional[float]:
        """Safely convert value to float."""
        if value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None

    async def batch_extract(
        self,
        documents: List[Dict[str, str]],
        concurrency: int = 3,
    ) -> List[DocumentExtraction]:
        """
        Extract from multiple documents concurrently.

        Args:
            documents: List of dicts with 'content', 'document_id', 'collection_id'
            concurrency: Max concurrent extractions

        Returns:
            List of DocumentExtraction objects
        """
        import asyncio

        semaphore = asyncio.Semaphore(concurrency)

        async def extract_with_limit(doc):
            async with semaphore:
                return await self.extract(
                    content=doc["content"],
                    document_id=doc["document_id"],
                    collection_id=doc["collection_id"],
                )

        tasks = [extract_with_limit(doc) for doc in documents]
        return await asyncio.gather(*tasks)


# Singleton instance
_extractor_instance: Optional[StructuredExtractor] = None


def get_structured_extractor() -> StructuredExtractor:
    """Get or create the structured extractor singleton."""
    global _extractor_instance
    if _extractor_instance is None:
        _extractor_instance = StructuredExtractor()
    return _extractor_instance
