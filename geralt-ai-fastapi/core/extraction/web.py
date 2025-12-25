"""
Web Extractor

Extracts text content from web pages using Selenium for JavaScript rendering.
"""
import time
import re
import logging
from typing import List, Dict, Any, Union
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import WebDriverException, TimeoutException

from core.extraction.base import BaseExtractor
from core.extraction.factory import ExtractorFactory

logger = logging.getLogger(__name__)


class WebExtractor(BaseExtractor):
    """
    Extract text content from web pages.
    
    Uses Selenium for JavaScript rendering and dynamic content loading.
    Scrolls through the page to trigger lazy-loaded content.
    """
    
    def __init__(self):
        super().__init__()
        
    def extract(self, file: Union[str, bytes], **kwargs) -> List[Dict[str, Any]]:
        if not isinstance(file, str):
            raise ValueError("WebExtractor expects a URL string")

        url = file
        self._log_start(f"Web page: {url}")
        
        max_chunk_size = kwargs.get("max_chunk_size", 500)
        scroll_timeout = kwargs.get("scroll_timeout", 30)
        
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")

        driver = None
        try:
            driver = webdriver.Chrome(options=chrome_options)
            driver.set_page_load_timeout(30)
            
            self._log_debug(f"Loading page: {url}")
            driver.get(url)
            
            # Get initial page height
            prev_height = driver.execute_script("return document.body.scrollHeight")
            self.logger.info(f"Initial page height: {prev_height}px")

            # Scroll through the page to load dynamic content
            scroll_inc = 500
            scroll_count = 0
            max_scrolls = scroll_timeout  # Approximate 1 scroll per second
            
            while scroll_count < max_scrolls:
                driver.execute_script(f"window.scrollBy(0, {scroll_inc});")
                time.sleep(1)
                scroll_count += 1
                
                cur_height = driver.execute_script("return document.body.scrollHeight")
                if cur_height == prev_height:
                    self._log_debug(f"Reached end of page after {scroll_count} scrolls")
                    break
                prev_height = cur_height
            
            # Return to top and wait
            driver.execute_script("window.scrollTo(0, 0)")
            time.sleep(1)

            # Extract and parse HTML
            html_source = driver.page_source
            self._log_debug(f"Page source length: {len(html_source)} characters")
            
            soup = BeautifulSoup(html_source, "html.parser")

            # Remove script and style elements
            for element in soup(["script", "style", "nav", "footer", "header"]):
                element.extract()

            # Get text content
            raw_text = soup.get_text(separator="\n")
            lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
            
            self.logger.info(f"Extracted {len(lines)} non-empty lines of text")
            
            # Chunk the text
            out_chunks = []
            chunk_buf = ""

            for ln in lines:
                if len(chunk_buf) + len(ln) + 1 <= max_chunk_size:
                    chunk_buf += " " + ln
                else:
                    if chunk_buf.strip():
                        out_chunks.append({
                            "content": chunk_buf.strip(),
                            "metadata": {"source_url": url}
                        })
                    chunk_buf = ln
                    
            if chunk_buf.strip():
                out_chunks.append({
                    "content": chunk_buf.strip(),
                    "metadata": {"source_url": url}
                })
            
            self._log_complete(len(out_chunks), "text chunks")
            return out_chunks
            
        except TimeoutException as e:
            self._log_error(e, f"Page load timeout for {url}")
            raise ValueError(f"Web page load timeout: {url}")
            
        except WebDriverException as e:
            self._log_error(e, f"WebDriver error for {url}")
            raise ValueError(f"Web extraction failed: {str(e)}")
            
        except Exception as e:
            self._log_error(e, f"Web extraction from {url}")
            raise ValueError(f"Web extraction failed: {str(e)}")
            
        finally:
            if driver:
                try:
                    driver.quit()
                except Exception as quit_err:
                    self._log_warning(f"Failed to cleanup WebDriver: {quit_err}")


ExtractorFactory.register("web", WebExtractor)
ExtractorFactory.register("html_url", WebExtractor)
