"""Free API widgets for the dashboard.
This module now re-exports functions from the homelab.widgets package.
"""

from .weather import get_weather
from .news import get_hacker_news, get_world_headlines
from .social import get_reddit_top
from .crypto import get_crypto_prices
from .security import (
    get_usgs_earthquakes,
    get_gdacs_alerts,
    get_threat_status,
    get_reliefweb_reports
)

__all__ = [
    'get_weather',
    'get_hacker_news',
    'get_world_headlines',
    'get_reddit_top',
    'get_crypto_prices',
    'get_usgs_earthquakes',
    'get_gdacs_alerts',
    'get_threat_status',
    'get_reliefweb_reports'
]
