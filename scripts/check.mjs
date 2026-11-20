// Dùng cho hook Stop của Claude Code: chặn agent kết thúc khi test đang đỏ.
// Mã thoát 2 = chặn, nội dung stderr được gửi lại cho agent.
import { spawnSync } from 'node:child_process';

const r = spawnSync(process.execPath, ['--test'], { encoding: 'utf8', cwd: new URL('..', import.meta.url) });
if (r.status !== 0) {
  const tail = (r.stdout + r.stderr).split('\n').filter((l) => /^not ok|fail|Error/.test(l)).slice(0, 15).join('\n');
  process.stderr.write(`Test đang đỏ, chưa được kết thúc. Sửa lỗi rồi chạy lại "npm test".\n${tail}\n`);
  process.exit(2);
}
process.exit(0);
