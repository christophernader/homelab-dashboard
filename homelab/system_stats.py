import psutil


def system_stats() -> dict:
    mem = psutil.virtual_memory()
    cpu_percent = psutil.cpu_percent(interval=None)
    return {
        "cpu_percent": round(cpu_percent, 1),
        "mem_percent": round(mem.percent, 1),
        "mem_used": mem.used,
        "mem_total": mem.total,
    }


def human_bytes(num: int) -> str:
    step_unit = 1024.0
    units = ["B", "KB", "MB", "GB", "TB", "PB"]
    for unit in units:
        if num < step_unit:
            return f"{num:.1f} {unit}"
        num /= step_unit
    return f"{num:.1f} EB"
