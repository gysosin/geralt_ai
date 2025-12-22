import json
import re
import io
import string
import pandas as pd
from typing import List, Dict, Any, Union
from bs4 import BeautifulSoup
from chardet import detect

from core.extraction.base import BaseExtractor
from core.extraction.factory import ExtractorFactory

def detect_encoding(binary_data):
    result = detect(binary_data)
    return result["encoding"]

# -------------------------------------------------------------------------
# JSON Extractor
# -------------------------------------------------------------------------
class JSONExtractor(BaseExtractor):
    def extract(self, file: Union[str, bytes, io.BytesIO], **kwargs) -> List[Dict[str, Any]]:
        # Read content
        if hasattr(file, "read"):
            content_bytes = file.read()
            if isinstance(content_bytes, str):
                content_bytes = content_bytes.encode('utf-8')
        elif isinstance(file, str):
            content_bytes = file.encode('utf-8')
        else:
            content_bytes = file

        max_chunk_size = kwargs.get("max_chunk_size", 2000)
        min_chunk_size = kwargs.get("min_chunk_size", None)

        parser = self.JsonChunkParser(max_chunk_size, min_chunk_size)
        return parser(content_bytes)

    class JsonChunkParser:
        def __init__(self, max_chunk_size=2000, min_chunk_size=None):
            self.max_chunk_size = max_chunk_size * 2
            self.min_chunk_size = (
                min_chunk_size
                if min_chunk_size is not None
                else max(max_chunk_size - 200, 50)
            )

        def __call__(self, binary):
            enc = detect_encoding(binary)
            txt = binary.decode(enc, errors="ignore")
            data = json.loads(txt)
            splitted = self.split_json(data, convert_lists=True)
            sections = []
            for chunk, path in splitted:
                if chunk:
                    sections.append(
                        {
                            "content": json.dumps(chunk, ensure_ascii=False),
                            "metadata": {"path": path},
                        }
                    )
            return sections

        def _json_size(self, data):
            return len(json.dumps(data, ensure_ascii=False))

        def _set_nested_dict(self, d, path, value):
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

        def split_json(self, json_data, convert_lists=False):
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
    def extract(self, file: Union[str, bytes, io.BytesIO], **kwargs) -> List[Dict[str, Any]]:
        extracted_cells = []
        try:
            df = pd.read_csv(file)
            for row_idx, row in df.iterrows():
                for col_idx, val in row.items():
                    if pd.notna(val):
                        col_letter = string.ascii_uppercase[df.columns.get_loc(col_idx)]
                        cell_addr = f"{col_letter}{row_idx + 2}"
                        extracted_cells.append(
                            {"content": str(val), "cell_address": cell_addr}
                        )
        except Exception as e:
            raise ValueError(f"Error extracting from CSV: {str(e)}")
        return extracted_cells

ExtractorFactory.register("csv", CSVExtractor)


# -------------------------------------------------------------------------
# Text Extractor
# -------------------------------------------------------------------------
class TextExtractor(BaseExtractor):
    def extract(self, file: Union[str, bytes, io.BytesIO], **kwargs) -> List[Dict[str, Any]]:
        if hasattr(file, "read"):
            content = file.read().decode("utf-8")
        elif isinstance(file, bytes):
            content = file.decode("utf-8")
        else:
            content = file

        max_chunk_size = kwargs.get("max_chunk_size", 2000)
        lines = content.splitlines()

        chunks = []
        chunk = ""
        start_line = 1

        for line_num, line in enumerate(lines, start=1):
            if len(chunk) + len(line) <= max_chunk_size:
                chunk += line + "\n"
            else:
                chunks.append(
                    {
                        "content": chunk.strip(),
                        "metadata": {"start_line": start_line, "end_line": line_num - 1},
                    }
                )
                chunk = line + "\n"
                start_line = line_num

        if chunk:
            chunks.append(
                {
                    "content": chunk.strip(),
                    "metadata": {"start_line": start_line, "end_line": line_num},
                }
            )

        return chunks

ExtractorFactory.register("txt", TextExtractor)


# -------------------------------------------------------------------------
# HTML Extractor
# -------------------------------------------------------------------------
class HTMLExtractor(BaseExtractor):
    def extract(self, file: Union[str, bytes, io.BytesIO], **kwargs) -> List[Dict[str, Any]]:
        # 'file' here is expected to be the HTML content string or bytes
        if hasattr(file, "read"):
            content = file.read()
        else:
            content = file
            
        soup = BeautifulSoup(content, "html.parser")
        text = soup.get_text()
        cleaned_text = re.sub(r"\s+", " ", text).strip()
        return [{"content": cleaned_text, "metadata": {}}]

ExtractorFactory.register("html", HTMLExtractor)
