// Hàm truy vấn địa hình dùng chung cho mô phỏng và hiển thị.
import { MAPS } from './config.js';
export { MAPS };

const D2R = Math.PI / 180;

// Lấy Y mặt đất tại (x,z) dựa vào terrain map
export function getGroundY(map, x, z) {
  // Đảo Chuông tầng
  if (map.tiers && map.tiers.length) {
    const r = Math.hypot(x, z);
    // Tầng 2: đĩa bán kính 8m tại Y=6
    const t2 = map.tiers.find((t) => t.type === 'disc');
    if (t2 && r <= t2.radius) return t2.y;
    // Tầng 1: vành khăn, z>0
    const t1 = map.tiers.find((t) => t.type === 'annulus');
    if (t1 && z > 0 && r >= t1.innerR && r <= t1.outerR) return t1.y;
    // Dốc
    if (map.ramps) {
      for (const ramp of map.ramps) {
        const ca = Math.cos(ramp.angle_deg * D2R);
        const sa = Math.sin(ramp.angle_deg * D2R);
        // project (x,z) onto ramp axis
        const along = x * ca + z * sa; // distance along ramp direction from center
        const across = -x * sa + z * ca; // perpendicular distance
        if (Math.abs(across) <= ramp.width / 2 && along >= ramp.topR && along <= ramp.footR) {
          // interpolate Y
          const frac = (along - ramp.topR) / (ramp.footR - ramp.topR);
          return ramp.topY + (ramp.footY - ramp.topY) * frac;
        }
      }
    }
  }
  // Cầu
  if (map.bridges) {
    for (const b of map.bridges) {
      if (x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax) return b.y;
    }
  }
  return 0;
}

// Kiểm tra (x,z) có nằm trên mặt đảo / cầu không
export function isOnIsland(map, x, z) {
  for (const isl of map.islands) {
    const dx = x - isl.center[0];
    const dz = z - isl.center[2];
    if (Math.hypot(dx, dz) <= isl.radius) return true;
  }
  if (map.bridges) {
    for (const b of map.bridges) {
      if (x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax) return true;
    }
  }
  return false;
}
