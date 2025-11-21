import os
import json
import pty
import select
import subprocess
import struct
import fcntl
import termios
from datetime import datetime, timezone
from threading import Thread

import requests
requests.packages.urllib3.disable_warnings()

from flask import Flask, jsonify, render_template, request
from flask_sock import Sock

from homelab.docker_utils import fetch_containers
from homelab.system_stats import system_stats, human_bytes
from homelab.icon_service import DEFAULT_ICON, icon_payload
from homelab.app_store import apps_with_status, save_app_entry, delete_app, reorder_apps, apply_order
from homelab.widgets import (
    get_weather, get_hacker_news, get_reddit_top, get_crypto_prices,
    get_world_headlines, get_threat_status, get_usgs_earthquakes, get_reliefweb_reports
)

app = Flask(__name__)
sock = Sock(app)

# Store active terminal sessions
terminal_sessions = {}


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


@app.get("/api/widgets/threats")
def widget_threats():
    threats = get_threat_status()
    return render_template("partials/threats.html", threats=threats)


@app.get("/api/widgets/threats-full")
def widget_threats_full():
    threats = get_threat_status()
    return render_template("partials/threats_full.html", threats=threats)


@app.get("/api/widgets/weather-bar")
def widget_weather_bar():
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    city = request.args.get("city", "auto")
    weather = get_weather(city=city, lat=lat, lon=lon)
    return render_template("partials/weather_bar.html", weather=weather)


@app.get("/api/widgets/crypto-bar")
def widget_crypto_bar():
    prices = get_crypto_prices(["bitcoin", "ethereum", "solana", "ripple", "cardano", "dogecoin", "polkadot", "avalanche-2"])
    return render_template("partials/crypto_bar.html", prices=prices)


@app.get("/api/widgets/news-detailed")
def widget_news_detailed():
    news = get_hacker_news(limit=10)
    return render_template("partials/widget_news_detailed.html", news=news)


@app.get("/api/widgets/reddit-detailed")
def widget_reddit_detailed():
    subreddit = request.args.get("sub", "technology")
    posts = get_reddit_top(subreddit, limit=10)
    return render_template("partials/widget_reddit_detailed.html", posts=posts, subreddit=subreddit)


@app.get("/api/widgets/earthquakes")
def widget_earthquakes():
    quakes = get_usgs_earthquakes(min_magnitude=4.5)
    return render_template("partials/earthquakes.html", quakes=quakes)


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


@sock.route('/terminal')
def terminal_websocket(ws):
    """WebSocket endpoint for terminal access - cross-platform."""
    import platform
    system = platform.system()

    if system == 'Windows':
        # Windows: Use subprocess with ConPTY or basic pipes
        shell = os.environ.get('COMSPEC', 'cmd.exe')
        try:
            # Try PowerShell first
            process = subprocess.Popen(
                ['powershell.exe', '-NoLogo', '-NoProfile'],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=0,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
            )
        except:
            process = subprocess.Popen(
                [shell],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=0
            )

        def read_and_send():
            """Read from process stdout and send to WebSocket."""
            try:
                while process.poll() is None:
                    output = process.stdout.read(1024)
                    if output:
                        try:
                            ws.send(output.decode('utf-8', errors='replace'))
                        except:
                            break
            except:
                pass

        reader_thread = Thread(target=read_and_send, daemon=True)
        reader_thread.start()

        try:
            while True:
                data = ws.receive()
                if data is None:
                    break
                if not data.startswith('\x1b[8;'):  # Skip resize on Windows
                    process.stdin.write(data.encode('utf-8'))
                    process.stdin.flush()
        except:
            pass
        finally:
            process.terminate()

    else:
        # Unix/macOS: Use PTY for full terminal support
        master_fd, slave_fd = pty.openpty()

        # Get user's default shell with login profile
        shell = os.environ.get('SHELL', '/bin/bash')

        # Build comprehensive environment with user's PATH
        shell_env = os.environ.copy()
        shell_env.update({
            'TERM': 'xterm-256color',
            'COLORTERM': 'truecolor',
            'COLUMNS': '120',
            'LINES': '30',
            'LC_ALL': 'en_US.UTF-8',
            'LANG': 'en_US.UTF-8',
        })
        # Remove variables that interfere with SSH password prompts
        shell_env.pop('SSH_ASKPASS', None)
        shell_env.pop('DISPLAY', None)
        shell_env.pop('SSH_ASKPASS_REQUIRE', None)

        # Function to set up controlling terminal
        def setup_tty():
            os.setsid()
            # Set as controlling terminal
            fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)

        # Spawn interactive login shell to get proper PATH
        process = subprocess.Popen(
            [shell, '-il'],  # -i interactive, -l login shell
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            preexec_fn=setup_tty,
            env=shell_env,
            cwd=os.path.expanduser('~')
        )

        os.close(slave_fd)

        # Set non-blocking
        flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
        fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

        def read_and_send():
            """Read from PTY and send to WebSocket."""
            try:
                while process.poll() is None:
                    try:
                        r, _, _ = select.select([master_fd], [], [], 0.1)
                        if master_fd in r:
                            output = os.read(master_fd, 4096)
                            if output:
                                try:
                                    ws.send(output.decode('utf-8', errors='replace'))
                                except:
                                    break
                    except (OSError, IOError):
                        break
            except:
                pass

        reader_thread = Thread(target=read_and_send, daemon=True)
        reader_thread.start()

        try:
            while True:
                data = ws.receive()
                if data is None:
                    break

                # Handle resize command
                if data.startswith('\x1b[8;'):
                    try:
                        parts = data[4:-1].split(';')
                        rows, cols = int(parts[0]), int(parts[1])
                        winsize = struct.pack('HHHH', rows, cols, 0, 0)
                        fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
                    except:
                        pass
                else:
                    os.write(master_fd, data.encode('utf-8'))
        except:
            pass
        finally:
            process.terminate()
            try:
                process.wait(timeout=1)
            except:
                process.kill()
            os.close(master_fd)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
