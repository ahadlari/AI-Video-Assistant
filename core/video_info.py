import yt_dlp

def get_video_metadata(url: str) -> dict:
    """
    Fetches video metadata (thumbnail, title, channel, duration) using yt-dlp 
    without actually downloading the video.
    """
    if not (url.startswith("http://") or url.startswith("https://")):
        return {
            "title": "Local File",
            "channel": "Unknown",
            "duration": 0,
            "thumbnail": None
        }

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            return {
                "title": info.get("title", "Unknown Title"),
                "channel": info.get("uploader", "Unknown Channel"),
                "duration": info.get("duration", 0),  # in seconds
                "thumbnail": info.get("thumbnail"),
                "description": info.get("description", ""),
                "tags": info.get("tags", [])
            }
        except Exception as e:
            print(f"Failed to extract metadata: {e}")
            return {
                "title": "Unknown Title",
                "channel": "Unknown Channel",
                "duration": 0,
                "thumbnail": None,
                "description": "",
                "tags": []
            }
