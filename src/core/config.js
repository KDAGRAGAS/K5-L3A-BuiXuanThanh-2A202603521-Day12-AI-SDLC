// Mọi con số gameplay nằm ở đây. game.contract.json được sinh từ file này
// (npm run contract) và test kiểm tra hai bên luôn khớp nhau.

export const TICK_RATE = 60;

// Các khóa khai báo trong Test Contract v1.0 (tuning).
export const TUNING = {
  player_speed: 6.0, // m/s
  carry_capacity: 10, // số đom đóm mang tối đa
  lantern_cost: 5, // số đom đóm để thắp 1 đèn
  lantern_count_night1: 5,
  pickup_radius: 1.0, // m, nhặt tự động khi khoảng cách XZ <= r
  interact_radius: 2.5, // m, nạp đèn khi bấm interact
  pulse_cost: 1, // tỏa sáng tốn 1 đom đóm đang mang
  pulse_radius: 6.0, // m
  night1_duration_s: 300,
  flames: 3, // "máu" của Mây
  invuln_s: 2.0, // bất tử sau khi bị chạm
  hit_drop_ratio: 0.5, // rơi floor(carried * 0.5) đom đóm, mất luôn
  pulse_stun_s: 3.0,
  pulse_push_m: 4.0,
  pulse_cooldown_s: 2.0,
  safe_radius: 6.0, // quanh đèn ĐÃ THẮP, Bóng Mực không vào được
  shade_speed: 3.5, // m/s
  shade_hit_radius: 1.0, // m
  fall_enabled: false, // mép đảo là tường vô hình, không rơi
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 5, // mỗi Bóng Mực bị choáng
    per_second_left: 2, // khi thắng: floor(time_left_s) * 2
    per_flame_left: 50, // khi thắng: flames * 50
  },
};

// Thông số thế giới không nằm trong contract (giả định của mình, xem docs/notes).
export const WORLD = {
  island_radius: 40,
  lantern_ring_radius: 25,
  mote_count: 40,
  mote_min_r: 4,
  mote_max_r: 37,
  mote_respawn_interval_s: 10,
  mote_respawn_below: 15,
  initial_shades: 2,
  max_shades: 5,
  shade_spawn_interval_s: 30,
  shade_spawn_r: 36,
  shade_y: 1.0, // tâm Bóng Mực lơ lửng 1 m
  shade_hit_knockback_m: 5.0, // Bóng Mực vừa chạm Mây bị bật lùi (không choáng)
  jump_speed: 6.0,
  gravity: 20.0,
};
