import docker
from docker.errors import DockerException
from typing import List, Tuple

from homelab.icon_service import icon_payload, DEFAULT_ICON


def get_icon_url(name: str) -> str:
    """Look up full icon URL from icon service."""
    if not name:
        return DEFAULT_ICON
    # If already a URL, return as-is
    if name.startswith('http'):
        return name
    # Search for icon
    icons = icon_payload(query=name, limit=5)
    for icon in icons:
        if icon['name'].lower() == name.lower():
            return icon['url']
    # Return first match or default
    if icons:
        return icons[0]['url']
    return DEFAULT_ICON


def get_docker_client() -> docker.DockerClient | None:
    try:
        return docker.from_env()
    except (PermissionError, DockerException):
        return None


def fetch_containers() -> Tuple[List[dict], str | None]:
    client = get_docker_client()
    if client is None:
        return [], "Docker socket not accessible. Check permissions or mount /var/run/docker.sock."

    try:
        containers = []
        for container in client.containers.list(all=True):
            containers.append(
                {
                    "id": container.short_id,
                    "name": container.name,
                    "status": container.status,
                    "image": ", ".join(container.image.tags) or container.image.short_id,
                }
            )
        return containers, None
    except PermissionError:
        return [], "Permission denied to access Docker. Run with appropriate privileges or socket mount."
    except DockerException as exc:
        return [], f"Unable to communicate with Docker: {exc}"


def scan_docker_apps() -> List[dict]:
    """Scan Docker containers for potential apps."""
    client = get_docker_client()
    if not client:
        return []

    apps = []
    # Known default ports for common services (fallback for host mode)
    known_ports = {
        'plex': 32400,
        'tautulli': 8181,
        'sonarr': 8989,
        'radarr': 7878,
        'lidarr': 8686,
        'readarr': 8787,
        'prowlarr': 9696,
        'bazarr': 6767,
        'sabnzbd': 8080,
        'transmission': 9091,
        'qbittorrent': 8080,
        'deluge': 8112,
        'portainer': 9000,
        'pihole': 80,
        'adguard': 80,
        'homeassistant': 8123,
        'jellyfin': 8096,
        'emby': 8096,
        'overseerr': 5055,
        'uptime-kuma': 3001,
        'grafana': 3000,
        'prometheus': 9090,
        'audiobookshelf': 13378,
    }

    try:
        for container in client.containers.list():
            labels = container.labels or {}
            
            # Skip if explicitly ignored
            if labels.get('homelab.ignore', '').lower() == 'true':
                continue

            name = labels.get('homelab.name') or container.name.lstrip('/')
            icon = labels.get('homelab.icon')
            url = labels.get('homelab.url')
            port = labels.get('homelab.port')

            # Icon inference
            if not icon:
                pass # User requested to disable auto-detection of icons for now


            # URL inference
            if not url:
                # 1. Try Traefik labels
                for key, value in labels.items():
                    if 'traefik.http.routers' in key and 'rule' in key:
                        if 'Host(' in value:
                            # Extract domain from Host(`example.com`)
                            import re
                            match = re.search(r'Host\(`([^`]+)`\)', value)
                            if match:
                                url = f"https://{match.group(1)}"
                                break
                
                # 2. Try Port Mapping
                if not url:
                    target_port = None
                    
                    # Check manual port override
                    if port:
                        target_port = port
                    
                    # Check known ports if host mode or no mapping found yet
                    elif container.attrs['HostConfig']['NetworkMode'] == 'host':
                        # Try to match container name or image to known ports
                        for key, p in known_ports.items():
                            if key in name.lower() or key in icon.lower():
                                target_port = p
                                break
                    
                    # Check exposed ports (bridge mode)
                    elif not target_port:
                        ports = container.attrs.get('NetworkSettings', {}).get('Ports', {})
                        for p_str, bindings in ports.items():
                            if bindings:
                                # Prefer 80/443/8080/etc if multiple
                                port_num = int(p_str.split('/')[0])
                                target_port = bindings[0]['HostPort']
                                # Heuristic: prefer web ports
                                if port_num in [80, 443, 8080, 8000, 3000, 5000]:
                                    break
                    
                    if target_port:
                        # Assume localhost for now, user can edit IP later
                        url = f"http://localhost:{target_port}"

            if url:
                apps.append({
                    "name": name,
                    "url": url,
                    "icon": get_icon_url(icon),
                    "container_id": container.short_id
                })

    except Exception:
        pass

    return apps
