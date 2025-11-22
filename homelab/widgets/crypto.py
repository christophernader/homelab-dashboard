"""Crypto widget data fetching."""
import requests
from homelab.utils.cache import get_cached

def get_crypto_prices(coins: list[str] = None) -> list[dict] | None:
    """Get crypto prices from CoinGecko (free, no API key for basic)."""
    if coins is None:
        coins = ["bitcoin", "ethereum"]

    def fetch():
        ids = ",".join(coins)
        url = f"https://api.coingecko.com/api/v3/simple/price?ids={ids}&vs_currencies=usd&include_24hr_change=true"
        resp = requests.get(url, timeout=5)
        resp.raise_for_status()
        data = resp.json()

        result = []
        for coin in coins:
            if coin in data:
                result.append({
                    "id": coin,
                    "name": coin.capitalize(),
                    "price": data[coin].get("usd", 0),
                    "change_24h": round(data[coin].get("usd_24h_change", 0), 2),
                })
        return result

    return get_cached("crypto", fetch, timeout=120)  # 2 min cache
