"""Weather widget data fetching."""
import requests
from homelab.utils.cache import get_cached

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

    return get_cached(cache_key, fetch, timeout=600)


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
