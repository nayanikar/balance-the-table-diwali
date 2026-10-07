/** @typedef {'sav'|'swt'} SideCode */
/** @typedef {'savoury'|'sweet'} PublicSide */

export const ICONS = {
  bowl: `<path class="f" d="M5 20H35C35 30 28 35 20 35S5 30 5 20Z"/><path class="l" d="M14 15q-3-4 0-8M20 16q-3-4 0-8M26 15q-3-4 0-8"/><path class="l" d="M10 25q10 4 20 0"/>`,
  pot: `<path class="f" d="M7 19H33V30Q33 35 28 35H12Q7 35 7 30Z"/><path class="l" d="M3 22H7M33 22H37M10 19Q20 12 30 19"/><circle class="l" cx="20" cy="12" r="2"/>`,
  dumpling: `<path class="f" d="M4 33C6 16 34 16 36 33Z"/><path class="l" d="M12 26l2-4M20 23v-4M28 26l-2-4"/>`,
  samosa: `<path class="f" d="M5 34L20 9L35 34Z"/><path class="l" d="M20 10L18 33M11 25l6 1"/>`,
  skewer: `<path class="l" d="M4 33L36 9"/><rect class="f" x="9" y="22" width="7" height="7" rx="1.5" transform="rotate(-37 12.5 25.5)"/><rect class="f" x="16.5" y="16.5" width="7" height="7" rx="1.5" transform="rotate(-37 20 20)"/><rect class="f" x="24" y="11" width="7" height="7" rx="1.5" transform="rotate(-37 27.5 14.5)"/>`,
  pizza: `<path class="f" d="M6 13Q20 7 34 13L20 36Z"/><path class="l" d="M7 16Q20 10 33 16"/><circle class="f2" cx="17" cy="20" r="2.2"/><circle class="f2" cx="23" cy="25" r="2"/>`,
  slice: `<path class="f" d="M5 34H35V19L5 27Z"/><path class="l" d="M5 31L35 26"/><circle class="f2" cx="29" cy="15" r="3.4"/>`,
  cookie: `<circle class="f" cx="20" cy="25" r="11"/><path class="l dots" d="M16 21h.1M24 22h.1M17 29h.1M25 29h.1M21 25h.1"/>`,
  donut: `<ellipse class="f" cx="20" cy="26" rx="13" ry="9"/><ellipse class="hole" cx="20" cy="25" rx="4" ry="2.4"/><path class="l" d="M11 23l2-1M27 22l2 1M14 30l2 1M25 30l2-1M19 20h2"/>`,
  pudding: `<path class="f" d="M9 34L12 19H28L31 34Z"/><path class="f2" d="M12 19H28L27.4 23Q25.5 26 23.6 23Q21.8 26 20 23Q18.2 26 16.4 23Q14.5 26 12.6 23Z"/>`,
  icecream: `<path class="f" d="M12 20L20 36L28 20Z"/><path class="l" d="M14 24l8 4M16 28l6 3"/><circle class="f" cx="20" cy="15" r="7.5"/>`,
  cupcake: `<path class="f" d="M10 24H30L27 35H13Z"/><path class="f" d="M9 24C8 15 32 15 31 24Z"/><circle class="f2" cx="20" cy="13" r="2.6"/><path class="l" d="M16 27l1 6M20 27v6M24 27l-1 6"/>`,
  cloche: `<path class="f" d="M7 31C7 17 33 17 33 31Z"/><path class="l" d="M4 33H36M12 26q2-4 6-5"/><circle class="f" cx="20" cy="15.5" r="2.2"/>`,
};

const RULES = {
  sav: [
    [/momo|dumpling|gyoza|dim ?sum|bao|wonton/i, 'dumpling'],
    [/samosa|pakor|empanada|spring roll|kachori|puff/i, 'samosa'],
    [/tikka|kebab|kabab|satay|skewer/i, 'skewer'],
    [/pizza|flatbread|focaccia/i, 'pizza'],
    [/curry|stew|chil+i|korma|masala|dal|chole|rajma|butter chicken/i, 'pot'],
    [/noodle|ramen|soup|pho|biryani|rice|pulao|salad|pasta|bowl|khichdi/i, 'bowl'],
  ],
  swt: [
    [/ice ?cream|kulfi|gelato|sorbet/i, 'icecream'],
    [/cupcake|muffin/i, 'cupcake'],
    [/cake|tiramisu|pie|tart|pastry|cheesecake/i, 'slice'],
    [/cookie|biscuit|brownie|lad+o+|barfi|fudge/i, 'cookie'],
    [/donut|doughnut|jalebi|gulab|churro/i, 'donut'],
    [/pudding|flan|kheer|rasmalai|custard|mousse|halwa|trifle|panna/i, 'pudding'],
  ],
};

const HASH_DEFAULTS = {
  sav: ['bowl', 'dumpling', 'pot', 'samosa'],
  swt: ['slice', 'cookie', 'pudding', 'donut'],
};

/** @type {Record<SideCode, string[]>} */
export const PALETTE = {
  sav: ['bowl', 'pot', 'dumpling', 'samosa', 'skewer', 'pizza'],
  swt: ['slice', 'cookie', 'donut', 'pudding', 'icecream', 'cupcake'],
};

/** @param {SideCode} side @param {string|null|undefined} name @param {number} [index] */
export function iconFor(side, name, index = 0) {
  if (!name) return 'cloche';
  for (const [re, ic] of RULES[side]) {
    if (re.test(name)) return ic;
  }
  let h = index;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return HASH_DEFAULTS[side][Math.abs(h) % 4];
}

/** @param {PublicSide} side */
export function toSideCode(side) {
  return side === 'savoury' ? 'sav' : 'swt';
}

/** @param {SideCode} code */
export function toPublicSide(code) {
  return code === 'sav' ? 'savoury' : 'sweet';
}

export const SEEDS = {
  sweet: {
    sav: ['Biryani', 'Momos'],
    swt: ['Tiramisu', 'Cookies', 'Rasmalai', null, 'Gulab jamun', 'Brownies'],
  },
  even: {
    sav: ['Biryani', 'Momos', 'Paneer tikka', 'Hakka noodles'],
    swt: ['Tiramisu', 'Cookies', 'Rasmalai', null],
  },
  sav: {
    sav: ['Biryani', 'Momos', 'Paneer tikka', 'Hakka noodles', 'Samosas'],
    swt: ['Tiramisu', null],
  },
  empty: { sav: [], swt: [] },
};
