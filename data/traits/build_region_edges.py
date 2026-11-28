"""Build descriptive matchup tags from the fixed Oracle's Elixir CSV snapshots."""

import argparse
from collections import Counter, defaultdict
import csv
import json
import math
from pathlib import Path

from build_pro_profiles import POSITIONS, ROOT, key


REGIONS = ('LPL', 'LCK', 'LEC', 'LCS', 'CBLOL', 'LCP')
DOMESTIC = {r: r for r in REGIONS}
DOMESTIC.update({'LTA N': 'LCS', 'LTAN': 'LCS', 'LTA S': 'CBLOL', 'LTAS': 'CBLOL'})
INTERNATIONAL = {'FST', 'MSI', 'EWC', 'WLDs'}
TRAITS = ROOT / 'data/traits/traits.json'


def read_games(paths):
    games = defaultdict(dict)
    for path in paths:
        with path.open(encoding='utf-8-sig', newline='') as stream:
            for row in csv.DictReader(stream):
                league, position, side = row['league'], row['position'], row['side']
                if league not in DOMESTIC and league not in INTERNATIONAL:
                    continue
                if not row['gameid'] or side not in {'Blue', 'Red'}:
                    continue
                if position != 'team' and (league not in INTERNATIONAL or position not in POSITIONS):
                    continue
                group = (row['year'], league, row['gameid'])
                games[group][side, position] = row
    return games


def expectation(edge):
    return 1 / (1 + 10 ** (-edge / 400))


def efficiency(player):
    return math.log((int(player['kills']) + int(player['assists']) + 1) / (int(player['deaths']) + 1))


def region_edges(paths):
    games = read_games(paths)
    teams = {}
    regions = defaultdict(set)
    for game, rows in games.items():
        a, b = (rows.get((side, 'team')) for side in ('Blue', 'Red'))
        if not a or not b or not a['teamid'] or not b['teamid'] or a['result'] + b['result'] not in {'01', '10'}:
            continue
        teams[game] = a, b
        year, league, _ = game
        if league in DOMESTIC:
            for team in (a, b):
                regions[year, team['teamid']].add(DOMESTIC[league])

    local = defaultdict(lambda: 1500.0)
    region_strength = defaultdict(float)
    results = defaultdict(list)
    identities = defaultdict(set)
    records = []
    for game, (a, b) in sorted(teams.items(), key=lambda item: (item[1][0]['date'], item[0])):
        year, league, _ = game
        ta, tb = a['teamid'], b['teamid']
        win = int(a['result'])
        ka, kb = (year, ta), (year, tb)
        if league in DOMESTIC:
            update = 24 * (win - expectation(local[ka] - local[kb]))
            local[ka] += update
            local[kb] -= update
            continue
        if len(regions[ka]) != 1 or len(regions[kb]) != 1 or regions[ka] == regions[kb]:
            continue
        ra, rb = next(iter(regions[ka])), next(iter(regions[kb]))
        p = expectation(local[ka] - local[kb] + region_strength[ra] - region_strength[rb])
        surprise = win - p
        region_strength[ra] += 12 * surprise
        region_strength[rb] -= 12 * surprise
        records.append(game)
        rows = games[game]
        for side, enemy, region, opponent, result, residual in (
            ('Blue', 'Red', rb, tb, win, surprise), ('Red', 'Blue', ra, ta, 1-win, -surprise)
        ):
            for pos, role in POSITIONS.items():
                row, opp = rows.get((side, pos)), rows.get((enemy, pos))
                if not row or not opp or not row['playerid']:
                    continue
                pid = row['playerid']
                identities[key(row['playername']), role].add(pid)
                # Same-position KDA margin, with the typical winner advantage removed below.
                results[pid, region].append(((year, league), opponent, residual,
                                             role, result, efficiency(row) - efficiency(opp)))

    by_role = defaultdict(list)
    for rows in results.values():
        for _, _, _, role, won, margin in rows:
            by_role[role, won].append(margin)
    means = {k: sum(v)/len(v) for k, v in by_role.items()}
    roster = defaultdict(list)
    for source in ROOT.glob('data/*.json'):
        for team in json.loads(source.read_text(encoding='utf-8'))['teams']:
            for player in team['players']:
                roster[key(player['id']), player['role']].append(player['id'])

    output = defaultdict(list)
    for identity, names in roster.items():
        ids = identities.get(identity, set())
        if len(names) != 1 or len(ids) != 1:
            continue
        pid = next(iter(ids))
        for region in REGIONS:
            rows = results.get((pid, region), [])
            n = len(rows)
            if n < 10 or len({row[0] for row in rows}) < 2 or len({row[1] for row in rows}) < 2:
                continue
            edge = 100 * sum(row[2] for row in rows) / (n+12)
            personal = sum(margin-means[role, won] for _,_,_,role,won,margin in rows) / n
            if edge >= 5 and personal >= 0:
                output[names[0]].append([region,n,round(edge,1)])
    return output, records


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv', type=Path, nargs='+')
    tags, matches = region_edges(parser.parse_args().csv)
    data = json.loads(TRAITS.read_text(encoding='utf-8'))
    players = data['players']
    for name, traits in list(players.items()):
        traits.pop('regionEdge', None)
        if not traits:
            del players[name]
    keys = {name.casefold(): name for name in players}
    for name, tags_for_player in sorted(tags.items()):
        players.setdefault(keys.get(name.casefold(), name), {})['regionEdge'] = tags_for_player
    TRAITS.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True)+'\n', encoding='utf-8')
    print(f'{len(matches)} cross-region maps, {len(tags)} tagged players, '
          f'{dict(Counter(tag[0] for rows in tags.values() for tag in rows))}')
