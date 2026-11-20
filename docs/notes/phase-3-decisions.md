# Phase 3 — quyết định thiết kế theo Ticket-03

Ticket-03 thay mô hình “đèn sáng là hoàn tất” bằng nhiên liệu có hạn. Mỗi đèn giữ `fuelTicks` nguyên theo 1/60 đơn vị, `everLit` và `relitCount`; nạp đèn đang sáng dùng đom đóm để tăng nhiên liệu. Khi hết dầu, đèn tắt nhưng vẫn nhớ đã từng sáng để lần thắp lại chỉ cần 5 đom đóm.

Đêm không thắng khi thắp đủ đèn. Ở tick bình minh, Mây phải còn sống và tối thiểu `ceil(0.6 × tổng đèn)` đang sáng; hết lửa luôn thua trước kiểm tra bình minh. Điểm được tính theo lượng nạp, lần thắp mới/thắp lại, choáng Bóng Mực và trạng thái đèn/lửa tại bình minh như cấu hình v1.2.

Các scenario cũ được cập nhật đúng phần Ticket-03 thay thế: pickup không còn cộng điểm; nạp đủ lần đầu cộng 5 điểm mỗi mote và 100 điểm thắp; thắp hết đèn không còn thắng sớm; event `lantern_lit` ghi `relight`; event `game_over` ghi điểm. Scenario luật thắng cũ được chuyển thành kiểm tra không thắng sớm. Các test điều khiển/pause/dash/rơi/gió giữ tiêu chí Ticket-02 và được sửa trong core nếu sai.
