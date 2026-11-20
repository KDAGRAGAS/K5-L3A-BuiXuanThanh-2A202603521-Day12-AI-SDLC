# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Phase 4)_ · Lab Day 12 AI SDLC · Bùi Xuân Thành · 2A202603521
> Tài liệu gốc của lab: [docs/lab/LAB_README.md](docs/lab/LAB_README.md), [GUIDE](GUIDE.md), [RUBRIC](RUBRIC.md), [SUBMISSION](SUBMISSION.md)

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi đội nón lá, chạy khắp Đảo Bến gom đom đóm để thắp lại 5 Đèn Lồng Lớn trước bình minh và né Bóng Mực trong sương đen.

## Cài đặt và chạy (cần Node.js ≥ 18, chạy được trên macOS, Linux, Windows)

```bash
git clone <link-repo> dao-den-long && cd dao-den-long
npm install        # không có dependency, bước này chỉ để đủ build_cmd
npm start          # mở http://localhost:5173
```

## Điều khiển

| Phím | Việc |
|---|---|
| W A S D / ↑ ↓ | Di chuyển (theo hướng camera) |
| Kéo chuột / ← → | Xoay camera |
| Space | Nhảy |
| E | Nạp đom đóm vào Đèn Lồng Lớn ở gần |
| Q | Tỏa sáng: tốn 1 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 6 m |
| R | Chơi lại |

## Luật và cách tính điểm (Đêm 1)

- Đom đóm tự được nhặt khi đi qua (mang tối đa 10). Mỗi đèn cần 5 đom đóm. Thắp đủ 5 đèn thì **thắng**.
- Bóng Mực chạm thì mất 1 lửa (có 3 lửa), rơi một nửa số đom đóm đang mang, rồi được bất tử 2 giây. Hết lửa thì **thua**. Hết 5 phút đêm (bình minh) mà chưa thắp đủ cũng **thua**.
- Bóng Mực không vào được vùng 6 m quanh đèn đã thắp.
- **Điểm:**
  - +10 cho mỗi đom đóm nhặt.
  - +100 cho mỗi đèn thắp.
  - +5 cho mỗi Bóng Mực bị choáng.
  - Khi thắng, cộng thêm 2 điểm cho mỗi giây đêm còn lại và 50 điểm cho mỗi lửa còn lại.

Mọi con số nằm trong [`src/core/config.js`](src/core/config.js) và được khai báo trong [`game.contract.json`](game.contract.json). Giả định cho chỗ PRD-0 để mơ hồ: [docs/notes/phase-1-assumptions.md](docs/notes/phase-1-assumptions.md).

## Test và chế độ headless (Test Contract v1.0)

```bash
npm test                 # 25 test: luật chơi + CLI + tính tất định
npm run proof            # chạy scenario trong tests/scenarios, ghi docs/proof/phase-1/RESULTS.md
node src/headless/cli.js --seed 1 --night 1 --ticks 600 --out out.jsonl \
     [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

- Chạy 60 tick/giây cố định, không cửa sổ, không cần GPU. Một đêm 5 phút chạy trong khoảng 60 ms.
- Mã thoát: 0 khi chạy xong; 2 khi file inputs/scenario sai định dạng; 1 khi thiếu tham số, không đọc được file, hoặc `--night` khác 1.
- `tuning` không có trường nào là `null`: game có đủ mọi khái niệm trong contract. `fall_enabled = false` vì mép đảo là tường vô hình.

## Cấu trúc

```text
src/core/        luật chơi thuần, tất định (dùng chung cho web và headless)
src/headless/    CLI theo Test Contract + kiểm tra định dạng
web/             hiển thị Three.js (web/vendor: three.js r170, MIT)
tests/           unit test, test CLI, tests/scenarios/*.json (scenario bằng chứng)
scripts/         serve, proof, gen-contract, check (hook)
docs/notes/      giả định, nhật ký AI, đánh giá
docs/proof/      bằng chứng từng phase
AGENTS.md, CLAUDE.md, .claude/   harness AI (hook Stop, skill verify-game, subagent reviewer)
```

## Harness AI

- [`AGENTS.md`](AGENTS.md): lệnh build/test, kiến trúc, quy tắc. `CLAUDE.md` trỏ tới file này.
- **Hook Stop** (`.claude/settings.json` → `scripts/check.mjs`): chặn agent kết thúc khi `npm test` đang đỏ.
- **Skill** `.claude/skills/verify-game`: quy trình thêm scenario và sinh bằng chứng. Dùng sau khi sửa luật chơi và trước khi gắn tag.
- **Subagent** `.claude/agents/reviewer.md`: review độc lập, chỉ đọc, đối chiếu với yêu cầu và contract.
- **CI** `.github/workflows/ci.yml`: chạy `npm test` và `npm run proof` trên Ubuntu và macOS mỗi lần push.

## Sáng tạo của tôi

Các phần dưới đây chỉ thay đổi hiển thị trong `web/`, không đổi output headless. Bằng chứng: `npm run proof` vẫn ra cùng sha256.

- Đom đóm Mây đang mang **bay vòng quanh cô bé**, nhìn là biết đang mang bao nhiêu.
- **Đảo sáng dần** theo số đèn đã thắp: nền trời chuyển từ tím đen sang tím ấm, cỏ xanh lên.
- **Vòng sáng** dưới chân mỗi đèn đã thắp, đánh dấu vùng an toàn mà Bóng Mực không vào được.

Ảnh: [docs/proof/phase-1/screens](docs/proof/phase-1/screens).

## Ghi chép

- Bằng chứng: [docs/proof/phase-1/README.md](docs/proof/phase-1/README.md)
- Nhật ký dùng AI và token: [docs/notes/ai-log.md](docs/notes/ai-log.md)
- Đánh giá từng phase: [docs/notes/evaluation.md](docs/notes/evaluation.md)
