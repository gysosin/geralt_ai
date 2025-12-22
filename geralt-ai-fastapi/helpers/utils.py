"""
UtilityService

OOP-based utility functions for document processing and file handling.
"""
import datetime
import re
import logging
from typing import Optional, List, Dict, Any
from urllib.parse import quote_plus
from pathlib import Path

import numpy as np

from config import Config


class UtilityService:
    """
    Service providing utility functions for the application.
    
    Provides methods for:
    - File type extraction and resource type mapping
    - Time conversions
    - Text chunking
    - URL generation
    - File name sanitization
    """
    
    _instance: Optional["UtilityService"] = None
    
    # File type to resource type mapping
    RESOURCE_TYPE_MAP = {
        "pdf": "PDF_Document",
        "docx": "Word_Document",
        "doc": "Word_Document",
        "xlsx": "Excel_Spreadsheet",
        "xls": "Excel_Spreadsheet",
        "pptx": "PowerPoint_Presentation",
        "txt": "Text_File",
        "json": "Text_File",
        "mp3": "Audio_File",
        "wav": "Audio_File",
        "m4a": "Audio_File",
        "mp4": "Video_File",
        "mkv": "Video_File",
        "avi": "Video_File",
        "srt": "Youtube",
        "html": "Web_Page",
        "csv": "CSV_File",
    }
    
    def __init__(self):
        """Initialize the utility service."""
        self.logger = logging.getLogger(self.__class__.__name__)
    
    @classmethod
    def get_instance(cls) -> "UtilityService":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    # =========================================================================
    # File Handling
    # =========================================================================

    def secure_filename(self, filename: str) -> str:
        """
        Sanitize a filename to be safe for filesystem/storage usage.
        
        Args:
            filename: The original filename
            
        Returns:
            Sanitized filename
        """
        filename = Path(filename).name
        # Replace anything that isn't alphanumeric, dash, dot, or underscore with underscore
        filename = re.sub(r"[^a-zA-Z0-9_.-]", "_", filename)
        return filename

    # =========================================================================
    # Embedding Index Lookup
    # =========================================================================
    
    def get_document_id_by_embedding_index(
        self,
        index: int,
        public: bool,
        public_embedding_collection,
        embedding_collection
    ) -> Optional[str]:
        """
        Get document ID by embedding index.
        
        Args:
            index: Embedding index
            public: Whether to search public or private collection
            public_embedding_collection: Public embedding collection
            embedding_collection: Private embedding collection
            
        Returns:
            Document ID or None if not found
        """
        # Convert numpy.int64 to standard Python int
        if isinstance(index, np.int64):
            index = int(index)
        
        collection = public_embedding_collection if public else embedding_collection
        embedding_doc = collection.find_one({"embedding_index": index})
        
        return embedding_doc["document_id"] if embedding_doc else None
    
    # =========================================================================
    # File Type Handling
    # =========================================================================
    
    def extract_file_type(self, file_name: str) -> str:
        """
        Extract file extension from filename.
        
        Args:
            file_name: The filename to extract extension from
            
        Returns:
            File extension without dot, or 'unknown' if not found
        """
        match = re.search(r"\.(\w+)$", file_name)
        return match.group(1).lower() if match else "unknown"
    
    def get_resource_type(self, file_extension: str) -> str:
        """
        Map file extension to resource type.
        
        Args:
            file_extension: File extension (without dot)
            
        Returns:
            Resource type string
        """
        return self.RESOURCE_TYPE_MAP.get(file_extension.lower(), "Unknown Type")
    
    def get_file_info(self, file_name: str) -> Dict[str, str]:
        """
        Get both file extension and resource type for a file.
        
        Args:
            file_name: The filename
            
        Returns:
            Dictionary with 'extension' and 'resource_type'
        """
        extension = self.extract_file_type(file_name)
        return {
            "extension": extension,
            "resource_type": self.get_resource_type(extension)
        }
    
    # =========================================================================
    # Time Conversions
    # =========================================================================
    
    def time_to_seconds(self, time_value: Any) -> Optional[float]:
        """
        Convert time value to seconds.
        
        Args:
            time_value: Time as int, float, or HH:MM:SS.xxx string
            
        Returns:
            Time in seconds, or None if input is None
        """
        if time_value is None:
            return None
        
        if isinstance(time_value, (int, float)):
            return float(time_value)
        
        if isinstance(time_value, str):
            parts = time_value.split(":")
            if len(parts) == 3:
                hours = float(parts[0])
                minutes = float(parts[1])
                seconds = float(parts[2])
                return hours * 3600 + minutes * 60 + seconds
            return 0.0
        
        return 0.0
    
    def seconds_to_timestring(self, seconds: Optional[float]) -> Optional[str]:
        """
        Convert seconds to HH:MM:SS.xxx format.
        
        Args:
            seconds: Time in seconds
            
        Returns:
            Formatted time string, or None if input is None
        """
        if seconds is None:
            return None
        
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = seconds % 60
        
        return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"
    
    # =========================================================================
    # Text Processing
    # =========================================================================
    
    def split_text_into_subchunks(
        self,
        text: str,
        max_chars: int,
        overlap: int = 0
    ) -> List[str]:
        """
        Split text into sub-chunks of specified maximum length.
        
        Args:
            text: Text to split
            max_chars: Maximum characters per chunk
            overlap: Number of overlapping characters between chunks
            
        Returns:
            List of text chunks
        """
        if max_chars <= 0:
            return [text]
        
        result = []
        start = 0
        text_length = len(text)
        
        while start < text_length:
            end = min(start + max_chars, text_length)
            sub_text = text[start:end]
            result.append(sub_text)
            
            # Advance start pointer
            next_start = end - overlap
            # Ensure we always move forward at least 1 char to avoid infinite loop
            if next_start <= start:
                next_start = start + 1
            
            start = next_start
            
            if start >= text_length:
                break
        
        return result
    
    # =========================================================================
    # URL Generation
    # =========================================================================
    
    def generate_preview_url(
        self,
        file_path: str,
        original_file_name: str,
        minio_client=None
    ) -> str:
        """
        Generate a preview URL for a file stored in MinIO.
        
        Args:
            file_path: Path to file in MinIO
            original_file_name: Original filename for display
            minio_client: MinIO client instance (uses default if not provided)
            
        Returns:
            Preview URL string, or empty string on error
        """
        if not file_path:
            return ""
        
        try:
            # Import here to avoid circular imports
            if minio_client is None:
                from clients import minio_client
            
            pre_signed_url = minio_client.presigned_get_object(
                Config.BUCKET_NAME,
                file_path,
                expires=datetime.timedelta(hours=24),
            )
            encoded_url = quote_plus(pre_signed_url)
            filename_param = quote_plus(original_file_name) if original_file_name else "file"
            
            return f"{Config.BASE_API_URL}/bot_management/proxy-file?url={encoded_url}&filename={filename_param}"
        except Exception as e:
            self.logger.error(f"Error generating preview URL: {e}")
            return ""

    # =========================================================================
    # URL Processing
    # =========================================================================

    def is_valid_url(self, url: str) -> bool:
        """Check if a string is a valid URL."""
        regex = re.compile(
            r"^(?:http|https)://"
            r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|"
            r"localhost|"
            r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
            r"\[?[A-F0-9]*:[A-F0-9:]+\]?)"
            r"(?::\d+)?"
            r"(?:/?|[/?]\S+)$",
            re.IGNORECASE,
        )
        return re.match(regex, url) is not None

    def normalize_url(self, url: str) -> str:
        """Normalize a URL."""
        from urllib.parse import urlparse, parse_qs
        parsed_url = urlparse(url)

        if "youtube.com" in parsed_url.netloc or "youtu.be" in parsed_url.netloc:
            vid = self._extract_youtube_video_id(url)
            if vid:
                return f"https://www.youtube.com/watch?v={vid}"

        normalized = parsed_url._replace(fragment="", query="").geturl()
        return normalized

    def _extract_youtube_video_id(self, url: str) -> Optional[str]:
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(url)
        if parsed.hostname == "youtu.be":
            return parsed.path[1:]
        if parsed.hostname in ("www.youtube.com", "youtube.com"):
            if parsed.path == "/watch":
                qs = parse_qs(parsed.query)
                return qs.get("v", [None])[0]
            if parsed.path.startswith("/embed/"):
                return parsed.path.split("/")[2]
            if parsed.path.startswith("/v/"):
                return parsed.path.split("/")[2]
        return None

    def get_document_name_from_url(self, url: str) -> str:
        """Generate a document name from the URL."""
        match = re.search(r"://(?:www\.)?([^/.]+)(.*)", url)
        if not match:
            return "document"
        website = match.group(1)
        route = match.group(2).strip("/")
        if route:
            return f"{website}_{route.replace('/', '_')}"
        return website

    def get_youtube_video_title(self, url: str, append_text=".srt") -> Optional[str]:
        """Retrieve a YouTube video title."""
        import yt_dlp
        try:
            ydl_opts = {"quiet": True}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if info.get("_type") == "playlist":
                    return None
                title = info.get("title")
                return f"{title}{append_text}" if title else None
        except:
            return None


# Singleton access
_utility_service_instance: Optional[UtilityService] = None


def get_utility_service() -> UtilityService:
    """Get or create the utility service singleton."""
    global _utility_service_instance
    if _utility_service_instance is None:
        _utility_service_instance = UtilityService()
    return _utility_service_instance
