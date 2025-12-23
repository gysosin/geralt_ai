"""
Document Format Converters

Converts various document formats to PDF for unified processing.
"""
import io
import os
import subprocess
import tempfile
import logging
from pathlib import Path
from typing import Union, Optional

logger = logging.getLogger(__name__)


class DocumentConverter:
    """Convert Office documents to PDF using LibreOffice headless mode."""
    
    @staticmethod
    def is_libreoffice_available() -> bool:
        """Check if LibreOffice is installed."""
        try:
            result = subprocess.run(
                ["libreoffice", "--version"],
                capture_output=True,
                timeout=5
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False
    
    @staticmethod
    def convert_to_pdf(
        file: Union[str, bytes, io.BytesIO],
        source_format: str
    ) -> Optional[bytes]:
        """
        Convert document to PDF using LibreOffice.
        
        Args:
            file: Input file (path, bytes, or BytesIO)
            source_format: Source format extension (docx, pptx, xlsx, etc.)
        
        Returns:
            PDF bytes if successful, None otherwise
        """
        if not DocumentConverter.is_libreoffice_available():
            logger.warning("LibreOffice not available, cannot convert to PDF")
            return None
        
        # Create temp directory for conversion
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_dir_path = Path(temp_dir)
            
            # Write input file
            input_path = temp_dir_path / f"input.{source_format}"
            if isinstance(file, bytes):
                input_path.write_bytes(file)
            elif isinstance(file, io.BytesIO):
                input_path.write_bytes(file.read())
            else:
                # Copy from file path
                input_path.write_bytes(Path(file).read_bytes())
            
            try:
                # Run LibreOffice conversion
                result = subprocess.run(
                    [
                        "libreoffice",
                        "--headless",
                        "--convert-to", "pdf",
                        "--outdir", str(temp_dir_path),
                        str(input_path)
                    ],
                    capture_output=True,
                    timeout=30,  # 30s timeout
                    text=True
                )
                
                if result.returncode != 0:
                    logger.error(f"LibreOffice conversion failed: {result.stderr}")
                    return None
                
                # Read generated PDF
                output_pdf = temp_dir_path / "input.pdf"
                if output_pdf.exists():
                    return output_pdf.read_bytes()
                else:
                    logger.error("PDF output file not found after conversion")
                    return None
                    
            except subprocess.TimeoutExpired:
                logger.error("LibreOffice conversion timeout")
                return None
            except Exception as e:
                logger.error(f"Error during conversion: {e}")
                return None


class UniversalExtractor:
    """
    Universal document extractor that converts all formats to PDF first.
    
    Supported formats: DOCX, PPTX, XLSX, ODP, ODS, RTF
    """
    
    CONVERTIBLE_FORMATS = {
        "docx", "doc", "pptx", "ppt", "xlsx", "xls",
        "odp", "ods", "odt", "rtf"
    }
    
    @staticmethod
    def should_convert(file_extension: str) -> bool:
        """Check if file should be converted to PDF."""
        return file_extension.lower() in UniversalExtractor.CONVERTIBLE_FORMATS
    
    @staticmethod
    def extract_via_pdf(
        file: Union[str, bytes, io.BytesIO],
        source_format: str
    ) -> Optional[bytes]:
        """
        Convert document to PDF and return PDF bytes.
        
        This PDF can then be processed by PDFExtractor for:
        - Page snapshots
        - Text with bbox coordinates
        - OCR fallback
        
        Args:
            file: Input file
            source_format: Original format (docx, pptx, etc.)
        
        Returns:
            PDF bytes or None if conversion failed
        """
        return DocumentConverter.convert_to_pdf(file, source_format)
