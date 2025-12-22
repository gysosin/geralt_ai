from abc import ABC, abstractmethod
from typing import List, Dict, Any, Union
import io

class BaseExtractor(ABC):
    @abstractmethod
    def extract(self, file: Union[str, bytes, io.BytesIO], **kwargs) -> List[Dict[str, Any]]:
        """
        Extract content from the given file or source.
        Returns a list of dicts with 'content' and 'metadata'.
        """
        pass
