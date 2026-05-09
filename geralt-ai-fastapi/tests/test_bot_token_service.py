"""
Tests for bot token service upload hardening.
"""
from io import BytesIO
from unittest.mock import MagicMock
from urllib.parse import quote


class FakeIconUpload:
    def __init__(self, filename: str, content: bytes, content_type: str = "image/png"):
        self.filename = filename
        self.content_type = content_type
        self.file = BytesIO(content)

    def read(self, size=-1):
        return self.file.read(size)

    def seek(self, offset, whence=0):
        return self.file.seek(offset, whence)

    def tell(self):
        return self.file.tell()


def test_upload_icon_stores_valid_png():
    from services.bots.token_service import BotTokenService

    service = BotTokenService()
    service.storage = MagicMock()

    result = service._upload_icon(
        FakeIconUpload("bot.png", b"\x89PNG\r\n\x1a\n" + b"icon-bytes", "image/png"),
        "mehul",
    )

    assert result.success is True
    assert result.data["file_path"].startswith("mehul/bot_icons/")
    service.storage.put_object.assert_called_once()
    assert service.storage.put_object.call_args.kwargs["length"] == len(
        b"\x89PNG\r\n\x1a\n" + b"icon-bytes"
    )


def test_upload_icon_rejects_oversized_image():
    from services.bots.token_service import BotTokenService

    service = BotTokenService()
    service.storage = MagicMock()
    service.MAX_ICON_SIZE = 4

    result = service._upload_icon(
        FakeIconUpload("bot.png", b"\x89PNG\r\n\x1a\nlarge", "image/png"),
        "mehul",
    )

    assert result.success is False
    assert result.status_code == 413
    assert "too large" in result.error.lower()
    service.storage.put_object.assert_not_called()


def test_upload_icon_rejects_spoofed_image_content():
    from services.bots.token_service import BotTokenService

    service = BotTokenService()
    service.storage = MagicMock()

    result = service._upload_icon(
        FakeIconUpload("bot.png", b"<script>alert(1)</script>", "image/png"),
        "mehul",
    )

    assert result.success is False
    assert result.status_code == 400
    assert "image content" in result.error.lower()
    service.storage.put_object.assert_not_called()


def test_upload_icon_rejects_mismatched_content_type():
    from services.bots.token_service import BotTokenService

    service = BotTokenService()
    service.storage = MagicMock()

    result = service._upload_icon(
        FakeIconUpload("bot.gif", b"GIF89a" + b"icon-bytes", "image/png"),
        "mehul",
    )

    assert result.success is False
    assert result.status_code == 400
    assert "content type" in result.error.lower()
    service.storage.put_object.assert_not_called()


def test_proxy_file_rejects_non_storage_url(monkeypatch):
    from config import Config
    from services.bots import token_service
    from services.bots.token_service import BotTokenService

    service = BotTokenService()
    monkeypatch.setattr(Config, "MINIO_ENDPOINT", "storage.example.com:9000")
    monkeypatch.setattr(token_service.requests, "get", MagicMock())

    result = service.proxy_file(
        quote("http://169.254.169.254/latest/meta-data", safe=""),
        "metadata",
    )

    assert result.success is False
    assert result.status_code == 400
    assert "storage" in result.error.lower()
    token_service.requests.get.assert_not_called()


def test_proxy_icon_allows_configured_storage_url(monkeypatch):
    from config import Config
    from services.bots import token_service
    from services.bots.token_service import BotTokenService

    service = BotTokenService()
    monkeypatch.setattr(Config, "MINIO_ENDPOINT", "storage.example.com:9000")
    mock_response = MagicMock()
    mock_response.content = b"icon"
    mock_response.headers = {"Content-Type": "image/png"}
    mock_response.raise_for_status.return_value = None
    monkeypatch.setattr(token_service.requests, "get", MagicMock(return_value=mock_response))

    target_url = "https://storage.example.com:9000/documents/icon.png?signature=abc"
    result = service.proxy_icon(quote(target_url, safe=""))

    assert result.success is True
    token_service.requests.get.assert_called_once_with(target_url, timeout=10)
    mock_response.raise_for_status.assert_called_once()
