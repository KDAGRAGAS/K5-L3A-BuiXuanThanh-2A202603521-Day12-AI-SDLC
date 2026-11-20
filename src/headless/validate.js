// Kiểm tra định dạng file inputs/scenario. Sai định dạng -> FormatError -> mã thoát 2.
// Test Contract v1.2
export class FormatError extends Error {}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const fail = (msg) => {
  throw new FormatError(msg);
};

export function validateInputs(data) {
  if (!isObj(data) || !Array.isArray(data.frames)) fail('inputs: cần object có mảng "frames"');
  let last = -1;
  data.frames.forEach((f, i) => {
    const at = `inputs.frames[${i}]`;
    if (!isObj(f)) fail(`${at}: phải là object`);
    if (!Number.isInteger(f.tick) || f.tick < 0) fail(`${at}.tick: phải là số nguyên >= 0`);
    if (f.tick <= last) fail(`${at}.tick: phải tăng nghiêm ngặt`);
    last = f.tick;
    if (f.move !== undefined && !(Array.isArray(f.move) && f.move.length === 2 && f.move.every((x) => isNum(x) && x >= -1 && x <= 1)))
      fail(`${at}.move: cần [x, z] với mỗi giá trị trong [-1, 1]`);
    if (f.cam_yaw_deg !== undefined && !isNum(f.cam_yaw_deg)) fail(`${at}.cam_yaw_deg: phải là số`);
    for (const b of ['jump', 'interact', 'pulse', 'dash', 'pause'])
      if (f[b] !== undefined && typeof f[b] !== 'boolean') fail(`${at}.${b}: phải là boolean`);
  });
  return data;
}

export function validateScenario(s) {
  if (!isObj(s)) fail('scenario: phải là object');
  if (s.player !== undefined) {
    if (!isObj(s.player)) fail('scenario.player: phải là object');
    if (s.player.pos !== undefined && !isVec3(s.player.pos)) fail('scenario.player.pos: cần [x, y, z]');
    for (const k of ['carried', 'flames', 'successful_lights'])
      if (s.player[k] !== undefined && !(Number.isInteger(s.player[k]) && s.player[k] >= 0)) fail(`scenario.player.${k}: số nguyên >= 0`);
    for (const k of ['invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks'])
      if (s.player[k] !== undefined && !(Number.isInteger(s.player[k]) && s.player[k] >= 0)) fail(`scenario.player.${k}: số nguyên >= 0`);
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled'])
    if (s[k] !== undefined && typeof s[k] !== 'boolean') fail(`scenario.${k}: phải là boolean`);
  if (s.time_left_s !== undefined && !(isNum(s.time_left_s) && s.time_left_s >= 0)) fail('scenario.time_left_s: số >= 0');
  if (s.motes !== undefined) {
    if (!Array.isArray(s.motes)) fail('scenario.motes: phải là mảng');
    s.motes.forEach((m, i) => {
      if (Array.isArray(m)) {
        if (!isVec3(m)) fail(`scenario.motes[${i}]: cần [x, y, z]`);
      } else if (isObj(m)) {
        if (!isVec3(m.pos)) fail(`scenario.motes[${i}].pos: cần [x, y, z]`);
      } else fail(`scenario.motes[${i}]: cần [x,y,z] hoặc {pos, ...}`);
    });
  }
  if (s.shades !== undefined) {
    if (!Array.isArray(s.shades)) fail('scenario.shades: phải là mảng');
    s.shades.forEach((sh, i) => {
      if (!isObj(sh) || !isVec3(sh.pos)) fail(`scenario.shades[${i}]: cần { "pos": [x, y, z] }`);
      if (sh.id !== undefined && typeof sh.id !== 'string') fail(`scenario.shades[${i}].id: phải là chuỗi`);
      if (sh.state !== undefined && !['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'].includes(sh.state))
        fail(`scenario.shades[${i}].state: phải là spawning|wander|chase|recoil|stunned|drain`);
      if (sh.state_ticks_left !== undefined && !(Number.isInteger(sh.state_ticks_left) && sh.state_ticks_left >= 0))
        fail(`scenario.shades[${i}].state_ticks_left: số nguyên >= 0`);
      if (sh.target_lantern_id !== undefined && sh.target_lantern_id !== null && typeof sh.target_lantern_id !== 'string')
        fail(`scenario.shades[${i}].target_lantern_id: phải là chuỗi hoặc null`);
    });
  }
  if (s.lanterns !== undefined) {
    if (!Array.isArray(s.lanterns)) fail('scenario.lanterns: phải là mảng');
    s.lanterns.forEach((L, i) => {
      if (!isObj(L) || typeof L.id !== 'string') fail(`scenario.lanterns[${i}]: cần "id"`);
      if (L.pos !== undefined && !isVec3(L.pos)) fail(`scenario.lanterns[${i}].pos: cần [x, y, z]`);
      if (L.lit !== undefined && typeof L.lit !== 'boolean') fail(`scenario.lanterns[${i}].lit: boolean`);
      if (L.deposited !== undefined && !(Number.isInteger(L.deposited) && L.deposited >= 0))
        fail(`scenario.lanterns[${i}].deposited: số nguyên >= 0`);
      if (L.fuel !== undefined && !(isNum(L.fuel) && L.fuel >= 0))
        fail(`scenario.lanterns[${i}].fuel: số >= 0`);
      if (L.ever_lit !== undefined && typeof L.ever_lit !== 'boolean')
        fail(`scenario.lanterns[${i}].ever_lit: boolean`);
      if (L.relit_count !== undefined && !(Number.isInteger(L.relit_count) && L.relit_count >= 0))
        fail(`scenario.lanterns[${i}].relit_count: số nguyên >= 0`);
    });
  }
  if (s.drifters !== undefined) {
    if (!Array.isArray(s.drifters)) fail('scenario.drifters: phải là mảng');
    s.drifters.forEach((d, i) => {
      if (!isObj(d) || !isVec3(d.pos)) fail(`scenario.drifters[${i}]: cần { "pos": [x, y, z] }`);
      if (d.state !== undefined && !['idle', 'chase', 'flee', 'removed'].includes(d.state))
        fail(`scenario.drifters[${i}].state: phải là idle|chase|flee|removed`);
    });
  }
  if (s.charms !== undefined) {
    if (!Array.isArray(s.charms)) fail('scenario.charms: phải là mảng');
    s.charms.forEach((c, i) => {
      if (!isObj(c)) fail(`scenario.charms[${i}]: phải là object`);
      if (typeof c.id !== 'string') fail(`scenario.charms[${i}].id: cần chuỗi`);
      if (!isVec3(c.pos)) fail(`scenario.charms[${i}].pos: cần [x, y, z]`);
    });
  }
  return s;
}
