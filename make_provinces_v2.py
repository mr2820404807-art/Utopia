# -*- coding: utf-8 -*-
"""
生成精简版世界行政区划数据 data/provinces_v2.geojson
- 来源: Natural Earth 10m admin-1（4596 个行政区，全253国覆盖）
- 每国按 (scalerank, 面积) 保留最重要的 K 个行政区（大国多、小国全留）
- 坐标圆整到 3 位小数（~100m），大幅压缩体积
"""
import json, math, os

SRC = 'ne-temp/geojson/ne_10m_admin_1_states_provinces.geojson'
OUT = 'data/provinces_v2.geojson'
# 每国保留上限：按国家行政区总数分档（档位放宽，保留更多行政区划）
CAPS = [(120, 48), (60, 36), (30, 24), (15, 16), (6, 10), (0, 0)]  # (总数下限, 保留数, 0=全留)

def ring_area_bbox(ring):
    a = 0
    minx = miny = 1e9; maxx = maxy = -1e9
    for i in range(len(ring) - 1):
        x1, y1 = ring[i][:2]; x2, y2 = ring[i + 1][:2]
        a += x1 * y2 - x2 * y1
        minx = min(minx, x1); maxx = max(maxx, x1)
        miny = min(miny, y1); maxy = max(maxy, y1)
    return abs(a) / 2, (minx, miny, maxx, maxy)

def geom_area_bbox(geom):
    total = 0; bb = (1e9, 1e9, -1e9, -1e9)
    def scan(coords):
        nonlocal total, bb
        for poly in coords:
            for ring in poly:
                a, (x0, y0, x1, y1) = ring_area_bbox(ring)
                # 外环加、内环减
                total += a if ring is poly[0] else -a
                bb = (min(bb[0], x0), min(bb[1], y0), max(bb[2], x1), max(bb[3], y1))
    if geom['type'] == 'Polygon': scan([geom['coordinates']])
    elif geom['type'] == 'MultiPolygon': scan(geom['coordinates'])
    return total, bb

def round_geom(geom, nd=3):
    def rr(c):
        if isinstance(c[0], (int, float)): return [round(c[0], nd), round(c[1], nd)]
        return [rr(x) for x in c]
    return {'type': geom['type'], 'coordinates': rr(geom['coordinates'])}

def thin_ring(ring, keep=1):
    # 均匀抽稀顶点（保首尾）
    if keep <= 1 or len(ring) < 12: return ring
    n = len(ring)
    return [ring[int(i * (n - 1) / (n - 1))] for i in range(0, n, max(1, len(ring) // 1))]

def thin_geom(geom, max_pts):
    """每个环限制顶点数：超过 max_pts 时均匀抽稀"""
    def th_ring(ring):
        if len(ring) <= max_pts: return ring
        step = (len(ring) - 1) / (max_pts - 1)
        return [ring[round(i * step)] for i in range(max_pts)]
    def th(poly):
        return [th_ring(r) for r in poly]
    if geom['type'] == 'Polygon':
        return {'type': 'Polygon', 'coordinates': th(geom['coordinates'])}
    return {'type': 'MultiPolygon', 'coordinates': [th(p) for p in geom['coordinates']]}

d = json.load(open(SRC, encoding='utf-8'))

# 国家名归一化：admin_1 的 admin 字段用长名（如 United States of America），
# 而游戏中国家键用 admin_0 的 NAME 短名（United States）——统一映射到短名
COUNTRIES = 'ne-temp/geojson/ne_50m_admin_0_countries.geojson'
cgeo = json.load(open(COUNTRIES, encoding='utf-8'))
longToShort = {}
shortNames = set()
for f in cgeo['features']:
    p = f['properties']
    nm = p.get('NAME') or ''
    ad = p.get('ADMIN') or ''
    if nm: shortNames.add(nm)
    if ad and nm: longToShort[ad] = nm

def normalize_admin(admin):
    if admin in shortNames: return admin
    return longToShort.get(admin, admin)

by_country = {}
for f in d['features']:
    p = f['properties']
    admin = normalize_admin(p.get('admin') or '')
    name = p.get('name') or ''
    if not admin or not name or admin == 'Antarctica':
        continue
    sr = p.get('scalerank') or 10
    area, bb = geom_area_bbox(f['geometry'])
    by_country.setdefault(admin, []).append({
        'name': name, 'sr': sr, 'area': area, 'bb': bb, 'geom': f['geometry'],
    })

kept = []
for admin, lst in by_country.items():
    lst.sort(key=lambda x: (x['sr'], -x['area']))
    cap = next((c for lo, c in CAPS if len(lst) > lo), 0)
    # 行政区多的国家存在大量市镇级碎块：按面积过滤，只留主要区划
    min_area = 0.02 if len(lst) <= 20 else (0.06 if len(lst) <= 60 else 0.12)
    kept_list = [it for it in lst if it['area'] >= min_area]
    if not kept_list:
        # 小国全部低于面积线：保留面积最大的前 4 个，避免整个国家无省可分
        kept_list = lst[:4]
    if cap:
        kept_list = kept_list[:cap]
    for item in kept_list:
        # 大几何抽稀：限制每环 240 顶点
        geom = thin_geom(item['geom'], 240)
        kept.append({
            'type': 'Feature',
            'properties': {'name': item['name'], 'admin': admin},
            'geometry': round_geom(geom),
        })

# 台湾特殊处理：admin 改为 China（与现有游戏逻辑一致）
for f in kept:
    if f['properties']['admin'] == 'Taiwan':
        f['properties']['admin'] = 'China'

out = {'type': 'FeatureCollection', 'features': kept}
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
size = os.path.getsize(OUT)
print(f'保留 {len(kept)} 个行政区 / {len(by_country)} 国，输出 {OUT}，{size/1048576:.1f} MB')
countries = sorted(set(f['properties']['admin'] for f in kept))
print('国家数:', len(countries))
