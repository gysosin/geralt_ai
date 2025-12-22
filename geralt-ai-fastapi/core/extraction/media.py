import os
import re
import tempfile
import io
from typing import List, Dict, Any, Union
from uuid import uuid4
from urllib.parse import urlparse, parse_qs

import yt_dlp
import moviepy.editor as mp
from pydub import AudioSegment

from core.extraction.base import BaseExtractor
from core.extraction.factory import ExtractorFactory
from config import Config

# Assuming Config.OPENAI_CLIENT is available, or we use AIProviderFactory
# For simplicity, we'll try to use AIProviderFactory if possible, but 
# the original code used `client.audio.transcriptions.create`.
# If AIProviderFactory doesn't expose raw audio transcription, we might need a direct client.
# Based on previous read, OpenAIProvider doesn't seem to have audio.
# I will use Config.OPENAI_CLIENT directly as in the original code for now, 
# but wrapped safely.

def get_openai_client():
    return Config.OPENAI_CLIENT

# -------------------------------------------------------------------------
# Audio Extractor
# -------------------------------------------------------------------------
class AudioExtractor(BaseExtractor):
    def extract(self, file: Union[str, bytes, io.BytesIO], **kwargs) -> List[Dict[str, Any]]:
        client = get_openai_client()
        
        try:
            if isinstance(file, bytes):
                file_bytes = file
            elif hasattr(file, "read"):
                file_bytes = file.read()
            else:
                # File path string?
                with open(file, "rb") as f:
                    file_bytes = f.read()

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmpf:
                tmpf.write(file_bytes)
                tmpf.flush()

                # Single-chunk transcription
                with open(tmpf.name, "rb") as af:
                    srt_text = client.audio.transcriptions.create(
                        file=af, model="whisper-1", response_format="srt"
                    )

                segs = self._parse_srt(srt_text)
                results = []
                for i, sg in enumerate(segs, start=1):
                    st = sg.get("start")
                    ed = sg.get("end")
                    tx = sg.get("text")
                    if st and ed and tx:
                        results.append(
                            {
                                "content": tx,
                                "start_time": st,
                                "end_time": ed,
                                "metadata": {"segment_index": i},
                            }
                        )
                return results
        except Exception as e:
            # logging.error(f"Audio extraction failed: {e}")
            return []

    def _parse_srt(self, srt_text):
        """
        Given SRT-formatted text, parse into a list of dicts with 'id', 'start', 'end', and 'text'.
        """
        pattern = re.compile(
            r"(\d+)\n"
            r"(\d{2}:\d{2}:\d{2},\d{3})\s-->\s(\d{2}:\d{2}:\d{2},\d{3})\n"
            r"(.*?)(?=\n\n|\Z)",
            re.DOTALL,
        )
        matches = pattern.findall(srt_text + "\n\n")
        segments = []

        for segment_id, start_ts, end_ts, text_block in matches:
            segments.append(
                {
                    "id": int(segment_id),
                    "start": start_ts.replace(",", "."),
                    "end": end_ts.replace(",", "."),
                    "text": " ".join(text_block.strip().splitlines()),
                }
            )
        return segments

ExtractorFactory.register("mp3", AudioExtractor)
ExtractorFactory.register("wav", AudioExtractor)
ExtractorFactory.register("m4a", AudioExtractor)


# -------------------------------------------------------------------------
# Video Extractor
# -------------------------------------------------------------------------
class VideoExtractor(BaseExtractor):
    def extract(self, file: Union[str, bytes, io.BytesIO], **kwargs) -> List[Dict[str, Any]]:
        # Need to handle file input properly for moviepy
        # MoviePy usually needs a file path.
        
        temp_video_path = None
        audio_path = os.path.join(tempfile.gettempdir(), f"{uuid4()}.mp3")
        
        try:
            if hasattr(file, "read"):
                with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as vf:
                    vf.write(file.read())
                    temp_video_path = vf.name
            elif isinstance(file, bytes):
                with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as vf:
                    vf.write(file)
                    temp_video_path = vf.name
            else:
                # Assume it's a path
                temp_video_path = file

            with mp.VideoFileClip(temp_video_path) as video:
                if video.audio is None:
                    raise ValueError("Video has no audio track.")
                video.audio.write_audiofile(audio_path, logger=None)
            
            # Now transcribe audio_path
            # We can use AudioExtractor logic or the chunk logic if it's long
            # Using chunk logic from original helper:
            srt_text = self._transcribe_audio_in_chunks(audio_path)
            
            if not srt_text:
                return []

            segs = self._parse_srt(srt_text)
            for sg in segs:
                sg["start"] = self._srt_time_to_seconds(sg["start"])
                sg["end"] = self._srt_time_to_seconds(sg["end"])

            result = []
            for idx, sg in enumerate(segs, start=1):
                st = sg["start"]
                ed = sg["end"]
                tx = sg["text"]
                if st is not None and ed is not None and tx:
                    result.append(
                        {
                            "content": tx,
                            "start_time": st,
                            "end_time": ed,
                            "metadata": {"segment_index": idx},
                        }
                    )
            return result

        except Exception as e:
            # logging.error(f"Video extraction failed: {e}")
            return []
        finally:
            if audio_path and os.path.exists(audio_path):
                os.remove(audio_path)
            if temp_video_path and os.path.exists(temp_video_path) and temp_video_path != file:
                os.remove(temp_video_path)

    def _transcribe_audio_with_whisper_chunk(self, audio_path):
        client = get_openai_client()
        try:
            with open(audio_path, "rb") as audio_file:
                tr = client.audio.transcriptions.create(
                    file=audio_file, model="whisper-1", response_format="srt"
                )
                return tr
        except Exception:
            return None

    def _transcribe_audio_in_chunks(self, audio_path, chunk_duration_sec=600):
        try:
            audio = AudioSegment.from_file(audio_path)
            duration_ms = len(audio)
            chunk_size_ms = chunk_duration_sec * 1000

            if duration_ms <= chunk_size_ms:
                return self._transcribe_audio_with_whisper_chunk(audio_path)

            combined_srt_segments = []
            start_ms = 0
            while start_ms < duration_ms:
                end_ms = min(start_ms + chunk_size_ms, duration_ms)
                sub_clip = audio[start_ms:end_ms]

                tmp_chunk_path = os.path.join(tempfile.gettempdir(), f"{uuid4()}.mp3")
                sub_clip.export(tmp_chunk_path, format="mp3")

                chunk_srt_text = self._transcribe_audio_with_whisper_chunk(tmp_chunk_path)
                os.remove(tmp_chunk_path)

                if not chunk_srt_text:
                    return None

                segs = self._parse_srt(chunk_srt_text)
                offset_sec = start_ms / 1000.0
                for sg in segs:
                    sg["start"] = self._srt_time_to_seconds(sg["start"]) + offset_sec
                    sg["end"] = self._srt_time_to_seconds(sg["end"]) + offset_sec
                combined_srt_segments.extend(segs)

                start_ms += chunk_size_ms

            return self._srt_from_segments(combined_srt_segments)

        except Exception as e:
            return None

    def _parse_srt(self, srt_text):
        pattern = re.compile(
            r"(\d+)\n"
            r"(\d{2}:\d{2}:\d{2},\d{3})\s-->\s(\d{2}:\d{2}:\d{2},\d{3})\n"
            r"(.*?)(?=\n\n|\Z)",
            re.DOTALL,
        )
        matches = pattern.findall(srt_text + "\n\n")
        segments = []
        for segment_id, start_ts, end_ts, text_block in matches:
            segments.append(
                {
                    "id": int(segment_id),
                    "start": start_ts.replace(",", "."),
                    "end": end_ts.replace(",", "."),
                    "text": " ".join(text_block.strip().splitlines()),
                }
            )
        return segments

    def _srt_time_to_seconds(self, srt_time_str):
        if isinstance(srt_time_str, float):
            return srt_time_str
        srt_time_str = srt_time_str.replace(",", ".")
        parts = srt_time_str.split(":")
        if len(parts) != 3:
            return 0.0

        hours, minutes, sec_millis = parts
        if "." in sec_millis:
            sec, millis = sec_millis.split(".")
        else:
            sec, millis = sec_millis, "0"

        total_seconds = (
            int(hours) * 3600 + int(minutes) * 60 + int(sec) + float(millis) / 1000.0
        )
        return total_seconds

    def _srt_from_segments(self, segments):
        def format_timestamp(seconds):
            hrs = int(seconds // 3600)
            mins = int((seconds % 3600) // 60)
            secs = int(seconds % 60)
            millis = int((seconds - int(seconds)) * 1000)
            return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"

        lines = []
        for i, seg in enumerate(segments, start=1):
            start_str = format_timestamp(seg["start"])
            end_str = format_timestamp(seg["end"])
            text = seg["text"]
            lines.append(str(i))
            lines.append(f"{start_str} --> {end_str}")
            lines.append(text)
            lines.append("")
        return "\n".join(lines)


        return "\n".join(lines)


ExtractorFactory.register("mp4", VideoExtractor)
ExtractorFactory.register("mkv", VideoExtractor)
ExtractorFactory.register("avi", VideoExtractor)


# -------------------------------------------------------------------------
# YouTube Extractor
# -------------------------------------------------------------------------
class YoutubeExtractor(BaseExtractor):
    def extract(self, file: Union[str, bytes], **kwargs) -> List[Dict[str, Any]]:
        if not isinstance(file, str):
            raise ValueError("YoutubeExtractor expects a URL string")
        
        url = file
        audio_path = None
        
        try:
            # Download audio
            ydl_opts = {
                "format": "bestaudio/best",
                "outtmpl": os.path.join(tempfile.gettempdir(), "%(id)s.%(ext)s"),
                "postprocessors": [
                    {
                        "key": "FFmpegExtractAudio",
                        "preferredcodec": "mp3",
                        "preferredquality": "192",
                    }
                ],
                "quiet": True,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                vid = info.get("id", None)
                audio_path = os.path.join(tempfile.gettempdir(), f"{vid}.mp3")
            
            # Transcribe
            # We can reuse AudioExtractor logic if we can instantiate it or extract the method
            # For simplicity, I'll instantiate AudioExtractor
            audio_extractor = AudioExtractor()
            results = audio_extractor.extract(audio_path)
            
            return results
            
        except Exception as e:
            # logging.error(f"YouTube extraction failed: {e}")
            return []
        finally:
            if audio_path and os.path.exists(audio_path):
                os.remove(audio_path)

ExtractorFactory.register("youtube", YoutubeExtractor)

