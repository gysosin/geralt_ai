import io
import string
import pandas as pd
from typing import List, Dict, Any, Union
from PIL import Image
import pytesseract

from core.extraction.base import BaseExtractor
from core.extraction.factory import ExtractorFactory

# -------------------------------------------------------------------------
# PDF Extractor
# -------------------------------------------------------------------------
class PDFExtractor(BaseExtractor):
    def extract(self, file: Union[str, bytes, io.BytesIO], **kwargs) -> List[Dict[str, Any]]:
        import fitz  # PyMuPDF

        if isinstance(file, bytes):
            stream = io.BytesIO(file)
        elif isinstance(file, io.BytesIO):
            stream = file
        else:
            stream = open(file, "rb")

        extracted_pages = []
        try:
            # Open PDF
            if isinstance(stream, io.BytesIO):
                 file_bytes = stream.read()
                 doc = fitz.open(stream=file_bytes, filetype="pdf")
            else:
                 doc = fitz.open(stream.name)
            
            # Zoom factor for rendering (2x for quality)
            zoom_matrix = fitz.Matrix(2, 2)
            
            for page_num, page in enumerate(doc):
                # 1. Render page image (snapshot)
                pix = page.get_pixmap(matrix=zoom_matrix)
                img_bytes = pix.tobytes("png")
                img_width, img_height = pix.width, pix.height
                
                # 2. Extract text blocks with bbox coordinates
                # get_text("dict") returns structured text with bounding boxes
                text_dict = page.get_text("dict")
                blocks = text_dict.get("blocks", [])
                
                # 3. OCR fallback if no text blocks
                use_ocr = len(blocks) == 0 or all(
                    len(b.get("lines", [])) == 0 for b in blocks if b.get("type") == 0
                )
                
                if use_ocr:
                    try:
                        pil_img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                        ocr_text = pytesseract.image_to_string(pil_img)
                        if ocr_text.strip():
                            # Create single block for OCR text (no precise bbox available)
                            blocks = [{
                                "type": 0,
                                "bbox": [0, 0, page.rect.width, page.rect.height],
                                "lines": [{
                                    "spans": [{
                                        "text": ocr_text,
                                        "bbox": [0, 0, page.rect.width, page.rect.height]
                                    }]
                                }]
                            }]
                    except Exception:
                        pass
                
                # 4. Process text blocks into chunks
                first_block_of_page = True
                block_idx = 0
                
                for block in blocks:
                    if block.get("type") != 0:  # Skip image blocks
                        continue
                    
                    # Extract all text from this block
                    block_text = ""
                    block_bbox = block.get("bbox", [0, 0, page.rect.width, page.rect.height])
                    
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            block_text += span.get("text", "") + " "
                        block_text += "\n"
                    
                    block_text = block_text.strip()
                    if not block_text:
                        continue
                    
                    block_idx += 1
                    
                    # Convert PDF coordinates to image coordinates (apply zoom)
                    # PyMuPDF bbox: [x0, y0, x1, y1] in PDF units
                    # We need to scale to match rendered image
                    scale_x = zoom_matrix.a  # 2.0
                    scale_y = zoom_matrix.d  # 2.0
                    
                    bbox_scaled = [
                        int(block_bbox[0] * scale_x),
                        int(block_bbox[1] * scale_y),
                        int(block_bbox[2] * scale_x),
                        int(block_bbox[3] * scale_y)
                    ]
                    
                    item = {
                        "content": block_text,
                        "metadata": {
                            "page_number": page_num + 1,
                            "block_index": block_idx,
                            "bbox": bbox_scaled,  # [x0, y0, x1, y1] in image coordinates
                            "image_dimensions": {
                                "width": img_width,
                                "height": img_height
                            }
                        },
                    }
                    
                    # Attach snapshot to first block of page
                    if first_block_of_page:
                        item["_page_image_bytes"] = img_bytes
                        first_block_of_page = False
                    
                    extracted_pages.append(item)
                else: 
                     # If page is essentially empty even after OCR, we might want to skip or just store image?
                     # For Retrieval purpose, if no text, nothing to retrieve.
                     # But we might want to see the image?
                     # Currently we only store chunks for RAG. If no text, no chunks.
                     pass

            doc.close()
            if hasattr(stream, 'close') and stream is not file: # Close if we opened it
                stream.close()

        except Exception as e:
            raise ValueError(f"Error processing PDF: {str(e)}")
            
        return extracted_pages

ExtractorFactory.register("pdf", PDFExtractor)


# -------------------------------------------------------------------------
# DOCX Extractor
# -------------------------------------------------------------------------
class DocxExtractor(BaseExtractor):
    def extract(self, file: Union[str, bytes, io.BytesIO], **kwargs) -> List[Dict[str, Any]]:
        from docx import Document

        if isinstance(file, bytes):
            file = io.BytesIO(file)

        from_page = kwargs.get("from_page", 0)
        to_page = kwargs.get("to_page", 999999999)
        do_ocr = kwargs.get("do_ocr", True)

        results = []
        page_number = 0
        paragraph_counter = 0
        table_counter = 0

        try:
            doc = Document(file)

            # 1) Paragraph text
            for para in doc.paragraphs:
                if page_number >= to_page:
                    break
                runs_text = []
                for run in para.runs:
                    if "lastRenderedPageBreak" in run._element.xml:
                        page_number += 1
                        if page_number >= to_page:
                            break

                    if from_page <= page_number < to_page and run.text.strip():
                        runs_text.append(run.text)

                merged = "".join(runs_text).strip()
                if merged:
                    paragraph_counter += 1
                    results.append(
                        {
                            "content": merged,
                            "metadata": {
                                "page_number": page_number,
                                "paragraph_number": paragraph_counter,
                                "style_name": para.style.name if para.style else None,
                            },
                        }
                    )

            # 2) Tables
            for table in doc.tables:
                table_counter += 1
                row_count = len(table.rows)
                col_count = len(table.columns)
                if row_count == 0 or col_count == 0:
                    continue

                headers = []
                for c_idx in range(col_count):
                    text_h = table.cell(0, c_idx).text.strip()
                    headers.append(text_h)

                for row_idx in range(1, row_count):
                    row_vals = []
                    for c_idx in range(col_count):
                        cell_val = table.cell(row_idx, c_idx).text.strip()
                        header_val = headers[c_idx] if c_idx < len(headers) else ""
                        if header_val or cell_val:
                            row_vals.append(f"{header_val}: {cell_val}".strip(": "))
                    if row_vals:
                        results.append(
                            {
                                "content": "; ".join(row_vals),
                                "metadata": {
                                    "page_number": page_number,
                                    "table_number": table_counter,
                                    "row_number": row_idx,
                                },
                            }
                        )

            # 3) Images + OCR
            if do_ocr:
                for rel in doc.part.rels.values():
                    if "image" in rel.target_ref:
                        try:
                            blob = rel.target_part.blob
                            pil_img = Image.open(io.BytesIO(blob)).convert("L")
                            ocr_text = pytesseract.image_to_string(pil_img)
                            if ocr_text.strip():
                                paragraph_counter += 1
                                results.append(
                                    {
                                        "content": ocr_text.strip(),
                                        "metadata": {
                                            "page_number": page_number,
                                            "paragraph_number": paragraph_counter,
                                            "ocr_extracted": True,
                                        },
                                    }
                                )
                        except Exception:
                            pass

            return results
        except Exception as e:
            raise e

ExtractorFactory.register("docx", DocxExtractor)


# -------------------------------------------------------------------------
# PPTX Extractor
# -------------------------------------------------------------------------
class PPTXExtractor(BaseExtractor):
    def extract(self, file: Union[str, bytes, io.BytesIO], **kwargs) -> List[Dict[str, Any]]:
        from pptx import Presentation
        from pptx.enum.shapes import MSO_SHAPE_TYPE

        if isinstance(file, bytes):
            file = io.BytesIO(file)

        from_slide = kwargs.get("from_slide", 0)
        to_slide = kwargs.get("to_slide", None)

        try:
            pres = Presentation(file)
            total_slides = len(pres.slides)
            to_slide = to_slide or total_slides

            flattened = []
            for slide_num, slide in enumerate(pres.slides, start=1):
                if slide_num < from_slide + 1:
                    continue
                if slide_num > to_slide:
                    break

                sorted_shapes = sorted(
                    slide.shapes, key=lambda s: ((s.top or 0) // 10, (s.left or 0))
                )
                for sh_idx, shape in enumerate(sorted_shapes):
                    if shape.has_text_frame:
                        txt = "\n".join(
                            p.text.strip()
                            for p in shape.text_frame.paragraphs
                            if p.text.strip()
                        )
                        if txt:
                            flattened.append(
                                {
                                    "content": txt,
                                    "metadata": {
                                        "slide_number": slide_num,
                                        "shape_type": str(shape.shape_type),
                                        "shape_index": sh_idx + 1,
                                    },
                                }
                            )
                    elif shape.shape_type == MSO_SHAPE_TYPE.TABLE:
                        table = shape.table
                        row_count = len(table.rows)
                        col_count = len(table.columns)
                        if row_count == 0 or col_count == 0:
                            continue

                        headers = []
                        for c_idx in range(col_count):
                            headers.append(table.cell(0, c_idx).text.strip())

                        table_texts = []
                        for row_i in range(1, row_count):
                            row_vals = []
                            for c_i in range(col_count):
                                hdr = headers[c_i] if c_i < len(headers) else ""
                                cell_txt = table.cell(row_i, c_i).text.strip()
                                if hdr or cell_txt:
                                    row_vals.append(f"{hdr}: {cell_txt}".strip(": "))
                            if row_vals:
                                table_texts.append("; ".join(row_vals))
                        if table_texts:
                            joined_tbl = "\n".join(table_texts)
                            flattened.append(
                                {
                                    "content": joined_tbl,
                                    "metadata": {
                                        "slide_number": slide_num,
                                        "shape_type": "table",
                                        "shape_index": sh_idx + 1,
                                    },
                                }
                            )
                    elif hasattr(shape, "image") and shape.image:
                        try:
                            img_bytes = io.BytesIO(shape.image.blob)
                            pil_img = Image.open(img_bytes).convert("L")
                            ocr_text = pytesseract.image_to_string(pil_img)
                            if ocr_text.strip():
                                flattened.append(
                                    {
                                        "content": ocr_text.strip(),
                                        "metadata": {
                                            "slide_number": slide_num,
                                            "shape_type": "ocr",
                                            "shape_index": sh_idx + 1,
                                        },
                                    }
                                )
                        except Exception:
                            pass
                    elif shape.shape_type == MSO_SHAPE_TYPE.GROUP:
                        sub_texts = []
                        subshapes_sorted = sorted(
                            shape.shapes, key=lambda x: ((x.top or 0) // 10, (x.left or 0))
                        )
                        for sb in subshapes_sorted:
                            try:
                                if sb.has_text_frame:
                                    stxt = "\n".join(
                                        pp.text.strip()
                                        for pp in sb.text_frame.paragraphs
                                        if pp.text.strip()
                                    )
                                    if stxt:
                                        sub_texts.append(stxt)
                            except:
                                pass
                        if sub_texts:
                            flattened.append(
                                {
                                    "content": "\n".join(sub_texts),
                                    "metadata": {
                                        "slide_number": slide_num,
                                        "shape_type": "group",
                                        "shape_index": sh_idx + 1,
                                    },
                                }
                            )
            return flattened
        except Exception as e:
            return []

ExtractorFactory.register("pptx", PPTXExtractor)


# -------------------------------------------------------------------------
# Excel Extractor
# -------------------------------------------------------------------------
class ExcelExtractor(BaseExtractor):
    def extract(self, file: Union[str, bytes, io.BytesIO], **kwargs) -> List[Dict[str, Any]]:
        extracted_cells = []
        try:
            sheets = pd.read_excel(file, sheet_name=None)
            for sheet_name, df in sheets.items():
                for row_idx, row in df.iterrows():
                    for col_idx, value in row.items():
                        if pd.notna(value):
                            col_letter = string.ascii_uppercase[df.columns.get_loc(col_idx)]
                            cell_addr = f"{col_letter}{row_idx + 2}"
                            extracted_cells.append(
                                {
                                    "content": str(value),
                                    "cell_address": cell_addr,
                                    "sheet_name": sheet_name,
                                }
                            )
        except Exception as e:
            raise ValueError(f"Error extracting from Excel: {str(e)}")
        return extracted_cells

ExtractorFactory.register("xlsx", ExcelExtractor)
ExtractorFactory.register("xls", ExcelExtractor)
