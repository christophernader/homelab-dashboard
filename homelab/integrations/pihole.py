"""Pi-hole integration for DNS statistics."""

import requests
from typing import Optional
from ..settings import get_integration_config


def get_pihole_stats() -> Optional[dict]:
    """
    Fetch statistics from Pi-hole API.

    Requires configuration:
    - pihole_url: Base URL of Pi-hole (e.g., http://192.168.1.10)
    - pihole_api_key: API key from Pi-hole settings (optional for basic stats)
    """
    config = get_integration_config('pihole')
    if not config or not config.get('enabled'):
        return None

    base_url = config.get('url', '').rstrip('/')
    api_key = config.get('api_key', '')

    if not base_url:
        return None

    try:
        # Build API URL
        api_url = f"{base_url}/admin/api.php"
        params = {'summary': ''}
        if api_key:
            params['auth'] = api_key

        resp = requests.get(api_url, params=params, timeout=5, verify=False)
        resp.raise_for_status()
        data = resp.json()

        return {
            'domains_blocked': int(data.get('domains_being_blocked', 0)),
            'dns_queries_today': int(data.get('dns_queries_today', 0)),
            'ads_blocked_today': int(data.get('ads_blocked_today', 0)),
            'ads_percentage_today': float(data.get('ads_percentage_today', 0)),
            'unique_clients': int(data.get('unique_clients', 0)),
            'queries_cached': int(data.get('queries_cached', 0)),
            'queries_forwarded': int(data.get('queries_forwarded', 0)),
            'status': data.get('status', 'unknown'),
            'gravity_last_updated': data.get('gravity_last_updated', {}).get('relative', {}).get('days', 'N/A'),
        }
    except Exception as e:
        return {'error': str(e), 'status': 'error'}
