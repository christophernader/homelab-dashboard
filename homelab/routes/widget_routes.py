"""Widget API routes blueprint."""

from flask import Blueprint, render_template, request

from homelab.widgets import (
    get_weather, get_hacker_news, get_reddit_top, get_crypto_prices,
    get_world_headlines, get_threat_status, get_usgs_earthquakes
)
from homelab.integrations import get_pihole_stats, get_speedtest_results, get_uptime_kuma_stats
from homelab.settings import load_settings

widgets_bp = Blueprint('widgets', __name__)


@widgets_bp.get("/api/widgets/weather")
def widget_weather():
    # First check query params, then fall back to saved settings
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    city = request.args.get("city")

    # If no params provided, use saved location settings
    if lat is None and lon is None and city is None:
        settings = load_settings()
        location = settings.get('location', {})

        if not location.get('use_auto', True):
            # Use manual location settings
            city = location.get('city') or None
            lat_str = location.get('latitude', '')
            lon_str = location.get('longitude', '')
            if lat_str and lon_str:
                try:
                    lat = float(lat_str)
                    lon = float(lon_str)
                except (ValueError, TypeError):
                    pass

    weather = get_weather(city=city or "auto", lat=lat, lon=lon)
    return render_template("partials/widget_weather.html", weather=weather, lat=lat, lon=lon)


@widgets_bp.get("/api/widgets/news")
def widget_news():
    news = get_hacker_news(limit=5)
    return render_template("partials/widget_news.html", news=news)


@widgets_bp.get("/api/widgets/reddit")
def widget_reddit():
    subreddit = request.args.get("sub", "technology")
    posts = get_reddit_top(subreddit, limit=5)
    return render_template("partials/widget_reddit.html", posts=posts, subreddit=subreddit)


@widgets_bp.get("/api/widgets/crypto")
def widget_crypto():
    prices = get_crypto_prices()
    return render_template("partials/widget_crypto.html", prices=prices)


@widgets_bp.get("/api/widgets/headlines")
def widget_headlines():
    headlines = get_world_headlines(limit=10)
    return render_template("partials/widget_headlines.html", headlines=headlines)


@widgets_bp.get("/api/widgets/threats")
def widget_threats():
    threats = get_threat_status()
    return render_template("partials/threats.html", threats=threats)


@widgets_bp.get("/api/widgets/threats-full")
def widget_threats_full():
    threats = get_threat_status()
    return render_template("partials/threats_full.html", threats=threats)


@widgets_bp.get("/api/widgets/weather-bar")
def widget_weather_bar():
    # First check query params, then fall back to saved settings
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    city = request.args.get("city")

    # If no params provided, use saved location settings
    if lat is None and lon is None and city is None:
        settings = load_settings()
        location = settings.get('location', {})

        if not location.get('use_auto', True):
            # Use manual location settings
            city = location.get('city') or None
            lat_str = location.get('latitude', '')
            lon_str = location.get('longitude', '')
            if lat_str and lon_str:
                try:
                    lat = float(lat_str)
                    lon = float(lon_str)
                except (ValueError, TypeError):
                    pass

    weather = get_weather(city=city or "auto", lat=lat, lon=lon)
    return render_template("partials/weather_bar.html", weather=weather)


@widgets_bp.get("/api/widgets/crypto-bar")
def widget_crypto_bar():
    prices = get_crypto_prices(["bitcoin", "ethereum", "solana", "ripple", "cardano", "dogecoin", "polkadot", "avalanche-2"])
    return render_template("partials/crypto_bar.html", prices=prices)


@widgets_bp.get("/api/widgets/news-detailed")
def widget_news_detailed():
    news = get_hacker_news(limit=10)
    return render_template("partials/widget_news_detailed.html", news=news)


@widgets_bp.get("/api/widgets/reddit-detailed")
def widget_reddit_detailed():
    subreddit = request.args.get("sub", "technology")
    posts = get_reddit_top(subreddit, limit=10)
    return render_template("partials/widget_reddit_detailed.html", posts=posts, subreddit=subreddit)


@widgets_bp.get("/api/widgets/earthquakes")
def widget_earthquakes():
    quakes = get_usgs_earthquakes(min_magnitude=4.5)
    return render_template("partials/earthquakes.html", quakes=quakes)


@widgets_bp.get("/api/widgets/pihole")
def widget_pihole():
    """Get Pi-hole stats widget."""
    stats = get_pihole_stats()
    return render_template("partials/widget_pihole.html", pihole=stats)


@widgets_bp.get("/api/widgets/speedtest")
def widget_speedtest():
    """Get Speedtest widget."""
    stats = get_speedtest_results()
    return render_template("partials/widget_speedtest.html", speedtest=stats)


@widgets_bp.get("/api/widgets/uptime-kuma")
def widget_uptime_kuma():
    """Get Uptime Kuma widget."""
    stats = get_uptime_kuma_stats()
    return render_template("partials/widget_uptime_kuma.html", uptime=stats)
