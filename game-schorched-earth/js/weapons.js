// Weapon definitions. `ammo` is the per-round allotment per tank.
// type: 'missile' explodes on impact, 'dirt' adds a mound, 'roller' rolls
// downhill before exploding, 'mirv' splits into 5 warheads at apex.
window.SE = window.SE || {};

window.SE.WEAPONS = [
    { id: 'babyMissile', name: 'Baby Missile', radius: 22, maxDamage: 26,  ammo: Infinity, type: 'missile' },
    { id: 'missile',     name: 'Missile',      radius: 38, maxDamage: 46,  ammo: 10,       type: 'missile' },
    { id: 'bigNuke',     name: 'Big Nuke',     radius: 75, maxDamage: 100, ammo: 2,        type: 'missile' },
    { id: 'dirtBomb',    name: 'Dirt Bomb',    radius: 55, maxDamage: 0,   ammo: 3,        type: 'dirt'    },
    { id: 'roller',      name: 'Roller',       radius: 42, maxDamage: 55,  ammo: 5,        type: 'roller'  },
    { id: 'mirv',        name: 'MIRV',         radius: 30, maxDamage: 36,  ammo: 2,        type: 'mirv'    }
];
