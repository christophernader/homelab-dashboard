"""Security and disaster widget data fetching."""
import requests
import xml.etree.ElementTree as ET
from html import unescape
import re
from datetime import datetime
from homelab.utils.cache import get_cached

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

    return get_cached("usgs_earthquakes", fetch, timeout=120)  # 2 min cache


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

    return get_cached("gdacs_alerts", fetch, timeout=300)  # 5 min cache


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

    return get_cached("threat_status", fetch, timeout=120)  # 2 min cache


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

    return get_cached("reliefweb", fetch, timeout=600)  # 10 min cache
