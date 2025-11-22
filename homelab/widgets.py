"""Free API widgets for the dashboard."""
import requests
from functools import lru_cache
from datetime import datetime
import time
import xml.etree.ElementTree as ET
from html import unescape
import re
from threading import Lock
from collections import OrderedDict

# Cache timeout in seconds
CACHE_TIMEOUT = 300  # 5 minutes
MAX_CACHE_SIZE = 50  # Maximum number of cached items
_cache = OrderedDict()
_cache_lock = Lock()


def _get_cached(key: str, fetcher, timeout: int = CACHE_TIMEOUT):
    """Thread-safe time-based cache with LRU eviction."""
    now = time.time()

    with _cache_lock:
        if key in _cache:
            data, timestamp = _cache[key]
            if now - timestamp < timeout:
                # Move to end (most recently used)
                _cache.move_to_end(key)
                return data

    try:
        data = fetcher()
        with _cache_lock:
            _cache[key] = (data, now)
            _cache.move_to_end(key)
            # Evict oldest items if cache is too large
            while len(_cache) > MAX_CACHE_SIZE:
                _cache.popitem(last=False)
        return data
    except Exception:
        # Return stale cache if available
        with _cache_lock:
            if key in _cache:
                return _cache[key][0]
        return None


def get_weather(city: str = "auto", lat: float = None, lon: float = None) -> dict | None:
    """Get weather from Open-Meteo (free, no API key, reliable). Supports lat/lon."""
    if lat is None or lon is None:
        # Default to a location if none provided
        lat, lon = 34.0, -81.0  # Default fallback
        cache_key = f"weather_{city}"
    else:
        cache_key = f"weather_{lat}_{lon}"

    def fetch():
        # Open-Meteo API - free, no API key needed
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,"
            f"weather_code,wind_speed_10m,wind_direction_10m"
            f"&temperature_unit=fahrenheit"
            f"&wind_speed_unit=mph"
            f"&timezone=auto"
        )
        resp = requests.get(url, timeout=10, headers={"User-Agent": "HomelabDashboard/1.0"})
        resp.raise_for_status()
        data = resp.json()

        current = data.get("current", {})
        temp_f = current.get("temperature_2m", 0)
        temp_c = round((temp_f - 32) * 5 / 9, 1)

        # Get location name via reverse geocoding (simple approach)
        city_name = city if city != "auto" else f"{lat:.2f}, {lon:.2f}"

        return {
            "temp_c": str(int(temp_c)),
            "temp_f": str(int(temp_f)),
            "feels_like_c": str(int((current.get("apparent_temperature", temp_f) - 32) * 5 / 9)),
            "condition": _weather_code_to_condition(current.get("weather_code", 0)),
            "humidity": str(int(current.get("relative_humidity_2m", 0))),
            "wind_mph": str(int(current.get("wind_speed_10m", 0))),
            "wind_dir": _wind_degree_to_direction(current.get("wind_direction_10m", 0)),
            "city": city_name,
            "country": "",
            "icon": _weather_code_to_icon(current.get("weather_code", 0)),
        }

    return _get_cached(cache_key, fetch, timeout=600)


def _weather_code_to_condition(code: int) -> str:
    """Convert WMO weather code to human-readable condition."""
    conditions = {
        0: "Clear", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
        45: "Fog", 48: "Depositing Rime Fog",
        51: "Light Drizzle", 53: "Drizzle", 55: "Dense Drizzle",
        56: "Freezing Drizzle", 57: "Dense Freezing Drizzle",
        61: "Slight Rain", 63: "Rain", 65: "Heavy Rain",
        66: "Freezing Rain", 67: "Heavy Freezing Rain",
        71: "Slight Snow", 73: "Snow", 75: "Heavy Snow", 77: "Snow Grains",
        80: "Rain Showers", 81: "Moderate Showers", 82: "Violent Showers",
        85: "Snow Showers", 86: "Heavy Snow Showers",
        95: "Thunderstorm", 96: "Thunderstorm w/ Hail", 99: "Severe Thunderstorm",
    }
    return conditions.get(code, "Unknown")


def _weather_code_to_icon(code: int) -> str:
    """Convert WMO weather code to Font Awesome icon."""
    if code == 0:
        return "fa-sun"
    elif code in [1, 2]:
        return "fa-cloud-sun"
    elif code == 3:
        return "fa-cloud"
    elif code in [45, 48]:
        return "fa-smog"
    elif code in [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]:
        return "fa-cloud-rain"
    elif code in [71, 73, 75, 77, 85, 86]:
        return "fa-snowflake"
    elif code in [95, 96, 99]:
        return "fa-cloud-bolt"
    return "fa-cloud"


def _wind_degree_to_direction(degrees: float) -> str:
    """Convert wind direction degrees to compass direction."""
    directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    idx = int((degrees + 11.25) / 22.5) % 16
    return directions[idx]


def _weather_icon(code: str) -> str:
    """Map weather code to Font Awesome icon."""
    code = str(code)
    icons = {
        "113": "fa-sun",           # Clear/Sunny
        "116": "fa-cloud-sun",     # Partly cloudy
        "119": "fa-cloud",         # Cloudy
        "122": "fa-cloud",         # Overcast
        "143": "fa-smog",          # Mist
        "176": "fa-cloud-rain",    # Patchy rain
        "179": "fa-snowflake",     # Patchy snow
        "182": "fa-cloud-sleet",   # Patchy sleet
        "185": "fa-icicles",       # Patchy freezing drizzle
        "200": "fa-cloud-bolt",    # Thundery outbreaks
        "227": "fa-wind",          # Blowing snow
        "230": "fa-snowflake",     # Blizzard
        "248": "fa-smog",          # Fog
        "260": "fa-smog",          # Freezing fog
        "263": "fa-cloud-rain",    # Patchy light drizzle
        "266": "fa-cloud-rain",    # Light drizzle
        "281": "fa-temperature-low",  # Freezing drizzle
        "284": "fa-icicles",       # Heavy freezing drizzle
        "293": "fa-cloud-rain",    # Patchy light rain
        "296": "fa-cloud-rain",    # Light rain
        "299": "fa-cloud-showers-heavy",  # Moderate rain
        "302": "fa-cloud-showers-heavy",  # Heavy rain
        "305": "fa-cloud-showers-heavy",  # Heavy rain
        "308": "fa-cloud-showers-heavy",  # Heavy rain
        "311": "fa-icicles",       # Light freezing rain
        "314": "fa-icicles",       # Heavy freezing rain
        "317": "fa-snowflake",     # Light sleet
        "320": "fa-snowflake",     # Moderate sleet
        "323": "fa-snowflake",     # Patchy light snow
        "326": "fa-snowflake",     # Light snow
        "329": "fa-snowflake",     # Patchy moderate snow
        "332": "fa-snowflake",     # Moderate snow
        "335": "fa-snowflake",     # Heavy snow
        "338": "fa-snowflake",     # Heavy snow
        "350": "fa-icicles",       # Ice pellets
        "353": "fa-cloud-rain",    # Light rain shower
        "356": "fa-cloud-showers-heavy",  # Heavy rain shower
        "359": "fa-cloud-showers-heavy",  # Torrential rain
        "362": "fa-snowflake",     # Light sleet showers
        "365": "fa-snowflake",     # Heavy sleet showers
        "368": "fa-snowflake",     # Light snow showers
        "371": "fa-snowflake",     # Heavy snow showers
        "374": "fa-icicles",       # Light ice pellet showers
        "377": "fa-icicles",       # Heavy ice pellet showers
        "386": "fa-cloud-bolt",    # Thundery with light rain
        "389": "fa-cloud-bolt",    # Thundery with heavy rain
        "392": "fa-cloud-bolt",    # Thundery with light snow
        "395": "fa-cloud-bolt",    # Heavy snow with thunder
    }
    return icons.get(code, "fa-cloud")


def get_hacker_news(limit: int = 5) -> list[dict] | None:
    """Get top stories from Hacker News (free, no API key)."""
    def fetch():
        # Get top story IDs
        resp = requests.get(
            "https://hacker-news.firebaseio.com/v0/topstories.json",
            timeout=5
        )
        resp.raise_for_status()
        story_ids = resp.json()[:limit]

        stories = []
        for sid in story_ids:
            story_resp = requests.get(
                f"https://hacker-news.firebaseio.com/v0/item/{sid}.json",
                timeout=3
            )
            if story_resp.ok:
                story = story_resp.json()
                stories.append({
                    "title": story.get("title", ""),
                    "url": story.get("url", f"https://news.ycombinator.com/item?id={sid}"),
                    "score": story.get("score", 0),
                    "comments": story.get("descendants", 0),
                    "hn_url": f"https://news.ycombinator.com/item?id={sid}",
                })
        return stories

    return _get_cached("hackernews", fetch, timeout=300)  # 5 min cache


def _time_ago(timestamp: float) -> str:
    """Convert Unix timestamp to human-readable time ago."""
    now = time.time()
    diff = now - timestamp
    if diff < 60:
        return "just now"
    elif diff < 3600:
        mins = int(diff / 60)
        return f"{mins}m ago"
    elif diff < 86400:
        hours = int(diff / 3600)
        return f"{hours}h ago"
    else:
        days = int(diff / 86400)
        return f"{days}d ago"


def get_reddit_top(subreddit: str = "technology", limit: int = 5) -> list[dict] | None:
    """Get top posts from a subreddit (free, no API key for public data)."""
    def fetch():
        url = f"https://www.reddit.com/r/{subreddit}/hot.json?limit={limit + 5}"
        resp = requests.get(
            url,
            timeout=5,
            headers={"User-Agent": "HomelabDashboard/1.0"}
        )
        resp.raise_for_status()
        data = resp.json()

        posts = []
        for item in data.get("data", {}).get("children", []):
            post = item.get("data", {})
            if post.get("stickied"):
                continue
            created = post.get("created_utc", 0)
            posts.append({
                "title": post.get("title", "")[:100],
                "url": post.get("url", ""),
                "score": post.get("score", 0),
                "comments": post.get("num_comments", 0),
                "subreddit": post.get("subreddit", subreddit),
                "reddit_url": f"https://reddit.com{post.get('permalink', '')}",
                "time_ago": _time_ago(created) if created else "",
            })
        return posts[:limit]

    return _get_cached(f"reddit_{subreddit}", fetch, timeout=300)


def get_crypto_prices(coins: list[str] = None) -> list[dict] | None:
    """Get crypto prices from CoinGecko (free, no API key for basic)."""
    if coins is None:
        coins = ["bitcoin", "ethereum"]

    def fetch():
        ids = ",".join(coins)
        url = f"https://api.coingecko.com/api/v3/simple/price?ids={ids}&vs_currencies=usd&include_24hr_change=true"
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        data = resp.json()

        result = []
        for coin in coins:
            if coin in data:
                result.append({
                    "id": coin,
                    "name": coin.capitalize(),
                    "price": data[coin].get("usd", 0),
                    "change_24h": round(data[coin].get("usd_24h_change", 0), 2),
                })
        return result

    return _get_cached("crypto", fetch, timeout=120)  # 2 min cache


def get_world_headlines(limit: int = 10) -> list[dict] | None:
    """Get world news headlines from various free sources."""
    def fetch():
        headlines = []

        # Try Reddit worldnews
        try:
            resp = requests.get(
                "https://www.reddit.com/r/worldnews/hot.json?limit=15",
                timeout=5,
                headers={"User-Agent": "HomelabDashboard/1.0"}
            )
            if resp.ok:
                data = resp.json()
                for item in data.get("data", {}).get("children", []):
                    post = item.get("data", {})
                    if not post.get("stickied") and post.get("score", 0) > 1000:
                        # Get the actual article URL, not Reddit link
                        url = post.get("url", "")
                        if not url or "reddit.com" in url:
                            url = f"https://reddit.com{post.get('permalink', '')}"
                        headlines.append({
                            "title": post.get("title", "")[:120],
                            "url": url,
                            "source": "Reddit",
                        })
        except Exception:
            pass

        # Try HN for tech news
        try:
            resp = requests.get(
                "https://hacker-news.firebaseio.com/v0/topstories.json",
                timeout=5
            )
            if resp.ok:
                for sid in resp.json()[:5]:
                    story_resp = requests.get(
                        f"https://hacker-news.firebaseio.com/v0/item/{sid}.json",
                        timeout=3
                    )
                    if story_resp.ok:
                        story = story_resp.json()
                        if story.get("score", 0) > 100:
                            # Get story URL or fallback to HN comments
                            url = story.get("url", f"https://news.ycombinator.com/item?id={sid}")
                            headlines.append({
                                "title": story.get("title", "")[:120],
                                "url": url,
                                "source": "HN",
                            })
        except Exception:
            pass

        return headlines[:limit] if headlines else None

    return _get_cached("headlines", fetch, timeout=300)


def get_usgs_earthquakes(min_magnitude: float = 4.5) -> list[dict] | None:
    """Get recent significant earthquakes from USGS (free, no API key)."""
    def fetch():
        # USGS provides various feeds - using significant earthquakes from past day
        url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson"
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        quakes = []
        for feature in data.get("features", []):
            props = feature.get("properties", {})
            coords = feature.get("geometry", {}).get("coordinates", [0, 0, 0])
            mag = props.get("mag", 0)

            if mag and mag >= min_magnitude:
                # Convert timestamp
                ts = props.get("time", 0)
                dt = datetime.fromtimestamp(ts / 1000) if ts else None

                quakes.append({
                    "magnitude": round(mag, 1),
                    "place": props.get("place", "Unknown location"),
                    "time": dt.strftime("%H:%M UTC") if dt else "Unknown",
                    "date": dt.strftime("%Y-%m-%d") if dt else "Unknown",
                    "depth_km": round(coords[2], 1) if len(coords) > 2 else 0,
                    "url": props.get("url", ""),
                    "alert": props.get("alert"),  # green, yellow, orange, red
                    "tsunami": props.get("tsunami", 0),
                    "felt": props.get("felt", 0),  # Number of felt reports
                })

        # Sort by magnitude descending
        quakes.sort(key=lambda x: x["magnitude"], reverse=True)
        return quakes[:10]

    return _get_cached("usgs_earthquakes", fetch, timeout=120)  # 2 min cache


def get_gdacs_alerts() -> list[dict] | None:
    """Get disaster alerts from GDACS RSS feed (UN/EU system, free)."""
    def fetch():
        url = "https://www.gdacs.org/xml/rss.xml"
        resp = requests.get(url, timeout=10, headers={"User-Agent": "HomelabDashboard/1.0"})
        resp.raise_for_status()

        # Parse RSS XML
        root = ET.fromstring(resp.content)
        alerts = []

        for item in root.findall(".//item"):
            title = item.findtext("title", "")
            description = item.findtext("description", "")
            link = item.findtext("link", "")
            pub_date = item.findtext("pubDate", "")

            # Extract alert level from title or description (Red, Orange, Green)
            alert_level = "green"
            title_lower = title.lower()
            if "red" in title_lower or "red alert" in description.lower():
                alert_level = "red"
            elif "orange" in title_lower or "orange alert" in description.lower():
                alert_level = "orange"
            elif "green" in title_lower:
                alert_level = "green"

            # Detect event type
            event_type = "unknown"
            for t in ["earthquake", "flood", "cyclone", "tsunami", "volcano", "drought"]:
                if t in title_lower or t in description.lower():
                    event_type = t
                    break

            # Clean description
            clean_desc = unescape(re.sub(r'<[^>]+>', '', description))[:200]

            alerts.append({
                "title": title,
                "description": clean_desc,
                "link": link,
                "pub_date": pub_date,
                "alert_level": alert_level,
                "event_type": event_type,
            })

        return alerts[:10]

    return _get_cached("gdacs_alerts", fetch, timeout=300)  # 5 min cache


def get_threat_status() -> dict:
    """
    Aggregate threat data from multiple sources.
    Returns threat level and active alerts.
    """
    def fetch():
        threats = {
            "level": "DEFCON 5",
            "level_num": 5,
            "status": "NOMINAL",
            "color": "green",
            "earthquakes": [],
            "disasters": [],
            "alerts_count": 0,
        }

        # Get earthquake data
        try:
            quakes = get_usgs_earthquakes(min_magnitude=4.5)
            if quakes:
                threats["earthquakes"] = quakes[:5]
                # Check for major quakes
                major_quakes = [q for q in quakes if q["magnitude"] >= 6.0]
                if major_quakes:
                    threats["level_num"] = min(threats["level_num"], 3)
                    for q in major_quakes:
                        if q["magnitude"] >= 7.0:
                            threats["level_num"] = min(threats["level_num"], 2)
        except Exception as e:
            print(f"Error fetching earthquakes: {e}")

        # Get GDACS disaster alerts
        try:
            gdacs = get_gdacs_alerts()
            if gdacs:
                threats["disasters"] = gdacs[:5]
                # Check for red/orange alerts
                red_alerts = [a for a in gdacs if a["alert_level"] == "red"]
                orange_alerts = [a for a in gdacs if a["alert_level"] == "orange"]

                if red_alerts:
                    threats["level_num"] = min(threats["level_num"], 2)
                elif orange_alerts:
                    threats["level_num"] = min(threats["level_num"], 3)

                threats["alerts_count"] = len(red_alerts) + len(orange_alerts)
        except Exception as e:
            print(f"Error fetching GDACS: {e}")

        # Set threat level based on aggregated data
        level_map = {
            5: ("DEFCON 5", "NOMINAL", "green"),
            4: ("DEFCON 4", "ELEVATED", "blue"),
            3: ("DEFCON 3", "INCREASED", "yellow"),
            2: ("DEFCON 2", "HIGH", "orange"),
            1: ("DEFCON 1", "MAXIMUM", "red"),
        }

        level_info = level_map.get(threats["level_num"], level_map[5])
        threats["level"] = level_info[0]
        threats["status"] = level_info[1]
        threats["color"] = level_info[2]

        return threats

    return _get_cached("threat_status", fetch, timeout=120)  # 2 min cache


def get_reliefweb_reports(limit: int = 5) -> list[dict] | None:
    """Get humanitarian/disaster reports from ReliefWeb API (UN OCHA, free)."""
    def fetch():
        url = "https://api.reliefweb.int/v1/reports"
        params = {
            "appname": "homelab-dashboard",
            "limit": limit,
            "filter[field]": "primary_country.iso3",
            "sort[]": "date:desc",
            "fields[include][]": ["title", "url", "date.created", "primary_country.name", "source.name", "disaster_type.name"],
        }

        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        reports = []
        for item in data.get("data", []):
            fields = item.get("fields", {})
            reports.append({
                "title": fields.get("title", "")[:100],
                "url": fields.get("url", ""),
                "country": fields.get("primary_country", {}).get("name", "Global"),
                "source": fields.get("source", [{}])[0].get("name", "Unknown") if fields.get("source") else "Unknown",
                "disaster_type": fields.get("disaster_type", [{}])[0].get("name", "") if fields.get("disaster_type") else "",
            })

        return reports

    return _get_cached("reliefweb", fetch, timeout=600)  # 10 min cache
