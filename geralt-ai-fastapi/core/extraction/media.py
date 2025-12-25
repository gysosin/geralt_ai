"""
Media Extractors

Extractors for audio, video, and YouTube content using whisper transcription.
"""
import os
import re
import tempfile
import io
import logging
from typing import List, Dict, Any, Union
from uuid import uuid4

import yt_dlp
import moviepy.editor as mp
from pydub import AudioSegment

from core.extraction.base import BaseExtractor
from core.extraction.factory import ExtractorFactory
from config import Config

logger = logging.getLogger(__name__)


def get_openai_client():
    """Get the OpenAI client for Whisper transcription."""
    return Config.OPENAI_CLIENT


# -------------------------------------------------------------------------
# Audio Extractor
# -------------------------------------------------------------------------
class AudioExtractor(BaseExtractor):
    """
    Extract transcription from audio files using Whisper.
    
    Supported formats: MP3, WAV, M4A
    """
    
    def __init__(self):
        super().__init__()
    
    def extract(self, file: Union[str, bytes, io.BytesIO], **kwargs) -> List[Dict[str, Any]]:
        self._log_start("Audio file")
        
        client = get_openai_client()
        if not client:
            raise ValueError("OpenAI client not configured for audio transcription")
        
        try:
            if isinstance(file, bytes):
                file_bytes = file
            elif hasattr(file, "read"):
                file_bytes = file.read()
            else:
                self._log_debug(f"Reading audio from path: {file}")
                with open(file, "rb") as f:
                    file_bytes = f.read()
            
            self.logger.info(f"Audio file size: {len(file_bytes) / 1024:.1f} KB")

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmpf:
                tmpf.write(file_bytes)
                tmpf.flush()

                self._log_debug("Sending audio to Whisper for transcription")
                with open(tmpf.name, "rb") as af:
                    srt_text = client.audio.transcriptions.create(
                        file=af, model="whisper-1", response_format="srt"
                    )

                segs = self._parse_srt(srt_text)
                self.logger.info(f"Transcription complete: {len(segs)} segments")
                
                results = []
                for i, sg in enumerate(segs, start=1):
                    st = sg.get("start")
                    ed = sg.get("end")
                    tx = sg.get("text")
                    if st and ed and tx:
                        results.append({
                            "content": tx,
                            "metadata": {
                                "start_time": st,
                                "end_time": ed,
                                "segment_index": i,
                            },
                        })
                
                self._log_complete(len(results), "segments")
                return results
                
        except Exception as e:
            self._log_error(e, "Audio transcription")
            raise ValueError(f"Audio extraction failed: {str(e)}")

    def _parse_srt(self, srt_text: str) -> List[Dict]:
        """Parse SRT-formatted text into segments."""
        pattern = re.compile(
            r"(\d+)\n"
            r"(\d{2}:\d{2}:\d{2},\d{3})\s-->\s(\d{2}:\d{2}:\d{2},\d{3})\n"
            r"(.*?)(?=\n\n|\Z)",
            re.DOTALL,
        )
        matches = pattern.findall(srt_text + "\n\n")
        segments = []

        for segment_id, start_ts, end_ts, text_block in matches:
            segments.append({
                "id": int(segment_id),
                "start": start_ts.replace(",", "."),
                "end": end_ts.replace(",", "."),
                "text": " ".join(text_block.strip().splitlines()),
            })
        return segments


ExtractorFactory.register("mp3", AudioExtractor)
ExtractorFactory.register("wav", AudioExtractor)
ExtractorFactory.register("m4a", AudioExtractor)


# -------------------------------------------------------------------------
# Video Extractor
# -------------------------------------------------------------------------
class VideoExtractor(BaseExtractor):
    """
    Extract transcription from video files.
    
    Extracts audio track and transcribes using Whisper.
    Supports chunked transcription for long videos.
    """
    
    def __init__(self):
        super().__init__()
    
    def extract(self, file: Union[str, bytes, io.BytesIO], **kwargs) -> List[Dict[str, Any]]:
        self._log_start("Video file")
        
        temp_video_path = None
        audio_path = os.path.join(tempfile.gettempdir(), f"{uuid4()}.mp3")
        own_temp_video = False
        
        try:
            # Handle different input types
            if hasattr(file, "read"):
                with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as vf:
                    vf.write(file.read())
                    temp_video_path = vf.name
                own_temp_video = True
            elif isinstance(file, bytes):
                with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as vf:
                    vf.write(file)
                    temp_video_path = vf.name
                own_temp_video = True
            else:
                temp_video_path = file
            
            self._log_debug(f"Extracting audio from video")
            
            # Extract audio from video
            with mp.VideoFileClip(temp_video_path) as video:
                if video.audio is None:
                    raise ValueError("Video has no audio track")
                
                duration = video.duration
                self.logger.info(f"Video duration: {duration:.1f} seconds")
                video.audio.write_audiofile(audio_path, logger=None)
            
            self._log_debug("Audio extracted, starting transcription")
            
            # Transcribe audio
            srt_text = self._transcribe_audio_in_chunks(audio_path)
            
            if not srt_text:
                raise ValueError("Transcription returned no content")

            segs = self._parse_srt(srt_text)
            self.logger.info(f"Transcription complete: {len(segs)} segments")
            
            # Convert timestamps to seconds
            for sg in segs:
                sg["start"] = self._srt_time_to_seconds(sg["start"])
                sg["end"] = self._srt_time_to_seconds(sg["end"])

            results = []
            for idx, sg in enumerate(segs, start=1):
                st = sg["start"]
                ed = sg["end"]
                tx = sg["text"]
                if st is not None and ed is not None and tx:
                    results.append({
                        "content": tx,
                        "metadata": {
                            "start_time": st,
                            "end_time": ed,
                            "segment_index": idx,
                        },
                    })
            
            self._log_complete(len(results), "segments")
            return results

        except Exception as e:
            self._log_error(e, "Video processing")
            raise ValueError(f"Video extraction failed: {str(e)}")
            
        finally:
            # Cleanup
            if audio_path and os.path.exists(audio_path):
                try:
                    os.remove(audio_path)
                except Exception as cleanup_err:
                    self._log_warning(f"Failed to cleanup audio file: {cleanup_err}")
                    
            if own_temp_video and temp_video_path and os.path.exists(temp_video_path):
                try:
                    os.remove(temp_video_path)
                except Exception as cleanup_err:
                    self._log_warning(f"Failed to cleanup video file: {cleanup_err}")

    def _transcribe_audio_with_whisper_chunk(self, audio_path: str) -> str:
        """Transcribe a single audio chunk."""
        client = get_openai_client()
        if not client:
            raise ValueError("OpenAI client not configured")
            
        try:
            with open(audio_path, "rb") as audio_file:
                tr = client.audio.transcriptions.create(
                    file=audio_file, model="whisper-1", response_format="srt"
                )
                return tr
        except Exception as e:
            self._log_error(e, "Whisper transcription")
            return None

    def _transcribe_audio_in_chunks(self, audio_path: str, chunk_duration_sec: int = 600) -> str:
        """Transcribe long audio by splitting into chunks."""
        try:
            audio = AudioSegment.from_file(audio_path)
            duration_ms = len(audio)
            chunk_size_ms = chunk_duration_sec * 1000

            if duration_ms <= chunk_size_ms:
                self._log_debug("Audio short enough for single transcription")
                return self._transcribe_audio_with_whisper_chunk(audio_path)

            self.logger.info(f"Splitting {duration_ms/1000:.1f}s audio into {chunk_duration_sec}s chunks")
            
            combined_srt_segments = []
            start_ms = 0
            chunk_num = 0
            
            while start_ms < duration_ms:
                chunk_num += 1
                end_ms = min(start_ms + chunk_size_ms, duration_ms)
                sub_clip = audio[start_ms:end_ms]

                tmp_chunk_path = os.path.join(tempfile.gettempdir(), f"{uuid4()}.mp3")
                sub_clip.export(tmp_chunk_path, format="mp3")
                
                self._log_debug(f"Transcribing chunk {chunk_num} ({start_ms/1000:.1f}s - {end_ms/1000:.1f}s)")

                chunk_srt_text = self._transcribe_audio_with_whisper_chunk(tmp_chunk_path)
                
                try:
                    os.remove(tmp_chunk_path)
                except Exception:
                    pass

                if not chunk_srt_text:
                    self._log_warning(f"Chunk {chunk_num} transcription failed")
                    start_ms += chunk_size_ms
                    continue

                segs = self._parse_srt(chunk_srt_text)
                offset_sec = start_ms / 1000.0
                
                for sg in segs:
                    sg["start"] = self._srt_time_to_seconds(sg["start"]) + offset_sec
                    sg["end"] = self._srt_time_to_seconds(sg["end"]) + offset_sec
                combined_srt_segments.extend(segs)

                start_ms += chunk_size_ms

            return self._srt_from_segments(combined_srt_segments)

        except Exception as e:
            self._log_error(e, "Chunked transcription")
            return None

    def _parse_srt(self, srt_text: str) -> List[Dict]:
        """Parse SRT-formatted text into segments."""
        pattern = re.compile(
            r"(\d+)\n"
            r"(\d{2}:\d{2}:\d{2},\d{3})\s-->\s(\d{2}:\d{2}:\d{2},\d{3})\n"
            r"(.*?)(?=\n\n|\Z)",
            re.DOTALL,
        )
        matches = pattern.findall(srt_text + "\n\n")
        segments = []
        for segment_id, start_ts, end_ts, text_block in matches:
            segments.append({
                "id": int(segment_id),
                "start": start_ts.replace(",", "."),
                "end": end_ts.replace(",", "."),
                "text": " ".join(text_block.strip().splitlines()),
            })
        return segments

    def _srt_time_to_seconds(self, srt_time_str) -> float:
        """Convert SRT timestamp to seconds."""
        if isinstance(srt_time_str, (int, float)):
            return float(srt_time_str)
            
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

    def _srt_from_segments(self, segments: List[Dict]) -> str:
        """Generate SRT text from segments."""
        def format_timestamp(seconds: float) -> str:
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


ExtractorFactory.register("mp4", VideoExtractor)
ExtractorFactory.register("mkv", VideoExtractor)
ExtractorFactory.register("avi", VideoExtractor)


# -------------------------------------------------------------------------
# YouTube Extractor
# -------------------------------------------------------------------------
class YoutubeExtractor(BaseExtractor):
    """
    Extract transcription from YouTube videos.
    
    Downloads audio and transcribes using Whisper.
    """
    
    def __init__(self):
        super().__init__()
    
    def extract(self, file: Union[str, bytes], **kwargs) -> List[Dict[str, Any]]:
        if not isinstance(file, str):
            raise ValueError("YoutubeExtractor expects a URL string")
        
        url = file
        self._log_start(f"YouTube video: {url}")
        
        audio_path = None
        
        try:
            # Download audio
            self._log_debug("Downloading audio from YouTube")
            
            ydl_opts = {
                "format": "bestaudio/best",
                "outtmpl": os.path.join(tempfile.gettempdir(), "%(id)s.%(ext)s"),
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }],
                "quiet": True,
                "no_warnings": True,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                vid = info.get("id", None)
                title = info.get("title", "Unknown")
                duration = info.get("duration", 0)
                audio_path = os.path.join(tempfile.gettempdir(), f"{vid}.mp3")
                
                self.logger.info(f"Downloaded: '{title}' ({duration}s)")
            
            # Transcribe using AudioExtractor
            self._log_debug("Starting transcription")
            
            audio_extractor = AudioExtractor()
            results = audio_extractor.extract(audio_path)
            
            # Add YouTube-specific metadata
            for result in results:
                result["metadata"]["youtube_url"] = url
                if title:
                    result["metadata"]["video_title"] = title
            
            self._log_complete(len(results), "segments")
            return results
            
        except Exception as e:
            self._log_error(e, f"YouTube extraction from {url}")
            raise ValueError(f"YouTube extraction failed: {str(e)}")
            
        finally:
            if audio_path and os.path.exists(audio_path):
                try:
                    os.remove(audio_path)
                except Exception as cleanup_err:
                    self._log_warning(f"Failed to cleanup audio file: {cleanup_err}")


ExtractorFactory.register("youtube", YoutubeExtractor)
