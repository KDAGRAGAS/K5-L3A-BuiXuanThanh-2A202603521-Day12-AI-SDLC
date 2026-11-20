// Sinh game.contract.json từ src/core/config.js để hai bên không lệch nhau.
import { writeFileSync } from 'node:fs';
import { TUNING } from '../src/core/config.js';

export const CONTRACT = {
  contract_version: '1.3',
  team: '2A202603521-bui-xuan-thanh',
  build_cmd: 'npm install',
  run_cmd: 'npm start',
  headless_cmd: 'node src/headless/cli.js',
  bench_cmd: 'node scripts/bench.mjs',
  soak_cmd: 'node --no-opt --max-semi-space-size=1 --expose-gc src/headless/soak.js',
  tuning: {
    player_speed: TUNING.player_speed,
    carry_capacity: TUNING.carry_capacity,
    capacity_max: TUNING.capacity_max,
    lantern_cost: TUNING.lantern_cost,
    relight_cost: TUNING.relight_cost,
    pickup_radius: TUNING.pickup_radius,
    interact_radius: TUNING.interact_radius,
    pulse_cost: TUNING.pulse_cost,
    pulse_radius: TUNING.pulse_radius,
    pulse_stun_ticks: TUNING.pulse_stun_ticks,
    pulse_push_m: TUNING.pulse_push_m,
    pulse_cooldown_s: TUNING.pulse_cooldown_s,
    safe_radius: TUNING.safe_radius,
    shade_speed: TUNING.shade_speed,
    shade_hit_radius: TUNING.shade_hit_radius,
    invuln_ticks: TUNING.invuln_ticks,
    hit_drop_ratio: TUNING.hit_drop_ratio,
    flames: TUNING.flames,
    night1_duration_s: TUNING.night1_duration_s,
    night2_duration_s: TUNING.night2_duration_s,
    night3_duration_s: TUNING.night3_duration_s,
    dash_speed: TUNING.dash_speed,
    dash_duration_s: TUNING.dash_duration_s,
    dash_cooldown_s: TUNING.dash_cooldown_s,
    fuel_max: TUNING.fuel_max,
    fuel_decay_per_s: TUNING.fuel_decay_per_s,
    fuel_per_mote: TUNING.fuel_per_mote,
    drain_per_s: TUNING.drain_per_s,
    low_fuel_threshold: TUNING.low_fuel_threshold,
    win_ratio: TUNING.win_ratio,
    score: TUNING.score,
  },
};

if (process.argv[1] && process.argv[1].endsWith('gen-contract.mjs')) {
  writeFileSync(new URL('../game.contract.json', import.meta.url), JSON.stringify(CONTRACT, null, 2) + '\n');
  console.log('da ghi game.contract.json');
}
