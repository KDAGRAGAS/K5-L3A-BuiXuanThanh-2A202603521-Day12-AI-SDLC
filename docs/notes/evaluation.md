# Đánh giá từng phase

## Phase 1

- **Đạt:** R1–R9 và C1–C6 có test hoặc scenario đạt (xem `docs/proof/phase-1/README.md`).
- **Chưa có bằng chứng đầy đủ:**
  - C7 chưa có kết quả CI trên macOS/Linux, vì CI chỉ chạy sau khi push.
  - Thắng bằng tay trên bản web chưa có ảnh. Phần logic thắng đã có scenario `04`.
- **Rủi ro với test ẩn:** test ẩn dựng tình huống từ số trong `tuning`, nên hành vi ngoài contract có thể làm lệch kết quả:
  - Bóng Mực bị bật lùi sau khi chạm.
  - Sinh thêm Bóng Mực mỗi 30 s khi `random_shades` không tắt.
  - Thứ tự xử lý trong một bước: di chuyển → nhặt → nạp → tỏa sáng → Bóng Mực di chuyển → va chạm → sinh thêm → thời gian → kết thúc.
- **Harness cần chỉnh:** chưa có. Theo dõi xem agent có đặt luật chơi vào `web/` không; nếu có thì thêm test chặn.

## Phase 2 — Ticket-02

- **Đạt:** chuẩn hóa tuning và Contract v1.1; hỗ trợ 3 đêm; 40/40 test xanh; 22/22 scenario headless đạt và tất định. Thời gian ba lượt đầy đủ nằm trong `docs/proof/phase-2/RESULTS.md`.
- **Đạt trong kiểm tra web:** đã đi qua intro → chơi → kết quả → đêm tiếp theo, kiểm tra thua/chơi lại và tổng điểm đêm 3 bằng browser smoke flow; cài âm lượng/độ nhạy được lưu sau khi tải lại. Ảnh và phép đo FPS nằm trong `docs/proof/phase-2/screens/`.
- **Hiệu năng đo được:** 60 FPS TB tại 1280×720 trên Intel Iris Xe Graphics; kết quả tùy thiết bị. Headless tối đa 21.600 tick dưới một giây.
- **Review độc lập:** reviewer phát hiện thiếu lá bay, tỷ lệ độ nhạy quá cao và thiếu scenario lịch mote/Gió Lạc; các điểm này đã được sửa, bổ sung bằng chứng và reviewer xác nhận không còn vấn đề chức năng.
- **Giới hạn bằng chứng:** âm thanh đã được nối vào event game và cài đặt âm lượng, nhưng chưa có đo kiểm âm học. Chưa có kết quả CI hệ điều hành khác vì chưa push.
- **Rủi ro còn lại:** mô phỏng địa hình chỉ dùng các mặt đảo/dốc/bục được mô tả trong ticket; vật trang trí không cản đường. Các lựa chọn chưa chốt được ghi trong `docs/notes/phase-2-assumptions.md`.

## Phase 4 — Ticket-04 (đang thực hiện)

- Đã triển khai Contract v1.3, benchmark, soak, leaderboard cục bộ và tùy chọn accessibility. Yêu cầu và kết quả chi tiết nằm tại [`phase-4-assumptions.md`](phase-4-assumptions.md).
- `npm test`: 50/50 đạt. `PHASE=phase-4 npm run proof`: 22/22 scenario đạt; các thay đổi scenario do Ticket-03 thay luật có ghi tại [`phase-3-decisions.md`](phase-3-decisions.md).
- Benchmark 30 giây: 385.5 FPS TB, P1 114.3 FPS, p95 5.4 ms, tải 986 ms, vsync tắt; `peak_mem_mb: null` vì Chrome không cấp RSS cho trang.
- Soak 10 đêm theo lệnh contract: 0 crash, RSS 43.1 → 45.1 MiB (tăng khoảng 4.6%), đạt ngưỡng tăng tối đa 20%; năm lượt lặp cùng cấu hình đều dưới 5%.
- Clone sạch từ commit chạy `npm install`, `npm test` (50/50), và server trả HTTP 200 cùng API leaderboard hợp lệ. Video có trong `docs/demo/` và README đã liên kết; thời lượng dưới 5 phút nhưng chưa xác nhận trong video có đủ test/headless/benchmark. Review độc lập không còn lỗi code. Còn thiếu ảnh UI đúng 1280×720 và tag/release.
