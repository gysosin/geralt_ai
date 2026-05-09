"""
Shared upload validation helpers.
"""
import os
from dataclasses import dataclass
from typing import Any, Optional, Set

from helpers.utils import get_utility_service


IMAGE_CONTENT_TYPES_BY_EXTENSION = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
}
IMAGE_CONTENT_TYPE_ORDER = ("image/png", "image/jpeg", "image/gif")


@dataclass
class ImageUploadValidation:
    success: bool
    status_code: int = 200
    error: Optional[str] = None
    extension: Optional[str] = None
    file_size: int = 0
    stream: Optional[Any] = None


def validate_image_upload(
    upload: Any,
    *,
    allowed_extensions: Set[str],
    max_size_bytes: int,
    resource_label: str,
    missing_extension_message: Optional[str] = None,
    invalid_extension_message: Optional[str] = None,
) -> ImageUploadValidation:
    """Validate image extension, MIME type, size, and byte signature."""
    filename = get_utility_service().secure_filename(upload.filename)
    allowed_extensions = {extension.lower() for extension in allowed_extensions}
    allowed_extensions_text = ", ".join(sorted(allowed_extensions))
    invalid_format_message = (
        invalid_extension_message
        or f"Invalid image format. Allowed: {allowed_extensions_text}"
    )

    if "." not in filename:
        return ImageUploadValidation(
            success=False,
            error=missing_extension_message or invalid_format_message,
            status_code=400,
        )

    extension = filename.rsplit(".", 1)[1].lower()
    if extension not in allowed_extensions:
        return ImageUploadValidation(
            success=False,
            error=invalid_format_message,
            status_code=400,
        )

    allowed_content_types = {
        content_type
        for ext, content_type in IMAGE_CONTENT_TYPES_BY_EXTENSION.items()
        if ext in allowed_extensions
    }
    content_type = (getattr(upload, "content_type", "") or "").split(";")[0].strip().lower()
    if content_type and content_type not in allowed_content_types:
        allowed_content_types_text = ", ".join(
            item for item in IMAGE_CONTENT_TYPE_ORDER if item in allowed_content_types
        )
        return ImageUploadValidation(
            success=False,
            error=f"Invalid image content type. Allowed: {allowed_content_types_text}",
            status_code=400,
        )

    expected_content_type = IMAGE_CONTENT_TYPES_BY_EXTENSION[extension]
    if content_type and content_type != expected_content_type:
        return ImageUploadValidation(
            success=False,
            error=f"Invalid image content type for .{extension} file",
            status_code=400,
        )

    stream = getattr(upload, "file", upload)
    stream.seek(0, os.SEEK_END)
    file_size = stream.tell()
    stream.seek(0)

    if file_size <= 0:
        return ImageUploadValidation(
            success=False,
            error=f"{resource_label} cannot be empty",
            status_code=400,
        )
    if file_size > max_size_bytes:
        return ImageUploadValidation(
            success=False,
            error=f"{resource_label} is too large",
            status_code=413,
        )

    header = stream.read(16)
    stream.seek(0)
    if not _matches_image_signature(extension, header):
        return ImageUploadValidation(
            success=False,
            error="Invalid image content",
            status_code=400,
        )

    return ImageUploadValidation(
        success=True,
        extension=extension,
        file_size=file_size,
        stream=stream,
    )


def _matches_image_signature(extension: str, header: bytes) -> bool:
    if extension == "png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")
    if extension in {"jpg", "jpeg"}:
        return header.startswith(b"\xff\xd8\xff")
    if extension == "gif":
        return header.startswith((b"GIF87a", b"GIF89a"))
    return False
