"""Uptime Kuma integration for service monitoring."""

import requests
from typing import Optional
from ..settings import get_integration_config


def get_uptime_kuma_stats() -> Optional[dict]:
    """
    Fetch statistics from Uptime Kuma status page API.

    Requires configuration:
    - uptime_kuma_url: Base URL of Uptime Kuma (e.g., http://192.168.1.10:3001)
    - uptime_kuma_slug: Status page slug (e.g., 'default' or your custom slug)
    """
    config = get_integration_config('uptime_kuma')
    if not config or not config.get('enabled'):
        return None

    base_url = config.get('url', '').rstrip('/')
    slug = config.get('slug', 'default')

    if not base_url:
        return None

    try:
        # Get status page data
        resp = requests.get(
            f"{base_url}/api/status-page/{slug}",
            timeout=5,
            verify=False
        )
        resp.raise_for_status()
        data = resp.json()

        monitors = []
        total_monitors = 0
        up_monitors = 0
        down_monitors = 0
        paused_monitors = 0

        # Parse public group list
        for group in data.get('publicGroupList', []):
            for monitor in group.get('monitorList', []):
                total_monitors += 1
                status = monitor.get('status', 0)

                if status == 1:
                    up_monitors += 1
                    status_text = 'up'
                elif status == 0:
                    down_monitors += 1
                    status_text = 'down'
                else:
                    paused_monitors += 1
                    status_text = 'paused'

                monitors.append({
                    'name': monitor.get('name', 'Unknown'),
                    'status': status_text,
                    'uptime_24h': monitor.get('uptime24', 0),
                })

        # Calculate overall health
        health = (up_monitors / total_monitors * 100) if total_monitors > 0 else 0

        return {
            'total_monitors': total_monitors,
            'up': up_monitors,
            'down': down_monitors,
            'paused': paused_monitors,
            'health_percent': round(health, 1),
            'monitors': monitors[:10],  # Top 10 monitors
            'status': 'connected',
        }
    except Exception as e:
        return {'error': str(e), 'status': 'error'}
