// SVG Board Renderer for Brass: Lancashire
// Uses the actual game board map as background with interactive overlay

const BoardRenderer = {
  svg: null,

  init() {
    this.svg = document.getElementById('game-board');
    this.render();
  },

  render() {
    if (!this.svg) return;
    this.svg.innerHTML = '';

    // Board map background image
    const img = this.createSVG('image', {
      href: '/img/board-map.jpg',
      x: 0, y: 0,
      width: 600, height: 520,
      preserveAspectRatio: 'xMidYMid meet'
    });
    this.svg.appendChild(img);

    // Semi-transparent overlay for contrast
    this.addRect(0, 0, 600, 520, '#000', 0.15);

    // Draw links first (below locations)
    this.drawLinks();

    // Draw non-buildable waypoints
    this.drawNonBuildable();

    // Draw external ports
    this.drawExternalPorts();

    // Draw buildable locations
    this.drawLocations();
  },

  drawLinks() {
    const state = gameState;
    const era = state.era;

    for (const link of BOARD.links) {
      const from = BOARD.locations[link.from];
      const to = BOARD.locations[link.to];
      if (!from || !to) continue;

      const linkState = state.board.links[link.id];
      const isAvailable = era === 'canal' ? link.canal : link.rail;

      let color = '#44553322';
      let width = 2;
      let dash = '';

      if (linkState && linkState.owner !== null) {
        color = BOARD.playerColors[linkState.owner];
        width = 5;
        if (linkState.type === 'canal') dash = '8,4';
      } else if (isAvailable) {
        color = era === 'canal' ? '#4488ccaa' : '#886644aa';
        width = 3;
        dash = '4,4';
      } else {
        color = '#33441144';
        width = 1;
        dash = '2,4';
      }

      // If link goes through a non-buildable waypoint, draw 2 segments
      if (link.through && BOARD.nonBuildable[link.through]) {
        const wp = BOARD.nonBuildable[link.through];
        this.drawLinkLine(from.x, from.y, wp.x, wp.y, color, width, dash, link.id);
        this.drawLinkLine(wp.x, wp.y, to.x, to.y, color, width, dash, link.id);

        // Double-segment indicator
        if (linkState && linkState.owner === null && isAvailable) {
          const label = this.createSVG('text', {
            x: wp.x, y: wp.y - 10,
            'text-anchor': 'middle',
            'font-size': '8',
            fill: '#ffcc00',
            'font-weight': 'bold',
            'pointer-events': 'none'
          });
          label.textContent = 'x2';
          this.svg.appendChild(label);
        }
      } else {
        this.drawLinkLine(from.x, from.y, to.x, to.y, color, width, dash, link.id);
      }
    }
  },

  drawLinkLine(x1, y1, x2, y2, color, width, dash, linkId) {
    const line = this.createSVG('line', {
      x1, y1, x2, y2,
      stroke: color,
      'stroke-width': width,
      'stroke-dasharray': dash,
      'stroke-linecap': 'round',
      'data-link-id': linkId,
      class: 'board-link'
    });
    this.svg.appendChild(line);
  },

  drawNonBuildable() {
    for (const [id, wp] of Object.entries(BOARD.nonBuildable)) {
      // Small diamond marker
      const diamond = this.createSVG('polygon', {
        points: `${wp.x},${wp.y-8} ${wp.x+8},${wp.y} ${wp.x},${wp.y+8} ${wp.x-8},${wp.y}`,
        fill: '#33333388',
        stroke: '#66666688',
        'stroke-width': 1
      });
      this.svg.appendChild(diamond);

      const text = this.createSVG('text', {
        x: wp.x, y: wp.y + 18,
        'text-anchor': 'middle',
        'font-size': '7',
        fill: '#ccc',
        'font-style': 'italic',
        'pointer-events': 'none'
      });
      text.textContent = wp.name;
      this.svg.appendChild(text);
    }
  },

  drawExternalPorts() {
    for (const [id, port] of Object.entries(BOARD.externalPorts)) {
      // External port marker (anchor shape)
      const circle = this.createSVG('circle', {
        cx: port.x, cy: port.y, r: 12,
        fill: '#1a3a5a',
        stroke: '#4488cc',
        'stroke-width': 2
      });
      this.svg.appendChild(circle);

      const icon = this.createSVG('text', {
        x: port.x, y: port.y + 3,
        'text-anchor': 'middle',
        'font-size': '10',
        fill: '#88ccff',
        'font-weight': 'bold',
        'pointer-events': 'none'
      });
      icon.textContent = 'E';
      this.svg.appendChild(icon);

      const label = this.createSVG('text', {
        x: port.x, y: port.y + 22,
        'text-anchor': 'middle',
        'font-size': '8',
        fill: '#88ccff',
        'pointer-events': 'none'
      });
      label.textContent = port.name;
      this.svg.appendChild(label);

      // Draw dashed lines to connected locations
      for (const locId of port.connectedTo) {
        const loc = BOARD.locations[locId];
        if (!loc) continue;
        const line = this.createSVG('line', {
          x1: port.x, y1: port.y,
          x2: loc.x, y2: loc.y,
          stroke: '#4488cc44',
          'stroke-width': 1,
          'stroke-dasharray': '3,3'
        });
        this.svg.appendChild(line);
      }
    }
  },

  drawLocations() {
    const state = gameState;

    for (const [locId, loc] of Object.entries(BOARD.locations)) {
      const locState = state.board.locations[locId];
      if (!locState) continue;

      const numSlots = locState.slots.length;
      const radius = 16 + numSlots * 4;

      // Location circle with semi-transparent fill so map shows through
      const circle = this.createSVG('circle', {
        cx: loc.x, cy: loc.y, r: radius,
        fill: '#e8dcc8cc',
        stroke: '#8b7355',
        'stroke-width': 2,
        'data-location': locId,
        class: 'board-location'
      });
      this.svg.appendChild(circle);

      // Location name
      const text = this.createSVG('text', {
        x: loc.x, y: loc.y - radius - 4,
        'text-anchor': 'middle',
        'font-size': '8',
        'font-family': 'sans-serif',
        fill: '#fff',
        'font-weight': 'bold',
        'paint-order': 'stroke',
        stroke: '#000',
        'stroke-width': 2
      });
      text.textContent = loc.name;
      this.svg.appendChild(text);

      // Draw industry slots
      this.drawSlots(locId, loc, locState);
    }
  },

  drawSlots(locId, loc, locState) {
    const slots = locState.slots;
    const spacing = 18;
    const startX = loc.x - (slots.length - 1) * spacing / 2;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const sx = startX + i * spacing;
      const sy = loc.y;

      if (slot.owner !== null) {
        // Filled slot
        const fillColor = slot.flipped
          ? BOARD.playerColors[slot.owner]
          : BOARD.industryColors[slot.industryType] || '#ccc';

        const rect = this.createSVG('rect', {
          x: sx - 7, y: sy - 7,
          width: 14, height: 14,
          rx: 2,
          fill: fillColor,
          stroke: BOARD.playerColors[slot.owner],
          'stroke-width': slot.flipped ? 3 : 1.5,
          'data-location': locId,
          'data-slot': i,
          class: 'board-slot filled'
        });
        this.svg.appendChild(rect);

        // Industry icon + level
        const icon = this.createSVG('text', {
          x: sx, y: sy + 3,
          'text-anchor': 'middle',
          'font-size': '8',
          'font-weight': 'bold',
          fill: slot.industryType === 'coalMine' ? '#fff' : '#333',
          'pointer-events': 'none'
        });
        icon.textContent = BOARD.industryIcons[slot.industryType] + slot.level;
        this.svg.appendChild(icon);

        // Resource cubes
        if (slot.resources > 0) {
          const cubeColor = slot.industryType === 'coalMine' ? '#111' : '#d4740e';
          for (let r = 0; r < slot.resources; r++) {
            const cube = this.createSVG('rect', {
              x: sx - 7 + r * 4, y: sy + 9,
              width: 3, height: 3,
              fill: cubeColor,
              stroke: '#fff',
              'stroke-width': 0.5
            });
            this.svg.appendChild(cube);
          }
        }
      } else {
        // Empty slot - show allowed types
        const allowed = slot.allowed;
        const isDual = allowed.length > 1;

        const rect = this.createSVG('rect', {
          x: sx - 7, y: sy - 7,
          width: 14, height: 14,
          rx: 2,
          fill: isDual ? '#ffffff22' : 'none',
          stroke: '#8b735566',
          'stroke-width': 1,
          'stroke-dasharray': '3,2',
          'data-location': locId,
          'data-slot': i,
          class: 'board-slot empty'
        });
        this.svg.appendChild(rect);

        // Show allowed type icons
        const label = this.createSVG('text', {
          x: sx, y: sy + 3,
          'text-anchor': 'middle',
          'font-size': isDual ? '6' : '7',
          fill: '#8b735599',
          'pointer-events': 'none'
        });
        label.textContent = allowed.map(t => BOARD.industryIcons[t] || '?').join('/');
        this.svg.appendChild(label);
      }
    }
  },

  // SVG helpers
  createSVG(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  },

  addRect(x, y, w, h, fill, opacity) {
    const rect = this.createSVG('rect', {
      x, y, width: w, height: h,
      fill, opacity: opacity || 1
    });
    this.svg.appendChild(rect);
  },

  highlightLocations(locIds, callback) {
    document.querySelectorAll('.board-location').forEach(el => {
      const locId = el.getAttribute('data-location');
      if (locIds.includes(locId)) {
        el.classList.add('highlight');
        el.style.cursor = 'pointer';
        el.onclick = () => callback(locId);
      }
    });
  },

  highlightLinks(linkIds, callback) {
    document.querySelectorAll('.board-link').forEach(el => {
      const linkId = el.getAttribute('data-link-id');
      if (linkIds.includes(linkId)) {
        el.classList.add('highlight');
        el.style.cursor = 'pointer';
        el.onclick = () => callback(linkId);
      }
    });
  },

  clearHighlights() {
    document.querySelectorAll('.highlight').forEach(el => {
      el.classList.remove('highlight');
      el.style.cursor = '';
      el.onclick = null;
    });
  }
};
