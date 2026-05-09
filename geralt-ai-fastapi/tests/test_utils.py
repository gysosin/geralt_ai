"""
Tests for Utility Service

Tests for helpers/utils.py UtilityService class.
"""
import pytest
from unittest.mock import MagicMock, patch
import numpy as np


class TestUtilityService:
    """Test suite for UtilityService class."""
    
    def test_extract_file_type_pdf(self):
        """Test extracting file type from PDF filename."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        assert service.extract_file_type("document.pdf") == "pdf"
    
    def test_extract_file_type_docx(self):
        """Test extracting file type from DOCX filename."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        assert service.extract_file_type("document.docx") == "docx"
    
    def test_extract_file_type_with_path(self):
        """Test extracting file type from path with filename."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        assert service.extract_file_type("/path/to/file.txt") == "txt"
    
    def test_extract_file_type_unknown(self):
        """Test extracting file type from filename without extension."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        assert service.extract_file_type("noextension") == "unknown"
    
    def test_extract_file_type_uppercase(self):
        """Test extracting file type handles uppercase."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        assert service.extract_file_type("document.PDF") == "pdf"
    
    def test_get_resource_type_pdf(self):
        """Test getting resource type for PDF."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        assert service.get_resource_type("pdf") == "PDF_Document"
    
    def test_get_resource_type_word(self):
        """Test getting resource type for Word documents."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        assert service.get_resource_type("docx") == "Word_Document"
        assert service.get_resource_type("doc") == "Word_Document"
    
    def test_get_resource_type_excel(self):
        """Test getting resource type for Excel files."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        assert service.get_resource_type("xlsx") == "Excel_Spreadsheet"
        assert service.get_resource_type("xls") == "Excel_Spreadsheet"
    
    def test_get_resource_type_audio(self):
        """Test getting resource type for audio files."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        assert service.get_resource_type("mp3") == "Audio_File"
        assert service.get_resource_type("wav") == "Audio_File"
    
    def test_get_resource_type_video(self):
        """Test getting resource type for video files."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        assert service.get_resource_type("mp4") == "Video_File"
        assert service.get_resource_type("mkv") == "Video_File"
    
    def test_get_resource_type_unknown(self):
        """Test getting resource type for unknown extension."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        assert service.get_resource_type("xyz") == "Unknown Type"
    
    def test_get_file_info(self):
        """Test getting complete file info."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        info = service.get_file_info("report.pdf")
        
        assert info["extension"] == "pdf"
        assert info["resource_type"] == "PDF_Document"
    
    def test_time_to_seconds_with_int(self):
        """Test converting int to seconds."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        assert service.time_to_seconds(100) == 100.0
    
    def test_time_to_seconds_with_float(self):
        """Test converting float to seconds."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        assert service.time_to_seconds(100.5) == 100.5
    
    def test_time_to_seconds_with_string(self):
        """Test converting HH:MM:SS string to seconds."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        # 01:30:45 = 1*3600 + 30*60 + 45 = 5445
        assert service.time_to_seconds("01:30:45") == 5445.0
    
    def test_time_to_seconds_with_milliseconds(self):
        """Test converting time string with milliseconds."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        result = service.time_to_seconds("00:01:30.500")
        assert abs(result - 90.5) < 0.001
    
    def test_time_to_seconds_with_none(self):
        """Test handling None input."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        assert service.time_to_seconds(None) is None
    
    def test_seconds_to_timestring(self):
        """Test converting seconds to time string."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        # 5445 seconds = 01:30:45.000
        result = service.seconds_to_timestring(5445)
        assert result == "01:30:45.000"
    
    def test_seconds_to_timestring_with_fraction(self):
        """Test converting seconds with fractions to time string."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        result = service.seconds_to_timestring(90.5)
        assert result == "00:01:30.500"
    
    def test_seconds_to_timestring_with_none(self):
        """Test handling None input."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        assert service.seconds_to_timestring(None) is None
    
    def test_split_text_into_subchunks_basic(self):
        """Test basic text splitting."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        text = "a" * 100
        chunks = service.split_text_into_subchunks(text, max_chars=30)
        
        assert len(chunks) == 4  # 100 / 30 = 3.33, rounds up to 4
        assert all(len(c) <= 30 for c in chunks[:-1])
    
    def test_split_text_into_subchunks_with_overlap(self):
        """Test text splitting with overlap."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        text = "abcdefghij" * 10  # 100 chars
        chunks = service.split_text_into_subchunks(text, max_chars=30, overlap=10)
        
        # With overlap, we should get more chunks
        assert len(chunks) > 4
    
    def test_split_text_into_subchunks_empty(self):
        """Test splitting empty text."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        chunks = service.split_text_into_subchunks("", max_chars=30)
        
        assert chunks == []
    
    def test_split_text_into_subchunks_small_text(self):
        """Test splitting text smaller than max_chars."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        text = "Hello World"
        chunks = service.split_text_into_subchunks(text, max_chars=100)
        
        assert chunks == ["Hello World"]
    
    def test_split_text_into_subchunks_invalid_max(self):
        """Test handling invalid max_chars."""
        from helpers.utils import UtilityService
        
        service = UtilityService()
        text = "Hello World"
        chunks = service.split_text_into_subchunks(text, max_chars=0)
        
        assert chunks == [text]
    
    def test_singleton_instance(self):
        """Test that get_instance returns same object."""
        from helpers.utils import UtilityService
        
        instance1 = UtilityService.get_instance()
        instance2 = UtilityService.get_instance()
        
        assert instance1 is instance2

    def test_is_valid_url_accepts_public_http_url(self):
        """Test URL validation accepts public HTTP/S destinations."""
        from helpers.utils import UtilityService

        service = UtilityService()
        with patch("helpers.utils.socket.getaddrinfo") as mock_getaddrinfo:
            mock_getaddrinfo.return_value = [
                (2, 1, 6, "", ("93.184.216.34", 443)),
            ]

            assert service.is_valid_url("https://example.com/report.pdf") is True

    @pytest.mark.parametrize(
        "url",
        [
            "ftp://example.com/report.pdf",
            "http://localhost:8000/report.pdf",
            "http://localhost.localdomain/report.pdf",
            "http://service.localhost/report.pdf",
            "http://127.0.0.1/report.pdf",
            "http://10.0.0.5/report.pdf",
            "http://100.64.0.1/report.pdf",
            "http://172.16.0.5/report.pdf",
            "http://192.168.1.10/report.pdf",
            "http://169.254.169.254/latest/meta-data",
            "http://[::1]/report.pdf",
        ],
    )
    def test_is_valid_url_rejects_non_public_targets(self, url):
        """Test URL validation blocks local, private, and metadata targets."""
        from helpers.utils import UtilityService

        service = UtilityService()
        assert service.is_valid_url(url) is False

    def test_is_valid_url_rejects_hostname_resolving_private(self):
        """Test URL validation blocks hostnames that resolve to private IPs."""
        from helpers.utils import UtilityService

        service = UtilityService()
        with patch("helpers.utils.socket.getaddrinfo") as mock_getaddrinfo:
            mock_getaddrinfo.return_value = [
                (2, 1, 6, "", ("10.1.2.3", 443)),
            ]

            assert service.is_valid_url("https://internal.example.com/report.pdf") is False
