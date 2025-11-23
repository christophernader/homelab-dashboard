"""Audiobookshelf integration for recent books and stats."""

import requests
from typing import Optional, List, Dict, Any
from ..settings import get_integration_config, load_settings


def get_audiobookshelf_stats(config_override=None) -> Optional[Dict[str, Any]]:
    """Get Audiobookshelf statistics."""
    if config_override:
        config = config_override
    else:
        settings = load_settings()
        config = settings.get('integrations', {}).get('audiobookshelf', {})
    if not config or not config.get('enabled'):
        return None

    base_url = config.get('url', '').rstrip('/')
    api_key = config.get('api_key', '')

    if not base_url or not api_key:
        return None

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    try:
        # 1. Get Libraries to find the first audiobook library
        libs_resp = requests.get(f"{base_url}/api/libraries", headers=headers, timeout=5)
        libs_resp.raise_for_status()
        libraries = libs_resp.json().get('libraries', [])

        audiobook_lib = next((lib for lib in libraries if lib.get('mediaType') == 'book'), None)
        
        recent_books = []
        total_books = 0
        total_duration = 0

        if audiobook_lib:
            lib_id = audiobook_lib['id']
            
            # 2. Get recent books
            items_resp = requests.get(
                f"{base_url}/api/libraries/{lib_id}/items",
                headers=headers,
                params={'sort': 'addedAt', 'desc': 1, 'limit': 5, 'minified': 1},
                timeout=5
            )
            if items_resp.status_code == 200:
                data = items_resp.json()
                results = data.get('results', [])
                total_books = data.get('total', 0)
                
                for item in results:
                    media = item.get('media', {})
                    metadata = media.get('metadata', {})
                    recent_books.append({
                        'title': media.get('metadata', {}).get('title') or item.get('name'),
                        'author': metadata.get('authorName') or (metadata.get('authors', [{}])[0].get('name') if metadata.get('authors') else 'Unknown'),
                        'cover': f"{base_url}/api/items/{item['id']}/cover?token={api_key}",
                        'added_at': item.get('addedAt'),
                        'duration': media.get('duration', 0)
                    })

        # 3. Get listening stats (optional, maybe for future)
        # For now just return what we have

        return {
            'status': 'online',
            'total_books': total_books,
            'recent_books': recent_books,
            'library_name': audiobook_lib.get('name') if audiobook_lib else 'Unknown'
        }

    except Exception as e:
        return {'error': str(e), 'status': 'error'}
