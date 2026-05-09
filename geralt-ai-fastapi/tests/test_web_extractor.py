"""
Tests for web extraction safety checks.
"""
from unittest.mock import MagicMock

import pytest


def test_web_extractor_rejects_unsafe_url_before_browser(monkeypatch):
    from core.extraction import web
    from core.extraction.web import WebExtractor

    mock_chrome = MagicMock()
    monkeypatch.setattr(web.webdriver, "Chrome", mock_chrome)

    with pytest.raises(ValueError, match="Unsafe URL"):
        WebExtractor().extract("http://127.0.0.1/admin")

    mock_chrome.assert_not_called()
