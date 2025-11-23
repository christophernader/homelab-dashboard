"""Portainer integration for Docker management stats."""

import requests
from typing import Optional
from ..settings import get_integration_config


def get_portainer_stats(config_override=None) -> Optional[dict]:
    """
    Fetch statistics from Portainer API.

    Requires configuration:
    - portainer_url: Base URL of Portainer (e.g., http://192.168.1.10:9000)
    - portainer_api_key: API key from Portainer
    """
    if config_override:
        config = config_override
    else:
        config = get_integration_config('portainer')
    if not config or not config.get('enabled'):
        return None

    base_url = config.get('url', '').rstrip('/')
    api_key = config.get('api_key', '')

    if not base_url or not api_key:
        return None

    headers = {'X-API-Key': api_key}

    try:
        # Get endpoints (environments)
        endpoints_resp = requests.get(
            f"{base_url}/api/endpoints",
            headers=headers,
            timeout=5,
            verify=False
        )
        endpoints_resp.raise_for_status()
        endpoints = endpoints_resp.json()

        total_containers = 0
        running_containers = 0
        stopped_containers = 0
        total_stacks = 0
        total_volumes = 0
        total_images = 0

        for endpoint in endpoints:
            snapshots = endpoint.get('Snapshots', [])
            if snapshots:
                snap = snapshots[0]
                total_containers += snap.get('TotalCPU', 0) or snap.get('DockerSnapshotRaw', {}).get('Containers', 0)
                running_containers += snap.get('RunningContainerCount', 0)
                stopped_containers += snap.get('StoppedContainerCount', 0)
                total_stacks += snap.get('StackCount', 0)
                total_volumes += snap.get('VolumeCount', 0)
                total_images += snap.get('ImageCount', 0)

        return {
            'endpoints': len(endpoints),
            'total_containers': total_containers,
            'running_containers': running_containers,
            'stopped_containers': stopped_containers,
            'stacks': total_stacks,
            'volumes': total_volumes,
            'images': total_images,
            'status': 'connected',
        }
    except Exception as e:
        return {'error': str(e), 'status': 'error'}
