# Bằng chứng Phase 1: bảng truy vết

Chạy lại tại tag `phase-1`: `npm test` và `npm run proof`. Kết quả scenario ở [RESULTS.md](RESULTS.md) (do script sinh, không sửa tay), output đầy đủ ở `runs/`.

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| R1 Đêm 1, 5 đèn L1..L5 | unit test | `tests/core.test.js` "mặc định: 5 đèn..." | đạt |
| R2 Đi lại, xoay camera | unit test + scenario | `core.test.js` "di chuyển..."; scenario `01`, `02` | đạt |
| R2 Nhảy | unit test | `core.test.js` "nhảy: chỉ kích hoạt ở cạnh lên" | đạt |
| R2 Camera 3D góc nhìn thứ ba | chạy bản web, chụp màn hình | `screens/1-play.png` | đạt |
| R3 Đom đóm, nhặt trong bán kính, giới hạn mang | unit test + scenario | `core.test.js` "nhặt đom đóm..."; scenario `01` | đạt |
| R4 Nạp và thắp đèn | unit test + scenario | `core.test.js` "nạp đèn..."; scenario `03` | đạt |
| R5 Bóng Mực xuất hiện, đuổi | unit test + scenario | `core.test.js` "sinh Bóng Mực mỗi 30 s"; scenario `10`; `runs/full-night-seed-123.jsonl` (đứng yên thì bị đuổi kịp và thua) | đạt |
| R6 Bị chạm mất lửa, rơi đom đóm, bất tử | unit test + scenario | `core.test.js` "bị chạm..."; scenario `06` | đạt |
| R7 Tỏa sáng choáng + đẩy, có hồi chiêu và chi phí | unit test + scenario | `core.test.js` "tỏa sáng..."; scenario `05` | đạt |
| R7 Bóng Mực sợ đèn (safe_radius) | unit test + scenario | `core.test.js` "safe_radius..."; scenario `09` | đạt |
| R8 Thắng all_lit, thua no_flames / dawn, điểm | unit test + scenario | scenario `04`, `07`, `08` | đạt |
| R9 HUD + chơi lại | chạy bản web, chụp màn hình | `screens/1-play.png` (HUD), `screens/2-later.png` (màn thua), `screens/3-restart.png` (bấm R, ván mới đủ 3 lửa) | đạt |
| C1 contract khớp số đang dùng | unit test | `core.test.js` "game.contract.json khớp src/core/config.js" | đạt |
| C2 Tham số CLI, mã thoát 0/2/≠0 | test CLI | `tests/cli.test.js` | đạt |
| C3 Mô hình tick | test CLI + scenario | `cli.test.js` (snapshot tick 0, sự kiện tick 40 khi đi 4 m, `time_left_s` 298 ở tick 120); scenario `08` (dawn đúng tick 120) | đạt |
| C4 Quy ước inputs/scenario | unit test | `core.test.js` (cạnh lên của interact/jump/pulse; scenario không cộng điểm) | đạt |
| C5 Định dạng output | test CLI | `cli.test.js` (3 loại dòng, `end` cuối, `--snapshot-every`) | đạt |
| C6 Tính tất định | test + proof | `cli.test.js` "tính tất định"; `RESULTS.md` (mỗi scenario chạy 2 lần so sha256) | đạt |
| C7 macOS/Linux | CI | `.github/workflows/ci.yml` (ubuntu + macos) | chờ CI chạy sau khi push |
| Chơi được từ đầu tới thắng | chơi tay | thua: `screens/2-later.png`; thắng qua headless scenario `04` | thắng bằng tay: **chưa có bằng chứng ảnh**, cần quay trong video demo |

Ghi chú:
- Ảnh chụp bằng Chrome headless (đồ họa phần mềm) điều khiển tự động: bấm W 2,5 s, bấm Q, chờ 15 s, bấm R.
- Thời gian chạy headless một đêm 5 phút ghi trong `RESULTS.md`.
