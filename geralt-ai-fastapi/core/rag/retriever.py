"""
Hybrid Retriever

Industry-standard hybrid retriever combining BM25 keyword search with dense vector similarity.
Implements hierarchical parent-child document retrieval with RRF fusion.
"""
import json
import logging
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from elasticsearch import AsyncElasticsearch

from core.ai.base import EmbeddingProvider
from core.config import settings

logger = logging.getLogger(__name__)


class RetrievalResult(BaseModel):
    """Result from retrieval operation."""
    content: str
    score: float
    document_id: str
    chunk_id: str
    collection_id: Optional[str] = None
    metadata: dict = {}


class HybridRetriever:
    """
    Hierarchical Hybrid Retriever (RRF).

    Orchestrates:
    1. Dense Vector Search (Milvus) -> Finds Child Chunks -> Votes for Parent
    2. Lexical Search (Elasticsearch) -> Finds Parent Chunks -> Votes for Parent
    3. Reciprocal Rank Fusion (RRF) -> Merges votes
    4. Fetch -> Returns top Parent Documents

    Data Flow Alignment:
    - Extraction produces: {"content": "...", "metadata": {...}}
    - Chunker creates parents (ES) and children (Milvus)
    - Children have parent_chunk_id in metadata
    - Parents have chunk_type="parent" in ES
    """

    def __init__(
        self,
        es_client: AsyncElasticsearch,
        embedder: EmbeddingProvider,
        milvus_client: Optional[object] = None,
        index_name: Optional[str] = None,
    ):
        self.es = es_client
        self.embedder = embedder
        self.milvus = milvus_client
        self.index = index_name or settings.ELASTIC_INDEX
        self.logger = logging.getLogger(f"{self.__class__.__name__}")

    async def retrieve(
        self,
        query: str,
        collection_ids: Optional[List[str]] = None,
        top_k: int = 10,
    ) -> List[RetrievalResult]:
        """
        Perform hierarchical hybrid retrieval.

        Args:
            query: Search query
            collection_ids: Optional list of collection IDs to filter
            top_k: Number of results to return

        Returns:
            List of RetrievalResult objects
        """
        try:
            query_preview = query[:50] + "..." if len(query) > 50 else query
            self.logger.info(f"Query: '{query_preview}' | Collections: {collection_ids}")

            # 1. Embed Query
            query_vector = await self.embedder.embed(query, task_type="retrieval_query")
            self.logger.debug(f"Query embedded, vector dim: {len(query_vector)}")

            # 2. Run Searches
            # A. Milvus Vector Search (Children)
            milvus_results = []
            if self.milvus:
                import asyncio
                milvus_results = await asyncio.to_thread(
                    self._search_milvus, query_vector, collection_ids, top_k * 2
                )
            self.logger.info(f"Milvus search: {len(milvus_results)} child chunks found")

            # B. ES Keyword Search (Parents)
            es_results = await self._search_es_keyword(query, collection_ids, top_k * 2)
            self.logger.info(f"ES search: {len(es_results)} parent chunks found")

            # 3. Reciprocal Rank Fusion (RRF)
            fused_scores, previews = self._apply_rrf(milvus_results, es_results)
            self.logger.debug(f"RRF fused {len(fused_scores)} unique parent IDs")

            # 4. Get Top K Parent IDs
            top_parent_ids = sorted(fused_scores, key=fused_scores.get, reverse=True)[:top_k]

            if not top_parent_ids:
                self.logger.warning("No parent IDs found after RRF fusion")
                return []

            self.logger.info(f"Top {len(top_parent_ids)} parents selected for retrieval")

            # 5. Fetch Final Parent Content from ES (with fallback to previews)
            final_parents = await self._fetch_parents(top_parent_ids, previews)
            self.logger.info(f"Fetched {len(final_parents)} parent documents")

            # 6. Convert to RetrievalResult
            results = []
            for p in final_parents:
                chunk_id = p.get("chunk_id", "")
                score = fused_scores.get(chunk_id, 0.0)

                # Parse metadata - handle both string and dict
                meta = p.get("metadata", {})
                if isinstance(meta, str):
                    try:
                        meta = json.loads(meta)
                    except json.JSONDecodeError:
                        self.logger.warning(f"Failed to parse metadata JSON for chunk {chunk_id}")
                        meta = {}

                results.append(RetrievalResult(
                    content=p.get("content", ""),
                    score=score,
                    document_id=p.get("document_id", ""),
                    chunk_id=chunk_id,
                    collection_id=p.get("collection_id"),
                    metadata=meta
                ))

            # Sort by score
            results.sort(key=lambda x: x.score, reverse=True)

            self.logger.info(f"Returning {len(results)} results")
            return results

        except Exception as e:
            self.logger.error(f"Hybrid retrieval error: {e}", exc_info=True)
            raise

    def _search_milvus(
        self,
        vector: List[float],
        collection_ids: Optional[List[str]],
        limit: int
    ) -> List[Dict[str, Any]]:
        """
        Search Milvus for Child Chunks.

        Children contain parent_chunk_id in metadata for linking back.
        Collection filtering is done post-retrieval since collection_id is in JSON metadata.
        """
        try:
            results = self.milvus.search(
                collection_name="embedding_collection",
                vectors=[vector],
                limit=limit,
                output_fields=["metadata"]
            )

            mapped = []
            raw_hits = 0
            filtered_out = 0

            for hits in results:
                raw_hits += len(hits)
                for hit in hits:
                    # Milvus 2.6+ returns JSON field as dict directly
                    meta = hit.entity.get("metadata", {})

                    if not isinstance(meta, dict):
                        self.logger.warning(f"Unexpected metadata type: {type(meta)}")
                        continue

                    try:
                        # Get parent_chunk_id - this links child to parent
                        parent_id = meta.get("parent_chunk_id")

                        if not parent_id:
                            self.logger.debug(f"Child chunk missing parent_chunk_id")
                            continue

                        # Get collection_id for filtering
                        # Collection ID was stored directly in metadata in document_tasks
                        coll_id = meta.get("collection_id")

                        # Fallback: Check inside 'extra' dict if flattening failed
                        if not coll_id:
                            extra = meta.get("extra", {})
                            if isinstance(extra, dict):
                                coll_id = extra.get("collection_id")

                        # Apply collection filter
                        if collection_ids and coll_id and coll_id not in collection_ids:
                            filtered_out += 1
                            continue

                        # Get content preview for fallback
                        preview = meta.get("content_preview", "")

                        mapped.append({
                            "parent_id": parent_id,
                            "score": hit.score,
                            "preview": preview,
                            "document_id": meta.get("document_id", ""),
                            "collection_id": coll_id,
                        })

                    except Exception as parse_err:
                        self.logger.debug(f"Failed to parse hit metadata: {parse_err}")
                        continue

            self.logger.debug(f"Milvus: {raw_hits} hits, {len(mapped)} mapped, {filtered_out} filtered")
            return mapped

        except Exception as e:
            self.logger.warning(f"Milvus search failed: {e}")
            return []

    async def _search_es_keyword(
        self,
        query: str,
        collection_ids: Optional[List[str]],
        limit: int
    ) -> List[Dict[str, Any]]:
        """
        Search ES for Parent Chunks using keyword/BM25 search.

        Parents are stored with chunk_type="parent" during document processing.
        """
        # Build query
        must = [{
            "multi_match": {
                "query": query,
                "fields": ["content", "metadata.title", "metadata.source"],
                "type": "best_fields",
                "fuzziness": "AUTO"
            }
        }]

        # Filter for parent chunks only
        filter_conditions = [{"term": {"chunk_type.keyword": "parent"}}]

        if collection_ids:
            filter_conditions.append({"terms": {"collection_id.keyword": collection_ids}})

        body = {
            "size": limit,
            "query": {
                "bool": {
                    "must": must,
                    "filter": filter_conditions
                }
            },
            "_source": ["chunk_id", "document_id", "collection_id", "content"]
        }

        try:
            resp = await self.es.search(index=self.index, body=body)

            mapped = []
            hits = resp.get("hits", {}).get("hits", [])

            for hit in hits:
                source = hit["_source"]
                mapped.append({
                    "parent_id": source.get("chunk_id"),
                    "score": hit["_score"],
                    "document_id": source.get("document_id", ""),
                    "collection_id": source.get("collection_id", ""),
                })

            return mapped

        except Exception as e:
            self.logger.error(f"ES keyword search failed: {e}")
            return []

    def _apply_rrf(
        self,
        milvus_results: List[Dict],
        es_results: List[Dict],
        k: int = 60
    ) -> tuple[Dict[str, float], Dict[str, str]]:
        """
        Reciprocal Rank Fusion.

        Combines rankings from multiple retrieval sources.
        Score = sum(1 / (k + rank)) for each source where item appears.

        Args:
            milvus_results: Results from vector search
            es_results: Results from keyword search
            k: RRF parameter (default 60)

        Returns:
            (fused_scores dict, previews dict)
        """
        scores: Dict[str, float] = {}
        previews: Dict[str, str] = {}

        # Process Milvus results (Vector Search)
        # Take best rank for each parent (multiple children may point to same parent)
        seen_parents_milvus = set()
        rank = 1

        for res in milvus_results:
            pid = res["parent_id"]
            if pid not in seen_parents_milvus:
                scores[pid] = scores.get(pid, 0.0) + (1.0 / (k + rank))

                # Store preview for fallback
                if res.get("preview"):
                    previews[pid] = res.get("preview")

                seen_parents_milvus.add(pid)
                rank += 1

        # Process ES results (Keyword Search)
        rank = 1
        for res in es_results:
            pid = res["parent_id"]
            # Boost ES results (Parent chunks) slightly as they often contain better context for tables/entities
            scores[pid] = scores.get(pid, 0.0) + (2.0 / (k + rank))
            rank += 1

        self.logger.debug(f"RRF: {len(seen_parents_milvus)} from Milvus, {len(es_results)} from ES")
        return scores, previews

    async def _fetch_parents(
        self,
        parent_ids: List[str],
        previews: Optional[Dict[str, str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch full parent content from ES.

        Falls back to preview content from Milvus children if parent not found in ES.
        """
        if not parent_ids:
            return []

        previews = previews or {}

        # Use terms query on chunk_id
        body = {
            "query": {
                "terms": {"chunk_id.keyword": parent_ids}
            },
            "size": len(parent_ids),
            "_source": True  # Get all fields
        }

        try:
            resp = await self.es.search(index=self.index, body=body)

            parents = []
            for hit in resp.get("hits", {}).get("hits", []):
                parents.append(hit["_source"])

            # Check for missing parents
            found_ids = {p.get("chunk_id") for p in parents}
            missing_ids = [pid for pid in parent_ids if pid not in found_ids]

            if missing_ids:
                self.logger.warning(f"Missing {len(missing_ids)} parents in ES, using previews")

                # Create synthetic parents from previews
                for pid in missing_ids:
                    if pid in previews:
                        # Extract document_id from parent_id pattern: {doc_id}_p_{index}_{hash}
                        doc_id = pid.split("_p_")[0] if "_p_" in pid else "unknown"

                        synthetic_parent = {
                            "chunk_id": pid,
                            "document_id": doc_id,
                            "content": previews[pid],
                            "chunk_type": "parent (synthetic)",
                            "metadata": json.dumps({"source": "milvus_preview", "synthetic": True})
                        }
                        parents.append(synthetic_parent)
                        self.logger.debug(f"Created synthetic parent for {pid}")

            return parents

        except Exception as e:
            self.logger.error(f"Failed to fetch parents from ES: {e}")

            # Fallback: Return synthetic parents from all available previews
            fallback_parents = []
            for pid in parent_ids:
                if pid in previews:
                    doc_id = pid.split("_p_")[0] if "_p_" in pid else "unknown"
                    fallback_parents.append({
                        "chunk_id": pid,
                        "document_id": doc_id,
                        "content": previews[pid],
                        "chunk_type": "parent (fallback)",
                        "metadata": json.dumps({"source": "milvus_preview", "fallback": True})
                    })

            return fallback_parents

    async def retrieve_keyword_only(
        self,
        query: str,
        collection_ids: Optional[List[str]] = None,
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Keyword-only retrieval (for debugging/comparison).
        """
        return await self._search_es_keyword(query, collection_ids, top_k)

    async def retrieve_vector_only(
        self,
        query: str,
        collection_ids: Optional[List[str]] = None,
        top_k: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Vector-only retrieval (for debugging/comparison).
        """
        import asyncio
        query_vector = await self.embedder.embed(query, task_type="retrieval_query")
        return await asyncio.to_thread(
            self._search_milvus, query_vector, collection_ids, top_k
        )
