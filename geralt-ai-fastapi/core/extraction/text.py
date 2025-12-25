"""
Text-based Extractors

Extractors for text-based formats: JSON, CSV, TXT, HTML.
"""
import json
import re
import io
import string
import logging
import pandas as pd
from typing import List, Dict, Any, Union
from bs4 import BeautifulSoup
from chardet import detect

from core.extraction.base import BaseExtractor
from core.extraction.factory import ExtractorFactory

logger = logging.getLogger(__name__)


def detect_encoding(binary_data: bytes) -> str:
    """Detect the encoding of binary data."""
    result = detect(binary_data)
    return result.get("encoding", "utf-8") or "utf-8"


# -------------------------------------------------------------------------
# JSON Extractor
# -------------------------------------------------------------------------
class JSONExtractor(BaseExtractor):
    """
    Extract content from JSON files.
    
    Splits large JSON structures into manageable chunks while preserving
    the hierarchical path information.
    """
    
    def __init__(self):
        super().__init__()
    
    def extract(self, file: Union[str, bytes, io.BytesIO], **kwargs) -> List[Dict[str, Any]]:
        self._log_start("JSON file")
        
        try:
            # Read content
            if hasattr(file, "read"):
                content_bytes = file.read()
                if isinstance(content_bytes, str):
                    content_bytes = content_bytes.encode('utf-8')
            elif isinstance(file, str):
                content_bytes = file.encode('utf-8')
            else:
                content_bytes = file

            self._log_debug(f"JSON content size: {len(content_bytes)} bytes")
            
            max_chunk_size = kwargs.get("max_chunk_size", 2000)
            min_chunk_size = kwargs.get("min_chunk_size", None)

            parser = self._JsonChunkParser(max_chunk_size, min_chunk_size, self.logger)
            results = parser(content_bytes)
            
            self._log_complete(len(results), "JSON chunks")
            return results
            
        except json.JSONDecodeError as e:
            self._log_error(e, "Invalid JSON")
            raise ValueError(f"Invalid JSON format: {str(e)}")
            
        except Exception as e:
            self._log_error(e, "JSON extraction")
            raise ValueError(f"JSON extraction failed: {str(e)}")

    class _JsonChunkParser:
        """Internal class for parsing and chunking JSON."""
        
        def __init__(self, max_chunk_size: int = 2000, min_chunk_size: int = None, logger=None):
            self.max_chunk_size = max_chunk_size * 2
            self.min_chunk_size = (
                min_chunk_size
                if min_chunk_size is not None
                else max(max_chunk_size - 200, 50)
            )
            self.logger = logger or logging.getLogger(__name__)

        def __call__(self, binary: bytes) -> List[Dict[str, Any]]:
            enc = detect_encoding(binary)
            self.logger.debug(f"Detected encoding: {enc}")
            
            txt = binary.decode(enc, errors="ignore")
            data = json.loads(txt)
            
            splitted = self.split_json(data, convert_lists=True)
            
            sections = []
            for chunk, path in splitted:
                if chunk:
                    sections.append({
                        "content": json.dumps(chunk, ensure_ascii=False),
                        "metadata": {"path": path},
                    })
            return sections

        def _json_size(self, data) -> int:
            return len(json.dumps(data, ensure_ascii=False))

        def _set_nested_dict(self, d: dict, path: list, value):
            for key in path[:-1]:
                d = d.setdefault(key, {})
            d[path[-1]] = value

        def _list_to_dict_preprocessing(self, data):
            if isinstance(data, dict):
                return {k: self._list_to_dict_preprocessing(v) for k, v in data.items()}
            if isinstance(data, list):
                return {
                    str(i): self._list_to_dict_preprocessing(item)
                    for i, item in enumerate(data)
                }
            return data

        def _split_json(self, data, path=None, chunks=None):
            if chunks is None:
                chunks = [({}, path or [])]
            if path is None:
                path = []

            if isinstance(data, dict):
                for key, value in data.items():
                    new_path = path + [key]
                    chunk_size = self._json_size(chunks[-1][0])
                    size = self._json_size({key: value})
                    if size < (self.max_chunk_size - chunk_size):
                        self._set_nested_dict(chunks[-1][0], new_path, value)
                    else:
                        if chunk_size >= self.min_chunk_size:
                            chunks.append(({}, new_path))
                        self._split_json(value, new_path, chunks)
            else:
                self._set_nested_dict(chunks[-1][0], path, data)
            return chunks

        def split_json(self, json_data, convert_lists: bool = False):
            if convert_lists:
                data = self._list_to_dict_preprocessing(json_data)
            else:
                data = json_data
            splitted = self._split_json(data)
            if not splitted[-1][0]:
                splitted.pop()
            return splitted


ExtractorFactory.register("json", JSONExtractor)


# -------------------------------------------------------------------------
# CSV Extractor
# -------------------------------------------------------------------------
class CSVExtractor(BaseExtractor):
    """
    Extract content from CSV files.
    
    Each non-empty cell is extracted with its cell address and column information.
    """
    
    def __init__(self):
        super().__init__()
    
    def extract(self, file: Union[str, bytes, io.BytesIO], **kwargs) -> List[Dict[str, Any]]:
        self._log_start("CSV file")
        
        extracted_cells = []
        try:
            df = pd.read_csv(file)
            
            row_count = len(df)
            col_count = len(df.columns)
            self.logger.info(f"CSV dimensions: {row_count} rows x {col_count} columns")
            
            for row_idx, row in df.iterrows():
                for col_idx, val in row.items():
                    if pd.notna(val):
                        col_pos = df.columns.get_loc(col_idx)
                        col_letter = self._get_column_letter(col_pos)
                        cell_addr = f"{col_letter}{row_idx + 2}"
                        
                        extracted_cells.append({
                            "content": str(val),
                            "metadata": {
                                "cell_address": cell_addr,
                                "column_name": str(col_idx),
                            },
                        })
            
            self._log_complete(len(extracted_cells), "cells")
            return extracted_cells
            
        except pd.errors.EmptyDataError:
            self._log_warning("CSV file is empty")
            return []
            
        except Exception as e:
            self._log_error(e, "CSV extraction")
            raise ValueError(f"Error extracting from CSV: {str(e)}")
    
    @staticmethod
    def _get_column_letter(col_pos: int) -> str:
        """Convert column position to Excel-style letter (A, B, ..., Z, AA, AB, ...)."""
        result = ""
        while col_pos >= 0:
            result = string.ascii_uppercase[col_pos % 26] + result
            col_pos = col_pos // 26 - 1
        return result


ExtractorFactory.register("csv", CSVExtractor)


# -------------------------------------------------------------------------
# Text Extractor
# -------------------------------------------------------------------------
class TextExtractor(BaseExtractor):
    """
    Extract content from plain text files.
    
    Splits text into chunks based on line boundaries while respecting
    maximum chunk size limits.
    """
    
    def __init__(self):
        super().__init__()
    
    def extract(self, file: Union[str, bytes, io.BytesIO], **kwargs) -> List[Dict[str, Any]]:
        self._log_start("Text file")
        
        try:
            # Read content
            if hasattr(file, "read"):
                content = file.read()
                if isinstance(content, bytes):
                    content = content.decode("utf-8", errors="ignore")
            elif isinstance(file, bytes):
                content = file.decode("utf-8", errors="ignore")
            else:
                content = file

            max_chunk_size = kwargs.get("max_chunk_size", 2000)
            lines = content.splitlines()
            
            self.logger.info(f"Text file: {len(lines)} lines, {len(content)} characters")

            chunks = []
            chunk = ""
            start_line = 1

            for line_num, line in enumerate(lines, start=1):
                if len(chunk) + len(line) <= max_chunk_size:
                    chunk += line + "\n"
                else:
                    if chunk.strip():
                        chunks.append({
                            "content": chunk.strip(),
                            "metadata": {
                                "start_line": start_line,
                                "end_line": line_num - 1,
                            },
                        })
                    chunk = line + "\n"
                    start_line = line_num

            if chunk.strip():
                chunks.append({
                    "content": chunk.strip(),
                    "metadata": {
                        "start_line": start_line,
                        "end_line": len(lines),
                    },
                })

            self._log_complete(len(chunks), "text chunks")
            return chunks
            
        except Exception as e:
            self._log_error(e, "Text extraction")
            raise ValueError(f"Text extraction failed: {str(e)}")


ExtractorFactory.register("txt", TextExtractor)


# -------------------------------------------------------------------------
# HTML Extractor
# -------------------------------------------------------------------------
class HTMLExtractor(BaseExtractor):
    """
    Extract text content from HTML files.
    
    Parses HTML and extracts clean text content, removing scripts,
    styles, and HTML markup.
    """
    
    def __init__(self):
        super().__init__()
    
    def extract(self, file: Union[str, bytes, io.BytesIO], **kwargs) -> List[Dict[str, Any]]:
        self._log_start("HTML file")
        
        try:
            # Read content
            if hasattr(file, "read"):
                content = file.read()
            else:
                content = file
            
            if isinstance(content, bytes):
                # Try to detect encoding
                encoding = detect_encoding(content)
                content = content.decode(encoding, errors="ignore")
            
            self._log_debug(f"HTML content size: {len(content)} characters")
                
            soup = BeautifulSoup(content, "html.parser")
            
            # Remove script and style elements
            for element in soup(["script", "style"]):
                element.extract()
            
            # Get title if available
            title = soup.title.string if soup.title else None
            
            # Get text
            text = soup.get_text()
            cleaned_text = re.sub(r"\s+", " ", text).strip()
            
            self.logger.info(f"Extracted {len(cleaned_text)} characters of text")
            
            result = {
                "content": cleaned_text,
                "metadata": {}
            }
            
            if title:
                result["metadata"]["title"] = title.strip()
            
            self._log_complete(1, "HTML document")
            return [result]
            
        except Exception as e:
            self._log_error(e, "HTML extraction")
            raise ValueError(f"HTML extraction failed: {str(e)}")


ExtractorFactory.register("html", HTMLExtractor)
