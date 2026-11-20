// Kiểm tra định dạng inputs/scenario theo Test Contract v1.1.
export class FormatError extends Error {}

const isObj = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNum = (value) => typeof value === 'number' && Number.isFinite(value);
const isVec3 = (value) => Array.isArray(value) && value.length === 3 && value.every(isNum);
const fail = (message) => { throw new FormatError(message); };
const intAtLeastZero = (value) => Number.isInteger(value) && value >= 0;
const boolAt = (value, at) => { if (typeof value !== 'boolean') fail(`${at}: phải là boolean`); };
const nonNegativeIntAt = (value, at) => { if (!intAtLeastZero(value)) fail(`${at}: số nguyên >= 0`); };

export function validateInputs(data) {
  if (!isObj(data) || !Array.isArray(data.frames)) fail('inputs: cần object có mảng "frames"');
  let last = -1;
  data.frames.forEach((frame, index) => {
    const at = `inputs.frames[${index}]`;
    if (!isObj(frame)) fail(`${at}: phải là object`);
    if (!Number.isInteger(frame.tick) || frame.tick < 0) fail(`${at}.tick: phải là số nguyên >= 0`);
    if (frame.tick <= last) fail(`${at}.tick: phải tăng nghiêm ngặt`);
    last = frame.tick;
    if (frame.move !== undefined && !(Array.isArray(frame.move) && frame.move.length === 2 && frame.move.every((n) => isNum(n) && n >= -1 && n <= 1)))
      fail(`${at}.move: cần [x, z] với mỗi giá trị trong [-1, 1]`);
    if (frame.cam_yaw_deg !== undefined && !isNum(frame.cam_yaw_deg)) fail(`${at}.cam_yaw_deg: phải là số`);
    for (const button of ['jump', 'dash', 'interact', 'pulse', 'pause']) {
      if (frame[button] !== undefined) boolAt(frame[button], `${at}.${button}`);
    }
  });
  return data;
}

export function validateScenario(scenario) {
  if (!isObj(scenario)) fail('scenario: phải là object');
  if (scenario.player !== undefined) {
    if (!isObj(scenario.player)) fail('scenario.player: phải là object');
    const player = scenario.player;
    if (player.pos !== undefined && !isVec3(player.pos)) fail('scenario.player.pos: cần [x, y, z]');
    if (player.vel !== undefined && !isVec3(player.vel)) fail('scenario.player.vel: cần [x, y, z]');
    for (const key of ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks']) {
      if (player[key] !== undefined) nonNegativeIntAt(player[key], `scenario.player.${key}`);
    }
    if (player.grounded !== undefined) boolAt(player.grounded, 'scenario.player.grounded');
  }
  for (const key of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) {
    if (scenario[key] !== undefined) boolAt(scenario[key], `scenario.${key}`);
  }
  if (scenario.time_left_s !== undefined && !(isNum(scenario.time_left_s) && scenario.time_left_s >= 0))
    fail('scenario.time_left_s: số >= 0');

  if (scenario.motes !== undefined) {
    if (!Array.isArray(scenario.motes)) fail('scenario.motes: phải là mảng');
    scenario.motes.forEach((mote, index) => {
      const at = `scenario.motes[${index}]`;
      if (isVec3(mote)) return;
      if (!isObj(mote) || !isVec3(mote.pos)) fail(`${at}: cần [x,y,z] hoặc object có pos`);
      if (mote.id !== undefined && typeof mote.id !== 'string') fail(`${at}.id: phải là chuỗi`);
      if (mote.kind !== undefined && !['random', 'dropped'].includes(mote.kind)) fail(`${at}.kind: phải là random hoặc dropped`);
      if (mote.ttl_ticks !== undefined) nonNegativeIntAt(mote.ttl_ticks, `${at}.ttl_ticks`);
    });
  }

  if (scenario.shades !== undefined) {
    if (!Array.isArray(scenario.shades)) fail('scenario.shades: phải là mảng');
    scenario.shades.forEach((shade, index) => {
      const at = `scenario.shades[${index}]`;
      if (!isObj(shade) || !isVec3(shade.pos)) fail(`${at}: cần { pos: [x,y,z] }`);
      if (shade.id !== undefined && typeof shade.id !== 'string') fail(`${at}.id: phải là chuỗi`);
      if (shade.state !== undefined && !['spawning', 'wander', 'chase', 'recoil', 'stunned'].includes(shade.state)) fail(`${at}.state: trạng thái không hợp lệ`);
      if (shade.state_ticks_left !== undefined) nonNegativeIntAt(shade.state_ticks_left, `${at}.state_ticks_left`);
    });
  }

  if (scenario.drifters !== undefined) {
    if (!Array.isArray(scenario.drifters)) fail('scenario.drifters: phải là mảng');
    scenario.drifters.forEach((drifter, index) => {
      const at = `scenario.drifters[${index}]`;
      if (!isObj(drifter) || !isVec3(drifter.pos) || typeof drifter.id !== 'string') fail(`${at}: cần { id, pos: [x,y,z] }`);
      if (drifter.state !== undefined && !['idle', 'chase', 'flee'].includes(drifter.state)) fail(`${at}.state: trạng thái không hợp lệ`);
      for (const key of ['stolen', 'state_ticks_left']) if (drifter[key] !== undefined) nonNegativeIntAt(drifter[key], `${at}.${key}`);
    });
  }

  if (scenario.charms !== undefined) {
    if (!Array.isArray(scenario.charms)) fail('scenario.charms: phải là mảng');
    scenario.charms.forEach((charm, index) => {
      const at = `scenario.charms[${index}]`;
      if (!isObj(charm) || typeof charm.id !== 'string' || !isVec3(charm.pos)) fail(`${at}: cần { id, pos: [x,y,z] }`);
      if (charm.available !== undefined) boolAt(charm.available, `${at}.available`);
      if (charm.respawn_ticks !== undefined) nonNegativeIntAt(charm.respawn_ticks, `${at}.respawn_ticks`);
    });
  }

  if (scenario.wind !== undefined) {
    if (!isObj(scenario.wind)) fail('scenario.wind: phải là object');
    if (scenario.wind.active !== undefined) boolAt(scenario.wind.active, 'scenario.wind.active');
    if (scenario.wind.dir_deg !== undefined && !isNum(scenario.wind.dir_deg)) fail('scenario.wind.dir_deg: phải là số');
  }

  if (scenario.lanterns !== undefined) {
    if (!Array.isArray(scenario.lanterns)) fail('scenario.lanterns: phải là mảng');
    scenario.lanterns.forEach((lantern, index) => {
      const at = `scenario.lanterns[${index}]`;
      if (!isObj(lantern) || typeof lantern.id !== 'string') fail(`${at}: cần "id"`);
      if (!/^L[1-7]$/.test(lantern.id)) fail(`${at}.id: chỉ có L1..L7`);
      if (lantern.pos !== undefined && !isVec3(lantern.pos)) fail(`${at}.pos: cần [x,y,z]`);
      if (lantern.lit !== undefined) boolAt(lantern.lit, `${at}.lit`);
      if (lantern.deposited !== undefined) nonNegativeIntAt(lantern.deposited, `${at}.deposited`);
    });
  }
  return scenario;
}
