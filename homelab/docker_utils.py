import docker
from docker.errors import DockerException
from typing import List, Tuple


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
