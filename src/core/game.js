// Logic game thuần, tất định, không phụ thuộc hiển thị.
// Dùng chung cho bản web (web/main.js) và chế độ headless (src/headless/cli.js).
import { TUNING, WORLD, TICK_RATE } from './config.js';
import { mulberry32 } from './rng.js';

const DT = 1 / TICK_RATE;

export function r3(v) {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? 0 : r; // tránh -0
}
const v3 = (p) => [r3(p[0]), r3(p[1]), r3(p[2])];
export const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const secToTicks = (s) => Math.round(s * TICK_RATE);

export const DEFAULT_INPUT = Object.freeze({
  move: [0, 0],
  cam_yaw_deg: 0,
  jump: false,
  interact: false,
  pulse: false,
});

export class Game {
  constructor({ seed = 0, night = 1, scenario = null, tuning = TUNING, world = WORLD } = {}) {
    if (night !== 1) throw new Error(`night ${night} chưa được hỗ trợ (Phase 1 chỉ có Đêm 1)`);
    this.t = tuning;
    this.w = world;
    this.rng = mulberry32(seed);
    this.tick = 0;
    this.steps = 0;
    this.state = 'playing';
    this.result = null;
    this.score = 0;
    this.events = [];
    this.player = {
      pos: [0, 0, 0],
      vy: 0,
      grounded: true,
      flames: tuning.flames,
      carried: 0,
      invulnTicks: 0,
      pulseCdTicks: 0,
      facing: 0,
    };
    this.prev = { jump: false, interact: false, pulse: false };
    this.randomMotes = true;
    this.randomShades = true;
    this.timeLeft0 = tuning.night1_duration_s;
    this.nextMoteId = 1;
    this.nextShadeId = 1;
    this.shadeTimer = 0;
    this.moteTimer = 0;
    this.motes = null;
    this.shades = null;

    this.lanterns = [];
    const n = tuning.lantern_count_night1;
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n;
      const R = world.lantern_ring_radius;
      this.lanterns.push({ id: `L${i + 1}`, pos: [R * Math.sin(a), 0, R * Math.cos(a)], lit: false, deposited: 0 });
    }

    if (scenario) this.applyScenario(scenario);

    // Dựng mặc định cho phần scenario không chỉ định (không phát sự kiện, không cộng điểm).
    if (this.motes === null) {
      this.motes = [];
      if (this.randomMotes) for (let i = 0; i < world.mote_count; i++) this.motes.push(this.makeRandomMote());
    }
    if (this.shades === null) {
      this.shades = [];
      if (this.randomShades) for (let i = 0; i < world.initial_shades; i++) this.shades.push(this.makeShade());
    }
  }

  // ---------- dựng scenario ----------
  applyScenario(s) {
    const p = this.player;
    if (s.player) {
      if (s.player.pos) {
        p.pos = [...s.player.pos];
        p.grounded = p.pos[1] <= 0;
        if (p.pos[1] < 0) p.pos[1] = 0;
      }
      if (s.player.carried !== undefined) p.carried = s.player.carried;
      if (s.player.flames !== undefined) p.flames = s.player.flames;
    }
    if (s.random_motes !== undefined) this.randomMotes = s.random_motes;
    if (s.random_shades !== undefined) this.randomShades = s.random_shades;
    if (s.time_left_s !== undefined) this.timeLeft0 = s.time_left_s;
    if (s.lanterns) {
      for (const L of s.lanterns) {
        const lan = this.lanterns.find((x) => x.id === L.id);
        if (!lan) throw new Error(`lantern id không tồn tại: ${L.id}`);
        if (L.pos) lan.pos = [...L.pos];
        if (L.deposited !== undefined) lan.deposited = L.deposited;
        if (L.lit !== undefined) {
          lan.lit = L.lit;
          if (L.lit && L.deposited === undefined) lan.deposited = this.t.lantern_cost;
        }
      }
    }
    if (s.motes) {
      this.motes = s.motes.map((pos) => ({ id: `M${this.nextMoteId++}`, pos: [pos[0], 0, pos[2]] }));
    }
    if (s.shades) {
      this.shades = s.shades.map((sh, i) => ({
        id: sh.id ?? `S${i + 1}`,
        pos: [...sh.pos],
        state: 'chase',
        stunTicks: 0,
      }));
      let maxId = 0;
      for (const sh of this.shades) {
        const m = /^S(\d+)$/.exec(sh.id);
        if (m) maxId = Math.max(maxId, Number(m[1]));
      }
      this.nextShadeId = Math.max(maxId, this.shades.length) + 1;
    }
  }

  makeRandomMote() {
    const { mote_min_r: a, mote_max_r: b } = this.w;
    const r = Math.sqrt(a * a + this.rng() * (b * b - a * a));
    const ang = this.rng() * 2 * Math.PI;
    return { id: `M${this.nextMoteId++}`, pos: [r * Math.sin(ang), 0, r * Math.cos(ang)] };
  }

  makeShade() {
    const ang = this.rng() * 2 * Math.PI;
    const R = this.w.shade_spawn_r;
    const sh = { id: `S${this.nextShadeId++}`, pos: [R * Math.sin(ang), this.w.shade_y, R * Math.cos(ang)], state: 'chase', stunTicks: 0 };
    this.constrainShade(sh);
    return sh;
  }

  emit(name, data) {
    this.events.push({ type: 'event', tick: this.tick, name, data });
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  get timeLeft() {
    return this.timeLeft0 - this.steps / TICK_RATE;
  }

  clampIsland(pos) {
    const d = Math.hypot(pos[0], pos[2]);
    const R = this.w.island_radius;
    if (d > R) {
      pos[0] *= R / d;
      pos[2] *= R / d;
    }
  }

  // Bóng Mực không vào được vùng safe_radius quanh đèn đã thắp.
  constrainShade(sh) {
    for (const L of this.lanterns) {
      if (!L.lit) continue;
      const dx = sh.pos[0] - L.pos[0];
      const dz = sh.pos[2] - L.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < this.t.safe_radius) {
        const ux = d > 1e-9 ? dx / d : 1;
        const uz = d > 1e-9 ? dz / d : 0;
        sh.pos[0] = L.pos[0] + ux * this.t.safe_radius;
        sh.pos[2] = L.pos[2] + uz * this.t.safe_radius;
      }
    }
    this.clampIsland(sh.pos);
  }

  // ---------- một bước mô phỏng (1/60 s) ----------
  step(input = DEFAULT_INPUT) {
    if (this.state !== 'playing') return;
    const t = this.t;
    const w = this.w;
    const p = this.player;
    this.tick += 1; // sự kiện trong bước k ghi tick = k+1

    // nút chỉ kích hoạt khi chuyển false -> true
    const jumpE = !!input.jump && !this.prev.jump;
    const interactE = !!input.interact && !this.prev.interact;
    const pulseE = !!input.pulse && !this.prev.pulse;
    this.prev = { jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse };

    // bộ đếm
    if (p.invulnTicks > 0) p.invulnTicks--;
    if (p.pulseCdTicks > 0) p.pulseCdTicks--;
    for (const sh of this.shades) {
      if (sh.state === 'stunned') {
        sh.stunTicks--;
        if (sh.stunTicks <= 0) {
          sh.stunTicks = 0;
          sh.state = 'chase';
        }
      }
    }

    // di chuyển theo hướng camera
    let [mx, mz] = input.move ?? [0, 0];
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const th = ((input.cam_yaw_deg ?? 0) * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    p.pos[0] += wx * t.player_speed * DT;
    p.pos[2] += wz * t.player_speed * DT;
    if (wx !== 0 || wz !== 0) p.facing = Math.atan2(wx, wz);
    this.clampIsland(p.pos);

    // nhảy
    if (jumpE && p.grounded) {
      p.vy = w.jump_speed;
      p.grounded = false;
    }
    if (!p.grounded) {
      p.vy -= w.gravity * DT;
      p.pos[1] += p.vy * DT;
      if (p.pos[1] <= 0) {
        p.pos[1] = 0;
        p.vy = 0;
        p.grounded = true;
      }
    }

    // nhặt đom đóm (tự động)
    if (this.motes.length) {
      const kept = [];
      for (const m of this.motes) {
        if (p.carried < t.carry_capacity && distXZ(m.pos, p.pos) <= t.pickup_radius) {
          p.carried++;
          this.score += t.score.per_mote;
          this.emit('mote_picked', { carried: p.carried });
        } else kept.push(m);
      }
      this.motes = kept;
    }

    // nạp đèn
    if (interactE && p.carried > 0) {
      let best = null;
      let bestD = Infinity;
      for (const L of this.lanterns) {
        if (L.lit) continue;
        const d = distXZ(L.pos, p.pos);
        if (d <= t.interact_radius && d < bestD) {
          best = L;
          bestD = d;
        }
      }
      if (best) {
        const amount = Math.min(p.carried, t.lantern_cost - best.deposited);
        if (amount > 0) {
          p.carried -= amount;
          best.deposited += amount;
          this.emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= t.lantern_cost) {
            best.lit = true;
            this.score += t.score.per_lantern;
            this.emit('lantern_lit', { lantern_id: best.id });
            for (const sh of this.shades) this.constrainShade(sh);
          }
        }
      }
    }

    // tỏa sáng
    if (pulseE && p.pulseCdTicks === 0 && p.carried >= t.pulse_cost) {
      p.carried -= t.pulse_cost;
      p.pulseCdTicks = secToTicks(t.pulse_cooldown_s);
      const stunned = [];
      for (const sh of this.shades) {
        const dx = sh.pos[0] - p.pos[0];
        const dz = sh.pos[2] - p.pos[2];
        const d = Math.hypot(dx, dz);
        if (d <= t.pulse_radius) {
          sh.state = 'stunned';
          sh.stunTicks = secToTicks(t.pulse_stun_s);
          const ux = d > 1e-9 ? dx / d : 1;
          const uz = d > 1e-9 ? dz / d : 0;
          sh.pos[0] += ux * t.pulse_push_m;
          sh.pos[2] += uz * t.pulse_push_m;
          this.constrainShade(sh);
          stunned.push(sh.id);
        }
      }
      this.score += stunned.length * t.score.per_stun;
      this.emit('pulse', { stunned_ids: stunned });
    }

    // Bóng Mực đuổi
    const sstep = t.shade_speed * DT;
    for (const sh of this.shades) {
      if (sh.state !== 'chase') continue;
      const dx = p.pos[0] - sh.pos[0];
      const dz = p.pos[2] - sh.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > 1e-9) {
        const s = Math.min(sstep, d);
        sh.pos[0] += (dx / d) * s;
        sh.pos[2] += (dz / d) * s;
      }
      this.constrainShade(sh);
    }

    // va chạm
    if (p.invulnTicks === 0) {
      for (const sh of this.shades) {
        if (sh.state === 'stunned') continue;
        if (distXZ(sh.pos, p.pos) <= t.shade_hit_radius) {
          p.flames = Math.max(0, p.flames - 1);
          const dropped = Math.floor(p.carried * t.hit_drop_ratio);
          p.carried -= dropped;
          p.invulnTicks = secToTicks(t.invuln_s);
          // bật Bóng Mực lùi lại để nó không dính chặt vào Mây
          const dx = sh.pos[0] - p.pos[0];
          const dz = sh.pos[2] - p.pos[2];
          const d = Math.hypot(dx, dz);
          sh.pos[0] += (d > 1e-9 ? dx / d : 1) * w.shade_hit_knockback_m;
          sh.pos[2] += (d > 1e-9 ? dz / d : 0) * w.shade_hit_knockback_m;
          this.constrainShade(sh);
          this.emit('player_hit', { by: 'shade', flames: p.flames, dropped });
          break;
        }
      }
    }

    // sinh thêm
    if (this.randomShades) {
      this.shadeTimer++;
      if (this.shadeTimer >= secToTicks(w.shade_spawn_interval_s)) {
        this.shadeTimer = 0;
        if (this.shades.length < w.max_shades) {
          const sh = this.makeShade();
          this.shades.push(sh);
          this.emit('shade_spawned', { id: sh.id });
        }
      }
    }
    if (this.randomMotes) {
      this.moteTimer++;
      if (this.moteTimer >= secToTicks(w.mote_respawn_interval_s)) {
        this.moteTimer = 0;
        if (this.motes.length < w.mote_respawn_below) this.motes.push(this.makeRandomMote());
      }
    }

    this.steps += 1;

    // kết thúc: thắng ưu tiên, rồi hết máu, rồi bình minh
    if (this.lanterns.every((L) => L.lit)) {
      this.score += Math.floor(Math.max(0, this.timeLeft)) * t.score.per_second_left;
      this.score += p.flames * t.score.per_flame_left;
      this.finish('won', 'all_lit');
    } else if (p.flames <= 0) {
      this.finish('lost', 'no_flames');
    } else if (this.timeLeft <= 1e-9) {
      this.finish('lost', 'dawn');
    }
  }

  finish(result, reason) {
    this.state = result;
    this.result = { result, reason };
    this.emit('game_over', { result, reason });
  }

  snapshot() {
    const p = this.player;
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.tick,
      state: this.state,
      time_left_s: r3(Math.max(0, this.timeLeft)),
      score: this.score,
      player: { pos: v3(p.pos), flames: p.flames, carried: p.carried },
      lanterns: this.lanterns.map((L) => ({ id: L.id, pos: v3(L.pos), lit: L.lit, deposited: L.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: v3(s.pos), state: s.state })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: v3(m.pos) })),
    };
  }
}
