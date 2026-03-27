"""
Brass: Lancashire — Python game engine for neural network training.
Faithful port of the Node.js engine with all rules.
Optimized for fast self-play (no logging, minimal allocations).
"""
import random
from copy import deepcopy
from collections import deque

# ============ INDUSTRY DATA ============

INDUSTRIES = {
    'cottonMill': {
        'name': 'Cotton Mill',
        'levels': {
            1: {'cost': 12, 'coalCost': 0, 'ironCost': 0, 'incomeGain': 5, 'vp': 3, 'resources': 0},
            2: {'cost': 14, 'coalCost': 1, 'ironCost': 0, 'incomeGain': 4, 'vp': 5, 'resources': 0},
            3: {'cost': 16, 'coalCost': 1, 'ironCost': 1, 'incomeGain': 3, 'vp': 9, 'resources': 0},
            4: {'cost': 18, 'coalCost': 1, 'ironCost': 1, 'incomeGain': 2, 'vp': 12, 'resources': 0},
        },
        'tilesPerLevel': {1: 3, 2: 3, 3: 3, 4: 3},
    },
    'coalMine': {
        'name': 'Coal Mine',
        'levels': {
            1: {'cost': 5, 'coalCost': 0, 'ironCost': 0, 'incomeGain': 4, 'vp': 1, 'resources': 2},
            2: {'cost': 7, 'coalCost': 0, 'ironCost': 0, 'incomeGain': 7, 'vp': 2, 'resources': 3},
            3: {'cost': 8, 'coalCost': 0, 'ironCost': 1, 'incomeGain': 6, 'vp': 3, 'resources': 4},
            4: {'cost': 10, 'coalCost': 0, 'ironCost': 1, 'incomeGain': 5, 'vp': 4, 'resources': 5},
        },
        'tilesPerLevel': {1: 1, 2: 2, 3: 2, 4: 2},
    },
    'ironWorks': {
        'name': 'Iron Works',
        'levels': {
            1: {'cost': 5, 'coalCost': 1, 'ironCost': 0, 'incomeGain': 3, 'vp': 3, 'resources': 4},
            2: {'cost': 7, 'coalCost': 1, 'ironCost': 0, 'incomeGain': 3, 'vp': 5, 'resources': 4},
            3: {'cost': 9, 'coalCost': 1, 'ironCost': 0, 'incomeGain': 2, 'vp': 7, 'resources': 5},
            4: {'cost': 12, 'coalCost': 1, 'ironCost': 0, 'incomeGain': 1, 'vp': 9, 'resources': 6},
        },
        'tilesPerLevel': {1: 1, 2: 1, 3: 1, 4: 1},
    },
    'port': {
        'name': 'Port',
        'levels': {
            1: {'cost': 6, 'coalCost': 0, 'ironCost': 0, 'incomeGain': 3, 'vp': 2, 'resources': 0},
            2: {'cost': 7, 'coalCost': 0, 'ironCost': 0, 'incomeGain': 3, 'vp': 4, 'resources': 0},
            3: {'cost': 8, 'coalCost': 0, 'ironCost': 0, 'incomeGain': 4, 'vp': 6, 'resources': 0},
            4: {'cost': 9, 'coalCost': 0, 'ironCost': 0, 'incomeGain': 4, 'vp': 9, 'resources': 0},
        },
        'tilesPerLevel': {1: 2, 2: 2, 3: 2, 4: 2},
    },
    'shipyard': {
        'name': 'Shipyard',
        'levels': {
            0: {'cost': 0, 'coalCost': 0, 'ironCost': 0, 'incomeGain': 0, 'vp': 0, 'resources': 0},
            1: {'cost': 16, 'coalCost': 1, 'ironCost': 1, 'incomeGain': 2, 'vp': 10, 'resources': 0},
            2: {'cost': 25, 'coalCost': 1, 'ironCost': 1, 'incomeGain': 1, 'vp': 18, 'resources': 0},
        },
        'tilesPerLevel': {0: 2, 1: 2, 2: 2},
    },
}

# ============ BOARD DATA ============

LOCATIONS = {
    'lancaster':     {'slots': [['port'], ['cottonMill', 'port']]},
    'barrow':        {'slots': [['port'], ['shipyard']]},
    'fleetwood':     {'slots': [['port']]},
    'preston':       {'slots': [['port'], ['cottonMill', 'port'], ['ironWorks']]},
    'blackburn':     {'slots': [['cottonMill', 'coalMine'], ['cottonMill', 'coalMine'], ['ironWorks']]},
    'burnley':       {'slots': [['cottonMill', 'coalMine'], ['cottonMill', 'coalMine']]},
    'colne':         {'slots': [['cottonMill'], ['cottonMill']]},
    'wigan':         {'slots': [['coalMine'], ['coalMine']]},
    'bolton':        {'slots': [['cottonMill', 'coalMine'], ['cottonMill', 'coalMine'], ['ironWorks']]},
    'bury':          {'slots': [['cottonMill', 'coalMine'], ['cottonMill', 'coalMine']]},
    'rochdale':      {'slots': [['cottonMill', 'coalMine'], ['cottonMill', 'coalMine'], ['ironWorks']]},
    'oldham':        {'slots': [['cottonMill', 'coalMine'], ['cottonMill', 'coalMine']]},
    'manchester':    {'slots': [['cottonMill', 'coalMine'], ['cottonMill', 'coalMine'], ['cottonMill', 'coalMine'], ['ironWorks']]},
    'stockport':     {'slots': [['cottonMill'], ['cottonMill']]},
    'macclesfield':  {'slots': [['cottonMill'], ['cottonMill']]},
    'liverpool':     {'slots': [['port'], ['port'], ['port'], ['shipyard']]},
    'birkenhead':    {'slots': [['shipyard']]},
    'warrington':    {'slots': [['cottonMill', 'coalMine'], ['port']]},
    'ellesmerePort': {'slots': [['port']]},
}

LINKS = [
    {'id': 'barrow-lancaster', 'from': 'barrow', 'to': 'lancaster', 'canal': False, 'rail': True, 'segments': 1},
    {'id': 'lancaster-preston', 'from': 'lancaster', 'to': 'preston', 'canal': True, 'rail': True, 'segments': 1},
    {'id': 'lancaster-scotland', 'from': 'lancaster', 'to': 'scotland', 'canal': False, 'rail': True, 'segments': 2},
    {'id': 'preston-fleetwood', 'from': 'preston', 'to': 'fleetwood', 'canal': True, 'rail': True, 'segments': 1},
    {'id': 'preston-blackpool', 'from': 'preston', 'to': 'blackpool', 'canal': False, 'rail': True, 'segments': 2},
    {'id': 'preston-southport', 'from': 'preston', 'to': 'southport', 'canal': False, 'rail': True, 'segments': 2},
    {'id': 'preston-blackburn', 'from': 'preston', 'to': 'blackburn', 'canal': False, 'rail': True, 'segments': 1},
    {'id': 'preston-wigan', 'from': 'preston', 'to': 'wigan', 'canal': True, 'rail': True, 'segments': 1},
    {'id': 'blackburn-burnley', 'from': 'blackburn', 'to': 'burnley', 'canal': True, 'rail': True, 'segments': 1},
    {'id': 'blackburn-bolton', 'from': 'blackburn', 'to': 'bolton', 'canal': False, 'rail': True, 'segments': 1},
    {'id': 'blackburn-wigan', 'from': 'blackburn', 'to': 'wigan', 'canal': True, 'rail': True, 'segments': 1},
    {'id': 'burnley-colne', 'from': 'burnley', 'to': 'colne', 'canal': True, 'rail': True, 'segments': 1},
    {'id': 'colne-yorkshire', 'from': 'colne', 'to': 'yorkshire', 'canal': True, 'rail': True, 'segments': 2},
    {'id': 'rochdale-yorkshire', 'from': 'rochdale', 'to': 'yorkshire', 'canal': True, 'rail': True, 'segments': 2},
    {'id': 'wigan-bolton', 'from': 'wigan', 'to': 'bolton', 'canal': False, 'rail': True, 'segments': 1},
    {'id': 'wigan-warrington', 'from': 'wigan', 'to': 'warrington', 'canal': True, 'rail': True, 'segments': 1},
    {'id': 'wigan-liverpool', 'from': 'wigan', 'to': 'liverpool', 'canal': True, 'rail': True, 'segments': 1},
    {'id': 'wigan-southport', 'from': 'wigan', 'to': 'southport', 'canal': False, 'rail': True, 'segments': 2},
    {'id': 'southport-liverpool', 'from': 'southport', 'to': 'liverpool', 'canal': False, 'rail': True, 'segments': 2},
    {'id': 'bolton-bury', 'from': 'bolton', 'to': 'bury', 'canal': True, 'rail': True, 'segments': 1},
    {'id': 'bolton-manchester', 'from': 'bolton', 'to': 'manchester', 'canal': True, 'rail': True, 'segments': 1},
    {'id': 'bury-manchester', 'from': 'bury', 'to': 'manchester', 'canal': True, 'rail': True, 'segments': 1},
    {'id': 'bury-burnley', 'from': 'bury', 'to': 'burnley', 'canal': False, 'rail': True, 'segments': 1},
    {'id': 'bury-rochdale', 'from': 'bury', 'to': 'rochdale', 'canal': False, 'rail': True, 'segments': 1},
    {'id': 'rochdale-oldham', 'from': 'rochdale', 'to': 'oldham', 'canal': True, 'rail': True, 'segments': 1},
    {'id': 'oldham-manchester', 'from': 'oldham', 'to': 'manchester', 'canal': True, 'rail': True, 'segments': 1},
    {'id': 'manchester-stockport', 'from': 'manchester', 'to': 'stockport', 'canal': True, 'rail': True, 'segments': 1},
    {'id': 'manchester-warrington', 'from': 'manchester', 'to': 'warrington', 'canal': True, 'rail': True, 'segments': 1},
    {'id': 'liverpool-warrington', 'from': 'liverpool', 'to': 'warrington', 'canal': False, 'rail': True, 'segments': 1},
    {'id': 'ellesmerePort-birkenhead', 'from': 'ellesmerePort', 'to': 'birkenhead', 'canal': False, 'rail': True, 'segments': 1},
    {'id': 'liverpool-ellesmerePort', 'from': 'liverpool', 'to': 'ellesmerePort', 'canal': True, 'rail': True, 'segments': 1},
    {'id': 'warrington-ellesmerePort', 'from': 'warrington', 'to': 'ellesmerePort', 'canal': True, 'rail': True, 'segments': 1},
    {'id': 'ellesmerePort-northwich', 'from': 'ellesmerePort', 'to': 'northwich', 'canal': True, 'rail': True, 'segments': 2},
    {'id': 'northwich-theMidlands', 'from': 'northwich', 'to': 'theMidlands', 'canal': True, 'rail': True, 'segments': 2},
    {'id': 'stockport-macclesfield', 'from': 'stockport', 'to': 'macclesfield', 'canal': True, 'rail': True, 'segments': 1},
    {'id': 'macclesfield-theMidlands', 'from': 'macclesfield', 'to': 'theMidlands', 'canal': True, 'rail': True, 'segments': 2},
]

EXTERNAL_PORTS = {'scotland', 'yorkshire', 'theMidlands'}

DISTANT_MARKET_TILES = [0, 0, -1, -2, -2, -2, -2, -3, -3, -3, -4]

# Income track: square index -> income per round
INCOME_TRACK = []
for i in range(10):
    INCOME_TRACK.append(-10 + i)
INCOME_TRACK.append(0)  # square 10
for inc in range(1, 11):
    INCOME_TRACK.extend([inc, inc])  # 2 squares each
for inc in range(11, 21):
    INCOME_TRACK.extend([inc, inc, inc])  # 3 squares each
for inc in range(21, 30):
    INCOME_TRACK.extend([inc, inc, inc, inc])  # 4 squares each
INCOME_TRACK.extend([30, 30, 30])  # squares 97-99

MARKET_PRICES_4P = [1, 1, 2, 2, 3, 3, 4, 4]

# Cards to remove
CARDS_TO_REMOVE = {3: {'canal': 9, 'rail': 6}, 4: {'canal': 6, 'rail': 2}}

# ============ CARD DECK ============

def build_deck():
    """Build the standard 66-card deck."""
    cards = []
    loc_counts = {
        'barrow': 2, 'birkenhead': 2, 'blackburn': 2, 'bolton': 2, 'burnley': 2,
        'bury': 1, 'colne': 2, 'ellesmerePort': 1, 'fleetwood': 1, 'lancaster': 3,
        'liverpool': 4, 'macclesfield': 2, 'manchester': 4, 'oldham': 2, 'preston': 3,
        'rochdale': 2, 'stockport': 2, 'warrington': 2, 'wigan': 2,
    }
    for loc, count in loc_counts.items():
        for i in range(count):
            cards.append({'type': 'location', 'location': loc, 'id': f'{loc}_{i+1}'})

    ind_counts = {'cottonMill': 8, 'coalMine': 5, 'ironWorks': 3, 'port': 6, 'shipyard': 3}
    for ind, count in ind_counts.items():
        for i in range(count):
            cards.append({'type': 'industry', 'industry': ind, 'id': f'{ind}_{i+1}'})
    return cards


def build_industry_mat():
    """Build per-player industry mat."""
    mat = {}
    for ind_type, ind in INDUSTRIES.items():
        tiles = []
        for level in sorted(ind['levels'].keys()):
            count = ind['tilesPerLevel'].get(level, 1)
            tiles.extend([level] * count)
        mat[ind_type] = tiles
    return mat


# ============ GAME STATE ============

class Slot:
    __slots__ = ['allowed', 'owner', 'industry_type', 'level', 'flipped', 'resources']

    def __init__(self, allowed):
        self.allowed = allowed
        self.owner = None
        self.industry_type = None
        self.level = None
        self.flipped = False
        self.resources = 0

    def copy(self):
        s = Slot(self.allowed)
        s.owner = self.owner
        s.industry_type = self.industry_type
        s.level = self.level
        s.flipped = self.flipped
        s.resources = self.resources
        return s


class Player:
    __slots__ = ['seat', 'money', 'income', 'vp', 'spent', 'hand', 'mat']

    def __init__(self, seat, money=30):
        self.seat = seat
        self.money = money
        self.income = 10
        self.vp = 0
        self.spent = 0
        self.hand = []
        self.mat = build_industry_mat()

    def copy(self):
        p = Player.__new__(Player)
        p.seat = self.seat
        p.money = self.money
        p.income = self.income
        p.vp = self.vp
        p.spent = self.spent
        p.hand = list(self.hand)
        p.mat = {k: list(v) for k, v in self.mat.items()}
        return p


class Link:
    __slots__ = ['id', 'fr', 'to', 'canal', 'rail', 'segments', 'owner', 'link_type']

    def __init__(self, data):
        self.id = data['id']
        self.fr = data['from']
        self.to = data['to']
        self.canal = data['canal']
        self.rail = data['rail']
        self.segments = data.get('segments', 1)
        self.owner = None
        self.link_type = None  # 'canal' or 'rail'

    def copy(self):
        l = Link.__new__(Link)
        l.id = self.id
        l.fr = self.fr
        l.to = self.to
        l.canal = self.canal
        l.rail = self.rail
        l.segments = self.segments
        l.owner = self.owner
        l.link_type = self.link_type
        return l


class GameState:
    """Complete game state for Brass: Lancashire."""

    def __init__(self, num_players=3):
        self.num_players = num_players
        self.era = 'canal'
        self.round = 1
        self.phase = 'actions'  # 'actions' or 'finished'
        self.current_player_idx = 0
        self.actions_remaining = 1  # first turn of canal = 1
        self.market_slots = 8

        # Players
        self.players = [Player(i, money=30) for i in range(num_players)]
        self.turn_order = list(range(num_players))
        random.shuffle(self.turn_order)

        # Board
        self.locations = {}
        for loc_id, loc_data in LOCATIONS.items():
            self.locations[loc_id] = [Slot(allowed) for allowed in loc_data['slots']]

        self.links = {}
        for link_data in LINKS:
            l = Link(link_data)
            self.links[l.id] = l

        # Build adjacency for fast lookups
        self._build_adjacency()

        # Markets
        self.coal_market = self.market_slots
        self.iron_market = self.market_slots
        self.distant_demand = 8
        self.distant_tiles = list(DISTANT_MARKET_TILES)
        random.shuffle(self.distant_tiles)

        # Deck
        deck = build_deck()
        random.shuffle(deck)
        remove = CARDS_TO_REMOVE.get(num_players, {}).get('canal', 0)
        deck = deck[remove:]

        # Deal 8 cards per player
        for p in self.players:
            p.hand = [c['id'] for c in deck[:8]]
            deck = deck[8:]
        self.draw_pile = [c['id'] for c in deck]

    def _build_adjacency(self):
        """Build adjacency list from links."""
        self.adj = {}
        for link in self.links.values():
            self.adj.setdefault(link.fr, []).append(link)
            self.adj.setdefault(link.to, []).append(link)

    def copy(self):
        """Deep copy for simulation."""
        s = GameState.__new__(GameState)
        s.num_players = self.num_players
        s.era = self.era
        s.round = self.round
        s.phase = self.phase
        s.current_player_idx = self.current_player_idx
        s.actions_remaining = self.actions_remaining
        s.market_slots = self.market_slots
        s.players = [p.copy() for p in self.players]
        s.turn_order = list(self.turn_order)
        s.locations = {k: [sl.copy() for sl in v] for k, v in self.locations.items()}
        s.links = {k: v.copy() for k, v in self.links.items()}
        s._build_adjacency()
        s.coal_market = self.coal_market
        s.iron_market = self.iron_market
        s.distant_demand = self.distant_demand
        s.distant_tiles = list(self.distant_tiles)
        s.draw_pile = list(self.draw_pile)
        return s

    @property
    def current_seat(self):
        return self.turn_order[self.current_player_idx]

    @property
    def current_player(self):
        return self.players[self.current_seat]

    # ============ CONNECTIVITY ============

    def get_connected(self, start_loc):
        """BFS from start_loc through built links. Returns set of reachable locations."""
        visited = {start_loc}
        queue = deque([start_loc])
        while queue:
            loc = queue.popleft()
            for link in self.adj.get(loc, []):
                if link.owner is None:
                    continue
                neighbor = link.to if link.fr == loc else link.fr
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)
        return visited

    def get_player_network(self, seat):
        """Locations where player has industry or own link endpoint."""
        locs = set()
        for loc_id, slots in self.locations.items():
            for slot in slots:
                if slot.owner == seat:
                    locs.add(loc_id)
        for link in self.links.values():
            if link.owner == seat:
                locs.add(link.fr)
                locs.add(link.to)
        return locs

    def is_connected_to_port(self, loc_id):
        """Check if location is connected to external port or built port tile."""
        connected = self.get_connected(loc_id)
        for c in connected:
            if c in EXTERNAL_PORTS:
                return True
            if c in self.locations:
                for slot in self.locations[c]:
                    if slot.industry_type == 'port' and slot.owner is not None:
                        return True
        return False

    # ============ MARKET ============

    def market_buy_price(self, cubes):
        slots = self.market_slots
        prices = MARKET_PRICES_4P[:slots]
        if cubes <= 0:
            return 5
        idx = slots - cubes
        return prices[idx] if 0 <= idx < len(prices) else 5

    def market_sell_price(self, cubes):
        slots = self.market_slots
        prices = MARKET_PRICES_4P[:slots]
        if cubes >= slots:
            return 0
        # Selling fills from most expensive slot down
        slot_to_fill = slots - 1 - cubes
        return prices[slot_to_fill] if 0 <= slot_to_fill < len(prices) else 0

    # ============ INCOME ============

    def adjust_income(self, player, amount):
        player.income = max(0, min(99, player.income + amount))

    def drop_income_level(self, player):
        current_level = INCOME_TRACK[player.income]
        target = current_level - 1
        # Find highest square with target income
        for sq in range(99, -1, -1):
            if INCOME_TRACK[sq] == target:
                player.income = sq
                return
        player.income = 0

    def collect_income(self, player):
        inc = INCOME_TRACK[player.income]
        player.money += inc
        if player.money < 0:
            player.money = 0

    # ============ RESOURCE CONSUMPTION ============

    def consume_iron(self, amount, player):
        """Consume iron. Returns cost or None if impossible."""
        cost = 0
        remaining = amount

        # From board iron works (free)
        for loc_id, slots in self.locations.items():
            if remaining <= 0:
                break
            for slot in slots:
                if remaining <= 0:
                    break
                if slot.industry_type == 'ironWorks' and not slot.flipped and slot.resources > 0:
                    take = min(remaining, slot.resources)
                    slot.resources -= take
                    remaining -= take
                    # Auto-flip if empty
                    if slot.resources == 0:
                        slot.flipped = True
                        owner = self.players[slot.owner]
                        gain = INDUSTRIES['ironWorks']['levels'][slot.level]['incomeGain']
                        self.adjust_income(owner, gain)

        # From market
        while remaining > 0 and self.iron_market > 0:
            cost += self.market_buy_price(self.iron_market)
            self.iron_market -= 1
            remaining -= 1

        # From bank
        while remaining > 0:
            cost += 5
            remaining -= 1

        return cost

    def consume_coal(self, amount, target_loc, player):
        """Consume coal connected to target_loc. Returns cost or None if impossible."""
        cost = 0
        remaining = amount
        connected = self.get_connected(target_loc)

        # From connected coal mines (free)
        for loc_id in connected:
            if remaining <= 0:
                break
            if loc_id not in self.locations:
                continue
            for slot in self.locations[loc_id]:
                if remaining <= 0:
                    break
                if slot.industry_type == 'coalMine' and not slot.flipped and slot.resources > 0:
                    take = min(remaining, slot.resources)
                    slot.resources -= take
                    remaining -= take
                    if slot.resources == 0 and self.is_connected_to_port(loc_id):
                        slot.flipped = True
                        owner = self.players[slot.owner]
                        gain = INDUSTRIES['coalMine']['levels'][slot.level]['incomeGain']
                        self.adjust_income(owner, gain)

        # From market (if connected to port)
        if remaining > 0 and self.is_connected_to_port(target_loc):
            while remaining > 0 and self.coal_market > 0:
                cost += self.market_buy_price(self.coal_market)
                self.coal_market -= 1
                remaining -= 1
            while remaining > 0:
                cost += 5
                remaining -= 1

        if remaining > 0:
            return None  # Cannot fulfill
        return cost

    # ============ ACTIONS ============

    def apply_action(self, action):
        """Apply action dict. Returns True on success, False on failure."""
        atype = action['type']
        player = self.current_player
        card_id = action.get('card')

        if card_id and card_id in player.hand:
            player.hand.remove(card_id)
        elif atype != 'pass':
            return False

        if atype == 'buildIndustry':
            return self._do_build_industry(player, action)
        elif atype == 'buildLink':
            return self._do_build_link(player, action)
        elif atype == 'sellCotton':
            return self._do_sell_cotton(player, action)
        elif atype == 'takeLoan':
            return self._do_take_loan(player, action)
        elif atype == 'develop':
            return self._do_develop(player, action)
        elif atype == 'pass':
            self._advance_turn()
            return True
        return False

    def _do_build_industry(self, player, action):
        loc_id = action['location']
        slot_idx = action['slot']
        ind_type = action['industry']

        if loc_id not in self.locations:
            return False
        slots = self.locations[loc_id]
        if slot_idx >= len(slots):
            return False
        slot = slots[slot_idx]

        if ind_type not in slot.allowed:
            return False
        if not player.mat[ind_type]:
            return False

        level = player.mat[ind_type][0]
        if self.era == 'rail' and level <= 1:
            return False
        if ind_type == 'shipyard' and level == 0:
            return False

        tile = INDUSTRIES[ind_type]['levels'][level]

        if slot.owner is not None and slot.owner != player.seat:
            return False
        if slot.owner is not None and slot.level is not None and level <= slot.level:
            return False

        if self.era == 'canal' and slot.owner is None:
            for s in slots:
                if s.owner == player.seat:
                    return False

        # Estimate total cost BEFORE consuming (use copy to test)
        test = self.copy()
        test_player = test.players[player.seat]
        total_cost = tile['cost']
        if tile['ironCost'] > 0:
            total_cost += test.consume_iron(tile['ironCost'], test_player)
        if tile['coalCost'] > 0:
            cc = test.consume_coal(tile['coalCost'], loc_id, test_player)
            if cc is None:
                return False
            total_cost += cc
        if player.money < total_cost:
            return False

        # Now actually consume on real state
        real_cost = tile['cost']
        if tile['ironCost'] > 0:
            real_cost += self.consume_iron(tile['ironCost'], player)
        if tile['coalCost'] > 0:
            real_cost += self.consume_coal(tile['coalCost'], loc_id, player)

        player.money -= real_cost
        player.spent += real_cost
        player.mat[ind_type].pop(0)

        slot.owner = player.seat
        slot.industry_type = ind_type
        slot.level = level
        slot.flipped = False
        slot.resources = tile['resources']

        if ind_type == 'shipyard':
            slot.flipped = True
            self.adjust_income(player, tile['incomeGain'])

        if tile['resources'] == 0 and ind_type in ('coalMine', 'ironWorks'):
            slot.flipped = True
            self.adjust_income(player, tile['incomeGain'])

        self._advance_turn()
        return True

    def _do_build_link(self, player, action):
        link_id = action['link']
        if link_id not in self.links:
            return False
        link = self.links[link_id]
        if link.owner is not None:
            return False

        # Must have at least one tile on board
        has_tile = any(
            slot.owner == player.seat
            for slots in self.locations.values()
            for slot in slots
        )
        if not has_tile:
            return False

        # Network check
        network = self.get_player_network(player.seat)
        if network and link.fr not in network and link.to not in network:
            return False

        if self.era == 'canal':
            if not link.canal:
                return False
            cost = 3 * link.segments
            if player.money < cost:
                return False
            player.money -= cost
            player.spent += cost
            link.owner = player.seat
            link.link_type = 'canal'
        else:
            if not link.rail:
                return False
            base_cost = 5 * link.segments
            # Coal from either end
            coal_cost = None
            for end_loc in [link.fr, link.to]:
                test_state = self.copy()
                c = test_state.consume_coal(link.segments, end_loc, test_state.players[player.seat])
                if c is not None:
                    coal_cost = c
                    break

            if coal_cost is None:
                return False

            total = base_cost + coal_cost
            if player.money < total:
                return False

            # Actually consume coal
            self.consume_coal(link.segments, link.fr if coal_cost is not None else link.to, player)
            player.money -= base_cost
            player.spent += total
            link.owner = player.seat
            link.link_type = 'rail'

        self._build_adjacency()
        self._advance_turn()
        return True

    def _do_sell_cotton(self, player, action):
        sales = action.get('sales', [])
        if not sales:
            return False

        for sale in sales:
            mill_loc = sale['mill_loc']
            mill_slot = sale['mill_slot']
            target = sale['target']

            if mill_loc not in self.locations:
                return False
            slots = self.locations[mill_loc]
            if mill_slot >= len(slots):
                return False
            slot = slots[mill_slot]
            if slot.owner != player.seat or slot.industry_type != 'cottonMill' or slot.flipped:
                return False

            if target['type'] == 'port':
                port_loc = target['location']
                port_slot_idx = target['slot']
                if port_loc not in self.locations:
                    return False
                port_slots = self.locations[port_loc]
                if port_slot_idx >= len(port_slots):
                    return False
                port_slot = port_slots[port_slot_idx]
                if port_slot.industry_type != 'port' or port_slot.flipped or port_slot.owner is None:
                    return False

                # Check connectivity
                connected = self.get_connected(mill_loc)
                if port_loc not in connected:
                    return False

                # Flip both
                slot.flipped = True
                mill_data = INDUSTRIES['cottonMill']['levels'][slot.level]
                self.adjust_income(player, mill_data['incomeGain'])

                port_slot.flipped = True
                port_data = INDUSTRIES['port']['levels'][port_slot.level]
                port_owner = self.players[port_slot.owner]
                self.adjust_income(port_owner, port_data['incomeGain'])

            elif target['type'] == 'distant':
                if not self.is_connected_to_port(mill_loc):
                    return False
                if self.distant_demand <= 0 or not self.distant_tiles:
                    return False

                tile_val = self.distant_tiles.pop(0)
                self.distant_demand += tile_val  # tile_val is negative or 0
                if self.distant_demand <= 0:
                    self.distant_demand = 0
                    continue  # mill doesn't flip

                slot.flipped = True
                mill_data = INDUSTRIES['cottonMill']['levels'][slot.level]
                self.adjust_income(player, mill_data['incomeGain'])

        self._advance_turn()
        return True

    def _do_take_loan(self, player, action):
        amount = action.get('amount', 30)
        if amount not in (10, 20, 30):
            return False
        if self.era == 'rail' and not self.draw_pile:
            return False

        player.money += amount
        drops = amount // 10
        for _ in range(drops):
            self.drop_income_level(player)

        self._advance_turn()
        return True

    def _do_develop(self, player, action):
        develops = action.get('develops', [])
        if not develops or len(develops) > 2:
            return False

        iron_needed = len(develops)
        # Check each develop has tiles (account for duplicates)
        mat_counts = {}
        for ind_type in develops:
            mat_counts[ind_type] = mat_counts.get(ind_type, 0) + 1
        for ind_type, needed in mat_counts.items():
            if len(player.mat.get(ind_type, [])) < needed:
                return False

        # Test cost on copy first
        test = self.copy()
        test_cost = test.consume_iron(iron_needed, test.players[player.seat])
        if player.money < test_cost:
            return False

        # Actually consume
        iron_cost = self.consume_iron(iron_needed, player)
        player.money -= iron_cost
        player.spent += iron_cost

        for ind_type in develops:
            if player.mat.get(ind_type):
                player.mat[ind_type].pop(0)
            else:
                return False

        self._advance_turn()
        return True

    # ============ TURN FLOW ============

    def _advance_turn(self):
        self.actions_remaining -= 1

        # If current player has no more cards, force move to next player
        cur_seat = self.turn_order[self.current_player_idx]
        if not self.players[cur_seat].hand:
            self.actions_remaining = 0

        if self.actions_remaining <= 0:
            self.current_player_idx += 1
            # Skip players with no cards
            while (self.current_player_idx < len(self.turn_order) and
                   not self.players[self.turn_order[self.current_player_idx]].hand):
                self.current_player_idx += 1
            if self.current_player_idx >= len(self.turn_order):
                self._end_round()
            else:
                acts = 1 if (self.era == 'canal' and self.round == 1) else 2
                self.actions_remaining = acts

    def _end_round(self):
        # Check era end: draw pile empty AND all hands empty
        all_empty = all(len(p.hand) == 0 for p in self.players)
        if not self.draw_pile and all_empty:
            self._end_era()
            return

        # Reorder by spending (ascending)
        order = list(range(self.num_players))
        order.sort(key=lambda s: self.players[s].spent)
        self.turn_order = order

        # Reset spent, deal cards
        for p in self.players:
            p.spent = 0
            while len(p.hand) < 8 and self.draw_pile:
                p.hand.append(self.draw_pile.pop(0))

        self.round += 1
        self.current_player_idx = 0

        # Skip players with no cards at start of round
        while (self.current_player_idx < len(self.turn_order) and
               not self.players[self.turn_order[self.current_player_idx]].hand):
            self.current_player_idx += 1

        if self.current_player_idx >= len(self.turn_order):
            # Everyone is out of cards — end era
            self._end_era()
            return

        acts = 1 if (self.era == 'canal' and self.round == 1) else 2
        self.actions_remaining = acts

        # Collect income
        for p in self.players:
            self.collect_income(p)

    def _end_era(self):
        if self.era == 'canal':
            self._score_era()
            self._transition_to_rail()
        else:
            self._score_era()
            # Money bonus
            for p in self.players:
                p.vp += p.money // 10
            self.phase = 'finished'

    def _score_era(self):
        """Score flipped tiles and links for current era."""
        link_type = 'canal' if self.era == 'canal' else 'rail'

        # Score flipped tiles
        for loc_id, slots in self.locations.items():
            for slot in slots:
                if slot.flipped and slot.owner is not None:
                    tile = INDUSTRIES[slot.industry_type]['levels'][slot.level]
                    self.players[slot.owner].vp += tile['vp']

        # Score links
        for link in self.links.values():
            if link.link_type == link_type and link.owner is not None:
                vp = self._count_location_vp(link.fr) + self._count_location_vp(link.to)
                self.players[link.owner].vp += vp

    def _count_location_vp(self, loc_id):
        if loc_id not in self.locations:
            return 0
        return sum(1 for s in self.locations[loc_id] if s.flipped and s.owner is not None)

    def _transition_to_rail(self):
        # Remove canal links
        for link in self.links.values():
            if link.link_type == 'canal':
                link.owner = None
                link.link_type = None

        # Remove level 1 tiles
        for loc_id, slots in self.locations.items():
            for slot in slots:
                if slot.owner is not None and slot.level == 1:
                    slot.owner = None
                    slot.industry_type = None
                    slot.level = None
                    slot.flipped = False
                    slot.resources = 0

        # Reset markets
        self.distant_demand = 8
        self.distant_tiles = list(DISTANT_MARKET_TILES)
        random.shuffle(self.distant_tiles)
        self.coal_market = self.market_slots
        self.iron_market = self.market_slots

        # New deck
        deck = build_deck()
        random.shuffle(deck)
        remove = CARDS_TO_REMOVE.get(self.num_players, {}).get('rail', 0)
        deck = deck[remove:]

        for p in self.players:
            p.hand = [c['id'] for c in deck[:8]]
            deck = deck[8:]
            p.spent = 0
        self.draw_pile = [c['id'] for c in deck]

        self.era = 'rail'
        self.round = 1
        self.current_player_idx = 0
        self.actions_remaining = 2
        self.phase = 'actions'

        # Reorder by VP ascending
        self.turn_order = sorted(range(self.num_players), key=lambda s: self.players[s].vp)
        self._build_adjacency()


# ============ VALID ACTION GENERATION ============

def get_card_info(card_id):
    """Parse card ID to determine type."""
    if card_id.startswith('cottonMill_'):
        return 'industry', 'cottonMill'
    if card_id.startswith('coalMine_'):
        return 'industry', 'coalMine'
    if card_id.startswith('ironWorks_'):
        return 'industry', 'ironWorks'
    if card_id.startswith('port_'):
        return 'industry', 'port'
    if card_id.startswith('shipyard_'):
        return 'industry', 'shipyard'
    # Location card
    parts = card_id.rsplit('_', 1)
    return 'location', parts[0]


def generate_valid_actions(state):
    """Generate all valid actions for the current player."""
    player = state.current_player
    if not player.hand:
        return []

    actions = []
    card = player.hand[0]  # Use first card for all actions (sell/loan/develop don't care which)

    # Pass
    actions.append({'type': 'pass', 'card': card})

    # Take Loan
    if state.era != 'rail' or state.draw_pile:
        for amount in [10, 20, 30]:
            actions.append({'type': 'takeLoan', 'card': card, 'amount': amount})

    # Develop (1 or 2 types)
    developable = [t for t in player.mat if player.mat[t]]
    if developable:
        for t in developable:
            actions.append({'type': 'develop', 'card': card, 'develops': [t]})
        if len(developable) >= 2:
            for i, t1 in enumerate(developable):
                for t2 in developable[i:]:
                    actions.append({'type': 'develop', 'card': card, 'develops': [t1, t2]})

    # Build Industry
    network = state.get_player_network(player.seat)
    for card_id in set(player.hand):  # Deduplicate
        ctype, cval = get_card_info(card_id)
        for loc_id, slots in state.locations.items():
            for slot_idx, slot in enumerate(slots):
                if slot.owner is not None:
                    continue  # Simplified: skip overbuild for training
                for ind_type in slot.allowed:
                    if not player.mat[ind_type]:
                        continue
                    level = player.mat[ind_type][0]
                    if state.era == 'rail' and level <= 1:
                        continue
                    if ind_type == 'shipyard' and level == 0:
                        continue

                    tile = INDUSTRIES[ind_type]['levels'][level]
                    if player.money < tile['cost']:
                        continue

                    # Card check
                    if ctype == 'location' and cval != loc_id:
                        continue
                    if ctype == 'industry' and cval != ind_type:
                        if network and loc_id not in network:
                            continue

                    # Canal: one per location
                    if state.era == 'canal':
                        if any(s.owner == player.seat for s in slots):
                            continue

                    actions.append({
                        'type': 'buildIndustry',
                        'card': card_id,
                        'location': loc_id,
                        'slot': slot_idx,
                        'industry': ind_type,
                    })

    # Build Link
    has_tile = any(
        slot.owner == player.seat
        for slots in state.locations.values()
        for slot in slots
    )
    if has_tile:
        for link in state.links.values():
            if link.owner is not None:
                continue
            if state.era == 'canal' and not link.canal:
                continue
            if state.era == 'rail' and not link.rail:
                continue
            if network and link.fr not in network and link.to not in network:
                continue

            if state.era == 'canal':
                cost = 3 * link.segments
            else:
                cost = 5 * link.segments + 5  # Rough estimate for coal
            if player.money >= cost:
                actions.append({'type': 'buildLink', 'card': card, 'link': link.id})

    # Sell Cotton
    for loc_id, slots in state.locations.items():
        for slot_idx, slot in enumerate(slots):
            if slot.owner != player.seat or slot.industry_type != 'cottonMill' or slot.flipped:
                continue

            connected = state.get_connected(loc_id)

            # Via port
            for c_loc in connected:
                if c_loc not in state.locations:
                    continue
                for p_idx, p_slot in enumerate(state.locations[c_loc]):
                    if p_slot.industry_type == 'port' and not p_slot.flipped and p_slot.owner is not None:
                        actions.append({
                            'type': 'sellCotton',
                            'card': card,
                            'sales': [{
                                'mill_loc': loc_id, 'mill_slot': slot_idx,
                                'target': {'type': 'port', 'location': c_loc, 'slot': p_idx}
                            }]
                        })

            # Distant market
            if state.distant_demand > 0 and state.distant_tiles and state.is_connected_to_port(loc_id):
                actions.append({
                    'type': 'sellCotton',
                    'card': card,
                    'sales': [{
                        'mill_loc': loc_id, 'mill_slot': slot_idx,
                        'target': {'type': 'distant'}
                    }]
                })

    return actions


def generate_validated_actions(state):
    """Generate valid actions, filtering out ones that would fail."""
    actions = generate_valid_actions(state)
    if not actions:
        return actions

    validated = []
    for action in actions:
        if action['type'] in ('pass', 'takeLoan'):
            validated.append(action)
            continue
        # Test on a full copy
        test = state.copy()
        if test.apply_action(action):
            validated.append(action)

    if not validated and state.current_player.hand:
        validated.append({'type': 'pass', 'card': state.current_player.hand[0]})
    return validated


# Quick test
if __name__ == '__main__':
    state = GameState(3)
    turns = 0
    while state.phase != 'finished' and turns < 500:
        actions = generate_valid_actions(state)
        if not actions:
            break
        action = random.choice(actions)
        state.apply_action(action)
        turns += 1
    print(f"Game finished: {state.phase}, turns: {turns}")
    for p in state.players:
        print(f"  Player {p.seat}: VP={p.vp}, money={p.money}, income={INCOME_TRACK[p.income]}")
