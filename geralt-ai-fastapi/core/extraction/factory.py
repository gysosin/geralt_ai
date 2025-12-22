from typing import Dict, Type
from core.extraction.base import BaseExtractor

class ExtractorFactory:
    _extractors: Dict[str, Type[BaseExtractor]] = {}

    @classmethod
    def register(cls, file_type: str, extractor_cls: Type[BaseExtractor]):
        cls._extractors[file_type.lower()] = extractor_cls

    @classmethod
    def get_extractor(cls, file_type: str) -> BaseExtractor:
        extractor_cls = cls._extractors.get(file_type.lower())
        if not extractor_cls:
            # Fallback or specific error handling can be added here
            raise ValueError(f"No extractor registered for file type: {file_type}")
        return extractor_cls()
