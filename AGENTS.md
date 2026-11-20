# AGENTS.md: Đảo Đèn Lồng

Game 3D (Three.js trên web) và chế độ headless theo Test Contract v1.3. Node >= 18, không có dependency npm.

## Lệnh
- Chơi: `npm start` rồi mở http://localhost:5173
- Test: `npm test` (node:test, gồm unit + CLI). Phải xanh trước khi kết thúc việc.
- Bằng chứng: `npm run proof` chạy `tests/scenarios/*.json` qua headless, ghi `docs/proof/<phase>/` (`PHASE=phase-2 npm run proof`; PowerShell: `$env:PHASE='phase-2'; npm run proof`).
- Contract: sửa số trong `src/core/config.js` rồi `npm run contract` (sinh lại `game.contract.json`).
- Headless: `node src/headless/cli.js --seed 1 --night 1 --ticks 600 --out out.jsonl`; `--night` nhận 1, 2 hoặc 3.
- Benchmark: `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json` (cần Chrome/Chromium).
- Soak: `node --no-opt --max-semi-space-size=1 --expose-gc src/headless/soak.js --seed 7 --nights 10 --out soak.json` (tắt TurboFan optimization và giới hạn semi-space để RSS đo được ổn định giữa các lượt; gameplay và input vẫn chạy cùng core).
- Xuất leaderboard: `npm start -- --export-leaderboard out.json`.

## Kiến trúc
- `src/core/`: luật chơi thuần, tất định. Không DOM, không I/O, không `Math.random`/`Date.now` (có test chặn).
- `src/headless/`: CLI + kiểm tra định dạng; sai định dạng trả mã thoát 2.
- `web/`: chỉ hiển thị + đọc phím, gọi `Game.step()` 60 lần/giây. Không đặt luật chơi ở đây.
- Tuning gameplay và hình học ba bản đồ chỉ khai báo tại `src/core/config.js`; `game.contract.json` được sinh từ cấu hình.

## Quy tắc
- Yêu cầu gốc: ticket của phase trên lab board hoặc nội dung người dùng cung cấp; giả định phải ghi ở `docs/notes/phase-N-assumptions.md` trước khi code. Không bịa yêu cầu.
- Tính năng mới: viết test/scenario trước, rồi code. Không viết test luôn đạt, không sửa tay output trong `docs/proof`.
- Sáng tạo thêm chỉ ở `web/` (hiển thị) để không đổi output headless.
- Đổi luật cũ theo ticket mới: sửa/bỏ test cũ kèm lý do trong `docs/notes/`.
- Snapshot contract gồm `night`, `wind`, dữ liệu người chơi, `motes`, `drifters`, `charms`, nhiên liệu; giữ event tick k+1, snapshot tick 0, dòng end cuối và định dạng contract.
- Với phase có giao diện: chụp và kiểm tra ảnh vào `docs/proof/<phase>/screens/`; ghi yêu cầu chưa đo được là chưa đạt, không suy diễn bằng chứng. Với Phase 4, `bench.json`, `soak.json` phải do đúng lệnh tạo; không dùng số minh họa trong ticket.
- Chạy `npm test` và `PHASE=phase-N npm run proof`; với Phase 2 đo đủ ba đêm, tối đa 21.600 tick, dưới 30 giây. Kiểm tra bản web đạt ít nhất 30 FPS trung bình ở 1280×720.
- Review thay đổi bằng subagent `reviewer` (`.claude/agents/reviewer.md`) trước khi gắn tag; không tự chấm việc mình viết.
