"""
Extraction Package Initialization

Imports extractor modules to ensure they are registered with the ExtractorFactory.
"""
from .documents import PDFExtractor, DocxExtractor, PPTXExtractor, ExcelExtractor
from .media import *  # Assuming similar structure
from .text import *   # Assuming similar structure
from .web import *    # Assuming similar structure
