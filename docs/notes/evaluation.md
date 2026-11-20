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
