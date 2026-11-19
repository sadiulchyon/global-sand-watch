"""Build the world overview paths from Natural Earth 1:110m v5.1.2 (public domain).

Usage: python3 -I scripts/map/build-world.py /path/to/ne_110m_admin_0_countries.geojson
Source: https://github.com/nvkelso/natural-earth-vector/tree/v5.1.2/geojson
The same file and checksum are used by Mekong Sand Watch's country overview.
Projection: plate carree, 1 degree = 2.5 units, longitudes -180..180, latitudes 84..-58.
Antarctica is omitted. Country borders are reference geography, not basin boundaries.
"""
import hashlib, json, sys
from pathlib import Path

payload = Path(sys.argv[1]).read_bytes()
assert hashlib.sha256(payload).hexdigest() == '6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f'
# Natural Earth ADMIN names -> names used in the archives
rename = {'Laos': 'Lao PDR', 'Vietnam': 'Viet Nam', 'United Republic of Tanzania': 'Tanzania',
          'Democratic Republic of the Congo': 'DR Congo', 'Republic of the Congo': 'Congo',
          'United States of America': 'United States'}
K, LAT0 = 2.5, 84
out = {}
for feature in json.loads(payload)['features']:
    admin = feature['properties']['ADMIN']
    if admin == 'Antarctica':
        continue
    name = rename.get(admin, admin)
    g = feature['geometry']
    polygons = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
    parts = []
    for polygon in polygons:
        for ring in polygon:
            pts = []
            for lon, lat in ring:
                p = (round((lon + 180) * K, 1), round((LAT0 - lat) * K, 1))
                if not pts or pts[-1] != p:
                    pts.append(p)
            if len(pts) > 2:
                parts.append('M' + 'L'.join(f'{x:g},{y:g}' for x, y in pts) + 'Z')
    out[name] = out.get(name, '') + ''.join(parts)
assert {'Bangladesh', 'Viet Nam', 'Kenya', 'Rwanda', 'Lao PDR'} <= set(out)
Path('public/world-shapes.js').write_text(
    '// Natural Earth 1:110m admin-0 countries v5.1.2, public domain. Built by scripts/map/build-world.py.\n'
    f'export const WORLD = {{k: {K}, lat0: {LAT0}, width: {360*K:g}, height: {(LAT0+58)*K:g}}};\n'
    'export const countryShapes = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(len(out), 'countries')
