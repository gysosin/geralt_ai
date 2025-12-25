"""
Base Extractor

Abstract base class for all document extractors with built-in logging support.
"""
import logging
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Union
import io


class BaseExtractor(ABC):
    """
    Abstract base class for document extractors.
    
    All extractors should inherit from this class and implement the extract method.
    Provides built-in logging via the `logger` property.
    """
    
    def __init__(self):
        """Initialize the extractor with a logger."""
        self._logger = logging.getLogger(self.__class__.__name__)
    
    @property
    def logger(self) -> logging.Logger:
        """Get the logger for this extractor."""
        return self._logger
    
    @abstractmethod
    def extract(self, file: Union[str, bytes, io.BytesIO], **kwargs) -> List[Dict[str, Any]]:
        """
        Extract content from the given file or source.
        
        Args:
            file: File path, bytes, or BytesIO object
            **kwargs: Additional extraction options
            
        Returns:
            List of dicts with 'content' and 'metadata' keys
            
        Raises:
            ValueError: If extraction fails
        """
        pass
    
    def _log_start(self, source_info: str = "") -> None:
        """Log the start of extraction."""
        self.logger.info(f"Starting extraction{': ' + source_info if source_info else ''}")
    
    def _log_complete(self, count: int, item_type: str = "items") -> None:
        """Log successful extraction completion."""
        self.logger.info(f"Extraction complete: {count} {item_type} extracted")
    
    def _log_error(self, error: Exception, context: str = "") -> None:
        """Log an extraction error."""
        self.logger.error(f"Extraction failed{': ' + context if context else ''}: {error}", exc_info=True)
    
    def _log_warning(self, message: str) -> None:
        """Log a warning during extraction."""
        self.logger.warning(message)
    
    def _log_debug(self, message: str) -> None:
        """Log debug information."""
        self.logger.debug(message)
