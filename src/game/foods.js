// =============================================================================
// Foods — consumable buffs you feed the pond. Effects are temporary; genetics
// are never altered (a koi is what it is), but food can boost income, speed
// breeding, enrich the next brood, or attract more buyers.
// =============================================================================

export const FOODS = [
  {
    id: 'ricebran', name: 'Rice Bran', jp: '米糠', price: 30,
    desc: '+50% pond income for 60s.',
    buff: { kind: 'income', value: 1.5, ms: 60000 },
  },
  {
    id: 'wheatgerm', name: 'Wheat Germ', jp: '胚芽', price: 55,
    desc: 'Halves breeding rest for 120s.',
    buff: { kind: 'breedSpeed', value: 0.5, ms: 120000 },
  },
  {
    id: 'spirulina', name: 'Spirulina', jp: '藻', price: 80,
    desc: 'Enriches the next broods — finer lustre & size for 120s.',
    buff: { kind: 'breedQuality', value: 0.12, ms: 120000 },
  },
  {
    id: 'sakelees', name: 'Sake Lees', jp: '酒粕', price: 70,
    desc: 'A local delicacy — visitors come twice as often for 150s.',
    buff: { kind: 'offerRate', value: 0.5, ms: 150000 },
  },
  {
    id: 'premium', name: 'Premium Pellets', jp: '高級餌', price: 140,
    desc: '+150% pond income for 90s.',
    buff: { kind: 'income', value: 2.5, ms: 90000 },
  },
];

export const FOOD_BY_ID = Object.fromEntries(FOODS.map((f) => [f.id, f]));
