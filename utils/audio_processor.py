import yt_dlp
from pydub import AudioSegment
import os

DOWNLOAD_DIR = 'downloades'
os.makedirs(DOWNLOAD_DIR,exist_ok = True)

import time
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=2, max=10),
    retry=retry_if_exception_type(Exception),
    reraise=True
)
def download_youtube_audio(url :str) ->str:
    output_path = os.path.join(DOWNLOAD_DIR, "%(title)s.%(ext)s")
    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_path,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
                "preferredquality": "192",
            }
        ],
        "quiet": True,
        "extractor_args": {"youtube": ["player_client=android"]}, # Bypasses 403 without locking browser cookies
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info).replace(".webm", ".wav").replace(".m4a", ".wav")
        return filename
    except yt_dlp.utils.DownloadError as e:
        if "403" in str(e):
            print("HTTP Error 403 Forbidden. Retrying with backoff...")
        raise Exception(f"YouTube download failed: {str(e)}")



def convert_to_wav(input_path: str) -> str:
    """Convert any audio/video file to 16kHz mono WAV format using ffmpeg CLI to save RAM."""
    output_path = os.path.splitext(input_path)[0] + "_converted.wav"
    
    # Run ffmpeg command directly
    # -i input
    # -ac 1 (mono)
    # -ar 16000 (16kHz)
    # -y (overwrite)
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
    """Chunks the wav file into smaller pieces using ffmpeg without loading it all in RAM."""
    import subprocess
    import math
    
    chunk_secs = chunk_minutes * 60
    
    # First get total duration using ffprobe
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
    if source.startswith("http://") or source.startswith("https://"):
        print("Detected YouTube URL. Downloading audio...")
        wav_path = download_youtube_audio(source)
    else:
        print("Detected local file. Converting to WAV...")
        wav_path = convert_to_wav(source)

    print("Chunking audio...")
    chunks = chunk_audio(wav_path)
    print(f"Audio ready — {len(chunks)} chunk(s) created.")
    return chunks


def cleanup_audio_files(chunk_paths: list):
    """
    Safely delete temporary audio files after transcription is complete.
    Only deletes files that are inside the DOWNLOAD_DIR to prevent
    accidental deletion of user's original files.
    """
    deleted = 0
    parent_files = set()

    for chunk_path in chunk_paths:
        # Collect the parent WAV file path (the original download)
        # Chunks are named like: "original.wav_chunk_0.wav"
        # So the parent is everything before "_chunk_"
        if "_chunk_" in chunk_path:
            parent = chunk_path.rsplit("_chunk_", 1)[0]
            parent_files.add(parent)

        # Only delete if file is inside DOWNLOAD_DIR (safety check)
        abs_chunk = os.path.abspath(chunk_path)
        abs_download = os.path.abspath(DOWNLOAD_DIR)
        if abs_chunk.startswith(abs_download) and os.path.exists(chunk_path):
            try:
                os.remove(chunk_path)
                deleted += 1
            except OSError as e:
                print(f"Warning: Could not delete chunk {chunk_path}: {e}")

    # Delete parent WAV files (only if inside DOWNLOAD_DIR)
    for parent in parent_files:
        abs_parent = os.path.abspath(parent)
        abs_download = os.path.abspath(DOWNLOAD_DIR)
        if abs_parent.startswith(abs_download) and os.path.exists(parent):
            try:
                os.remove(parent)
                deleted += 1
            except OSError as e:
                print(f"Warning: Could not delete parent {parent}: {e}")

    # Also clean up any leftover .webm files from yt-dlp
    for f in os.listdir(DOWNLOAD_DIR):
        if f.endswith(".webm"):
            fpath = os.path.join(DOWNLOAD_DIR, f)
            try:
                os.remove(fpath)
                deleted += 1
            except OSError:
                pass

    print(f"Cleanup complete: {deleted} temporary file(s) deleted.")
