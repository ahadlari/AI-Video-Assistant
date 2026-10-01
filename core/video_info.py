import requests
import re

def strip_emojis(text: str) -> str:
    if not text:
        return text
    return re.sub(r'[^\u0000-\uFFFF]', '', text)

def get_video_metadata(url: str) -> dict:
    """
    Fetches video metadata (thumbnail, title, channel) using YouTube's free OEmbed API.
    This avoids yt-dlp entirely and never gets blocked by 403s.
    """
    if not (url.startswith("http://") or url.startswith("https://")):
        return {
            "title": "Local File",
            "channel": "Unknown",
            "duration": 0,
            "thumbnail": None
        }

    try:
        # YouTube OEmbed API is public and doesn't require keys or cookies
        oembed_url = f"https://www.youtube.com/oembed?url={url}&format=json"
        response = requests.get(oembed_url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            return {
                "title": strip_emojis(data.get("title", "Unknown Title")),
                "channel": strip_emojis(data.get("author_name", "Unknown Channel")),
                "duration": 0, # OEmbed doesn't provide duration
                "thumbnail": data.get("thumbnail_url"),
                "description": "", 
                "tags": []
            }
        else:
            print(f"OEmbed failed with status: {response.status_code}")
            
    except Exception as e:
        print(f"Failed to extract metadata via OEmbed: {e}")

    return {
        "title": "Unknown Title",
        "channel": "Unknown Channel",
        "duration": 0,
        "thumbnail": None,
        "description": "",
        "tags": []
    }
