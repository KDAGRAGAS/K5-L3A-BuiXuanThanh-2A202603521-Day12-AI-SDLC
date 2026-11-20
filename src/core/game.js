// Logic game thuần, tất định, không phụ thuộc hiển thị.
// Dùng chung cho bản web (web/main.js) và chế độ headless (src/headless/cli.js).
// Test Contract v1.2 — Phase 3: fuel system, drain state, dawn_survived, dynamic capacity.
import { TUNING, WORLD, TICK_RATE } from './config.js';
import { MAPS, getGroundY, isOnIsland } from './maps.js';
import { mulberry32 } from './rng.js';

const DT = 1 / TICK_RATE;

export function r3(v) {
  const r = Math.round(v * 1000) / 1000;
  return r === 0 ? 0 : r;
}
const v3 = (p) => [r3(p[0]), r3(p[1]), r3(p[2])];
export const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3D = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export const DEFAULT_INPUT = Object.freeze({
  move: [0, 0],
  cam_yaw_deg: 0,
  jump: false,
  interact: false,
  pulse: false,
  dash: false,
  pause: false,
});

export class Game {
  constructor({ seed = 0, night = 1, scenario = null, tuning = TUNING, world = WORLD, benchmarkMode = false } = {}) {
    if (night < 1 || night > 3) throw new Error(`night ${night} không hợp lệ (1-3)`);
    this.t = tuning;
    this.w = world;
    this.night = night;
    this.benchmarkMode = benchmarkMode;
    this.map = MAPS[night];
    this.rng = mulberry32(seed);
    this.tick = 0;
    this.steps = 0; // sim ticks (paused thì không tăng)
    this.nightStartEmitted = false;
    this.state = 'playing';
    this.paused = false;
    this.result = null;
    this.score = 0;
    this.events = [];

    const dur = night === 1 ? tuning.night1_duration_s : night === 2 ? tuning.night2_duration_s : tuning.night3_duration_s;
    this.timeLeft0 = dur;

    this.player = {
      pos: [...this.map.spawn],
      vel: [0, 0, 0],
      vy: 0,
      grounded: true,
      flames: tuning.flames,
      carried: 0,
      invulnTicks: 0,
      pulseCdTicks: 0,
      dashCdTicks: 0,
      dashTicks: 0, // >0 = đang lướt
      dashDir: [0, 0], // [dx, dz] normalized
      facing: 0,
      charmTicks: 0,
      fallRespawnTicks: 0, // >0 = đang chờ hồi sinh
      hasFallen: false,
      launched: false, // bục nhảy: giữ velocity tới khi chạm đất
      successfulLights: 0, // v1.2: số lần thắp thành công trong Đêm
    };
    this.prev = { jump: false, interact: false, pulse: false, dash: false, pause: false };

    this.randomMotes = true;
    this.randomShades = true;
    this.randomDrifters = true;
    this.windEnabled = this.map.windEnabled;

    this.nextMoteId = 1;
    this.nextShadeId = 1;
    this.nextDrifterId = 1;
    this.shadeSpawnTimer = 0;
    this.moteSpawnTimer = 0;
    this.drifterSpawnTimer = 0;

    // Lanterns from map
    this.lanterns = this.map.lanterns.map((L) => ({
      id: L.id,
      pos: [...L.pos],
      lit: false,
      deposited: 0,
      fuel: 0, // v1.2: 0–100 integer-ticks tracked as 60ths
      fuelTicks: 0, // internal: fuel in 1/60 units for precision
      everLit: false, // v1.2: đã từng sáng chưa
      relitCount: 0, // v1.2: số lần thắp lại
    }));

    // Wind (Đêm 3)
    this.wind = { active: false, dir: [0, 0], dirDeg: 0, ticksLeft: 0, warnTicksLeft: 0, timer: 0 };

    // Motes, shades, drifters, charms initialized after scenario
    this.motes = null;
    this.shades = null;
    this.drifters = null;
    this.charms = null;

    if (scenario) this.applyScenario(scenario);

    // Defaults
    if (this.motes === null) {
      this.motes = [];
      if (this.randomMotes) {
        const spawns = [...this.map.moteSpawns];
        // shuffle spawns
        for (let i = spawns.length - 1; i > 0; i--) {
          const j = Math.floor(this.rng() * (i + 1));
          [spawns[i], spawns[j]] = [spawns[j], spawns[i]];
        }
        const count = Math.min(this.map.moteInitialCount, spawns.length);
        for (let i = 0; i < count; i++) {
          this.motes.push({ id: `M${this.nextMoteId++}`, pos: [...spawns[i]], kind: 'random', ttlTicks: -1 });
        }
      }
    }
    if (this.shades === null) {
      this.shades = [];
      // shades spawn at shadeInitialTick, not at start (Phase 2 spec)
    }
    if (this.drifters === null) {
      this.drifters = [];
    }
    if (this.charms === null) {
      this.charms = this.map.charms.map((c) => ({
        id: c.id,
        pos: [...c.pos],
        available: true,
        respawnTicks: 0,
      }));
    }

    // Shade states: spawning, wander, chase, recoil, stunned
    // Safe zone push tracking
    this.safePushShades = new Map(); // shadeId -> ticksLeft
  }

  // ---------- scenario ----------
  applyScenario(s) {
    const p = this.player;
    if (s.player) {
      if (s.player.pos) p.pos = [...s.player.pos];
      if (s.player.carried !== undefined) p.carried = s.player.carried;
      if (s.player.flames !== undefined) p.flames = s.player.flames;
      if (s.player.invuln_ticks !== undefined) p.invulnTicks = s.player.invuln_ticks;
      if (s.player.dash_cd_ticks !== undefined) p.dashCdTicks = s.player.dash_cd_ticks;
      if (s.player.pulse_cd_ticks !== undefined) p.pulseCdTicks = s.player.pulse_cd_ticks;
      if (s.player.charm_ticks !== undefined) p.charmTicks = s.player.charm_ticks;
      if (s.player.successful_lights !== undefined) p.successfulLights = s.player.successful_lights;
    }
    if (s.random_motes !== undefined) this.randomMotes = s.random_motes;
    if (s.random_shades !== undefined) this.randomShades = s.random_shades;
    if (s.random_drifters !== undefined) this.randomDrifters = s.random_drifters;
    if (s.benchmark_mode !== undefined) this.benchmarkMode = s.benchmark_mode;
    if (s.wind_enabled !== undefined) this.windEnabled = s.wind_enabled;
    if (s.time_left_s !== undefined) this.timeLeft0 = s.time_left_s;
    if (s.lanterns) {
      for (const L of s.lanterns) {
        const lan = this.lanterns.find((x) => x.id === L.id);
        if (!lan) throw new Error(`lantern id không tồn tại: ${L.id}`);
        if (L.pos) lan.pos = [...L.pos];
        if (L.deposited !== undefined) lan.deposited = L.deposited;
        if (L.ever_lit !== undefined) lan.everLit = L.ever_lit;
        if (L.lit !== undefined) {
          lan.lit = L.lit;
          if (L.lit) {
            if (L.deposited === undefined) lan.deposited = this.t.lantern_cost;
            lan.everLit = true;
            // v1.2: fuel default 100 nếu lit=true mà không có fuel
            if (L.fuel === undefined) {
              lan.fuelTicks = this.t.fuel_max * TICK_RATE;
            }
          }
        }
        if (L.fuel !== undefined) {
          lan.fuelTicks = Math.round(L.fuel * TICK_RATE);
        }
        if (L.relit_count !== undefined) lan.relitCount = L.relit_count;
      }
    }
    if (s.motes) {
      this.motes = s.motes.map((m) => {
        if (Array.isArray(m)) return { id: `M${this.nextMoteId++}`, pos: [m[0], m[1] ?? 0, m[2]], kind: 'random', ttlTicks: -1 };
        return {
          id: m.id ?? `M${this.nextMoteId++}`,
          pos: [...m.pos],
          kind: m.kind ?? 'random',
          ttlTicks: m.ttl_ticks ?? -1,
        };
      });
    }
    if (s.shades) {
      this.shades = s.shades.map((sh, i) => ({
        id: sh.id ?? `S${i + 1}`,
        pos: [...sh.pos],
        state: sh.state ?? 'chase',
        stunTicks: 0,
        recoilTicks: 0,
        recoilDir: [0, 0],
        pushTicks: 0,
        pushDir: [0, 0],
        stateTicks: sh.state_ticks_left ?? 0,
        targetLanternId: sh.target_lantern_id ?? null, // v1.2: đèn đang hút
      }));
      let maxId = 0;
      for (const sh of this.shades) {
        const m = /^S(\d+)$/.exec(sh.id);
        if (m) maxId = Math.max(maxId, Number(m[1]));
      }
      this.nextShadeId = Math.max(maxId, this.shades.length) + 1;
    }
    if (s.drifters) {
      this.drifters = s.drifters.map((d, i) => ({
        id: d.id ?? `D${i + 1}`,
        pos: [...d.pos],
        state: d.state ?? 'idle',
        stolen: d.stolen ?? 0,
        fleeTicks: 0,
        despawnTicks: 0,
      }));
      let maxId = 0;
      for (const d of this.drifters) {
        const m = /^D(\d+)$/.exec(d.id);
        if (m) maxId = Math.max(maxId, Number(m[1]));
      }
      this.nextDrifterId = Math.max(maxId, this.drifters.length) + 1;
    }
    if (s.charms) {
      this.charms = s.charms.map((c) => ({
        id: c.id,
        pos: [...c.pos],
        available: c.available !== undefined ? c.available : true,
        respawnTicks: c.respawn_ticks ?? 0,
      }));
    }
  }

  // ---------- helpers ----------
  makeShadeAtSpawn() {
    const spawns = this.map.shadeSpawns;
    if (!spawns.length) return null;
    // pick random valid spawn (>= minDist from player)
    const valid = spawns.filter((sp) => distXZ(sp, this.player.pos) >= this.map.shadeMinDistPlayer);
    if (!valid.length) return null;
    const idx = Math.floor(this.rng() * valid.length);
    const sp = valid[idx];
    return {
      id: `S${this.nextShadeId++}`,
      pos: [sp[0], sp[1] ?? 1.0, sp[2]],
      state: 'wander',
      stunTicks: 0,
      recoilTicks: 0,
      recoilDir: [0, 0],
      pushTicks: 0,
      pushDir: [0, 0],
      stateTicks: 0,
      targetLanternId: null, // v1.2
    };
  }

  makeDrifterAtSpawn() {
    const spawns = this.map.drifterSpawns;
    if (!spawns.length) return null;
    const idx = Math.floor(this.rng() * spawns.length);
    const sp = spawns[idx];
    return {
      id: `D${this.nextDrifterId++}`,
      pos: [sp[0], sp[1] ?? 1.0, sp[2]],
      state: 'idle',
      stolen: 0,
      fleeTicks: 0,
      despawnTicks: 0,
      idleDir: this.rng() * Math.PI * 2,
    };
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

  getShadeSpeed() {
    return this.night === 3 ? this.t.shade_speed_night3 : this.t.shade_speed;
  }

  // Clamp to island boundaries
  clampToTerrain(pos) {
    if (!isOnIsland(this.map, pos[0], pos[2])) {
      // find nearest island edge
      let best = null;
      let bestD = Infinity;
      for (const isl of this.map.islands) {
        const dx = pos[0] - isl.center[0];
        const dz = pos[2] - isl.center[2];
        const d = Math.hypot(dx, dz);
        if (d <= isl.radius) { best = null; break; } // on island, shouldn't happen
        const edge = isl.radius / d;
        const ex = isl.center[0] + dx * edge;
        const ez = isl.center[2] + dz * edge;
        const ed = Math.hypot(pos[0] - ex, pos[2] - ez);
        if (ed < bestD) { bestD = ed; best = [ex, ez]; }
      }
      // check bridges
      for (const b of (this.map.bridges || [])) {
        const cx = Math.max(b.xMin, Math.min(b.xMax, pos[0]));
        const cz = Math.max(b.zMin, Math.min(b.zMax, pos[2]));
        const d = Math.hypot(pos[0] - cx, pos[2] - cz);
        if (d < bestD) { bestD = d; best = [cx, cz]; }
      }
      if (best) { pos[0] = best[0]; pos[2] = best[1]; }
    }
  }

  constrainShade(sh) {
    for (const L of this.lanterns) {
      if (!L.lit) continue;
      // v1.2: fuel < low_fuel_threshold → no safe zone
      if (L.fuelTicks < this.t.low_fuel_threshold * TICK_RATE) continue;
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
  }

  // ---------- step ----------
  step(input = DEFAULT_INPUT) {
    if (this.state !== 'playing') return;
    const t = this.t;
    const w = this.w;
    const p = this.player;
    this.tick += 1;

    // Edge detection
    const jumpE = !!input.jump && !this.prev.jump;
    const interactE = !!input.interact && !this.prev.interact;
    const pulseE = !!input.pulse && !this.prev.pulse;
    const dashE = !!input.dash && !this.prev.dash;
    const pauseE = !!input.pause && !this.prev.pause;
    this.prev = {
      jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse,
      dash: !!input.dash, pause: !!input.pause,
    };

    // 1. Pause toggle (trước mọi thứ)
    if (pauseE) {
      this.paused = !this.paused;
      this.emit(this.paused ? 'paused' : 'resumed', {});
      return; // toggle tick không chạy simulation, cả khi resume
    }
    if (this.paused) return; // tick tăng nhưng sim đứng yên

    if (!this.nightStartEmitted) {
      this.emit('night_start', { night: this.night });
      this.nightStartEmitted = true;
    }

    // Phóng ngay trong tick nếu Mây bắt đầu đúng trên bục.
    if (p.grounded && p.dashTicks <= 0) {
      const pad = (this.map.jumpPads || []).find((candidate) =>
        distXZ(p.pos, candidate.pos) <= candidate.radius && Math.abs(p.pos[1] - candidate.pos[1]) <= 0.5);
      if (pad) {
        p.vy = pad.launchVy;
        p.grounded = false;
        p.launched = true;
        if (pad.launchDir) p.vel = [pad.launchDir[0] * pad.launchHSpeed, 0, pad.launchDir[2] * pad.launchHSpeed];
        else if (pad.targetCenter) {
          const dx = pad.targetCenter[0] - pad.pos[0];
          const dz = pad.targetCenter[2] - pad.pos[2];
          const d = Math.hypot(dx, dz);
          p.vel = [dx / d * pad.launchHSpeed, 0, dz / d * pad.launchHSpeed];
        }
      }
    }

    // 2. Giảm bộ đếm
    if (p.invulnTicks > 0) p.invulnTicks--;
    if (p.pulseCdTicks > 0) p.pulseCdTicks--;
    if (p.dashCdTicks > 0) p.dashCdTicks--;
    if (p.charmTicks > 0) p.charmTicks--;
    if (p.fallRespawnTicks > 0) {
      p.fallRespawnTicks--;
      if (p.fallRespawnTicks === 0) {
        // Hồi sinh
        p.pos = [...this.map.spawn];
        p.vel = [0, 0, 0];
        p.vy = 0;
        p.grounded = true;
        p.launched = false;
        p.invulnTicks = t.invuln_ticks;
      }
      // Đang chờ hồi sinh: không nhặt, không bị chạm
      this.steps += 1;
      this._checkEnd();
      return;
    }

    // Shade timers
    for (const sh of this.shades) {
      if (sh.stunTicks > 0) {
        sh.stunTicks--;
        // push in first pulse_push_ticks
        if (sh.pushTicks > 0) {
          const pushStep = t.pulse_push_m / t.pulse_push_ticks;
          sh.pos[0] += sh.pushDir[0] * pushStep;
          sh.pos[2] += sh.pushDir[1] * pushStep;
          this.constrainShade(sh);
          sh.pushTicks--;
        }
        if (sh.stunTicks <= 0) {
          sh.stunTicks = 0;
          sh.state = 'wander';
        }
      }
      if (sh.recoilTicks > 0) {
        const recoilStep = t.shade_recoil_m / t.shade_recoil_ticks;
        sh.pos[0] += sh.recoilDir[0] * recoilStep;
        sh.pos[2] += sh.recoilDir[1] * recoilStep;
        this.constrainShade(sh);
        sh.recoilTicks--;
        if (sh.recoilTicks <= 0) sh.state = 'wander';
      }
      // Safe zone push
      if (this.safePushShades.has(sh.id)) {
        const left = this.safePushShades.get(sh.id);
        if (left > 0) this.safePushShades.set(sh.id, left - 1);
        else this.safePushShades.delete(sh.id);
      }
    }

    // v1.2: Fuel decay — đèn đang sáng hao 1/60 mỗi tick
    for (const L of this.lanterns) {
      if (!L.lit) continue;
      if (!this.benchmarkMode) L.fuelTicks -= 1; // 1/60 per tick = 1.0 per second
      // Shade drain will be applied after shade movement (step 8)
    }

    // v1.2: Check lanterns that ran out of fuel (after decay, before anything else)
    for (const L of this.lanterns) {
      if (L.lit && L.fuelTicks <= 0) {
        L.lit = false;
        L.fuelTicks = 0;
        L.deposited = 0;
        this.emit('lantern_out', { lantern_id: L.id });
      }
    }

    // Mote TTL
    this.motes = this.motes.filter((m) => {
      if (m.ttlTicks > 0) m.ttlTicks--;
      return m.ttlTicks !== 0; // -1 = permanent, >0 = alive, 0 = expired
    });

    // Charm respawn
    for (const c of this.charms) {
      if (!c.available && c.respawnTicks > 0) {
        c.respawnTicks--;
        if (c.respawnTicks <= 0) c.available = true;
      }
    }

    // Wind timer
    if (this.windEnabled) {
      this.wind.timer++;
      if (!this.wind.active && !this.wind.warnTicksLeft) {
        if (this.wind.timer >= w.wind_interval_ticks) {
          this.wind.timer = 0;
          // Trigger tick initializes the warning but is not one of its 120 ticks.
          this.wind.warnTicksLeft = w.wind_warn_ticks + 1;
          // pick random direction
          this.wind.dirDeg = Math.floor(this.rng() * 360);
          const rad = this.wind.dirDeg * Math.PI / 180;
          this.wind.dir = [Math.cos(rad), Math.sin(rad)];
        }
      }
      if (this.wind.warnTicksLeft > 0) {
        this.wind.warnTicksLeft--;
        if (this.wind.warnTicksLeft <= 0) {
          this.wind.active = true;
          this.wind.ticksLeft = w.wind_duration_ticks;
        }
      }
      if (this.wind.active) {
        this.wind.ticksLeft--;
        if (this.wind.ticksLeft <= 0) this.wind.active = false;
      }
    }

    // Kích hoạt dash trước khi tích phân để có đủ 12 tick chuyển động.
    if (dashE && p.dashTicks <= 0 && p.dashCdTicks <= 0) {
      const noCd = p.charmTicks > 0 && w.charm_dash_no_cd;
      if (noCd || p.dashCdTicks <= 0) {
        let dx, dz;
        const [mx, mz] = input.move ?? [0, 0];
        const mlen = Math.hypot(mx, mz);
        if (mlen > 0.01) {
          const th = ((input.cam_yaw_deg ?? 0) * Math.PI) / 180;
          dx = mx * Math.cos(th) + mz * Math.sin(th);
          dz = -mx * Math.sin(th) + mz * Math.cos(th);
          const dl = Math.hypot(dx, dz);
          dx /= dl; dz /= dl;
        } else {
          dx = Math.sin(p.facing);
          dz = Math.cos(p.facing);
        }
        p.dashDir = [dx, dz];
        p.dashTicks = Math.round(t.dash_duration_s * TICK_RATE);
        p.dashCdTicks = Math.round(t.dash_cooldown_s * TICK_RATE);
        if (!p.grounded) p.vy = 0;
        this.emit('dash', {});
      }
    }

    // 3. Di chuyển Mây
    const speed = p.charmTicks > 0 ? w.charm_speed_boost : t.player_speed;

    if (p.dashTicks > 0) {
      // Đang lướt
      p.pos[0] += p.dashDir[0] * t.dash_speed * DT;
      p.pos[2] += p.dashDir[1] * t.dash_speed * DT;
      // Lướt trên không giữ nguyên độ cao
      p.dashTicks--;
    } else if (p.launched) {
      // Bục nhảy: giữ velocity cho tới khi chạm đất
      p.pos[0] += p.vel[0] * DT;
      p.pos[2] += p.vel[2] * DT;
    } else {
      // Di chuyển bình thường
      let [mx, mz] = input.move ?? [0, 0];
      const len = Math.hypot(mx, mz);
      if (len > 1) { mx /= len; mz /= len; }
      const th = ((input.cam_yaw_deg ?? 0) * Math.PI) / 180;
      const wx = mx * Math.cos(th) + mz * Math.sin(th);
      const wz = -mx * Math.sin(th) + mz * Math.cos(th);
      const targetX = wx * speed;
      const targetZ = wz * speed;
      const dvx = targetX - p.vel[0];
      const dvz = targetZ - p.vel[2];
      const dv = Math.hypot(dvx, dvz);
      const maxDv = 60 * DT;
      if (dv > maxDv) {
        p.vel[0] += dvx / dv * maxDv;
        p.vel[2] += dvz / dv * maxDv;
      } else {
        p.vel[0] = targetX;
        p.vel[2] = targetZ;
      }
      p.pos[0] += p.vel[0] * DT;
      p.pos[2] += p.vel[2] * DT;
      if (wx !== 0 || wz !== 0) p.facing = Math.atan2(wx, wz);
    }

    // Wind push
    if (this.wind.active) {
      p.pos[0] += this.wind.dir[0] * w.wind_push_speed * DT;
      p.pos[2] += this.wind.dir[1] * w.wind_push_speed * DT;
    }

    // Nhảy
    if (jumpE && p.grounded && p.dashTicks <= 0) {
      p.vy = w.jump_speed;
      p.grounded = false;
    }

    // Gravity + ground
    if (!p.grounded) {
      if (p.dashTicks <= 0) { // lướt trên không giữ nguyên độ cao
        p.pos[1] += p.vy * DT;
        p.vy -= w.gravity * DT;
      }
      const gy = getGroundY(this.map, p.pos[0], p.pos[2]);
      if (isOnIsland(this.map, p.pos[0], p.pos[2]) && p.pos[1] <= gy) {
        p.pos[1] = gy;
        p.vy = 0;
        p.grounded = true;
        p.launched = false;
        p.vel = [0, 0, 0];
      }
    } else {
      // Check if ground dropped (walking off tier edge)
      const gy = getGroundY(this.map, p.pos[0], p.pos[2]);
      if (p.pos[1] < t.fall_y_threshold || p.pos[1] > gy + 0.01) {
        p.grounded = false;
        // start falling
      } else {
        p.pos[1] = gy;
      }
    }

    // Bục nhảy
    if (p.grounded && p.dashTicks <= 0) {
      for (const pad of (this.map.jumpPads || [])) {
        if (distXZ(p.pos, pad.pos) <= pad.radius && Math.abs(p.pos[1] - pad.pos[1]) <= 0.5) {
          p.vy = pad.launchVy;
          p.grounded = false;
          p.launched = true;
          // Hướng ngang
          if (pad.launchDir) {
            p.vel = [pad.launchDir[0] * pad.launchHSpeed, 0, pad.launchDir[2] * pad.launchHSpeed];
          } else if (pad.targetCenter) {
            const dx = pad.targetCenter[0] - pad.pos[0];
            const dz = pad.targetCenter[2] - pad.pos[2];
            const d = Math.hypot(dx, dz);
            p.vel = [dx / d * pad.launchHSpeed, 0, dz / d * pad.launchHSpeed];
          }
          break;
        }
      }
    }

    // Clamp to terrain / check fall
    if (isOnIsland(this.map, p.pos[0], p.pos[2])) {
      // ok
    } else {
      // Ngoài đảo
      if (p.pos[1] > -10) {
        // rơi tự do
        p.grounded = false;
      }
    }

    // Rơi khỏi đảo (Y < -10)
    if (p.pos[1] < t.fall_y_threshold && !p.hasFallen) {
      const lost = p.carried;
      p.hasFallen = true;
      p.flames--;
      p.carried = 0;
      this.emit('player_hit', { by: 'fall', flames: p.flames, lost });
      if (p.flames <= 0) {
        this.finish('lost', 'no_flames');
        return;
      }
      p.fallRespawnTicks = t.fall_respawn_ticks;
      this.steps += 1;
      this._checkEnd();
      return;
    }

    // 4. Nhặt đom đóm + bùa
    // v1.2: capacity = 10 + 2*successfulLights, max capacity_max
    const capacity = Math.min(t.carry_capacity + 2 * p.successfulLights, t.capacity_max);
    if (this.motes.length) {
      const kept = [];
      for (const m of this.motes) {
        const dxz = distXZ(m.pos, p.pos);
        const heightDiff = Math.abs(p.pos[1] - (m.pos[1] || 0));
        if (p.carried < capacity && dxz <= t.pickup_radius && heightDiff <= t.pickup_height) {
          p.carried++;
          this.emit('mote_picked', { carried: p.carried });
        } else kept.push(m);
      }
      this.motes = kept;
    }

    // Nhặt bùa
    for (const c of this.charms) {
      if (!c.available) continue;
      const dxz = distXZ(c.pos, p.pos);
      const heightDiff = Math.abs(p.pos[1] - (c.pos[1] || 0));
      if (dxz <= t.pickup_radius && heightDiff <= t.pickup_height) {
        c.available = false;
        c.respawnTicks = w.charm_respawn_ticks;
        p.charmTicks = w.charm_duration_ticks;
        this.emit('charm_picked', { charm_id: c.id, charm_ticks: w.charm_duration_ticks });
      }
    }

    // 5. Tương tác với đèn (v1.2: fuel system)
    if (interactE && p.carried > 0) {
      // Chọn đèn "nhận được": chưa sáng, hoặc sáng nhưng fuel < fuel_max
      // Đèn đầy dầu (sáng + fuel >= fuel_max) không được chọn
      let best = null;
      let bestD = Infinity;
      for (const L of this.lanterns) {
        const canReceive = !L.lit || (L.lit && L.fuelTicks < t.fuel_max * TICK_RATE);
        if (!canReceive) continue;
        const d = distXZ(L.pos, p.pos);
        if (d <= t.interact_radius) {
          if (d < bestD || (d === bestD && best && L.id < best.id)) {
            best = L;
            bestD = d;
          }
        }
      }
      if (best) {
        if (!best.lit) {
          // Thắp mới hoặc thắp lại
          const cost = best.everLit ? t.relight_cost : t.lantern_cost;
          const needed = cost - best.deposited;
          const amount = Math.min(p.carried, needed);
          if (amount > 0) {
            p.carried -= amount;
            best.deposited += amount;
            this.score += amount * t.score.per_mote_deposit;
            this.emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
            if (best.deposited >= cost) {
              best.lit = true;
              best.fuelTicks = t.fuel_max * TICK_RATE; // fuel = 100
              const isRelight = best.everLit;
              best.everLit = true;
              if (isRelight) {
                best.relitCount++;
                this.score += t.score.per_lantern_relight;
              } else {
                this.score += t.score.per_lantern_first;
              }
              p.successfulLights++;
              this.emit('lantern_lit', { lantern_id: best.id, relight: isRelight });
              // v1.2: đèn vừa thắp → đẩy shade ra
              for (const sh of this.shades) {
                if (sh.state === 'stunned') continue;
                const sd = distXZ(sh.pos, best.pos);
                if (sd < t.safe_radius) {
                  if (!this.safePushShades.has(sh.id)) {
                    this.safePushShades.set(sh.id, t.safe_push_ticks);
                  }
                  // drain → wander khi đèn được thắp
                  if (sh.state === 'drain' && sh.targetLanternId === best.id) {
                    sh.state = 'wander';
                    sh.targetLanternId = null;
                  }
                }
              }
            }
          }
        } else {
          // Châm dầu (đèn đang sáng, fuel < fuel_max)
          const fuelGap = t.fuel_max * TICK_RATE - best.fuelTicks;
          const used = Math.min(p.carried, Math.ceil(fuelGap / (t.fuel_per_mote * TICK_RATE)));
          if (used > 0) {
            p.carried -= used;
            best.fuelTicks = Math.min(t.fuel_max * TICK_RATE, best.fuelTicks + used * t.fuel_per_mote * TICK_RATE);
            this.score += used * t.score.per_mote_deposit;
            this.emit('refuel', { lantern_id: best.id, amount: used, fuel: r3(best.fuelTicks / TICK_RATE) });
            // v1.2: châm lên >= low_fuel_threshold → đẩy shade ra, shade drain→wander
            if (best.fuelTicks >= t.low_fuel_threshold * TICK_RATE) {
              for (const sh of this.shades) {
                if (sh.state === 'drain' && sh.targetLanternId === best.id) {
                  sh.state = 'wander';
                  sh.targetLanternId = null;
                }
                // push out shades within 6m
                const sd = distXZ(sh.pos, best.pos);
                if (sd < t.safe_radius && sh.state !== 'stunned') {
                  if (!this.safePushShades.has(sh.id)) {
                    this.safePushShades.set(sh.id, t.safe_push_ticks);
                  }
                }
              }
            }
          }
        }
      }
    }

    // 6. Cập nhật vùng an toàn (v1.2: fuel < 30 → mất safe zone)
    for (const sh of this.shades) {
      if (sh.state === 'stunned' || sh.state === 'drain') continue;
      for (const L of this.lanterns) {
        if (!L.lit) continue;
        // v1.2: đèn yếu (fuel < low_fuel_threshold) mất safe zone
        if (L.fuelTicks < t.low_fuel_threshold * TICK_RATE) continue;
        const d = distXZ(sh.pos, L.pos);
        if (d < t.safe_radius) {
          if (!this.safePushShades.has(sh.id)) {
            this.safePushShades.set(sh.id, t.safe_push_ticks);
          }
          this.constrainShade(sh);
        }
      }
    }

    // 7. Tỏa Sáng
    if (pulseE && p.pulseCdTicks === 0 && p.carried >= t.pulse_cost) {
      p.carried -= t.pulse_cost;
      p.pulseCdTicks = Math.round(t.pulse_cooldown_s * TICK_RATE);
      const pulseCenter = [p.pos[0], p.pos[1] + t.pulse_center_y, p.pos[2]];
      const stunned = [];

      // Bóng Mực
      for (const sh of this.shades) {
        const d = dist3D(pulseCenter, sh.pos);
        if (d <= t.pulse_radius) {
          const wasDraining = sh.state === 'drain';
          sh.state = 'stunned';
          sh.stunTicks = t.pulse_stun_ticks;
          sh.pushTicks = t.pulse_push_ticks;
          sh.targetLanternId = null;
          // push direction
          const dx = sh.pos[0] - p.pos[0];
          const dz = sh.pos[2] - p.pos[2];
          const hd = Math.hypot(dx, dz);
          sh.pushDir = hd > 1e-9 ? [dx / hd, dz / hd] : [1, 0];
          stunned.push(sh.id);
          // v1.2: +5 per stun, +15 nếu đang drain
          this.score += wasDraining ? t.score.per_stun_drain : t.score.per_stun;
        }
      }

      // Gió Lạc
      for (const dr of this.drifters) {
        if (dr.state === 'removed') continue;
        const d = dist3D(pulseCenter, dr.pos);
        if (d <= t.pulse_radius) {
          if (dr.state === 'chase') {
            // flee không cướp
            dr.state = 'flee';
            dr.stolen = 0;
            dr.fleeTicks = w.drifter_flee_ticks;
          } else if (dr.state === 'flee' && dr.stolen > 0) {
            // thả lại đom đóm
            const dropCount = dr.stolen;
            for (let i = 0; i < dropCount; i++) {
              const ang = this.rng() * Math.PI * 2;
              const r = 1.5 + this.rng() * 1.0;
              this.motes.push({
                id: `M${this.nextMoteId++}`,
                pos: [dr.pos[0] + Math.cos(ang) * r, dr.pos[1], dr.pos[2] + Math.sin(ang) * r],
                kind: 'dropped',
                ttlTicks: t.hit_drop_ttl_ticks,
              });
            }
            this.emit('drifter_drop', { drifter_id: dr.id, amount: dropCount });
            dr.stolen = 0;
            dr.despawnTicks = w.drifter_drop_despawn_ticks;
            dr.fleeTicks = w.drifter_drop_despawn_ticks;
            dr.state = 'flee'; // flees for the short despawn window
          }
        }
      }

      this.emit('pulse', { stunned_ids: stunned });
    }

    // 8. Di chuyển Bóng Mực và Gió Lạc
    const shadeSpeed = this.getShadeSpeed();
    const sstep = shadeSpeed * DT;
    for (const sh of this.shades) {
      if (sh.state === 'stunned' || sh.state === 'recoil' || sh.state === 'spawning') continue;
      const dxz = distXZ(sh.pos, p.pos);

      // v1.2: drain state
      if (sh.state === 'drain') {
        // drain: đứng yên, hút fuel
        const tgtLan = this.lanterns.find((L) => L.id === sh.targetLanternId);
        if (tgtLan) {
          const drainAmount = Math.round(t.drain_per_s / TICK_RATE * TICK_RATE); // 5/60 * 60 = 5 fuelTicks per tick
          tgtLan.fuelTicks -= drainAmount;
          // emit fuel_drain every 60 ticks
          if (this.tick % 60 === 0) {
            this.emit('fuel_drain', { lantern_id: tgtLan.id, shade_id: sh.id, fuel: r3(Math.max(0, tgtLan.fuelTicks / TICK_RATE)) });
          }
          // Check if lantern dies from drain
          if (tgtLan.fuelTicks <= 0 && tgtLan.lit) {
            tgtLan.lit = false;
            tgtLan.fuelTicks = 0;
            tgtLan.deposited = 0;
            this.emit('lantern_out', { lantern_id: tgtLan.id });
          }
        }
        // drain → chase nếu Mây trong 6m
        if (dxz <= t.safe_radius) {
          sh.state = 'chase';
          sh.targetLanternId = null;
        }
        // drain → wander nếu đèn tắt hoặc fuel >= 30 hoặc cách đèn > 2m
        else if (tgtLan && (!tgtLan.lit || tgtLan.fuelTicks >= t.low_fuel_threshold * TICK_RATE)) {
          sh.state = 'wander';
          sh.targetLanternId = null;
        } else if (tgtLan && distXZ(sh.pos, tgtLan.pos) > 2.0) {
          sh.state = 'wander';
          sh.targetLanternId = null;
        } else if (!tgtLan) {
          sh.state = 'wander';
          sh.targetLanternId = null;
        }
        continue; // drain: đứng yên
      }

      // wander → chase (player detection)
      if (sh.state === 'wander' && dxz <= t.shade_detect_r) sh.state = 'chase';
      // chase → wander
      if (sh.state === 'chase' && dxz > t.shade_lose_r) sh.state = 'wander';

      // v1.2: wander → drain: tìm đèn yếu (fuel < 30) gần nhất
      if (sh.state === 'wander') {
        let weakLan = null;
        let weakD = Infinity;
        for (const L of this.lanterns) {
          if (!L.lit || L.fuelTicks >= t.low_fuel_threshold * TICK_RATE) continue;
          const ld = distXZ(sh.pos, L.pos);
          if (ld < weakD || (ld === weakD && weakLan && L.id < weakLan.id)) {
            weakLan = L;
            weakD = ld;
          }
        }
        if (weakLan) {
          // Di chuyển về đèn yếu
          if (weakD <= 2.0) {
            // Đủ gần → drain
            sh.state = 'drain';
            sh.targetLanternId = weakLan.id;
            continue;
          } else {
            // Đi về phía đèn yếu
            const dx = weakLan.pos[0] - sh.pos[0];
            const dz = weakLan.pos[2] - sh.pos[2];
            const d = Math.hypot(dx, dz);
            if (d > 1e-9) {
              const s = Math.min(sstep, d);
              sh.pos[0] += (dx / d) * s;
              sh.pos[2] += (dz / d) * s;
            }
            continue; // skip normal movement
          }
        }
      }

      if (sh.state === 'chase') {
        const dx = p.pos[0] - sh.pos[0];
        const dz = p.pos[2] - sh.pos[2];
        const d = Math.hypot(dx, dz);
        if (d > 1e-9) {
          const s = Math.min(sstep, d);
          sh.pos[0] += (dx / d) * s;
          sh.pos[2] += (dz / d) * s;
        }
      } else if (sh.state === 'wander') {
        // random wander: slowly meander
        const ang = this.rng() * Math.PI * 2;
        sh.pos[0] += Math.cos(ang) * sstep * 0.3;
        sh.pos[2] += Math.sin(ang) * sstep * 0.3;
      }
      this.constrainShade(sh);
    }

    // Gió Lạc
    const driftKept = [];
    for (const dr of this.drifters) {
      if (dr.state === 'removed') {
        if (dr.despawnTicks > 0) { dr.despawnTicks--; driftKept.push(dr); }
        continue;
      }
      if (dr.state === 'idle') {
        // lượn chậm 2 m/s
        if (dr.idleDir === undefined) dr.idleDir = this.rng() * Math.PI * 2;
        dr.idleDir += (this.rng() - 0.5) * 0.1;
        dr.pos[0] += Math.cos(dr.idleDir) * w.drifter_speed_idle * DT;
        dr.pos[2] += Math.sin(dr.idleDir) * w.drifter_speed_idle * DT;
        // idle → chase
        if (p.carried >= w.drifter_detect_motes && distXZ(dr.pos, p.pos) <= w.drifter_detect_r) {
          dr.state = 'chase';
        }
      } else if (dr.state === 'chase') {
        // chase: bay về phía Mây
        const dx = p.pos[0] - dr.pos[0];
        const dz = p.pos[2] - dr.pos[2];
        const d = Math.hypot(dx, dz);
        if (d > 1e-9) {
          const s = Math.min(w.drifter_speed_chase * DT, d);
          dr.pos[0] += (dx / d) * s;
          dr.pos[2] += (dz / d) * s;
        }
        // chase → idle nếu Mây mang < 5 hoặc xa > 15
        if (p.carried < w.drifter_detect_motes || distXZ(dr.pos, p.pos) > w.drifter_detect_r) {
          dr.state = 'idle';
        }
      } else if (dr.state === 'flee') {
        // bay ra xa Mây
        const dx = dr.pos[0] - p.pos[0];
        const dz = dr.pos[2] - p.pos[2];
        const d = Math.hypot(dx, dz);
        if (d > 1e-9) {
          dr.pos[0] += (dx / d) * w.drifter_speed_flee * DT;
          dr.pos[2] += (dz / d) * w.drifter_speed_flee * DT;
        }
        dr.fleeTicks--;
        if (dr.fleeTicks <= 0) { dr.state = 'removed'; continue; }
      }
      driftKept.push(dr);
    }
    this.drifters = driftKept;

    // 9. Chạm: Gió Lạc cướp trước, rồi Bóng Mực
    // Gió Lạc
    for (const dr of this.drifters) {
      if (dr.state !== 'chase') continue;
      if (distXZ(dr.pos, p.pos) <= w.drifter_hit_r) {
        const amount = Math.min(w.drifter_steal_amount, p.carried);
        if (amount > 0) {
          p.carried -= amount;
          dr.stolen = amount;
          dr.state = 'flee';
          dr.fleeTicks = w.drifter_flee_ticks;
          this.emit('drifter_steal', { drifter_id: dr.id, amount, carried: p.carried });
        }
      }
    }

    // Bóng Mực va chạm
    if (!this.benchmarkMode && p.invulnTicks === 0) {
      // sort by id ascending
      const sorted = [...this.shades].sort((a, b) => {
        const ai = parseInt(a.id.slice(1)); const bi = parseInt(b.id.slice(1));
        return ai - bi;
      });
      for (const sh of sorted) {
        if (sh.state === 'stunned' || sh.state === 'spawning' || sh.state === 'drain') continue;
        // safe push: không gây sát thương
        if (this.safePushShades.has(sh.id) && this.safePushShades.get(sh.id) > 0) continue;
        const dxz = distXZ(sh.pos, p.pos);
        const heightDiff = Math.abs((sh.pos[1] || 1) - p.pos[1]);
        if (dxz <= t.shade_hit_radius && heightDiff <= t.shade_hit_height) {
          p.flames--;
          const dropped = Math.floor(p.carried * t.hit_drop_ratio);
          // drop motes
          for (let i = 0; i < dropped; i++) {
            const ang = this.rng() * Math.PI * 2;
            const r = t.hit_drop_min_r + this.rng() * (t.hit_drop_max_r - t.hit_drop_min_r);
            this.motes.push({
              id: `M${this.nextMoteId++}`,
              pos: [p.pos[0] + Math.cos(ang) * r, p.pos[1], p.pos[2] + Math.sin(ang) * r],
              kind: 'dropped',
              ttlTicks: t.hit_drop_ttl_ticks,
            });
          }
          p.carried -= dropped;
          p.invulnTicks = t.invuln_ticks;
          // recoil shade
          const dx = sh.pos[0] - p.pos[0];
          const dz = sh.pos[2] - p.pos[2];
          const d = Math.hypot(dx, dz);
          sh.state = 'recoil';
          sh.recoilTicks = t.shade_recoil_ticks;
          sh.recoilDir = d > 1e-9 ? [dx / d, dz / d] : [1, 0];
          this.emit('player_hit', { by: 'shade', flames: p.flames, dropped });
          break; // tối đa 1 lần mất Ngọn Lửa mỗi tick
        }
      }
    }

    // 10. Sinh đom đóm, Bóng Mực, Gió Lạc
    // Mote spawn
    if (this.randomMotes) {
      this.moteSpawnTimer++;
      if (this.moteSpawnTimer >= w.mote_respawn_interval_ticks) {
        this.moteSpawnTimer = 0;
        if (this.motes.length < w.mote_cap) {
          // tìm điểm trống
          const usedPositions = new Set(this.motes.map((m) => `${r3(m.pos[0])},${r3(m.pos[2])}`));
          const freeSpawns = this.map.moteSpawns.filter((sp) => !usedPositions.has(`${r3(sp[0])},${r3(sp[2])}`));
          if (freeSpawns.length > 0) {
            const idx = Math.floor(this.rng() * freeSpawns.length);
            const sp = freeSpawns[idx];
            this.motes.push({
              id: `M${this.nextMoteId++}`,
              pos: [...sp],
              kind: 'random',
              ttlTicks: -1,
            });
          }
        }
      }
    }

    // Shade spawn
    if (this.randomShades) {
      this.shadeSpawnTimer++;
      const firstSpawn = this.map.shadeInitialTick;
      const interval = this.map.shadeSpawnInterval;
      if (this.steps === Math.floor(firstSpawn / 1) - 1) {
        // at exact tick
      }
      // Spawn: initial at shadeInitialTick, then every interval
      if (this.tick === firstSpawn) {
        // Spawn initial shades
        for (let i = 0; i < this.map.shadeInitial && this.shades.length < this.map.shadeMax; i++) {
          const sh = this.makeShadeAtSpawn();
          if (sh) {
            this.shades.push(sh);
            this.emit('shade_spawned', { id: sh.id });
          }
        }
        this.shadeSpawnTimer = 0;
      } else if (this.tick > firstSpawn) {
        if (this.shadeSpawnTimer >= interval) {
          this.shadeSpawnTimer = 0;
          if (this.shades.length < this.map.shadeMax) {
            const sh = this.makeShadeAtSpawn();
            if (sh) {
              this.shades.push(sh);
              this.emit('shade_spawned', { id: sh.id });
            }
          }
        }
      }
    }

    // Drifter spawn (Đêm 2 & 3)
    if (this.randomDrifters && this.map.drifterSpawns.length > 0) {
      this.drifterSpawnTimer++;
      if (this.drifterSpawnTimer >= w.drifter_spawn_interval_ticks) {
        this.drifterSpawnTimer = 0;
        const activeDrifters = this.drifters.filter((d) => d.state !== 'removed');
        if (activeDrifters.length < w.drifter_max) {
          const dr = this.makeDrifterAtSpawn();
          if (dr) {
            this.drifters.push(dr);
          }
        }
      }
    }

    this.steps += 1;

    // 11. Thắng/thua
    this._checkEnd();
  }

  _checkEnd() {
    const t = this.t;
    const p = this.player;
    if (this.state !== 'playing' || this.benchmarkMode) return;
    // hết Ngọn Lửa → luôn thua (kể cả tick cuối)
    if (p.flames <= 0) {
      this.finish('lost', 'no_flames');
      return;
    }
    // v1.2: hết giờ → check win ratio
    if (this.timeLeft <= 1e-9) {
      const litCount = this.lanterns.filter((L) => L.lit).length;
      const needed = Math.ceil(t.win_ratio * this.lanterns.length);
      if (litCount >= needed) {
        // Thắng: dawn_survived
        // Scoring: +50 + floor(fuel) cho mỗi đèn sáng, +50 mỗi Ngọn Lửa
        for (const L of this.lanterns) {
          if (L.lit) {
            this.score += t.score.per_dawn_lantern_base + Math.floor(L.fuelTicks / TICK_RATE);
          }
        }
        this.score += p.flames * t.score.per_flame_left;
        this.finish('won', 'dawn_survived');
      } else {
        this.finish('lost', 'dawn');
      }
    }
    // v1.2: thắp đủ đèn KHÔNG kết thúc Đêm
  }

  finish(result, reason) {
    this.state = result;
    this.result = { result, reason };
    this.emit('game_over', { result, reason, score: this.score });
  }

  snapshot() {
    const p = this.player;
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.steps,
      state: this.paused ? 'paused' : this.state,
      night: this.night,
      time_left_s: r3(Math.max(0, this.timeLeft)),
      score: this.score,
      player: {
        pos: v3(p.pos),
        vel: v3([p.vel?.[0] ?? 0, p.vy, p.vel?.[2] ?? 0]),
        grounded: p.grounded,
        flames: p.flames,
        carried: p.carried,
        invuln: r3(p.invulnTicks / TICK_RATE),
        dash_cd_s: r3(p.dashCdTicks / TICK_RATE),
        pulse_cd_s: r3(p.pulseCdTicks / TICK_RATE),
        charm_s: r3(p.charmTicks / TICK_RATE),
        capacity: Math.min(this.t.carry_capacity + 2 * p.successfulLights, this.t.capacity_max),
      },
      lanterns: this.lanterns.map((L) => ({
        id: L.id, pos: v3(L.pos), lit: L.lit, deposited: L.deposited,
        fuel: r3(Math.max(0, L.fuelTicks / TICK_RATE)),
        ever_lit: L.everLit, relit_count: L.relitCount,
      })),
      shades: this.shades.map((s) => ({
        id: s.id, pos: v3(s.pos), state: s.state,
        target_lantern_id: s.targetLanternId ?? null,
      })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({
        id: m.id, pos: v3(m.pos), kind: m.kind,
        ttl_s: m.ttlTicks < 0 ? null : r3(m.ttlTicks / TICK_RATE),
      })),
      drifters: this.drifters.filter((d) => d.state !== 'removed').map((d) => ({
        id: d.id, pos: v3(d.pos), state: d.state, stolen: d.stolen,
      })),
      charms: this.charms.map((c) => ({
        id: c.id, available: c.available, respawn_s: r3(c.respawnTicks / TICK_RATE),
      })),
      wind: { active: this.wind.active, dir_deg: this.wind.dirDeg },
    };
  }
}
