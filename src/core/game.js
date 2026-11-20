// Luật chơi thuần, tất định, dùng chung cho web và headless.
import { TUNING, WORLD, TICK_RATE, pointsFromRings } from './config.js';
import { mulberry32 } from './rng.js';

const DT = 1 / TICK_RATE;
const secToTicks = (s) => Math.round(s * TICK_RATE);
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const clone3 = (v) => [v[0], v[1], v[2]];
const angleVector = (deg) => {
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r)];
};

export function r3(value) {
  const n = Math.round(value * 1000) / 1000;
  return n === 0 ? 0 : n;
}
const v3 = (p) => [r3(p[0]), r3(p[1]), r3(p[2])];

export const DEFAULT_INPUT = Object.freeze({
  move: [0, 0], cam_yaw_deg: 0, jump: false, dash: false,
  interact: false, pulse: false, pause: false,
});

export class Game {
  constructor({ seed = 0, night = 1, scenario = null, tuning = TUNING, world = WORLD } = {}) {
    if (![1, 2, 3].includes(night)) throw new Error(`night ${night} không hợp lệ (chỉ nhận 1, 2, 3)`);
    this.night = night;
    this.t = tuning;
    this.world = world;
    this.w = world[`night${night}`];
    this.rng = mulberry32(seed);
    this.tick = 0;
    this.steps = 0;
    this.state = 'playing';
    this.paused = false;
    this.nightStarted = false;
    this.result = null;
    this.score = 0;
    this.events = [];
    this.timeLeft0 = tuning[`night${night}_duration_s`];
    this.player = {
      pos: [...world.origin], vel: [0, 0, 0], grounded: true,
      flames: tuning.flames, carried: 0, invulnTicks: 0,
      dashCdTicks: 0, dashTicks: 0, dashDir: [0, 1], dashFreezeY: false,
      pulseCdTicks: 0, charmTicks: 0, respawnTicks: 0, facing: (world.start_facing_deg * Math.PI) / 180,
    };
    this.prev = { jump: false, dash: false, interact: false, pulse: false, pause: false };
    this.randomMotes = true;
    this.randomShades = true;
    this.randomDrifters = night !== 1;
    this.windEnabled = this.w.wind;
    this.wind = { active: false, dirDeg: 0 };
    this.moteSpawnPoints = pointsFromRings(this.w.mote_rings);
    this.usedMotePoints = new Set();
    this.usedShadePoints = new Set();
    this.nextMoteId = 1;
    this.nextShadeId = 1;
    this.nextDrifterId = 1;
    this.shadeSpawnPoints = this.w.shade_spawn_points.map(clone3);
    this.shadeTimer = 0;
    this.drifterTimer = 0;
    this.motes = null;
    this.shades = null;
    this.drifters = null;
    this.charms = this.w.charms.map((c) => ({ id: c.id, pos: clone3(c.pos), available: true, respawnTicks: 0 }));
    this.lanterns = this.w.lanterns.map((pos, i) => ({
      id: `L${i + 1}`, pos: clone3(pos), lit: false, deposited: 0,
    }));

    if (scenario) this.applyScenario(scenario);
    if (this.motes === null) this.initializeMotes();
    if (this.shades === null) this.shades = [];
    if (this.drifters === null) this.drifters = [];
    this.applyInitialSafeZones();
  }

  applyScenario(s) {
    const p = this.player;
    if (s.player) {
      const v = s.player;
      if (v.pos) {
        p.pos = clone3(v.pos);
        p.grounded = v.grounded ?? (v.pos[1] === 0 || this.isSupportedAt(v.pos[0], v.pos[2], v.pos[1]));
      }
      if (v.vel) p.vel = clone3(v.vel);
      for (const [key, field] of [['carried', 'carried'], ['flames', 'flames']]) if (v[key] !== undefined) p[field] = v[key];
      for (const [key, field] of [
        ['invuln_ticks', 'invulnTicks'], ['dash_cd_ticks', 'dashCdTicks'],
        ['pulse_cd_ticks', 'pulseCdTicks'], ['charm_ticks', 'charmTicks'],
      ]) if (v[key] !== undefined) p[field] = v[key];
      if (v.grounded !== undefined) p.grounded = v.grounded;
    }
    for (const [key, field] of [
      ['random_motes', 'randomMotes'], ['random_shades', 'randomShades'],
      ['random_drifters', 'randomDrifters'], ['wind_enabled', 'windEnabled'],
    ]) if (s[key] !== undefined) this[field] = s[key];
    if (s.time_left_s !== undefined) this.timeLeft0 = s.time_left_s;

    if (s.lanterns) {
      for (const value of s.lanterns) {
        const lantern = this.lanterns.find((item) => item.id === value.id);
        if (!lantern) throw new Error(`lantern id không tồn tại: ${value.id}`);
        if (value.pos) lantern.pos = clone3(value.pos);
        if (value.deposited !== undefined) lantern.deposited = value.deposited;
        if (value.lit !== undefined) {
          lantern.lit = value.lit;
          if (value.lit && value.deposited === undefined) lantern.deposited = this.t.lantern_cost;
        }
      }
    }
    if (s.motes) {
      this.motes = s.motes.map((value) => {
        const data = Array.isArray(value) ? { pos: value } : value;
        const mote = {
          id: data.id ?? `M${this.nextMoteId++}`,
          pos: clone3(data.pos), kind: data.kind ?? 'random',
          ttlTicks: data.ttl_ticks ?? (data.kind === 'dropped' ? secToTicks(this.t.mote_ttl_s) : 0),
          bornSimTick: 0,
        };
        const m = /^M(\d+)$/.exec(mote.id);
        if (m) this.nextMoteId = Math.max(this.nextMoteId, Number(m[1]) + 1);
        return mote;
      });
    } else if (s.random_motes === false) this.motes = [];

    if (s.shades) {
      this.shades = s.shades.map((value, i) => ({
        id: value.id ?? `S${i + 1}`, pos: clone3(value.pos),
        state: value.state ?? 'chase', stateTicks: value.state_ticks_left ?? (value.state === 'spawning' ? 1 : 0),
        stunTicks: value.state === 'stunned' ? (value.state_ticks_left ?? secToTicks(this.t.pulse_stun_s)) : 0,
        pushTicks: 0, pushRemain: 0, pushDir: [1, 0], recoilTicks: value.state === 'recoil' ? (value.state_ticks_left ?? secToTicks(this.t.shade_recoil_s)) : 0,
        recoilRemain: value.state === 'recoil' ? this.t.shade_hit_knockback_m : 0,
        recoilDir: [1, 0], safePushTicks: 0, safePushLantern: null, wanderDir: this.randomDirection(),
      }));
      for (const shade of this.shades) {
        const m = /^S(\d+)$/.exec(shade.id);
        if (m) this.nextShadeId = Math.max(this.nextShadeId, Number(m[1]) + 1);
      }
    }

    if (s.drifters) {
      this.drifters = s.drifters.map((value, i) => ({
        id: value.id ?? `D${i + 1}`, pos: clone3(value.pos), state: value.state ?? 'idle',
        stateTicks: value.state_ticks_left ?? 0, stolen: value.stolen ?? 0,
        pulseRemoved: false, wanderDir: this.randomDirection(),
      }));
      for (const drifter of this.drifters) {
        const m = /^D(\d+)$/.exec(drifter.id);
        if (m) this.nextDrifterId = Math.max(this.nextDrifterId, Number(m[1]) + 1);
      }
    }

    if (s.charms) {
      this.charms = s.charms.map((value) => ({
        id: value.id, pos: clone3(value.pos), available: value.available ?? true,
        respawnTicks: value.respawn_ticks ?? 0,
      }));
    }
    if (s.wind) {
      this.wind = { active: !!s.wind.active, dirDeg: s.wind.dir_deg ?? 0 };
    }
  }

  initializeMotes() {
    this.motes = [];
    if (!this.randomMotes) return;
    const indices = this.moteSpawnPoints.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    for (const index of indices.slice(0, this.t.mote_start_count)) {
      this.usedMotePoints.add(index);
      this.addMote(this.moteSpawnPoints[index], 'random', 0);
    }
  }

  randomDirection() {
    const a = this.rng() * Math.PI * 2;
    return [Math.cos(a), Math.sin(a)];
  }

  addMote(pos, kind = 'dropped', bornSimTick = this.steps + 1, ttlTicks = secToTicks(this.t.mote_ttl_s)) {
    const mote = { id: `M${this.nextMoteId++}`, pos: clone3(pos), kind, ttlTicks, bornSimTick };
    this.motes.push(mote);
    return mote;
  }

  emit(name, data = {}) {
    this.events.push({ type: 'event', tick: this.tick, name, data });
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  get timeLeft() {
    return this.timeLeft0 - this.steps / TICK_RATE;
  }

  ringPointAround(pos) {
    const a = this.rng() * Math.PI * 2;
    const radius = 1.5 + this.rng();
    return [pos[0] + Math.cos(a) * radius, pos[1], pos[2] + Math.sin(a) * radius];
  }

  dropMotes(amount, pos, bornSimTick = this.steps + 1) {
    for (let i = 0; i < amount; i++) this.addMote(this.ringPointAround(pos), 'dropped', bornSimTick);
  }

  motePointIndex(pos) {
    return this.moteSpawnPoints.findIndex((point) => dist3(point, pos) < 0.001);
  }

  spawnMoteAtFreePoint(simTick) {
    if (this.motes.length >= this.t.mote_max) return;
    const free = [];
    for (let i = 0; i < this.moteSpawnPoints.length; i++) {
      if (this.motes.some((m) => dist3(m.pos, this.moteSpawnPoints[i]) < 0.001)) continue;
      free.push(i);
    }
    if (!free.length) return;
    const index = free[Math.floor(this.rng() * free.length)];
    this.usedMotePoints.add(index);
    this.addMote(this.moteSpawnPoints[index], 'random', simTick, 0);
  }

  emitDroppedMotePickup(mote) {
    this.player.carried++;
    this.score += this.t.score.per_mote;
    this.emit('mote_picked', { carried: this.player.carried });
  }

  get surfaces() {
    return this.w;
  }

  surfaceHeightsAt(x, z) {
    const found = [];
    const insideIsland = this.w.islands.some((island) => Math.hypot(x - island.center[0], z - island.center[1]) <= island.radius);
    if (this.night === 3) {
      if (insideIsland) found.push(0);
      const radius = Math.hypot(x, z);
      for (const tier of this.w.tiers) {
        if (tier.id === 1 && radius >= tier.inner && radius <= tier.outer && z > 0) found.push(tier.y);
        if (tier.id === 2 && radius <= tier.radius) found.push(tier.y);
      }
      for (const ramp of this.w.ramps) {
        const a = (ramp.angle_deg * Math.PI) / 180;
        const along = x * Math.cos(a) + z * Math.sin(a);
        const lateral = -x * Math.sin(a) + z * Math.cos(a);
        if (along >= ramp.to_radius && along <= ramp.from_radius && Math.abs(lateral) <= ramp.width / 2) {
          found.push(ramp.from_y + ((ramp.from_radius - along) / (ramp.from_radius - ramp.to_radius)) * (ramp.to_y - ramp.from_y));
        }
      }
    } else if (insideIsland || this.w.bridges.some((b) => x >= b.min_x && x <= b.max_x && z >= b.min_z && z <= b.max_z)) {
      found.push(0);
    }
    return found.sort((a, b) => b - a);
  }

  isSupportedAt(x, z, y) {
    return this.surfaceHeightsAt(x, z).some((height) => Math.abs(height - y) <= 0.1);
  }

  surfaceHeightAt(x, z) {
    return this.surfaceHeightsAt(x, z)[0] ?? 0;
  }

  hasSameWalkingSurface(x, z, y) {
    const heights = this.surfaceHeightsAt(x, z);
    if (heights.some((height) => Math.abs(height - y) <= 0.1)) return true;
    // Ramp tops connect continuously to the raised terrace; only the ramp permits walking upward.
    return heights.some((height) => height > y && height - y <= this.t.player_speed / TICK_RATE);
  }

  findLandingSurface(x, z, fromY, toY) {
    for (const height of this.surfaceHeightsAt(x, z)) {
      if (height <= fromY + 0.001 && height >= toY - 0.001) return height;
    }
    return null;
  }

  applyInitialSafeZones() {
    for (const shade of this.shades) {
      for (const lantern of this.lanterns) {
        if (!lantern.lit) continue;
        const d = distXZ(shade.pos, lantern.pos);
        if (d < this.t.safe_radius) {
          const dir = d > 0.001 ? [(shade.pos[0] - lantern.pos[0]) / d, (shade.pos[2] - lantern.pos[2]) / d] : [1, 0];
          shade.pos[0] = lantern.pos[0] + dir[0] * this.t.safe_radius;
          shade.pos[2] = lantern.pos[2] + dir[1] * this.t.safe_radius;
          shade.pos[1] = this.surfaceHeightAt(shade.pos[0], shade.pos[2]) + this.t.shade_center_height;
        }
      }
    }
  }

  beginCounters(simTick) {
    const p = this.player;
    this.wasInvulnerableThisTick = p.invulnTicks > 0;
    if (p.invulnTicks > 0) p.invulnTicks--;
    if (p.charmTicks > 0) p.charmTicks--;
    if (p.pulseCdTicks > 0) p.pulseCdTicks--;
    if (p.dashCdTicks > 0 && p.charmTicks === 0) p.dashCdTicks--;

    for (const mote of this.motes) if (mote.kind === 'dropped' && mote.ttlTicks > 0) mote.ttlTicks--;
    this.motes = this.motes.filter((m) => m.kind !== 'dropped' || m.ttlTicks > 0);

    for (const charm of this.charms) {
      if (!charm.available && charm.respawnTicks > 0) {
        charm.respawnTicks--;
        if (charm.respawnTicks === 0) charm.available = true;
      }
    }

    for (const shade of this.shades) {
      shade._skipThisTick = ['stunned', 'recoil'].includes(shade.state);
      shade._pendingState = null;
      shade._safePushThisTick = shade.safePushTicks > 0;
      if (shade.state === 'spawning') {
        if (shade.stateTicks > 0) shade.stateTicks--;
        if (shade.stateTicks === 0) shade.state = 'wander';
      }
      if (shade.stateTicks > 0) {
        shade.stateTicks--;
        if (shade.stateTicks === 0) shade._pendingState = shade.state === 'spawning' || shade.state === 'stunned' ? 'wander' : 'chase';
      }
      if (shade.stunTicks > 0) {
        shade.stunTicks--;
        if (shade.stunTicks === 0) shade._pendingState = 'wander';
      }
      if (shade.pushTicks > 0) shade.pushTicks--;
      if (shade.recoilTicks > 0) shade.recoilTicks--;
      if (shade.safePushTicks > 0) shade.safePushTicks--;
    }
    for (const drifter of this.drifters) {
      drifter._pendingRemove = false;
      if (drifter.stateTicks > 0) {
        drifter.stateTicks--;
        if (drifter.stateTicks === 0 && drifter.state === 'flee') drifter._pendingRemove = true;
      }
    }

    if (this.windEnabled && this.night === 3) {
      const period = simTick % this.t.wind_interval_ticks;
      if (period === this.t.wind_interval_ticks - this.t.wind_warning_ticks) {
        this.wind.dirDeg = this.rng() * 360;
      }
      this.wind.active = simTick >= this.t.wind_interval_ticks && period < this.t.wind_duration_ticks;
    } else this.wind.active = false;
  }

  readMove(input) {
    let [mx, mz] = input.move ?? [0, 0];
    const magnitude = Math.hypot(mx, mz);
    if (magnitude > 1) { mx /= magnitude; mz /= magnitude; }
    const yaw = ((input.cam_yaw_deg ?? 0) * Math.PI) / 180;
    const wx = mx * Math.cos(yaw) + mz * Math.sin(yaw);
    const wz = -mx * Math.sin(yaw) + mz * Math.cos(yaw);
    const length = Math.hypot(wx, wz);
    return { x: length > 0 ? wx / length : 0, z: length > 0 ? wz / length : 0, moving: length > 0 };
  }

  approachVelocity(current, target, maxDelta) {
    const dx = target[0] - current[0];
    const dz = target[1] - current[1];
    const d = Math.hypot(dx, dz);
    if (d <= maxDelta || d === 0) return [target[0], target[1]];
    return [current[0] + (dx / d) * maxDelta, current[1] + (dz / d) * maxDelta];
  }

  padAtPlayer() {
    for (const pad of this.w.jump_pads) {
      if (Math.abs(this.player.pos[1] - pad.pos[1]) > 0.1) continue;
      if (distXZ(this.player.pos, pad.pos) <= pad.radius) return pad;
    }
    return null;
  }

  collideTower(nextX, nextZ) {
    if (this.night !== 3) return false;
    const tower = this.w.tower;
    if (this.player.pos[1] < tower.pos[1] || this.player.pos[1] > tower.pos[1] + tower.height) return false;
    return Math.hypot(nextX - tower.pos[0], nextZ - tower.pos[2]) < tower.radius;
  }

  movePlayer(input, simTick, edges) {
    const p = this.player;
    if (p.respawnTicks > 0) {
      p.respawnTicks--;
      p.vel = [0, 0, 0];
      if (p.respawnTicks === 0) {
        p.pos = clone3(this.world.origin);
        p.grounded = true;
        p.invulnTicks = secToTicks(this.t.fall_invuln_s);
        this.respawnedThisTick = true;
      }
      return;
    }
    this.respawnedThisTick = false;
    const move = this.readMove(input);
    const jumpEdge = edges.jump;
    const dashEdge = edges.dash;

    if (jumpEdge && p.grounded) {
      p.vel[1] = this.t.jump_speed;
      p.grounded = false;
    }
    if (dashEdge && p.dashTicks === 0 && (p.charmTicks > 0 || p.dashCdTicks === 0)) {
      const currentSpeed = Math.hypot(p.vel[0], p.vel[2]);
      const dir = move.moving ? [move.x, move.z]
        : currentSpeed > 0.1 ? [p.vel[0] / currentSpeed, p.vel[2] / currentSpeed]
          : [Math.sin(p.facing), Math.cos(p.facing)];
      const d = Math.hypot(dir[0], dir[1]) || 1;
      p.dashDir = [dir[0] / d, dir[1] / d];
      p.dashTicks = secToTicks(this.t.dash_duration_s);
      p.dashCdTicks = p.charmTicks > 0 ? 0 : secToTicks(this.t.dash_cooldown_s);
      p.dashFreezeY = !p.grounded;
      if (p.dashFreezeY) p.vel[1] = 0;
      this.emit('dash', {});
    }

    // Bục phóng được kích hoạt khi chạm lúc đang đứng trên bục.
    const pad = p.grounded ? this.padAtPlayer() : null;
    if (pad) {
      p.vel = clone3(pad.velocity);
      p.grounded = false;
      p.dashFreezeY = false;
      p.launchVelocityHeld = true;
    }

    const speed = p.charmTicks > 0 ? this.t.charm_speed : this.t.player_speed;
    let target = [move.x * speed, move.z * speed];
    if (this.wind.active) {
      const wdir = angleVector(this.wind.dirDeg);
      target[0] += wdir[0] * this.t.wind_speed;
      target[1] += wdir[1] * this.t.wind_speed;
    }
    if (p.dashTicks > 0) {
      p.vel[0] = p.dashDir[0] * this.t.dash_speed;
      p.vel[2] = p.dashDir[1] * this.t.dash_speed;
      if (move.moving) p.facing = Math.atan2(move.x, move.z);
    } else if (p.launchVelocityHeld) {
      // Bục phóng giữ nguyên vectơ vận tốc cho tới khi chạm mặt đất.
    } else {
      const v = this.approachVelocity([p.vel[0], p.vel[2]], target, this.t.player_accel * DT);
      p.vel[0] = v[0];
      p.vel[2] = v[1];
      if (move.moving) p.facing = Math.atan2(move.x, move.z);
    }

    const oldX = p.pos[0];
    const oldZ = p.pos[2];
    const nextX = oldX + p.vel[0] * DT;
    const nextZ = oldZ + p.vel[2] * DT;
    if (!this.collideTower(nextX, nextZ)) {
      p.pos[0] = nextX;
      p.pos[2] = nextZ;
    } else {
      p.vel[0] = 0;
      p.vel[2] = 0;
    }

    if (p.dashTicks > 0 && p.dashFreezeY) {
      // Air dash freezes the foot height until its final tick.
    } else if (p.grounded) {
      if (this.hasSameWalkingSurface(p.pos[0], p.pos[2], p.pos[1])) {
        const ramp = this.surfaceHeightsAt(p.pos[0], p.pos[2]).find((h) => h > p.pos[1] + 0.001);
        if (ramp !== undefined) p.pos[1] = ramp;
        p.vel[1] = 0;
      } else {
        p.grounded = false;
      }
    }

    if (!p.grounded && !(p.dashTicks > 0 && p.dashFreezeY)) {
      const fromY = p.pos[1];
      p.pos[1] += p.vel[1] * DT;
      p.vel[1] += this.t.gravity * DT;
      if (p.vel[1] <= 0) {
        const landed = this.findLandingSurface(p.pos[0], p.pos[2], fromY, p.pos[1]);
        if (landed !== null) {
          p.pos[1] = landed;
          p.vel[1] = 0;
          p.grounded = true;
          p.dashFreezeY = false;
          p.launchVelocityHeld = false;
        }
      }
    }
    if (p.dashTicks > 0) {
      p.dashTicks--;
      if (p.dashTicks === 0) p.dashFreezeY = false;
    }

    if (p.pos[1] < this.t.fall_y) this.fallPlayer(simTick);
  }

  fallPlayer(simTick) {
    const p = this.player;
    p.flames = Math.max(0, p.flames - 1);
    const lost = p.carried;
    p.carried = 0;
    p.vel = [0, 0, 0];
    p.grounded = false;
    p.invulnTicks = 0;
    this.emit('player_hit', { by: 'fall', flames: p.flames, lost });
    if (p.flames > 0) p.respawnTicks = this.t.fall_wait_ticks;
    else p.respawnTicks = 0;
  }

  pickupItems(simTick) {
    const p = this.player;
    if (p.respawnTicks > 0 || this.respawnedThisTick) return;
    const remaining = [];
    for (const mote of this.motes) {
      const heightOk = Math.abs(p.pos[1] - mote.pos[1]) <= this.t.pickup_vertical;
      if (p.carried < this.t.carry_capacity && mote.bornSimTick < simTick && heightOk && distXZ(p.pos, mote.pos) <= this.t.pickup_radius) {
        this.emitDroppedMotePickup(mote);
      } else remaining.push(mote);
    }
    this.motes = remaining;
    for (const charm of this.charms) {
      if (!charm.available) continue;
      if (Math.abs(p.pos[1] - charm.pos[1]) > this.t.pickup_vertical || distXZ(p.pos, charm.pos) > this.t.pickup_radius) continue;
      charm.available = false;
      charm.respawnTicks = this.t.charm_respawn_ticks;
      p.charmTicks = this.t.charm_duration_ticks;
      p.dashCdTicks = 0;
      this.emit('charm_picked', { charm_id: charm.id, charm_ticks: p.charmTicks });
    }
  }

  lanternInteraction(input) {
    const p = this.player;
    if (!input.interact || p.respawnTicks > 0 || p.carried <= 0) return;
    const candidates = this.lanterns
      .filter((lantern) => !lantern.lit && dist3(p.pos, lantern.pos) <= this.t.interact_radius)
      .sort((a, b) => dist3(p.pos, a.pos) - dist3(p.pos, b.pos) || a.id.localeCompare(b.id));
    const lantern = candidates[0];
    if (!lantern) return;
    const amount = Math.min(p.carried, this.t.lantern_cost - lantern.deposited);
    if (amount <= 0) return;
    p.carried -= amount;
    lantern.deposited += amount;
    this.emit('deposit', { lantern_id: lantern.id, amount, deposited: lantern.deposited });
    if (lantern.deposited >= this.t.lantern_cost) {
      lantern.lit = true;
      this.score += this.t.score.per_lantern;
      this.emit('lantern_lit', { lantern_id: lantern.id });
      for (const shade of this.shades) {
        if (distXZ(shade.pos, lantern.pos) >= this.t.safe_radius) continue;
        const d = distXZ(shade.pos, lantern.pos);
        shade.safePushDir = d > 0.001 ? [(shade.pos[0] - lantern.pos[0]) / d, (shade.pos[2] - lantern.pos[2]) / d] : [1, 0];
        shade.safePushLantern = lantern.id;
        shade.safePushTicks = this.t.safe_push_ticks;
        shade._safePushThisTick = true;
      }
    }
  }

  pulse(input) {
    const p = this.player;
    if (!input.pulse || p.pulseCdTicks > 0 || p.carried < this.t.pulse_cost || p.respawnTicks > 0) return;
    p.carried -= this.t.pulse_cost;
    p.pulseCdTicks = secToTicks(this.t.pulse_cooldown_s);
    const center = [p.pos[0], p.pos[1] + this.t.pulse_center_height, p.pos[2]];
    const hit = [];
    for (const shade of this.shades) {
      if (dist3(center, shade.pos) > this.t.pulse_radius) continue;
      const dx = shade.pos[0] - center[0];
      const dz = shade.pos[2] - center[2];
      const d = Math.hypot(dx, dz);
      shade.state = 'stunned';
      shade.stateTicks = secToTicks(this.t.pulse_stun_s);
      shade.stunTicks = shade.stateTicks;
      shade.pushTicks = secToTicks(this.t.pulse_push_s);
      shade.pushRemain = this.t.pulse_push_m;
      shade.pushDir = d > 0.001 ? [dx / d, dz / d] : [1, 0];
      shade._skipThisTick = true;
      shade._pendingState = null;
      hit.push(shade.id);
    }
    this.score += hit.length * this.t.score.per_stun;
    this.emit('pulse', { stunned_ids: hit });

    for (const drifter of this.drifters) {
      const centerDrifter = [drifter.pos[0], drifter.pos[1] + this.t.drifter_pulse_center_height, drifter.pos[2]];
      if (dist3(center, centerDrifter) > this.t.pulse_radius) continue;
      if (drifter.state === 'chase') {
        drifter.state = 'flee';
        drifter.stateTicks = this.t.drifter_flee_ticks;
        drifter.wanderDir = this.directionAway(drifter.pos, p.pos);
      } else if (drifter.state === 'flee' && drifter.stolen > 0) {
        const amount = drifter.stolen;
        for (let i = 0; i < amount; i++) {
          const angle = (Math.PI * 2 * i) / Math.max(1, amount);
          this.addMote([drifter.pos[0] + Math.cos(angle), drifter.pos[1], drifter.pos[2] + Math.sin(angle)], 'dropped', this.steps + 1);
        }
        drifter.stolen = 0;
        drifter.stateTicks = this.t.drifter_pulse_remove_ticks;
        drifter.pulseRemoved = true;
        this.emit('drifter_drop', { drifter_id: drifter.id, amount });
      }
    }
  }

  directionAway(from, target) {
    const dx = from[0] - target[0];
    const dz = from[2] - target[2];
    const d = Math.hypot(dx, dz);
    return d > 0.001 ? [dx / d, dz / d] : [1, 0];
  }

  constrainShadeToSafeZones(shade) {
    for (const lantern of this.lanterns) {
      if (!lantern.lit) continue;
      if (shade.safePushLantern === lantern.id && shade.safePushTicks > 0) continue;
      const dx = shade.pos[0] - lantern.pos[0];
      const dz = shade.pos[2] - lantern.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < this.t.safe_radius) {
        const dir = d > 0.001 ? [dx / d, dz / d] : [1, 0];
        shade.pos[0] = lantern.pos[0] + dir[0] * this.t.safe_radius;
        shade.pos[2] = lantern.pos[2] + dir[1] * this.t.safe_radius;
      }
    }
  }

  moveShadeAlong(shade, dir, amount) {
    const nextX = shade.pos[0] + dir[0] * amount;
    const nextZ = shade.pos[2] + dir[1] * amount;
    shade.pos[0] = nextX;
    shade.pos[2] = nextZ;
    this.constrainShadeToSafeZones(shade);
    shade.pos[1] = this.surfaceHeightAt(shade.pos[0], shade.pos[2]) + this.t.shade_center_height;
  }

  moveShades() {
    const p = this.player;
    const speed = this.night === 3 ? this.t.shade_speed_night3 : this.t.shade_speed;
    for (const shade of this.shades) {
      if (shade.safePushTicks > 0 && shade.safePushLantern) {
        const lantern = this.lanterns.find((l) => l.id === shade.safePushLantern);
        if (lantern) {
          const remaining = Math.max(1, shade.safePushTicks);
          const d = distXZ(shade.pos, lantern.pos);
          const amount = Math.max(0, this.t.safe_radius - d) / remaining;
          this.moveShadeAlong(shade, shade.safePushDir ?? [1, 0], amount);
        }
        continue;
      }
      if (shade.state === 'stunned') {
        if (shade.pushTicks > 0 && shade.pushRemain > 0) {
          const amount = Math.min(shade.pushRemain, this.t.pulse_push_m / secToTicks(this.t.pulse_push_s));
          this.moveShadeAlong(shade, shade.pushDir, amount);
          shade.pushRemain -= amount;
        }
        continue;
      }
      if (shade.state === 'recoil') {
        if (shade.recoilRemain > 0) {
          const amount = Math.min(shade.recoilRemain, this.t.shade_hit_knockback_m / secToTicks(this.t.shade_recoil_s));
          this.moveShadeAlong(shade, shade.recoilDir, amount);
          shade.recoilRemain -= amount;
        }
        continue;
      }
      if (shade.state === 'spawning') continue;
      const d = distXZ(shade.pos, p.pos);
      if (shade.state === 'chase' && d > this.t.shade_forget_radius) shade.state = 'wander';
      if (shade.state === 'wander' && d <= this.t.shade_detect_radius) shade.state = 'chase';
      if (shade.state === 'chase') {
        const dir = this.directionToward(shade.pos, p.pos);
        this.moveShadeAlong(shade, dir, Math.min(speed * DT, d));
      } else {
        this.moveShadeAlong(shade, shade.wanderDir, this.t.shade_wander_speed * DT);
      }
    }
  }

  directionToward(from, to) {
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    const d = Math.hypot(dx, dz);
    return d > 0.001 ? [dx / d, dz / d] : [1, 0];
  }

  moveDrifters() {
    const p = this.player;
    for (const drifter of this.drifters) {
      if (drifter.state === 'removed') continue;
      const d = distXZ(drifter.pos, p.pos);
      if (drifter.state === 'idle' && p.carried >= this.t.drifter_min_carried && d <= this.t.drifter_detect_radius) drifter.state = 'chase';
      if (drifter.state === 'chase' && (p.carried < this.t.drifter_min_carried || d > this.t.drifter_detect_radius)) drifter.state = 'idle';
      if (drifter.state === 'chase') {
        const dir = this.directionToward(drifter.pos, p.pos);
        const amount = Math.min(this.t.drifter_chase_speed * DT, d);
        drifter.pos[0] += dir[0] * amount;
        drifter.pos[2] += dir[1] * amount;
      } else if (drifter.state === 'flee') {
        const dir = this.directionAway(drifter.pos, p.pos);
        drifter.pos[0] += dir[0] * this.t.drifter_chase_speed * DT;
        drifter.pos[2] += dir[1] * this.t.drifter_chase_speed * DT;
      } else if (drifter.state === 'idle') {
        drifter.pos[0] += drifter.wanderDir[0] * this.t.drifter_idle_speed * DT;
        drifter.pos[2] += drifter.wanderDir[1] * this.t.drifter_idle_speed * DT;
      }
      drifter.pos[1] = this.surfaceHeightAt(drifter.pos[0], drifter.pos[2]);
    }
  }

  resolveContacts() {
    const p = this.player;
    if (p.respawnTicks > 0 || this.respawnedThisTick) return;
    // Gió Lạc chạm trước, bất tử không chặn việc cướp.
    for (const drifter of this.drifters) {
      if (drifter.state !== 'chase' || distXZ(drifter.pos, p.pos) > this.t.drifter_touch_radius) continue;
      const amount = Math.min(this.t.drifter_steal_max, p.carried);
      p.carried -= amount;
      drifter.stolen += amount;
      drifter.state = 'flee';
      drifter.stateTicks = this.t.drifter_flee_ticks;
      drifter.wanderDir = this.directionAway(drifter.pos, p.pos);
      this.emit('drifter_steal', { drifter_id: drifter.id, amount, carried: p.carried });
    }

    if (this.wasInvulnerableThisTick || p.invulnTicks > 0) return;
    const shades = [...this.shades].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
    for (const shade of shades) {
      if (shade.state === 'stunned' || shade.state === 'recoil' || shade.state === 'spawning' || shade._safePushThisTick) continue;
      if (distXZ(shade.pos, p.pos) > this.t.shade_hit_radius || Math.abs(shade.pos[1] - (p.pos[1] + this.t.player_hit_center_height)) > this.t.shade_hit_vertical) continue;
      p.flames = Math.max(0, p.flames - 1);
      const dropped = Math.floor(p.carried * this.t.hit_drop_ratio);
      p.carried -= dropped;
      this.dropMotes(dropped, p.pos);
      p.invulnTicks = secToTicks(this.t.invuln_s);
      shade.state = 'recoil';
      shade.stateTicks = secToTicks(this.t.shade_recoil_s);
      shade.recoilTicks = shade.stateTicks;
      shade.recoilRemain = this.t.shade_hit_knockback_m;
      shade.recoilDir = this.directionAway(shade.pos, p.pos);
      this.emit('player_hit', { by: 'shade', flames: p.flames, dropped });
      break;
    }
  }

  pickSpawnPoint(points, minDistance = 0, used = null) {
    const eligible = [];
    for (let i = 0; i < points.length; i++) {
      if (used?.has(i)) continue;
      if (distXZ(points[i], this.player.pos) < minDistance) continue;
      eligible.push(i);
    }
    if (!eligible.length) return null;
    const index = eligible[Math.floor(this.rng() * eligible.length)];
    used?.add(index);
    return points[index];
  }

  makeShade(point) {
    const shade = {
      id: `S${this.nextShadeId++}`, pos: clone3(point), state: 'spawning', stateTicks: 1,
      stunTicks: 0, pushTicks: 0, pushRemain: 0, pushDir: [1, 0],
      recoilTicks: 0, recoilRemain: 0, recoilDir: [1, 0],
      safePushTicks: 0, safePushLantern: null, wanderDir: this.randomDirection(),
    };
    return shade;
  }

  spawnEnemies(simTick) {
    if (this.randomShades && simTick >= this.w.shade_first_tick) {
      const elapsed = simTick - this.w.shade_first_tick;
      if (elapsed % this.w.shade_interval_ticks === 0 && this.shades.length < this.w.shade_max) {
        const count = elapsed === 0 ? this.w.shade_first_count : 1;
        for (let i = 0; i < count && this.shades.length < this.w.shade_max; i++) {
          const pos = this.pickSpawnPoint(this.shadeSpawnPoints, this.night === 1 ? 15 : 0, this.usedShadePoints);
          if (!pos) break;
          const shade = this.makeShade(pos);
          this.shades.push(shade);
          this.emit('shade_spawned', { id: shade.id });
        }
      }
    }
    if (this.randomDrifters && simTick > 0 && simTick % this.t.drifter_spawn_ticks === 0 && this.drifters.length < this.t.drifter_max) {
      const points = this.moteSpawnPoints;
      const pos = this.pickSpawnPoint(points, 0);
      if (pos) {
        const drifter = {
          id: `D${this.nextDrifterId++}`, pos: clone3(pos), state: 'idle', stateTicks: 0,
          stolen: 0, pulseRemoved: false, wanderDir: this.randomDirection(),
        };
        this.drifters.push(drifter);
      }
    }
  }

  advancePendingStates() {
    for (const shade of this.shades) {
      if (shade._pendingState) {
        shade.state = shade._pendingState;
        shade._pendingState = null;
      }
      if (shade.safePushTicks === 0) shade.safePushLantern = null;
      delete shade._skipThisTick;
      delete shade._safePushThisTick;
    }
    for (const drifter of this.drifters) if (drifter._pendingRemove) drifter.state = 'removed';
    this.drifters = this.drifters.filter((drifter) => drifter.state !== 'removed');
  }

  step(input = DEFAULT_INPUT) {
    if (this.state !== 'playing') return;
    this.tick++;
    const pauseEdge = !!input.pause && !this.prev.pause;
    const justPausedOrResumed = pauseEdge;
    const edges = {
      jump: !!input.jump && !this.prev.jump,
      dash: !!input.dash && !this.prev.dash,
      interact: !!input.interact && !this.prev.interact,
      pulse: !!input.pulse && !this.prev.pulse,
    };
    this.prev = {
      jump: !!input.jump, dash: !!input.dash,
      interact: !!input.interact, pulse: !!input.pulse, pause: !!input.pause,
    };
    if (pauseEdge) {
      this.paused = !this.paused;
      this.emit(this.paused ? 'paused' : 'resumed', {});
      return;
    }
    if (this.paused) return;

    const simTick = this.steps + 1;
    if (!this.nightStarted) {
      this.nightStarted = true;
      this.emit('night_start', { night: this.night });
    }
    this.respawnedThisTick = false;
    this.beginCounters(simTick);
    this.movePlayer(input, simTick, edges);
    this.pickupItems(simTick);
    this.lanternInteraction({ interact: edges.interact });
    this.pulse({ pulse: edges.pulse });
    this.moveShades();
    this.moveDrifters();
    this.resolveContacts();
    this.advancePendingStates();
    if (this.randomMotes && simTick % this.t.mote_respawn_ticks === 0) this.spawnMoteAtFreePoint(simTick);
    this.spawnEnemies(simTick);
    this.steps++;

    // Hết lửa luôn thua; nếu còn sống thì thắp hết thắng cả khi vừa hết giờ.
    if (this.player.flames <= 0) this.finish('lost', 'no_flames');
    else if (this.lanterns.every((lantern) => lantern.lit)) {
      this.score += Math.floor(Math.max(0, this.timeLeft)) * this.t.score.per_second_left;
      this.score += this.player.flames * this.t.score.per_flame_left;
      this.finish('won', 'all_lit');
    } else if (this.timeLeft <= 0) this.finish('lost', 'dawn');
  }

  finish(result, reason) {
    this.state = result;
    this.result = { result, reason };
    this.emit('game_over', { result, reason });
  }

  snapshot() {
    const p = this.player;
    const state = this.paused && this.state === 'playing' ? 'paused' : this.state;
    return {
      type: 'snapshot', tick: this.tick, sim_tick: this.steps, state, night: this.night,
      wind: { active: this.wind.active, dir_deg: r3(this.wind.dirDeg) },
      time_left_s: r3(Math.max(0, this.timeLeft)), score: this.score,
      player: {
        pos: v3(p.pos), vel: v3(p.vel), grounded: p.grounded,
        flames: p.flames, carried: p.carried,
        invuln: r3(p.invulnTicks / TICK_RATE), dash_cd_s: r3(p.dashCdTicks / TICK_RATE),
        pulse_cd_s: r3(p.pulseCdTicks / TICK_RATE), charm_s: r3(p.charmTicks / TICK_RATE),
      },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: v3(l.pos), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: v3(s.pos), state: s.state, state_ticks_left: s.stateTicks })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({
        id: m.id, pos: v3(m.pos), kind: m.kind,
        ttl_s: m.kind === 'dropped' ? r3(m.ttlTicks / TICK_RATE) : null,
      })),
      drifters: this.drifters.map((d) => ({ id: d.id, pos: v3(d.pos), state: d.state, stolen: d.stolen })),
      charms: this.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: r3(c.respawnTicks / TICK_RATE) })),
    };
  }
}
