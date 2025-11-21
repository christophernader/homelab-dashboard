"""Speedtest integration for network speed monitoring."""

import requests
from typing import Optional
from ..settings import get_integration_config


def get_speedtest_results() -> Optional[dict]:
    """
    Fetch latest speedtest results from Speedtest Tracker.

    Requires configuration:
    - speedtest_url: Base URL of Speedtest Tracker (e.g., http://192.168.1.10:8080)
    - speedtest_api_key: API key (optional, depends on your setup)
    """
    config = get_integration_config('speedtest')
    if not config or not config.get('enabled'):
        return None

    base_url = config.get('url', '').rstrip('/')
    api_key = config.get('api_key', '')

    if not base_url:
        return None

    headers = {}
    if api_key:
        headers['Authorization'] = f'Bearer {api_key}'

    try:
        # Get latest result from Speedtest Tracker
        resp = requests.get(
            f"{base_url}/api/speedtest/latest",
            headers=headers,
            timeout=5,
            verify=False
        )
        resp.raise_for_status()
        data = resp.json().get('data', {})

        download = data.get('download', 0)
        upload = data.get('upload', 0)
        ping = data.get('ping', 0)

        # Convert to Mbps if in bps
        if download > 1000000:
            download = download / 1000000
        if upload > 1000000:
            upload = upload / 1000000

        return {
            'download_mbps': round(download, 2),
            'upload_mbps': round(upload, 2),
            'ping_ms': round(ping, 1),
            'server': data.get('server_name', 'Unknown'),
            'isp': data.get('isp', 'Unknown'),
            'tested_at': data.get('created_at', ''),
            'status': 'connected',
        }
    except Exception as e:
        return {'error': str(e), 'status': 'error'}
