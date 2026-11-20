# AGENTS.md: Đảo Đèn Lồng

Game 3D (Three.js trên web) + chế độ headless theo Test Contract v1.0. Node >= 18, không có dependency npm.

## Lệnh
- Chơi: `npm start` rồi mở http://localhost:5173
- Test: `npm test` (node:test, gồm unit + CLI). Phải xanh trước khi kết thúc việc.
- Bằng chứng: `npm run proof` chạy `tests/scenarios/*.json` qua headless, ghi `docs/proof/<phase>/`
- Contract: sửa số trong `src/core/config.js` rồi `npm run contract` (sinh lại `game.contract.json`)
- Headless: `node src/headless/cli.js --seed 1 --night 1 --ticks 600 --out out.jsonl`

## Kiến trúc
- `src/core/`: luật chơi thuần, tất định. Không DOM, không I/O, không `Math.random`/`Date.now` (có test chặn).
- `src/headless/`: CLI + kiểm tra định dạng (sai định dạng -> mã thoát 2).
- `web/`: chỉ hiển thị + đọc phím, gọi `Game.step()` 60 lần/giây. Không đặt luật chơi ở đây.

## Quy tắc
- Yêu cầu gốc: tab của phase trên lab board; giả định ghi ở `docs/notes/phase-N-assumptions.md`. Không bịa yêu cầu.
  Chỗ mơ hồ: thêm giả định vào file đó trước khi code.
- Mọi con số gameplay chỉ nằm trong `src/core/config.js`. `tuning` trong contract phải khớp số đang dùng.
- Tính năng mới: viết test/scenario trước, rồi code. Không viết test luôn đạt, không sửa tay output trong `docs/proof`.
- Sáng tạo thêm chỉ ở `web/` (hiển thị) để không đổi output headless.
- Đổi luật cũ theo ticket mới: sửa/bỏ test cũ kèm lý do trong `docs/notes/`.
- Review thay đổi bằng subagent `reviewer` (`.claude/agents/reviewer.md`), không tự chấm việc mình viết.
