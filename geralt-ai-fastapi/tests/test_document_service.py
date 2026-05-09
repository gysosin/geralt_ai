"""
Tests for document upload service behavior.
"""
from io import BytesIO
from unittest.mock import MagicMock


class FakeUploadFile:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.file = BytesIO(content)


def test_upload_file_rejects_oversized_document(monkeypatch):
    from services.collections.document_service import DocumentService
    from config import Config

    service = DocumentService()
    service.db = MagicMock()
    service.storage = MagicMock()
    service.db.find_one.return_value = None
    monkeypatch.setattr(Config, "MAX_CONTENT_LENGTH", 4)

    result, ok = service._upload_file(
        FakeUploadFile("large.pdf", b"12345"),
        username="mehul",
        full_name="Mehul",
        collection_id="collection-1",
        conversation_id=None,
    )

    assert ok is False
    assert result["status"] == "too_large"
    service.storage.put_object.assert_not_called()
    service.db.insert_one.assert_not_called()
