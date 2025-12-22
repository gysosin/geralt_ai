import time
import re
from typing import List, Dict, Any, Union
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

from core.extraction.base import BaseExtractor
from core.extraction.factory import ExtractorFactory

class WebExtractor(BaseExtractor):
    def extract(self, file: Union[str, bytes], **kwargs) -> List[Dict[str, Any]]:
        # 'file' is expected to be a URL string here
        if not isinstance(file, str):
             raise ValueError("WebExtractor expects a URL string")

        url = file
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")

        driver = webdriver.Chrome(options=chrome_options)
        try:
            driver.get(url)

            scroll_inc = 100
            prev_height = driver.execute_script("return document.body.scrollHeight")

            # Slowly scroll downward
            while True:
                driver.execute_script(f"window.scrollBy(0, {scroll_inc});")
                time.sleep(1)
                cur_height = driver.execute_script("return document.body.scrollHeight")
                if cur_height == prev_height:
                    break
                prev_height = cur_height

            # Return to top, wait a bit
            driver.execute_script("window.scrollTo(0, 0)")
            time.sleep(2)

            html_source = driver.page_source
            soup = BeautifulSoup(html_source, "html.parser")

            # Remove script/style
            for sc_st in soup(["script", "style"]):
                sc_st.extract()

            raw_text = soup.get_text(separator="\n")
            lines = [ln.strip() for ln in raw_text.splitlines()]
            out_chunks = []
            chunk_buf = ""
            max_size = 500

            for ln in lines:
                if ln:
                    if len(chunk_buf) + len(ln) + 1 <= max_size:
                        chunk_buf += " " + ln
                    else:
                        out_chunks.append({"content": chunk_buf.strip(), "metadata": {"source_url": url}})
                        chunk_buf = ln
            if chunk_buf:
                out_chunks.append({"content": chunk_buf.strip(), "metadata": {"source_url": url}})
            
            # Optionally return HTML source if needed by caller, but BaseExtractor returns List[Dict]
            # We can include it in metadata or return as a separate chunk type if needed.
            # For now, following the interface.
            
            return out_chunks
        finally:
            driver.quit()

ExtractorFactory.register("web", WebExtractor)
ExtractorFactory.register("html_url", WebExtractor)
