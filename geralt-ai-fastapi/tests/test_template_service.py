"""
Tests for bot template service upload hardening.
"""
from io import BytesIO
from unittest.mock import MagicMock


class FakeTemplateImage:
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


def _template_data():
    return {
        "template_name": "Finance Bot",
        "prompt": "Answer finance questions from the collection.",
        "description": "Finance assistant",
    }


def test_create_template_stores_valid_png_image():
    from services.bots.template_service import TemplateService

    service = TemplateService()
    service.db = MagicMock()
    service.storage = MagicMock()
    service.db.find_one.return_value = None

    result = service.create(
        "mehul@example.com",
        _template_data(),
        FakeTemplateImage("template.png", b"\x89PNG\r\n\x1a\n" + b"image-bytes", "image/png"),
    )

    assert result.success is True
    service.storage.put_object.assert_called_once()
    service.db.insert_one.assert_called_once()
    assert service.storage.put_object.call_args.kwargs["length"] == len(
        b"\x89PNG\r\n\x1a\n" + b"image-bytes"
    )


def test_create_template_rejects_oversized_image():
    from services.bots.template_service import TemplateService

    service = TemplateService()
    service.db = MagicMock()
    service.storage = MagicMock()
    service.db.find_one.return_value = None
    service.MAX_TEMPLATE_IMAGE_SIZE = 4

    result = service.create(
        "mehul@example.com",
        _template_data(),
        FakeTemplateImage("template.png", b"\x89PNG\r\n\x1a\nlarge", "image/png"),
    )

    assert result.success is False
    assert result.status_code == 413
    assert "too large" in result.error.lower()
    service.storage.put_object.assert_not_called()
    service.db.insert_one.assert_not_called()


def test_create_template_rejects_spoofed_image_content():
    from services.bots.template_service import TemplateService

    service = TemplateService()
    service.db = MagicMock()
    service.storage = MagicMock()
    service.db.find_one.return_value = None

    result = service.create(
        "mehul@example.com",
        _template_data(),
        FakeTemplateImage("template.png", b"<script>alert(1)</script>", "image/png"),
    )

    assert result.success is False
    assert result.status_code == 400
    assert "image content" in result.error.lower()
    service.storage.put_object.assert_not_called()
    service.db.insert_one.assert_not_called()


def test_create_template_rejects_mismatched_content_type():
    from services.bots.template_service import TemplateService

    service = TemplateService()
    service.db = MagicMock()
    service.storage = MagicMock()
    service.db.find_one.return_value = None

    result = service.create(
        "mehul@example.com",
        _template_data(),
        FakeTemplateImage("template.gif", b"GIF89a" + b"image-bytes", "image/png"),
    )

    assert result.success is False
    assert result.status_code == 400
    assert "content type" in result.error.lower()
    service.storage.put_object.assert_not_called()
    service.db.insert_one.assert_not_called()
