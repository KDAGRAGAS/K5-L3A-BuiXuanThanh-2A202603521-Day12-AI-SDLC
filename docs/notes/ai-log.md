# Nhật ký dùng AI

Công cụ: Claude (claude.ai, model Claude Opus 5.5) có shell, trình duyệt và quyền đọc/ghi thư mục repo.
Token chỉ là **ước tính** (giao diện không hiện số chính xác): dựa trên độ dài hội thoại, số file đã đọc và số ảnh chụp màn hình.

## Phase 1

| Bước | Việc AI làm | Người kiểm tra |
|---|---|---|
| Đọc yêu cầu | Đọc 6 file tài liệu lab; mở lab board bằng trình duyệt, đọc PRD-0 + Test Contract qua ảnh chụp (nội dung nằm trong khung không trích được chữ) | Đối chiếu tóm tắt với board |
| Giả định | Liệt kê 9 nhóm chỗ mơ hồ, chốt số trong `src/core/config.js` | `docs/notes/phase-1-assumptions.md` |
| Build | Viết `src/core`, CLI headless, bản web Three.js, test, scenario, harness | Đọc diff, chạy test, xem ảnh |
| Verify | `npm test` (25 test), `npm run proof` (10 scenario, tất định), chụp màn hình bằng Chrome headless | `docs/proof/phase-1/` |

**Ước tính token Phase 1:** khoảng 250k token đầu vào (khoảng 60% là ảnh chụp lab board) và 40k token đầu ra.

**Cách tiết kiệm:**
- Bộ test chạy dưới 1 giây, nên AI kiểm chứng ngay mà không phải đoán.
- Mọi con số nằm một chỗ (`config.js`). Contract được sinh tự động, không phải sửa tay hai nơi.
- Ảnh chụp lab board là phần tốn nhiều nhất. Lần sau nên dán thẳng chữ của ticket vào hội thoại, rẻ hơn nhiều so với cuộn trang và chụp ảnh.

## Phase 2

| Bước | Việc AI làm | Người kiểm tra / bằng chứng |
|---|---|---|
| Đọc yêu cầu | Đọc nội dung Ticket-02 người dùng dán; chưa cần truy cập lab board | `docs/notes/phase-2-assumptions.md` |
| Giả định | Ghi rõ các chỗ ticket chưa chốt trước khi sửa luật | Bảng giả định Phase 2 |
| Build | Cập nhật core/config, CLI/validator, scenario, giao diện ba đêm, âm thanh, HUD, pause và cài đặt | `git diff`, `tests/phase2.test.js`, 20 scenario |
| Verify headless | `npm run contract`, `npm test` (40 test), `PHASE=phase-2 npm run proof` (22 scenario, hash ổn định và chạy đủ ba đêm) | `docs/proof/phase-2/RESULTS.md` |
| Verify web | Chrome tại 1280×720; kiểm tra màn menu/intro/play/pause/settings/results, lưu cài đặt và FPS | `docs/proof/phase-2/screens/` và `docs/proof/phase-2/README.md` |
| Review | Chạy subagent `reviewer` hai lượt; lượt đầu phát hiện cần bổ sung cue lá, chỉnh độ nhạy, scenario spawn và giả định điểm sương; đã xử lý rồi reviewer xác nhận không còn vấn đề chức năng | 40/40 test, 22/22 scenario; `docs/proof/phase-2/README.md` |

Không ghi ước tính token Phase 2. Computer-use runtime không khởi tạo được trong lượt này; thay vào đó dùng Chrome headless/CDP cục bộ để chụp ảnh và thao tác smoke flow. Các hook dùng để ép màn hình thắng/thua chỉ tồn tại trong lần chụp và được gỡ trước khi chốt.

### Lỗi của AI và cách phát hiện

| Lỗi | Phát hiện bằng | Sửa harness / quy trình |
|---|---|---|
| Test CLI mong `mote_picked` ở tick 51, đúng ra là 40 (nhặt khi khoảng cách ≤ 1 m, không phải khi chạm tâm) | `npm test` đỏ, tính lại bằng tay theo mô hình tick | Skill `verify-game` nhắc cách tính tick và bán kính |
| Test "không dùng Math.random" bắt nhầm chính dòng comment trong `rng.js` | `npm test` đỏ | Sửa comment; test giữ nguyên để chặn thật |
| Bản web chỉ thấy màu nền: hàm `draw` quên gọi `renderer.render` | Chụp màn hình bằng Chrome headless, ảnh đen | Ghi vào quy trình: mỗi thay đổi `web/` phải có ảnh chụp kiểm tra |
| Thiết kế đầu: Bóng Mực dính vào người sau khi chạm, mất 3 lửa trong khoảng 5 s | Chơi thử tự động (ảnh `2-later.png`), xem log headless | Thêm bật lùi 5 m khi chạm (ghi vào giả định) |
