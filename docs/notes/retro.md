# Retro tổng kết bốn phase

Trạng thái: bản nháp tổng kết. Phase 4 đã qua review code nhưng chưa phát hành; còn thiếu bộ ảnh UI đầy đủ theo ticket. Người dùng đang tự chụp ảnh giao diện; không tạo ảnh thay thế.

## Điều hiệu quả

- Tách luật thuần vào `src/core` giúp web và headless dùng chung hành vi, còn output headless được kiểm tra tất định.
- Đặt tuning trong cấu hình và sinh contract bằng script tránh cập nhật hai bản số riêng.
- Scenario có kỳ vọng sự kiện/tick làm lỗi lệch một bước dễ phát hiện. Ở Phase 2, các lỗi về tick nhặt mote và độ nhạy bị test/ảnh phát hiện trước khi chốt.
- Ghi giả định Phase 2 và Phase 4 trước khi triển khai làm rõ lựa chọn nào xuất phát từ ticket, lựa chọn nào là diễn giải.
- Harness `AGENTS.md`, skill `verify-game` và checklist proof nhắc chạy hồi quy, tạo bằng chứng thật và ghi rõ phần chưa đo được.
- Lượt kiểm chứng gần nhất: `npm test` 50/50; benchmark 385.5 FPS TB, P1 114.3, tải 986 ms; proof headless 22/22. Soak 0 crash, RSS tăng 4.6%, dưới ngưỡng 20%. Artifact JSON nằm trong `docs/proof/phase-4/`.

## Điều chưa hiệu quả và lỗi AI

- Test đầu tiên cho Phase 4 bắt được contract JSON còn ở v1.2 và fixture leaderboard thiếu trường bắt buộc; sửa từ lỗi thực thay vì nới tiêu chí. Event `night_start` mới làm thay đổi danh sách event cũ; assertion hồi quy giờ lọc event mới, còn test riêng vẫn kiểm tra `night_start`.
- Khi tiếp tục từ working tree đang có thay đổi Phase 3, giao diện web còn tham chiếu cấu trúc bản đồ cũ (`WORLD.nightN`) dù core đã chuyển sang `MAPS`. Browser benchmark bắt lỗi ở `makeWorld`; đã chuyển phần dựng cảnh sang cấu trúc map hiện hành.
- Bản benchmark đầu tiên dùng thời gian frame đã clamp cho gameplay, khiến số FPS sai; đối chiếu định nghĩa Ticket-04 đã tách raw frame interval khỏi delta giới hạn của simulation.
- Lượt Phase 1 dùng nhiều ảnh chụp lab board và ghi ước tính lớn; Phase 2 chưa ghi được ước tính token. Cần ghi số liệu gần lúc làm thay vì suy ra sau.

## AI, token và chi phí

- Công cụ và quy trình ghi trong [`ai-log.md`](ai-log.md). Phase 1 ước tính khoảng 250k token đầu vào, 40k đầu ra theo nhật ký cũ.
- Phase 2 chưa có ước tính; Phase 3 và Phase 4 chưa có số thực/ước tính đáng tin cậy. Không tự suy ra tổng token hay chi phí.
- Cách tiết kiệm: dán ticket dạng text; đọc đúng file/phần liên quan; dùng một test cụ thể để tái hiện; không chụp lại UI nếu DOM/ảnh cũ đã trả lời được câu hỏi; chỉ chạy proof sau khi test nhỏ đã xanh.

## Nếu làm lại

1. Đọc cấu trúc `src/core/maps.js` và chạy một smoke test web ngay sau khi thay API map, trước khi phát triển thêm UI.
2. Tạo danh sách yêu cầu–test–bằng chứng ngay đầu mỗi phase, gồm cả lệnh release và thao tác thủ công.
3. Giữ dữ liệu đo tự sinh tách khỏi ví dụ schema; ghi máy, renderer, thời lượng, flags và giới hạn đo cùng lúc tạo output.
4. Ghi token và thời gian cho từng phase khi kết thúc, không chờ tới retro.

## Việc còn lại trước khi gọi là hoàn tất

- Benchmark 30 giây đã đạt ngưỡng FPS/tải tại máy này. Soak ban đầu vượt RSS 20% do bộ nhớ mã JIT và semi-space dao động; sau khi chốt chế độ soak không tối ưu hóa TurboFan và semi-space 1 MiB, năm lượt lặp đều tăng dưới 5%, không crash.
- Kiểm tra leaderboard qua trình duyệt, restart server, xếp hạng/top 10 và lệnh export.
- Chụp ảnh Phase 4 cho cài đặt phím, chữ lớn/giảm chuyển động, cue nhiên liệu, cue Bóng Mực, leaderboard và màn hình lưu điểm.
- Đã giảm mức tăng RSS soak bằng cấu hình đo trong contract; clone sạch cài đặt, test và khởi động server/API thành công. Còn hoàn thiện ảnh UI trước tag/release.
