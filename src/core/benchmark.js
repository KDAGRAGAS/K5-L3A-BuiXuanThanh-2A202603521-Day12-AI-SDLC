import { mulberry32 } from './rng.js';

export function makeBenchmarkScenario(seed = 42) {
  const rng = mulberry32(seed);
  const shades = Array.from({ length: 200 }, (_, i) => {
    const angle = i * Math.PI * (3 - Math.sqrt(5)) + rng() * 0.08;
    const radius = 16 + rng() * 22;
    return { id: `S${i + 1}`, state: 'wander', pos: [Number((Math.cos(angle) * radius).toFixed(3)), 1, Number((Math.sin(angle) * radius).toFixed(3))] };
  });
  const motes = Array.from({ length: 100 }, (_, i) => {
    const angle = i * Math.PI * (3 - Math.sqrt(5)) + rng() * 0.08;
    const radius = 4 + rng() * 34;
    return { id: `M${i + 1}`, pos: [Number((Math.cos(angle) * radius).toFixed(3)), 0, Number((Math.sin(angle) * radius).toFixed(3))] };
  });
  return {
    benchmark_mode: true,
    player: { pos: [0, 0, 0], flames: 3, carried: 0 },
    random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
    time_left_s: 86400,
    motes,
    shades,
    lanterns: [1, 2, 3].map((n) => ({ id: `L${n}`, lit: true, fuel: 100 })),
  };
}
