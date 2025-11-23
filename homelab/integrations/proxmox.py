"""Proxmox VE integration for virtualization stats."""

import requests
from typing import Optional
from ..settings import get_integration_config


def get_proxmox_stats(config_override=None) -> Optional[dict]:
    """
    Fetch statistics from Proxmox VE API.

    Requires configuration:
    - proxmox_url: Base URL of Proxmox (e.g., https://192.168.1.10:8006)
    - proxmox_user: Username (e.g., root@pam)
    - proxmox_token_name: API token name
    - proxmox_token_secret: API token secret
    """
    if config_override:
        config = config_override
    else:
        config = get_integration_config('proxmox')
    if not config or not config.get('enabled'):
        return None

    base_url = config.get('url', '').rstrip('/')
    user = config.get('user', '')
    token_name = config.get('token_name', '')
    token_secret = config.get('token_secret', '')

    if not all([base_url, user, token_name, token_secret]):
        return None

    headers = {
        'Authorization': f'PVEAPIToken={user}!{token_name}={token_secret}'
    }

    try:
        # Get cluster status
        nodes_resp = requests.get(
            f"{base_url}/api2/json/nodes",
            headers=headers,
            timeout=10,
            verify=False
        )
        nodes_resp.raise_for_status()
        nodes = nodes_resp.json().get('data', [])

        total_vms = 0
        running_vms = 0
        total_containers = 0
        running_containers = 0
        total_cpu_usage = 0
        total_mem_usage = 0
        total_mem = 0
        total_disk_usage = 0
        total_disk = 0

        for node in nodes:
            node_name = node.get('node')

            # Get VMs on this node
            try:
                vms_resp = requests.get(
                    f"{base_url}/api2/json/nodes/{node_name}/qemu",
                    headers=headers,
                    timeout=5,
                    verify=False
                )
                if vms_resp.ok:
                    vms = vms_resp.json().get('data', [])
                    total_vms += len(vms)
                    running_vms += sum(1 for vm in vms if vm.get('status') == 'running')
            except:
                pass

            # Get LXC containers on this node
            try:
                lxc_resp = requests.get(
                    f"{base_url}/api2/json/nodes/{node_name}/lxc",
                    headers=headers,
                    timeout=5,
                    verify=False
                )
                if lxc_resp.ok:
                    lxcs = lxc_resp.json().get('data', [])
                    total_containers += len(lxcs)
                    running_containers += sum(1 for c in lxcs if c.get('status') == 'running')
            except:
                pass

            # Node resources
            total_cpu_usage += node.get('cpu', 0) * 100
            total_mem_usage += node.get('mem', 0)
            total_mem += node.get('maxmem', 0)
            total_disk_usage += node.get('disk', 0)
            total_disk += node.get('maxdisk', 0)

        node_count = len(nodes)
        avg_cpu = total_cpu_usage / node_count if node_count > 0 else 0
        mem_percent = (total_mem_usage / total_mem * 100) if total_mem > 0 else 0
        disk_percent = (total_disk_usage / total_disk * 100) if total_disk > 0 else 0

        return {
            'nodes': node_count,
            'total_vms': total_vms,
            'running_vms': running_vms,
            'total_containers': total_containers,
            'running_containers': running_containers,
            'cpu_usage': round(avg_cpu, 1),
            'memory_usage': round(mem_percent, 1),
            'disk_usage': round(disk_percent, 1),
            'status': 'connected',
        }
    except Exception as e:
        return {'error': str(e), 'status': 'error'}
