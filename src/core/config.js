// Mọi con số gameplay nằm ở đây. game.contract.json được sinh từ file này
// (npm run contract) và test kiểm tra hai bên luôn khớp nhau.

export const TICK_RATE = 60;

// Các khóa khai báo trong Test Contract v1.2 (tuning).
export const TUNING = {
  player_speed: 6.0, // m/s; tăng tốc/dừng <= 0.1s; điều khiển trên không đầy đủ
  carry_capacity: 10, // base capacity; actual = 10 + 2*successful_lights, max capacity_max
  capacity_max: 20, // v1.2: sức chứa tối đa
  lantern_cost: 10, // đom đóm để thắp đèn lần đầu
  relight_cost: 5, // v1.2: đom đóm để thắp lại đèn đã từng sáng
  pickup_radius: 1.0,
  pickup_height: 1.5, // chênh cao chân Mây vs mặt đất đom đóm
  interact_radius: 2.0,
  pulse_cost: 3,
  pulse_radius: 5.0, // 3D distance to shade center
  pulse_center_y: 0.8, // tâm = chân Mây + 0.8
  pulse_stun_ticks: 120,
  pulse_push_m: 4.0, // trong 15 tick đầu
  pulse_push_ticks: 15,
  pulse_cooldown_s: 3.0,
  safe_radius: 6.0,
  safe_push_ticks: 30, // bóng trong vùng an toàn bị đẩy ra trong 30 tick
  shade_speed: 4.0, // Đêm 3: 4.5 override trong map
  shade_speed_night3: 4.5,
  shade_detect_r: 12.0, // phát hiện 12m
  shade_lose_r: 18.0, // bỏ đuổi 18m
  shade_hit_radius: 1.0,
  shade_hit_height: 1.5,
  shade_recoil_m: 2.0,
  shade_recoil_ticks: 60,
  invuln_ticks: 90,
  hit_drop_ratio: 0.5,
  hit_drop_ttl_ticks: 480,
  hit_drop_min_r: 1.5,
  hit_drop_max_r: 2.5,
  flames: 3,
  night1_duration_s: 240, // v1.2: 240 (was 300)
  night2_duration_s: 270, // v1.2: 270 (was 330)
  night3_duration_s: 300, // v1.2: 300 (was 360)
  // Dash (Lướt)
  dash_speed: 14.0,
  dash_duration_s: 0.2, // 12 tick
  dash_cooldown_s: 1.5,
  // Fall
  fall_respawn_ticks: 60,
  fall_y_threshold: -10,
  // Fuel system (v1.2)
  fuel_max: 100, // nhiên liệu tối đa của đèn
  fuel_decay_per_s: 1.0, // hao hụt 1/giây khi đang sáng (1/60 mỗi tick)
  fuel_per_mote: 10, // mỗi đom đóm châm 10 fuel
  drain_per_s: 5.0, // Bóng Mực drain 5 fuel/giây
  low_fuel_threshold: 30, // fuel < 30 → mất safe zone, đèn nhấp nháy
  win_ratio: 0.6, // v1.2: cần ≥ 60% đèn sáng lúc bình minh để thắng
  // Scoring (v1.2 — THAY THẾ toàn bộ)
  score: {
    per_mote_deposit: 5, // v1.2: mỗi đom đóm nạp vào đèn
    per_lantern_first: 100, // thắp lần đầu
    per_lantern_relight: 40, // thắp lại
    per_stun: 5, // Bóng Mực trúng Tỏa Sáng
    per_stun_drain: 15, // bonus nếu đang drain
    per_dawn_lantern_base: 50, // bình minh: mỗi đèn sáng
    // + floor(fuel) thêm cho mỗi đèn sáng
    per_flame_left: 50, // bình minh: mỗi Ngọn Lửa còn
  },
};

// Thông số thế giới chung (không nằm trong contract).
export const WORLD = {
  jump_speed: 7.0, // v1.1: 7.0 m/s
  gravity: 20.0,
  // Mote respawn
  mote_respawn_interval_ticks: 240, // tick 240, 480, ...
  mote_cap: 30, // trần 30
  // Drifter (Gió Lạc) — Đêm 2 & 3
  drifter_speed_idle: 2.0,
  drifter_speed_chase: 7.0,
  drifter_speed_flee: 7.0,
  drifter_detect_r: 15.0,
  drifter_detect_motes: 5, // chase khi Mây mang >= 5
  drifter_hit_r: 1.2,
  drifter_steal_amount: 3, // min(3, carried)
  drifter_flee_ticks: 240,
  drifter_drop_despawn_ticks: 120, // pulse trúng flee → thả đồ, biến mất sau 120 tick
  drifter_max: 2,
  drifter_spawn_interval_ticks: 1200, // tick 1200, 2400, ...
  // Charm (Bùa Gió)
  charm_duration_ticks: 600,
  charm_speed_boost: 7.2,
  charm_respawn_ticks: 2700,
  charm_dash_no_cd: true, // lướt không hồi chiêu khi có bùa
  // Wind (Gió mạnh — Đêm 3)
  wind_interval_ticks: 1800, // 30s
  wind_duration_ticks: 300, // 5s
  wind_warn_ticks: 120, // 2s trước
  wind_push_speed: 2.0, // m/s
  // Environment lighting
  ambient_base: 0.15,
  ambient_scale: 0.55,
};

// Hình học và điểm sinh cho ba bản đồ; mọi số bản đồ nằm cùng cấu hình.
const D2R = Math.PI / 180;
const polar = (r, deg, y = 0) => [r * Math.cos(deg * D2R), y, r * Math.sin(deg * D2R)];

// ---------- Đêm 1 — Đảo Bến ----------
const night1 = {
  name: 'Đảo Bến',
  spawn: [0, 0, 0],
  facing_z: true, // quay mặt về +Z
  islands: [{ center: [0, 0, 0], radius: 40, y: 0 }],
  bridges: [],
  ramps: [],
  jumpPads: [],
  tiers: [], // flat
  tower: null,
  lanterns: [
    { id: 'L1', pos: [0, 0, 25] },
    { id: 'L2', pos: [23.8, 0, 7.7] },
    { id: 'L3', pos: [14.7, 0, -20.2] },
    { id: 'L4', pos: [-14.7, 0, -20.2] },
    { id: 'L5', pos: [-23.8, 0, 7.7] },
  ],
  // 8 điểm bán kính 12m (mỗi 45°) + 16 điểm bán kính 33m (mỗi 22.5°) = 24 điểm, dùng 20
  moteSpawns: [
    ...Array.from({ length: 8 }, (_, i) => polar(12, i * 45)),
    ...Array.from({ length: 16 }, (_, i) => polar(33, i * 22.5)),
  ],
  moteInitialCount: 20,
  // 12 điểm bán kính 37m (15°, 45°, 75°, ...)
  shadeSpawns: Array.from({ length: 12 }, (_, i) => polar(37, 15 + i * 30)),
  shadeMinDistPlayer: 15,
  shadeInitial: 2,
  shadeInitialTick: 300, // tick 300 = giây 5
  shadeSpawnInterval: 480, // 8s = 480 ticks
  shadeMax: 6,
  drifterSpawns: [], // không có Gió Lạc Đêm 1
  charms: [], // không có Bùa Gió Đêm 1
  windEnabled: false,
  duration_s: 300,
};

// ---------- Đêm 2 — Đảo Cau ----------
const night2MoteSpawnsA = [
  ...Array.from({ length: 4 }, (_, i) => polar(10, i * 90)),
  ...Array.from({ length: 8 }, (_, i) => polar(22, i * 45)),
];
const night2MoteSpawnsB = night2MoteSpawnsA.map(([x, y, z]) => [x + 70, y, z]);

const night2 = {
  name: 'Đảo Cau',
  spawn: [0, 0, 0],
  facing_z: true,
  islands: [
    { center: [0, 0, 0], radius: 28, y: 0 },
    { center: [70, 0, 0], radius: 28, y: 0 },
  ],
  bridges: [
    { xMin: 26, xMax: 44, zMin: -2, zMax: 2, y: 0 }, // cầu tre
  ],
  ramps: [],
  jumpPads: [
    // bục nhảy (20,0,18) → bắn về tâm đảo B (70,0,0)
    { pos: [20, 0, 18], radius: 1, launchVy: 14, launchHSpeed: 24, launchDir: [1, 0, 0] },
    // bục nhảy (50,0,-18) → bắn về tâm đảo A (0,0,0)
    { pos: [50, 0, -18], radius: 1, launchVy: 14, launchHSpeed: 24, launchDir: [-1, 0, 0] },
  ],
  tiers: [],
  tower: null,
  lanterns: [
    { id: 'L1', pos: [0, 0, 20] },
    { id: 'L2', pos: [17, 0, -10] },
    { id: 'L3', pos: [-17, 0, -10] },
    { id: 'L4', pos: [70, 0, 20] },
    { id: 'L5', pos: [87, 0, -10] },
    { id: 'L6', pos: [53, 0, -10] },
  ],
  moteSpawns: [...night2MoteSpawnsA, ...night2MoteSpawnsB],
  moteInitialCount: 20,
  // 8 điểm bán kính 26m mỗi đảo (22.5°, 67.5°, ...)
  shadeSpawns: [
    ...Array.from({ length: 8 }, (_, i) => polar(26, 22.5 + i * 45)),
    ...Array.from({ length: 8 }, (_, i) => {
      const p = polar(26, 22.5 + i * 45);
      return [p[0] + 70, p[1], p[2]];
    }),
  ],
  shadeMinDistPlayer: 15,
  shadeInitial: 2,
  shadeInitialTick: 300,
  shadeSpawnInterval: 420, // 7s
  shadeMax: 8,
  // Gió Lạc sinh trên các điểm mote spawn (sương)
  drifterSpawns: [...night2MoteSpawnsA, ...night2MoteSpawnsB],
  charms: [{ id: 'C1', pos: [35, 0, 0] }],
  windEnabled: false,
  duration_s: 330,
};

// ---------- Đêm 3 — Đảo Chuông ----------
const night3MoteT0 = Array.from({ length: 18 }, (_, i) => polar(34, i * 20)); // tầng 0
const night3MoteT1 = Array.from({ length: 8 }, (_, i) => polar(18, 20 + i * 20, 3)); // tầng 1 (z>0 side implied by 20..160 range)
const night3MoteT2 = Array.from({ length: 4 }, (_, i) => polar(5, 45 + i * 90, 6)); // tầng 2

const night3 = {
  name: 'Đảo Chuông',
  spawn: [0, 0, 0],
  facing_z: true,
  islands: [{ center: [0, 0, 0], radius: 45, y: 0 }],
  bridges: [],
  ramps: [
    // dốc ở 30°: chân (R=30,Y=0) → đỉnh (R=24,Y=3), rộng 3m
    { angle_deg: 30, footR: 30, topR: 24, footY: 0, topY: 3, width: 3 },
    // dốc ở 150°
    { angle_deg: 150, footR: 30, topR: 24, footY: 0, topY: 3, width: 3 },
  ],
  jumpPads: [
    // (0,3,13) → vận tốc Y 12, ngang 8 hướng -Z → đáp lên tầng 2
    { pos: [0, 3, 13], radius: 1, launchVy: 12, launchHSpeed: 8, launchDir: [0, 0, -1] },
  ],
  tiers: [
    // tầng 1: vành khăn R 12-24, z>0, Y=3
    { type: 'annulus', innerR: 12, outerR: 24, y: 3, constraint: 'z>0' },
    // tầng 2: đĩa R=8, Y=6
    { type: 'disc', radius: 8, y: 6 },
  ],
  tower: { pos: [0, 6, 0], radius: 2, height: 8 }, // tháp chuông
  lanterns: [
    { id: 'L1', pos: [0, 6, 6] },
    { id: 'L2', pos: [18, 3, 10] },
    { id: 'L3', pos: [-18, 3, 10] },
    { id: 'L4', pos: [35, 0, -10] },
    { id: 'L5', pos: [-35, 0, -10] },
    { id: 'L6', pos: [20, 0, -35] },
    { id: 'L7', pos: [-20, 0, -35] },
  ],
  moteSpawns: [...night3MoteT0, ...night3MoteT1, ...night3MoteT2],
  moteInitialCount: 20, // 20 lúc bắt đầu tại 20 điểm khác nhau
  shadeSpawns: Array.from({ length: 16 }, (_, i) => polar(43, i * 22.5)),
  shadeMinDistPlayer: 15,
  shadeInitial: 2,
  shadeInitialTick: 300,
  shadeSpawnInterval: 360, // 6s
  shadeMax: 10,
  drifterSpawns: [...night3MoteT0, ...night3MoteT1, ...night3MoteT2],
  charms: [
    { id: 'C1', pos: [30, 0, 25] },
    { id: 'C2', pos: [-30, 0, 25] },
  ],
  windEnabled: true,
  duration_s: 360,
};

export const MAPS = { 1: night1, 2: night2, 3: night3 };
