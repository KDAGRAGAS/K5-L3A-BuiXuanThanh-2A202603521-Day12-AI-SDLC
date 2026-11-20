# CHANGELOG

## phase-1
- Logic game tất định (`src/core`) dùng chung cho bản web và headless.
- Chế độ headless theo Test Contract v1.0, `game.contract.json` sinh từ `src/core/config.js`.
- Bản chơi 3D trên web: Đêm 1 – Đảo Bến, 5 Đèn Lồng Lớn, đom đóm, Bóng Mực, tỏa sáng, HUD, thắng/thua, chơi lại.
- 25 test (`npm test`), 10 scenario bằng chứng (`npm run proof`), CI, hook Stop, skill verify-game, subagent reviewer.

## phase-2
- Chuẩn hóa luật và contract v1.1; thêm dash, pause, Gió Lạc, Bùa Gió và ba bản đồ/đêm.
- Cập nhật headless CLI/validator, 40 test, 22 scenario xác định và proof đủ thời lượng ba đêm.
- Thêm menu hành trình, intro/kết quả từng đêm, HUD, âm thanh, cài đặt lưu, điều khiển cảm ứng và cảnh báo gió.
- Cập nhật `AGENTS.md`, skill `verify-game`, README, acceptance criteria, nhật ký AI và đánh giá.
