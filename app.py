import os
import json
from datetime import datetime, timezone

import requests
requests.packages.urllib3.disable_warnings()

from flask import Flask, jsonify, render_template, request

from homelab.docker_utils import fetch_containers
from homelab.system_stats import system_stats, human_bytes
from homelab.icon_service import DEFAULT_ICON, icon_payload
from homelab.app_store import apps_with_status, save_app_entry, delete_app, reorder_apps, apply_order
from homelab.widgets import get_weather, get_hacker_news, get_reddit_top, get_crypto_prices, get_world_headlines

app = Flask(__name__)


@app.route("/")
def index():
    containers, docker_error = fetch_containers()
    stats = system_stats()
    apps = apps_with_status()
    return render_template(
        "index.html",
        containers=containers,
        stats=stats,
        docker_error=docker_error,
        human_bytes=human_bytes,
        updated_at=datetime.now(timezone.utc),
        apps=apps,
        default_icon=DEFAULT_ICON,
    )


@app.route("/api/stats")
def api_stats():
    containers, docker_error = fetch_containers()
    stats = system_stats()
    partial = render_template(
        "partials/stats.html",
        containers=containers,
        stats=stats,
        docker_error=docker_error,
        human_bytes=human_bytes,
        updated_at=datetime.now(timezone.utc),
        default_icon=DEFAULT_ICON,
    )
    return partial


@app.route("/api/apps")
def api_apps():
    apps = apps_with_status()
    return render_template("partials/apps.html", apps=apps, default_icon=DEFAULT_ICON)


@app.post("/api/apps/add")
def add_app():
    name = request.form.get("name", "").strip()
    url = request.form.get("url", "").strip()
    icon = request.form.get("icon", "").strip() or DEFAULT_ICON

    if not name or not url:
        error_html = render_template(
            "partials/form_message.html", kind="error", message="Name and URL/IP are required."
        )
        return error_html, 400, {"HX-Retarget": "#form-message", "HX-Reswap": "innerHTML"}

    save_app_entry(name=name, url=url, icon=icon)

    apps = apps_with_status()
    response = render_template("partials/apps.html", apps=apps, default_icon=DEFAULT_ICON)
    return response, 201, {"HX-Trigger": json.dumps({"app_added": name})}


@app.delete("/api/apps/<name>")
def delete_app_route(name: str):
    if delete_app(name):
        apps = apps_with_status()
        return render_template("partials/apps.html", apps=apps, default_icon=DEFAULT_ICON)
    return "Not found", 404


@app.get("/api/icons/search")
def search_icons():
    query = request.args.get("q", "").strip().lower()
    icons = icon_payload(query=query or None, limit=50)
    return render_template("partials/icon_results.html", icons=icons, query=query)


@app.get("/api/widgets/weather")
def widget_weather():
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    city = request.args.get("city", "auto")
    weather = get_weather(city=city, lat=lat, lon=lon)
    return render_template("partials/widget_weather.html", weather=weather, lat=lat, lon=lon)


@app.get("/api/widgets/news")
def widget_news():
    news = get_hacker_news(limit=5)
    return render_template("partials/widget_news.html", news=news)


@app.get("/api/widgets/reddit")
def widget_reddit():
    subreddit = request.args.get("sub", "technology")
    posts = get_reddit_top(subreddit, limit=5)
    return render_template("partials/widget_reddit.html", posts=posts, subreddit=subreddit)


@app.get("/api/widgets/crypto")
def widget_crypto():
    prices = get_crypto_prices()
    return render_template("partials/widget_crypto.html", prices=prices)


@app.get("/api/widgets/headlines")
def widget_headlines():
    headlines = get_world_headlines(limit=10)
    return render_template("partials/widget_headlines.html", headlines=headlines)


@app.post("/api/apps/reorder")
def reorder_apps_route():
    data = request.get_json()
    if not data:
        return "Bad request", 400
    order = data.get("order")
    if isinstance(order, list) and order:
        apply_order(order)
        return "OK", 200

    from_name = data.get("from")
    to_name = data.get("to")
    position = data.get("position", "before")
    if from_name and to_name:
        reorder_apps(from_name, to_name, position)
        return "OK", 200
    return "Bad request", 400


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
