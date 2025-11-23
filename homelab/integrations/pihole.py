"""Pi-hole integration for DNS statistics. Supports both v5 and v6 APIs."""

import requests
from typing import Optional
from ..settings import get_integration_config


def get_pihole_stats(config_override=None) -> Optional[dict]:
    """
    Fetch statistics from Pi-hole API.
    Automatically detects v5 or v6 API and uses appropriate method.

    Requires configuration:
    - pihole_url: Base URL of Pi-hole (e.g., http://192.168.1.10)
    - pihole_api_key: Password (v6) or API key (v5)
    """
    if config_override:
        config = config_override
    else:
        config = get_integration_config('pihole')
    if not config or not config.get('enabled'):
        return None

    base_url = config.get('url', '').rstrip('/')
    api_key = config.get('api_key', '')

    if not base_url:
        return None

    # Try v6 API first, fall back to v5
    result = _try_pihole_v6(base_url, api_key)
    if result and result.get('status') != 'error':
        return result

    # Fall back to v5 API
    return _try_pihole_v5(base_url, api_key)


def _try_pihole_v6(base_url: str, password: str) -> Optional[dict]:
    """Try Pi-hole v6 REST API with session authentication."""
    session = requests.Session()
    session.verify = False

    try:
        # Authenticate to get session
        auth_resp = session.post(
            f"{base_url}/api/auth",
            json={"password": password},
            timeout=5
        )

        if auth_resp.status_code != 200:
            return None

        auth_data = auth_resp.json()
        session_info = auth_data.get('session', {})
        if not session_info.get('valid'):
            return None

        # Pi-hole v6 requires X-FTL-SID header for authenticated requests
        sid = session_info.get('sid', '')
        auth_headers = {'X-FTL-SID': sid}

        # Get stats summary
        stats_resp = session.get(f"{base_url}/api/stats/summary", headers=auth_headers, timeout=5)
        stats_resp.raise_for_status()
        data = stats_resp.json()

        # Get gravity info
        gravity_resp = session.get(f"{base_url}/api/info/gravity", headers=auth_headers, timeout=5)
        gravity_data = gravity_resp.json() if gravity_resp.status_code == 200 else {}

        # Get diagnosis info (errors/warnings) from messages endpoint
        messages_resp = session.get(f"{base_url}/api/info/messages", headers=auth_headers, timeout=5)
        messages_data = messages_resp.json() if messages_resp.status_code == 200 else {}

        # Count errors and warnings from messages
        diagnosis_errors = 0
        diagnosis_warnings = 0
        diagnosis_items = []

        # Message types that are errors vs warnings
        error_types = ['CONNECTION_ERROR', 'RATE_LIMIT', 'DATABASE_ERROR', 'GRAVITY_ERROR', 'FATAL']
        warning_types = ['DNSMASQ_WARN', 'WARNING', 'SUBNET', 'HOSTNAME']

        for item in messages_data.get('messages', []):
            msg_type = item.get('type', '').upper()
            message = item.get('plain', '') or item.get('html', '')

            if any(et in msg_type for et in error_types):
                diagnosis_errors += 1
                diagnosis_items.append({'type': 'error', 'message': message})
            else:
                # Treat unknown types as warnings
                diagnosis_warnings += 1
                diagnosis_items.append({'type': 'warning', 'message': message})

        # Logout to free session seat
        try:
            session.delete(f"{base_url}/api/auth", headers=auth_headers, timeout=2)
        except:
            pass

        queries = data.get('queries', {})

        return {
            'domains_blocked': int(data.get('gravity', {}).get('domains_being_blocked', 0)),
            'dns_queries_today': int(queries.get('total', 0)),
            'ads_blocked_today': int(queries.get('blocked', 0)),
            'ads_percentage_today': float(queries.get('percent_blocked', 0)),
            'unique_clients': int(data.get('clients', {}).get('total', 0)),
            'queries_cached': int(queries.get('cached', 0)),
            'queries_forwarded': int(queries.get('forwarded', 0)),
            'status': 'enabled' if data.get('gravity', {}).get('domains_being_blocked', 0) > 0 else 'disabled',
            'gravity_last_updated': gravity_data.get('gravity', {}).get('last_update', {}).get('relative', {}).get('days', 'N/A'),
            'diagnosis_errors': diagnosis_errors,
            'diagnosis_warnings': diagnosis_warnings,
            'diagnosis_items': diagnosis_items,
        }
    except Exception as e:
        return {'error': str(e), 'status': 'error'}
    finally:
        session.close()


def _try_pihole_v5(base_url: str, api_key: str) -> Optional[dict]:
    """Try Pi-hole v5 API (api.php)."""
    try:
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
