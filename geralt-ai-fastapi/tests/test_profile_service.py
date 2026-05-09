"""
Tests for user profile service upload hardening.
"""
from io import BytesIO
from unittest.mock import MagicMock


class FakeImageUpload:
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


def test_upload_profile_picture_stores_valid_png():
    from services.users.profile_service import ProfileService

    service = ProfileService()
    service.storage = MagicMock()

    upload = FakeImageUpload(
        "avatar.png",
        b"\x89PNG\r\n\x1a\n" + b"image-bytes",
        "image/png",
    )

    result = service._upload_profile_picture("mehul", upload)

    assert result.success is True
    assert result.data.startswith("mehul/profile_pictures/")
    service.storage.put_object.assert_called_once()
    assert service.storage.put_object.call_args.kwargs["length"] == len(
        b"\x89PNG\r\n\x1a\n" + b"image-bytes"
    )


def test_upload_profile_picture_rejects_oversized_image():
    from services.users.profile_service import ProfileService

    service = ProfileService()
    service.storage = MagicMock()
    service.MAX_PROFILE_PICTURE_SIZE = 4

    result = service._upload_profile_picture(
        "mehul",
        FakeImageUpload("avatar.png", b"\x89PNG\r\n\x1a\nlarge", "image/png"),
    )

    assert result.success is False
    assert result.status_code == 413
    assert "too large" in result.error.lower()
    service.storage.put_object.assert_not_called()


def test_upload_profile_picture_rejects_spoofed_image_content():
    from services.users.profile_service import ProfileService

    service = ProfileService()
    service.storage = MagicMock()

    result = service._upload_profile_picture(
        "mehul",
        FakeImageUpload("avatar.png", b"<script>alert(1)</script>", "image/png"),
    )

    assert result.success is False
    assert result.status_code == 400
    assert "image content" in result.error.lower()
    service.storage.put_object.assert_not_called()


def test_upload_profile_picture_rejects_mismatched_content_type():
    from services.users.profile_service import ProfileService

    service = ProfileService()
    service.storage = MagicMock()

    result = service._upload_profile_picture(
        "mehul",
        FakeImageUpload(
            "avatar.png",
            b"\x89PNG\r\n\x1a\n" + b"image-bytes",
            "image/jpeg",
        ),
    )

    assert result.success is False
    assert result.status_code == 400
    assert "content type" in result.error.lower()
    service.storage.put_object.assert_not_called()
