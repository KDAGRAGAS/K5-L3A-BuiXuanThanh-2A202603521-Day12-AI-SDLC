# Truy vết nghiệm thu Phase 2 — Ticket-02

Yêu cầu nguồn: Ticket-02 “Ba hòn đảo”, Contract v1.1. Giả định triển khai được ghi tại [`docs/notes/phase-2-assumptions.md`](../../notes/phase-2-assumptions.md). Kết quả scenario và hash do [`npm run proof`](RESULTS.md) sinh, không chỉnh sửa thủ công.

## Truy vết yêu cầu

| Mục | Tiêu chí nghiệm thu | Kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| S1 | Tuning v1.1; chạy 6 m/s, tăng tốc, nhảy, dash, nhặt và nạp đúng giới hạn | `tests/phase2.test.js`, `tests/core.test.js`; contract sinh từ config | `src/core/config.js`, scenario `01`, `03`, `11` | Đạt |
| S2 | Đảo Bến, 20 mote, sinh lại tại tick 240, lịch sinh Bóng Mực, hit/recoil/drop/safe zone và kết thúc đêm | test hồi quy Phase 1 cập nhật theo ticket; scenario `06`–`10`, `21` | `runs/06`–`10`, `runs/21` | Đạt |
| S3 | Pulse đúng phí, bán kính 3D, choáng, đẩy lùi và hồi chiêu; pulse Gió Lạc theo trạng thái | unit test; scenario `05`, `19` | `runs/05`, `runs/19` | Đạt |
| S4 | Đảo Cau có hai đảo, cầu, bục phóng, sáu đèn, mote, Bóng Mực và Bùa Gió | unit test; scenario `12`, `14` | `runs/12`, `runs/14`, ảnh Đêm 2 bên dưới | Đạt |
| S5 | Đảo Chuông có ba tầng, dốc, bục phóng, bảy đèn và gió theo chu kỳ | unit test; scenario `17`, `18` | `runs/17`, `runs/18`, ảnh Đêm 3 bên dưới | Đạt |
| S6 | Gió Lạc sinh ở tick 1200/2400, giới hạn hai con, idle/chase/flee/removed, cướp một lần, phản ứng với pulse | unit test; scenario `13`, `19`, `22` | `runs/13`, `runs/19`, `runs/22` | Đạt |
| S7 | Bùa tăng tốc, bỏ hồi dash, tồn tại 600 tick và hồi sinh đúng lịch | unit test; scenario `14` | `runs/14` | Đạt |
| S8 | Rơi mất lửa và toàn bộ mote, chờ rồi hồi sinh đúng điểm, bỏ qua bất tử | unit test; scenario `16` | `runs/16` | Đạt |
| S9 | Pause tăng tick ngoài nhưng dừng simulation/counter; resume theo cạnh lên | unit test; scenario `15`; giao diện pause được thao tác qua trình duyệt | `runs/15`, ảnh pause | Đạt |
| S10 | Contract 1.1, snapshot mới, state name chuẩn, CLI nhận đêm 1–3 | test validator/CLI, determinism, scenario `20` | `game.contract.json`, `runs/20` | Đạt |
| S11 | Menu → giới thiệu → chơi → kết quả → đêm sau; thua chơi lại; đêm 3 hiện tổng | Browser UI smoke flow ở 1280×720; test giao diện lái các nút thật, ép kết quả thắng/thua chỉ để kiểm tra panel và điều hướng | Ảnh menu, intro 1–3, kết quả thắng/thua và bình minh | Đạt; điểm thắng trong ảnh flow là dữ liệu kiểm tra giao diện, luật tính điểm được kiểm chứng headless |
| S12 | HUD, pause, cài đặt lưu âm lượng/độ nhạy, bảng màu, cảnh báo gió có lá bay và âm thanh | ảnh giao diện; cài âm lượng 42%/nhạy 95%, tải lại và đọc lại giá trị trong profile trình duyệt kiểm tra | Ảnh game, pause, settings, settings-saved và cue gió | Đạt cho hiển thị/điều hướng/lưu; âm thanh được nối vào các event, chưa có phép đo âm học |
| S13 | Headless đủ 21.600 tick < 30 s; web ≥ 30 FPS tại 1280×720 | `RESULTS.md` ghi thời gian/tính tất định từng đêm; Chrome đo FPS hiển thị sau khi chạy game | `RESULTS.md`; ảnh `game-1280x720.png` ghi FPS TB 60 | Đạt trên máy kiểm chứng ghi trong bằng chứng |
| S14 | Acceptance criteria; agent guide/skill cập nhật; scenario cho tính năng mới | kiểm tra `AGENTS.md`, skill `verify-game`, bộ scenario; reviewer độc lập trước tag | file trong repo và commit Phase 2 ghi lịch sử | Đạt; reviewer đã duyệt |

## Ảnh giao diện

Ảnh chụp ở viewport 1280×720. Chrome báo WebGL renderer Intel Iris Xe Graphics (Direct3D 11). Mức FPS TB trên HUD là trung bình của 120 mẫu frame gần nhất.

- [Menu](screens/menu-1280x720.png)
- [Intro Đêm 1](screens/intro-night1-1280x720.png), [intro Đêm 2](screens/intro-night2-1280x720.png), [intro Đêm 3](screens/intro-night3-1280x720.png)
- [Đêm 1 — HUD và FPS](screens/game-1280x720.png), [Đêm 2](screens/night2-1280x720.png), [Đêm 3](screens/night3-1280x720.png)
- [Pause](screens/pause-1280x720.png), [cài đặt](screens/settings-1280x720.png), [cài đặt sau khi tải lại](screens/settings-saved-1280x720.png)
- [Lá bay báo gió](screens/wind-warning-1280x720.png), [camera sau thao tác kéo 100 px ở độ nhạy mặc định](screens/camera-sensitivity-1280x720.png)
- [Kết quả Đêm 1](screens/result-night1-1280x720.png), [thua và chơi lại](screens/result-loss-1280x720.png), [Bình minh sau ba đêm](screens/result-sunrise-1280x720.png)

## Phạm vi bằng chứng

- `RESULTS.md` chạy từng scenario hai lần, so hash SHA-256 và chạy đủ thời lượng ba đêm. Kết quả lần cuối: **22/22 scenario**, tất định; thời gian cụ thể được lưu trong file sinh tự động và đều thấp hơn giới hạn 30 giây.
- Browser smoke flow xác nhận menu mở intro Đêm 1; nút vào đêm mở HUD; kết quả thắng mở intro Đêm 2 rồi Đêm 3; thắng Đêm 3 hiện tổng 3.000 trong lượt UI kiểm tra; thua chỉ có nút chơi lại và về menu; nút chơi lại mở lại đúng Đêm 1. Kết quả thắng/thua được ép bằng hook kiểm tra tạm trong lần chụp và hook đã gỡ trước review; luật thắng/thua được xác minh riêng bằng headless.
- Bàn phím được kiểm tra trực tiếp: Esc mở pause; mở cài đặt rồi Esc quay lại pause và vẫn giữ trạng thái dừng. Ở độ nhạy mặc định 60%, 100 px kéo chuột tương đương khoảng 11,5° camera; các ảnh kiểm tra đã ghi lại.
- Đo FPS trên GPU Iris Xe tại viewport thật 1280×720: **FPS TB 60**, vượt ngưỡng 30 FPS trong lần đo này. Hiệu năng có thể đổi theo máy và trình duyệt.
