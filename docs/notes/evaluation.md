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
