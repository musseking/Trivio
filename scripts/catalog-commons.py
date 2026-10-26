"""Discover exact-model Commons photographs; keep license evidence before selecting files.

Research results are private and never automatically approved for import.
"""
import concurrent.futures
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / '.local/catalog'
AGENT = 'TrivioDemoCatalog/1.0 (university demonstration; Wikimedia license attribution)'


def api(**params):
    url = 'https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({'format': 'json', **params})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': AGENT}), timeout=45) as response:
                return json.load(response)
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 + attempt * 3)


def plain(value):
    return html.unescape(re.sub('<[^>]+>', '', str(value)))


def research(key, query):
    data = api(action='query', generator='search', gsrsearch=query, gsrnamespace=6, gsrlimit=30,
               prop='imageinfo', iiprop='url|size|extmetadata', iiurlwidth=1280)
    candidates = []
    for page in data.get('query', {}).get('pages', {}).values():
        info = page.get('imageinfo', [{}])[0]
        meta = {k: plain(v['value']) for k, v in info.get('extmetadata', {}).items()}
        license = meta.get('LicenseShortName', '')
        if not re.fullmatch(r'CC BY(?:-SA)? [1-4]\.0|CC0(?: 1\.0)?|Public domain', license):
            continue
        if not info.get('url', '').lower().split('?')[0].endswith(('.jpg', '.jpeg', '.png')):
            continue
        candidates.append({'title': page['title'], 'pageId': page['pageid'], 'url': info['url'],
                           'downloadUrl': info.get('thumburl', info['url']), 'source': info['descriptionurl'],
                           'license': license, 'licenseUrl': meta.get('LicenseUrl', ''),
                           'author': meta.get('Artist', ''), 'description': meta.get('ImageDescription', ''),
                           'categories': meta.get('Categories', ''), 'width': info.get('width'), 'height': info.get('height')})
    PRIVATE.mkdir(parents=True, exist_ok=True)
    (PRIVATE / (key + '-candidates.json')).write_text(json.dumps(candidates, ensure_ascii=False, indent=2), encoding='utf-8')
    return key, [p['title'] for p in candidates]


QUERIES = {
    'porsche': '"911" "Turbo S" "992" -Cabriolet -Convertible -Brabus -Manthey',
    'mercedes': '"S 580" "V223" -Maybach',
    'bmw-m8': '"M8" "Competition" "Coupé" -Cabriolet -"Gran"',
    'audi-rs7': '"RS7" "performance"',
    'lamborghini': '"Huracán EVO" -Spyder -RWD -Tecnica',
    'ferrari': '"Ferrari Roma" -Spider',
    'bentley': 'incategory:"Bentley Continental GT Speed (3rd gen.)"',
    'rolls-royce': '"Rolls-Royce Ghost" "2021"',
    'aston': '"Aston Martin DB12" -Volante -"V12"',
    'range-rover': '"Range Rover" "SV" -Sport -SVR -SVAutobiography -Coupe',
    'toyota': '"Toyota Corolla" "2023" sedan',
    'audi-a4': '"Audi A4" "2020" -Avant -allroad',
    'bmw-320d': '"BMW" "320d" "G20"',
}

if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == '--query':
        print(json.dumps(research(sys.argv[2], sys.argv[3]), ensure_ascii=True))
        sys.exit(0)
    selected = {k: v for k, v in QUERIES.items() if len(sys.argv) == 1 or k in sys.argv[1:]}
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        for key, titles in pool.map(lambda item: research(*item), selected.items()):
            print(key + ': ' + json.dumps(titles, ensure_ascii=True))
