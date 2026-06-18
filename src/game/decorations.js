// =============================================================================
// Decoration catalog for the building system. Each entry has a model key (built
// in scene/decor.js), a price, and a hint of where it belongs. Players buy and
// then tap to place them anywhere; placements persist in the save.
// =============================================================================

export const DECOR = [
  { id: 'lantern',  name: 'Stone Lantern',  jp: '灯籠',   price: 120, place: 'edge',  icon: '🏮' },
  { id: 'torii',    name: 'Torii Gate',     jp: '鳥居',   price: 320, place: 'edge',  icon: '⛩️' },
  { id: 'bridge',   name: 'Wooden Bridge',  jp: '橋',     price: 460, place: 'water', icon: '🌉' },
  { id: 'pagoda',   name: 'Pagoda',         jp: '五重塔', price: 700, place: 'land',  icon: '🏯' },
  { id: 'bonsai',   name: 'Bonsai',         jp: '盆栽',   price: 170, place: 'edge',  icon: '🪴' },
  { id: 'stones',   name: 'Stepping Stones',jp: '飛び石', price: 90,  place: 'water', icon: '🪨' },
  { id: 'fountain', name: 'Bamboo Fountain',jp: '鹿威し', price: 210, place: 'edge',  icon: '🎍' },
  { id: 'maple',    name: 'Maple Tree',     jp: '紅葉',   price: 190, place: 'land',  icon: '🍁' },
  { id: 'pine',     name: 'Pine Tree',      jp: '松',     price: 180, place: 'land',  icon: '🌲' },
  { id: 'bush',     name: 'Azalea Bush',    jp: '躑躅',   price: 70,  place: 'land',  icon: '🌳' },
  { id: 'lilies',   name: 'Lily Cluster',   jp: '睡蓮',   price: 60,  place: 'water', icon: '🪷' },
  { id: 'snail',    name: 'Pond Snail',     jp: '蝸牛',   price: 45,  place: 'edge',  icon: '🐌' },
];

export const DECOR_BY_ID = Object.fromEntries(DECOR.map((d) => [d.id, d]));
