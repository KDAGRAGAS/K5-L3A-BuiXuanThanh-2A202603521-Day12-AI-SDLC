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

## phase-3
- Áp dụng Ticket-03: hệ thống nhiên liệu đèn, Bóng Mực hút nhiên liệu, thay đổi điều kiện bình minh/thắng và chấm điểm.
- Nâng cấu hình và snapshot lên Contract v1.2; giữ tương thích headless cũ.
- Breaking changes theo Ticket-03: đèn đã sáng có thể cạn/tắt; châm dầu được; thắp lại cần 5 mote; hết đèn sáng không kết thúc sớm; thắng chỉ được xét ở bình minh với ít nhất 60% đèn sáng; công thức điểm cũ bị thay.
- Quyết định thiết kế và các scenario hồi quy được cập nhật: [`docs/notes/phase-3-decisions.md`](docs/notes/phase-3-decisions.md).

## phase-4 (ứng viên v1.0.0)
- Nâng contract lên v1.3; bổ sung benchmark WebGL và soak 10 đêm, bảng xếp hạng cục bộ có hỗ trợ dấu tiếng Việt, cùng tùy chọn hỗ trợ tiếp cận.
- Đưa toàn bộ hình học ba bản đồ về `src/core/config.js`; khôi phục hành vi Ticket-02 bị lệch trong core; ghi lý do cập nhật fixture do Ticket-03 thay luật.
- Benchmark 30 giây đạt ngưỡng tại máy phát triển; soak 10 đêm không crash và RSS tăng 4.6% theo lệnh contract. Unit/CLI hiện có 50 test và proof 22/22 đạt.
- Clone sạch đã cài, chạy đủ 50 test và smoke server/API thành công.
- Có demo MP4 và artifacts đo trong `docs/proof/phase-4/`; review độc lập không còn lỗi code. Còn chờ bộ ảnh UI đúng 1280×720 và xác nhận nội dung video trước khi tạo tag `phase-4`/GitHub Release `v1.0.0`.
