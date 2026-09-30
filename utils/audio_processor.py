from pydub import AudioSegment
import os
import requests
from youtube_transcript_api import YouTubeTranscriptApi
from urllib.parse import urlparse, parse_qs

DOWNLOAD_DIR = 'downloades'
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

def extract_video_id(url: str) -> str:
    """Extracts the video ID from a YouTube URL."""
    parsed_url = urlparse(url)
    if parsed_url.hostname in ['youtu.be']:
        return parsed_url.path[1:]
    if parsed_url.hostname in ['www.youtube.com', 'youtube.com']:
        if parsed_url.path == '/watch':
            return parse_qs(parsed_url.query)['v'][0]
        if parsed_url.path.startswith(('/embed/', '/v/')):
            return parsed_url.path.split('/')[2]
        if parsed_url.path.startswith('/shorts/'):
            return parsed_url.path.split('/')[2]
    return None

def fetch_transcript_api(url: str) -> str:
    """
    OPTION A: Tries to fetch the text transcript directly from YouTube.
    Bypasses download and AI transcription completely.
    Returns the full text if successful, or None if no captions exist.
    """
    video_id = extract_video_id(url)
    if not video_id:
        return None
        
    try:
        # Use instantiation and fetch instead of get_transcript
        transcript_obj = YouTubeTranscriptApi().fetch(video_id, languages=['en', 'hi'])
        text = " ".join([snippet.text for snippet in transcript_obj.snippets])
        return text
    except Exception as e:
        print(f"Transcript API failed or no captions found: {e}")
        return None

def download_youtube_audio_rapidapi(url: str) -> str:
    """
    OPTION B: If Transcript fails, use a RapidAPI YouTube to MP3 downloader.
    (Requires RAPIDAPI_KEY in .env)
    """
    rapidapi_key = os.getenv("RAPIDAPI_KEY")
    if not rapidapi_key:
        raise Exception("RAPIDAPI_KEY is missing. Cannot fallback to audio download.")
        
    # Example using 'Youtube MP3' API from RapidAPI (ytstream-download-youtube-videos)
    # You will need to tell the user which exact API to subscribe to on RapidAPI.
    # For now, this is a placeholder structure for the API call.
    print(f"Fallback to RapidAPI for downloading {url}")
    
    # Placeholder: In reality, you'd make the requests.get() here, save the response.content
    # to a .mp3 file, and return the path.
    raise Exception("RapidAPI download implementation pending user API key selection.")


def convert_to_wav(input_path: str) -> str:
    """Convert any audio/video file to 16kHz mono WAV format using ffmpeg CLI to save RAM."""
    output_path = os.path.splitext(input_path)[0] + "_converted.wav"
    import subprocess
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-ac", "1", "-ar", "16000",
        output_path
    ]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError as e:
        raise Exception(f"Failed to convert audio using ffmpeg: {e}")
    return output_path


def chunk_audio(wav_path: str, chunk_minutes: int = 10) -> list:
    import subprocess
    import math
    chunk_secs = chunk_minutes * 60
    duration_cmd = [
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration", "-of",
        "default=noprint_wrappers=1:nokey=1", wav_path
    ]
    try:
        duration_str = subprocess.check_output(duration_cmd).decode("utf-8").strip()
        total_duration = float(duration_str)
    except Exception as e:
        raise Exception(f"Failed to get audio duration with ffprobe: {e}")

    num_chunks = math.ceil(total_duration / chunk_secs)
    chunks = []
    for i in range(num_chunks):
        start_time = i * chunk_secs
        chunk_path = f"{wav_path}_chunk_{i}.wav"
        cmd = [
            "ffmpeg", "-y", "-i", wav_path,
            "-ss", str(start_time), "-t", str(chunk_secs),
            "-acodec", "copy", chunk_path
        ]
        try:
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            chunks.append(chunk_path)
        except subprocess.CalledProcessError as e:
            raise Exception(f"Failed to create chunk {i} using ffmpeg: {e}")
    return chunks


def process_input(source: str) -> list:
    """Only used for File Uploads or Option B fallback now."""
    if source.startswith("http://") or source.startswith("https://"):
        print("Detected YouTube URL. Downloading audio via RapidAPI...")
        wav_path = download_youtube_audio_rapidapi(source)
    else:
        print("Detected local file. Converting to WAV...")
        wav_path = convert_to_wav(source)

    print("Chunking audio...")
    chunks = chunk_audio(wav_path)
    print(f"Audio ready — {len(chunks)} chunk(s) created.")
    return chunks


def cleanup_audio_files(chunk_paths: list):
    deleted = 0
    parent_files = set()
    for chunk_path in chunk_paths:
        if "_chunk_" in chunk_path:
            parent = chunk_path.rsplit("_chunk_", 1)[0]
            parent_files.add(parent)
        abs_chunk = os.path.abspath(chunk_path)
        abs_download = os.path.abspath(DOWNLOAD_DIR)
        if abs_chunk.startswith(abs_download) and os.path.exists(chunk_path):
            try:
                os.remove(chunk_path)
                deleted += 1
            except OSError as e:
                print(f"Warning: Could not delete chunk {chunk_path}: {e}")

    for parent in parent_files:
        abs_parent = os.path.abspath(parent)
        abs_download = os.path.abspath(DOWNLOAD_DIR)
        if abs_parent.startswith(abs_download) and os.path.exists(parent):
            try:
                os.remove(parent)
                deleted += 1
            except OSError as e:
                print(f"Warning: Could not delete parent {parent}: {e}")

    print(f"Cleanup complete: {deleted} temporary file(s) deleted.")
