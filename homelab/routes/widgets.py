"""Widget routes blueprint for all widget endpoints."""

from flask import Blueprint, render_template, request

from homelab.settings import load_settings
from homelab.widgets import (
    get_weather, get_hacker_news, get_reddit_top, get_crypto_prices,
    get_world_headlines, get_threat_status, get_usgs_earthquakes
)
from homelab.integrations import (
    get_pihole_stats, get_speedtest_results, get_uptime_kuma_stats
)

widgets_bp = Blueprint('widgets', __name__)


# ========== WEATHER WIDGETS ==========

@widgets_bp.get("/api/widgets/weather")
def widget_weather():
    """Get weather widget."""
    # First check query params, then fall back to saved settings
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    city = request.args.get("city")

    settings = load_settings()
    location = settings.get('location', {})
    units = location.get('units', 'imperial')

    # If no params provided, use saved location settings
    if lat is None and lon is None and city is None:
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
    return render_template("partials/widget_weather.html", weather=weather, lat=lat, lon=lon, units=units)


@widgets_bp.get("/api/widgets/weather-bar")
def widget_weather_bar():
    """Get weather bar widget."""
    # First check query params, then fall back to saved settings
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    city = request.args.get("city")

    settings = load_settings()
    location = settings.get('location', {})
    units = location.get('units', 'imperial')  # imperial (F) or metric (C)

    # If no params provided, use saved location settings
    if lat is None and lon is None and city is None:
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
    return render_template("partials/weather_bar.html", weather=weather, units=units)


# ========== NEWS WIDGETS ==========

@widgets_bp.get("/api/widgets/news")
def widget_news():
    """Get Hacker News widget."""
    news = get_hacker_news(limit=5)
    return render_template("partials/widget_news.html", news=news)


@widgets_bp.get("/api/widgets/news-detailed")
def widget_news_detailed():
    """Get detailed Hacker News widget."""
    news = get_hacker_news(limit=10)
    return render_template("partials/widget_news_detailed.html", news=news)


@widgets_bp.get("/api/widgets/headlines")
def widget_headlines():
    """Get world headlines widget."""
    headlines = get_world_headlines(limit=10)
    return render_template("partials/widget_headlines.html", headlines=headlines)


# ========== REDDIT WIDGETS ==========

@widgets_bp.get("/api/widgets/reddit")
def widget_reddit():
    """Get Reddit widget."""
    subreddit = request.args.get("sub", "technology")
    posts = get_reddit_top(subreddit, limit=5)
    return render_template("partials/widget_reddit.html", posts=posts, subreddit=subreddit)


@widgets_bp.get("/api/widgets/reddit-detailed")
def widget_reddit_detailed():
    """Get detailed Reddit widget."""
    subreddit = request.args.get("sub", "technology")
    posts = get_reddit_top(subreddit, limit=10)
    return render_template("partials/widget_reddit_detailed.html", posts=posts, subreddit=subreddit)


# ========== CRYPTO WIDGETS ==========

@widgets_bp.get("/api/widgets/crypto")
def widget_crypto():
    """Get crypto prices widget."""
    prices = get_crypto_prices()
    return render_template("partials/widget_crypto.html", prices=prices)


@widgets_bp.get("/api/widgets/crypto-bar")
def widget_crypto_bar():
    """Get crypto bar widget."""
    prices = get_crypto_prices(["bitcoin", "ethereum", "solana", "ripple", "cardano", "dogecoin", "polkadot", "avalanche-2"])
    return render_template("partials/crypto_bar.html", prices=prices)


# ========== SECURITY WIDGETS ==========

@widgets_bp.get("/api/widgets/threats")
def widget_threats():
    """Get threat status widget."""
    threats = get_threat_status()
    return render_template("partials/threats.html", threats=threats)


@widgets_bp.get("/api/widgets/threats-full")
def widget_threats_full():
    """Get full threat status widget."""
    threats = get_threat_status()
    return render_template("partials/threats_full.html", threats=threats)


@widgets_bp.get("/api/widgets/earthquakes")
def widget_earthquakes():
    """Get earthquakes widget."""
    quakes = get_usgs_earthquakes(min_magnitude=4.5)
    return render_template("partials/earthquakes.html", quakes=quakes)


# ========== INTEGRATION WIDGETS ==========

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
