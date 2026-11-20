# CHANGELOG

## phase-1
- Logic game tất định (`src/core`) dùng chung cho bản web và headless.
- Chế độ headless theo Test Contract v1.0, `game.contract.json` sinh từ `src/core/config.js`.
- Bản chơi 3D trên web: Đêm 1 – Đảo Bến, 5 Đèn Lồng Lớn, đom đóm, Bóng Mực, tỏa sáng, HUD, thắng/thua, chơi lại.
- 25 test (`npm test`), 10 scenario bằng chứng (`npm run proof`), CI, hook Stop, skill verify-game, subagent reviewer.
