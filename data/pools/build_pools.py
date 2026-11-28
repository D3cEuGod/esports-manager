"""Build every rostered player's starting champion pool from four years of pro games.

Usage (from any directory):
    python data/pools/build_pools.py 2023.csv 2024.csv 2025.csv 2026.csv

Inputs are Oracle's Elixir match CSVs (see data/pools/README.md for sources and hashes).
Writes data/pools/pools.json. build_web.py merges it into LEGENDS.champOverrides, which the
engine's genChampPool already reads for new saves. Hand-set entries in data/legends win.
"""

import argparse
import hashlib
from collections import Counter, defaultdict
import csv
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'data/pools/pools.json'
THIN = ROOT / 'data/pools/thin_research.json'
POSITIONS = {'top': 'TOP', 'jng': 'JUG', 'mid': 'MID', 'bot': 'ADC', 'sup': 'SUP'}
MAIN = {'LPL', 'LCK', 'LEC', 'LCS', 'CBLOL', 'LCP', 'LTA', 'LTA N', 'LTA S', 'WLDs', 'MSI', 'FST', 'EWC'}
# Older seasons count for less: a 2023 comfort pick is rustier than a 2026 one.
YEAR_WEIGHT = {2026: 1.0, 2025: 1.0, 2024: 0.6, 2023: 0.4}
# Games outside the top leagues (academy, ERL, LDL...) count for less.
MINOR_WEIGHT = 0.6

# Tier floors match engine profTier: 85 signature, 65 mastered, 45 proficient, 25 familiar.
POOL_MAX = 12
POOL_MIN = 9
COMMON_SHARE = 0.6      # a champion used by at least 60% of a role's pros is "common"
COMMON_FLOOR = 45


def key(value):
    return re.sub(r"[^\w]", '', value.casefold())


# Rank template: the k-th most played champion's value, before rating shift and evidence caps.
# Tuned so each rating band keeps about the same number of signature and mastered champions
# and the same top-5 average as the previous generator (balance), while the order now follows
# what the player actually played instead of the patch.
TEMPLATE = [89, 86, 79, 73, 67, 62, 58, 54, 50, 47, 45, 44]


def band_shift(rating):
    if rating >= 88:
        return 3
    if rating >= 84:
        return 2
    if rating >= 78:
        return 1
    if rating >= 70:
        return 0
    return -1


def max_signatures(rating):
    return 3 if rating >= 88 else 2


def evidence_cap(w):
    """Few games cannot make a signature: cap by weighted game count."""
    if w >= 10:
        return 97
    if w >= 6:
        return 84
    if w >= 3:
        return 72
    if w >= 1:
        return 58
    return 0


def champions():
    source = (ROOT / 'src/champs.js').read_text(encoding='utf-8').split('// --- Generated', 1)[0]
    rows = re.findall(r'^\s*\["([^"]+)","[^"]*",(\[[^\]]*\])', source, re.MULTILINE)
    return {name: json.loads(roles) for name, roles in rows}


def roster():
    players = []
    for path in sorted(ROOT.glob('data/*.json')):
        for team in json.loads(path.read_text(encoding='utf-8'))['teams']:
            for p in team['players']:
                players.append(dict(p, team=team['short']))
    return players


def load_rows(paths, heroes):
    lookup = {key(h): h for h in heroes}
    seen, rows = set(), []
    for path in paths:
        with path.open(encoding='utf-8-sig', newline='') as stream:
            for row in csv.DictReader(stream):
                role = POSITIONS.get(row['position'])
                if not role or not row['gameid'] or row['side'] not in {'Blue', 'Red'}:
                    continue
                unique = (row['gameid'], row['side'], role)
                if unique in seen:
                    continue
                seen.add(unique)
                year = int(row['year'] or row['date'][:4])
                rows.append((year, row['league'], role, key(row['playername']), row['playerid'],
                             lookup.get(key(row['champion']))))
    return rows


def match_players(players, rows):
    """Pick one Oracle's Elixir player id per rostered player: same name and role, most recent top-league games."""
    score = defaultdict(Counter)
    for year, league, role, name, pid, _ in rows:
        if pid:
            score[(name, role)][pid] += (3 if league in MAIN else 1) * (3 if year == 2026 else 2 if year == 2025 else 1)
    return {p['id']: score[(key(p['id']), p['role'])].most_common(1)[0][0]
            for p in players if score.get((key(p['id']), p['role']))}


def weighted_picks(rows, pids):
    wanted = set(pids.values())
    by_pid = defaultdict(Counter)
    raw = defaultdict(Counter)
    for year, league, role, name, pid, hero in rows:
        if pid in wanted and hero:
            by_pid[(pid, role)][hero] += YEAR_WEIGHT.get(year, 0.3) * (1 if league in MAIN else MINOR_WEIGHT)
            if year >= 2025 and league in MAIN:
                raw[(pid, role)][hero] += 1
    return by_pid, raw


def common_champions(players, raw, pids):
    """Champions that at least 60% of a role's regular pros played twice or more in 2025-26 top leagues."""
    seen, counts = Counter(), defaultdict(Counter)
    for p in players:
        pid = pids.get(p['id'])
        table = raw.get((pid, p['role'])) if pid else None
        if not table or sum(table.values()) < 40:
            continue
        seen[p['role']] += 1
        for hero, w in table.items():
            if w >= 2:
                counts[p['role']][hero] += 1
    return {role: sorted(h for h, n in counts[role].items() if n >= COMMON_SHARE * seen[role]) for role in seen}


def role_popularity(by_pid):
    pop = defaultdict(Counter)
    for (pid, role), table in by_pid.items():
        for hero, w in table.items():
            pop[role][hero] += w
    return pop


def build_pool(p, table, common, popularity, heroes, thin):
    rating = p.get('rating') or 70
    shift = band_shift(rating)
    ranked = [(h, w) for h, w in sorted(table.items(), key=lambda e: (-e[1], e[0]))
              if p['role'] in heroes.get(h, []) and w >= 1]
    pool, sigs = {}, 0
    for rank, (hero, w) in enumerate(ranked[:len(TEMPLATE)]):
        v = min(TEMPLATE[rank] + shift + (2 if rank == 0 and w >= 40 else 0), evidence_cap(w))
        if v >= 85:
            if sigs >= max_signatures(rating):
                v = 84
            sigs += 1
        pool[hero] = v
    # Thin data: a short researched list, then the role's most played champions (rotated per player
    # so unknown players don't all get the same pool) fill in at mastered/proficient, never signature.
    if sum(table.values()) < 20:
        fill = [h for h in thin.get(p['id'], {}).get('recent', []) if p['role'] in heroes.get(h, [])]
        popular = [h for h, _ in popularity[p['role']].most_common(12)]
        turn = int(hashlib.md5(p['id'].encode('utf-8')).hexdigest(), 16) % len(popular)
        fill += popular[turn:] + popular[:turn]
        for hero in dict.fromkeys(fill):
            if len(pool) >= 7:
                break
            if hero not in pool:
                pool[hero] = min(TEMPLATE[len(pool)] + shift - 10, 72)
    # Pro-common champions: every pro in the role can at least play them.
    for hero in common.get(p['role'], []):
        pool[hero] = max(pool.get(hero, 0), COMMON_FLOOR + max(0, shift))
    order = sorted(pool, key=lambda h: (-pool[h], h))[:POOL_MAX]
    for hero, _ in popularity[p['role']].most_common(30):
        if len(order) >= POOL_MIN:
            break
        if hero not in order:
            pool[hero] = 40
            order.append(hero)
    return {h: pool[h] for h in order}


def main(paths):
    heroes = champions()
    players = roster()
    rows = load_rows(paths, heroes)
    pids = match_players(players, rows)
    by_pid, raw = weighted_picks(rows, pids)
    common = common_champions(players, raw, pids)
    popularity = role_popularity(by_pid)
    thin = json.loads(THIN.read_text(encoding='utf-8')) if THIN.exists() else {}
    out = {}
    for p in players:
        pid = pids.get(p['id'])
        table = by_pid.get((pid, p['role']), Counter()) if pid else Counter()
        champs = build_pool(p, table, common, popularity, heroes, thin)
        picks = {h: round(w) for h, w in sorted(table.items(), key=lambda e: -e[1]) if round(w) >= 1}
        # Researched picks for players without data, so pool styling and signature checks still work.
        if not picks:
            picks = {h: 4 for h, v in champs.items() if v >= 50}
        out[p['id']] = {'role': p['role'], 'picks': picks, 'champs': champs}
    meta = {
        'source': "Oracle's Elixir match data 2023-2026 (see data/pools/README.md)",
        'rows': len(rows), 'matched': len(pids), 'players': len(out),
        'common': common,
    }
    OUT.write_text(json.dumps({'meta': meta, 'players': out}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f"{len(out)} players, {len(pids)} matched, {len(rows)} rows")
    print('common:', common)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv', type=Path, nargs='+')
    main(parser.parse_args().csv)
