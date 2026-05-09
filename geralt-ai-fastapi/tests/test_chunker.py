"""
Tests for hierarchical document chunking.
"""
from core.rag.chunker import HierarchicalChunkConfig, HierarchicalChunker


def test_markdown_table_chunks_repeat_header_when_split():
    """Large markdown tables stay readable after parent chunk splitting."""
    rows = [
        f"| Vendor {i:02d} | Invoice INV-{i:03d} | ${i * 125}.00 |"
        for i in range(1, 31)
    ]
    table = "\n".join([
        "Purchase order export",
        "| Vendor | Invoice | Amount |",
        "| --- | --- | ---: |",
        *rows,
    ])
    chunker = HierarchicalChunker(
        HierarchicalChunkConfig(
            parent_chunk_size=500,
            parent_chunk_overlap=0,
            child_chunk_size=180,
            child_chunk_overlap=0,
        )
    )

    parents, children = chunker.chunk(
        table,
        document_id="doc-1",
        collection_id="collection-1",
        source="po-export.md",
    )

    assert len(parents) > 1
    assert children
    for parent in parents:
        assert "| Vendor | Invoice | Amount |" in parent.content
        assert "| --- | --- | ---: |" in parent.content
        assert parent.metadata.collection_id == "collection-1"
