"""Aggregate champion picks and former teammate evidence from Oracle's Elixir CSVs.

Run from any directory with the 2025 and 2026 source files as positional arguments.
Only aggregate counts are committed to the game. See PRO_PROFILES.md for sources.
"""

import argparse
from collections import Counter, defaultdict
import csv
from itertools import combinations
import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[2]
CHAMPS = ROOT / 'src/champs.js'
MARKER = '// --- Generated professional data ---'
POSITIONS = {'top': 'TOP', 'jng': 'JUG', 'mid': 'MID', 'bot': 'ADC', 'sup': 'SUP'}
LEAGUES = {'LPL', 'LCK', 'LEC', 'LCS', 'CBLOL', 'LCP', 'LTAN', 'LTAS', 'LTA N', 'LTA S',
           'WLDs', 'MSI', 'FST', 'EWC'}


def key(value):
    return re.sub(r"[^\w]", '', value.casefold())


def encoded_table(values):
    lines = (f'  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False, separators=(",", ":"))}'
             for k, v in sorted(values.items()))
    return '{\n' + ',\n'.join(lines) + '\n}'


def build(paths):
    source = CHAMPS.read_text(encoding='utf-8').split(MARKER, 1)[0]
    heroes = {key(h): h for h in re.findall(r'^\s*\["([^"]+)","', source, re.MULTILINE)}
    roster = defaultdict(list)
    for data in ROOT.glob('data/*.json'):
        for team in json.loads(data.read_text(encoding='utf-8'))['teams']:
            for player in team['players']:
                roster[key(player['id'])].append(player)

    picks, roles, squads = defaultdict(Counter), defaultdict(Counter), defaultdict(set)
    seen, dates, leagues = set(), set(), Counter()
    for path in paths:
        with path.open(encoding='utf-8-sig', newline='') as stream:
            for row in csv.DictReader(stream):
                league, role = row['league'], POSITIONS.get(row['position'])
                if not role or league not in LEAGUES or not row['gameid'] or row['side'] not in {'Blue', 'Red'}:
                    continue
                unique = (row['year'], league, row['gameid'], row['side'], role)
                if unique in seen:
                    continue
                seen.add(unique)
                dates.add(row['date'][:10])
                leagues[league] += 1
                hero = heroes.get(key(row['champion']))
                if hero and row['year'] == '2026':
                    roles[role][hero] += 1
                matches = roster.get(key(row['playername']), [])
                eligible = [player for player in matches if player['role'] == role]
                if len(eligible) != 1:
                    continue
                player = eligible[0]['id'].lower()
                if hero:
                    picks[player][hero] += 1
                squads[unique[:-1]].add(player)

    paired = Counter('|'.join(pair) for squad in squads.values() for pair in combinations(sorted(squad), 2))
    paired = {pair: n for pair, n in paired.items() if n >= 5}
    players = {p: dict(sorted(counts.items(), key=lambda entry: (-entry[1], entry[0]))) for p, counts in picks.items()}
    block = ('window.PRO_PLAYER_DATA = {\nplayers: ' + encoded_table(players)
             + ',\nroles: ' + encoded_table({r: dict(sorted(c.items())) for r, c in roles.items()})
             + ',\npairs: ' + encoded_table(paired) + '\n};\n')
    CHAMPS.write_text(source.rstrip() + '\n\n' + MARKER + '\n' + block, encoding='utf-8')
    print(f'{len(players)} players, {len(paired)} pairs, {sum(leagues.values())} records, {min(dates)} to {max(dates)}')
    print(dict(sorted(leagues.items())))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv', type=Path, nargs='+')
    build(parser.parse_args().csv)
