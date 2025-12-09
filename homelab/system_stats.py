import psutil
import platform
import socket
import os
from datetime import datetime
from homelab.utils.logging_config import get_logger

logger = get_logger(__name__)


def system_stats() -> dict:
    mem = psutil.virtual_memory()
    cpu_percent = psutil.cpu_percent(interval=None)
    return {
        "cpu_percent": round(cpu_percent, 1),
        "mem_percent": round(mem.percent, 1),
        "mem_used": mem.used,
        "mem_total": mem.total,
    }


def system_info() -> dict:
    """Get detailed system information for the loading screen."""
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    boot_time = datetime.fromtimestamp(psutil.boot_time())
    uptime = datetime.now() - boot_time

    # Get CPU info
    cpu_count = psutil.cpu_count(logical=True)
    cpu_physical = psutil.cpu_count(logical=False) or cpu_count

    # Get hostname and IP
    hostname = socket.gethostname()
    try:
        # Get primary IP (not localhost)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip_address = s.getsockname()[0]
        s.close()
    except (OSError, socket.error) as e:
        logger.debug(f"Failed to get IP address: {e}, using localhost")
        ip_address = "127.0.0.1"

    # Format uptime
    days = uptime.days
    hours, remainder = divmod(uptime.seconds, 3600)
    minutes, _ = divmod(remainder, 60)
    if days > 0:
        uptime_str = f"{days}d {hours}h {minutes}m"
    else:
        uptime_str = f"{hours}h {minutes}m"

    return {
        "hostname": hostname,
        "platform": platform.system(),
        "platform_release": platform.release(),
        "architecture": platform.machine(),
        "cpu_cores": cpu_count,
        "cpu_physical": cpu_physical,
        "cpu_percent": round(psutil.cpu_percent(interval=None), 1),
        "ram_total": human_bytes(mem.total),
        "ram_used": human_bytes(mem.used),
        "ram_percent": round(mem.percent, 1),
        "disk_total": human_bytes(disk.total),
        "disk_used": human_bytes(disk.used),
        "disk_percent": round(disk.percent, 1),
        "ip_address": ip_address,
        "uptime": uptime_str,
    }


def human_bytes(num: int) -> str:
    step_unit = 1024.0
    units = ["B", "KB", "MB", "GB", "TB", "PB"]
    for unit in units:
        if num < step_unit:
            return f"{num:.1f} {unit}"
        num /= step_unit
    return f"{num:.1f} EB"
