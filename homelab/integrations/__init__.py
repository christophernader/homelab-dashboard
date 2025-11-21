"""Homelab integrations for popular self-hosted apps."""

from .pihole import get_pihole_stats
from .portainer import get_portainer_stats
from .proxmox import get_proxmox_stats
from .speedtest import get_speedtest_results
from .uptime_kuma import get_uptime_kuma_stats

__all__ = [
    'get_pihole_stats',
    'get_portainer_stats',
    'get_proxmox_stats',
    'get_speedtest_results',
    'get_uptime_kuma_stats',
]
