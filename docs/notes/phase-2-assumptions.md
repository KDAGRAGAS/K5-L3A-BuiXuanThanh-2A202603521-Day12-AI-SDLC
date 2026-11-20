# Phase 2 (Ticket-02): tiêu chí nghiệm thu, kiểm chứng và giả định

Nguồn: nội dung Ticket-02 do người dùng cung cấp, đọc ngày 2026-11-20. Ticket làm rõ hoặc thay các số Phase 1; các scenario Phase 1 được giữ để kiểm tra hồi quy sau khi cập nhật kỳ vọng theo v1.1.

## Tiêu chí nghiệm thu

| # | Yêu cầu | Tiêu chí nghiệm thu | Bằng chứng |
|---|---|---|---|
| S1 | Chuẩn hóa tốc độ, nhảy, quán tính, lướt, nhặt và nạp | Tuning khớp bảng ticket; di chuyển đạt 6 m/s; lướt 14 m/s trong 12 tick, cooldown 90 tick; nhặt có giới hạn XZ và chênh cao; nạp tối đa phần còn thiếu | unit + scenario dash, pickup, lantern |
| S2 | Đêm 1 chuẩn hóa | Đảo bán kính 40; 20 đom đóm ở điểm riêng; sinh lại đúng tick 240; spawn Bóng Mực tick 300; damage, recoil, dropped TTL và safe zone theo ticket | unit + scenario phase 1 đã cập nhật + `21-dom-dom-sinh-lai` |
| S3 | Pulse chuẩn hóa | Tốn 3; mục tiêu khóa theo khoảng cách 3D từ chân +0.8; stun 120 tick; đẩy 4 m trong 15 tick; cooldown 180 tick; không chết | scenario pulse |
| S4 | Đêm 2 — Đảo Cau | Hai đảo, cầu hẹp không lan can, hai bục phóng; 6 đèn; motes/enemy ở hai đảo; tốc độ Bóng Mực 4 m/s, spawn mỗi 420 tick, tối đa 8 | scenario night2 |
| S5 | Đêm 3 — Đảo Chuông | Bản đồ ba tầng, dốc, bục tới tầng 2, tháp cản đường; 7 đèn; 30 điểm mote; gió chu kỳ; Bóng Mực 4.5 m/s, spawn mỗi 360 tick, tối đa 10 | scenario night3 + wind |
| S6 | Gió Lạc | Chỉ Đêm 2–3; spawn tick 1200, 2400…; kiểm tra cap 2 ở tick 3600; idle/chase/flee; cướp tối đa 3 một lần; pulse chase/flee theo ticket | scenario spawn/cap, steal và pulse |
| S7 | Bùa Gió | Vị trí theo đêm; nhặt làm mới 600 tick; tốc độ 7.2; dash không hồi chiêu; hồi sinh bùa sau 2700 tick | scenario charm |
| S8 | Rơi khỏi đảo | Y < -10 trừ lửa và toàn bộ đom đóm đúng một lần; không nhặt/chạm 60 tick; hồi sinh gốc với vận tốc 0, bất tử 90 tick; hết lửa xử thua luôn | scenario fall |
| S9 | Pause | Cạnh lên pause đổi trạng thái; tick tăng nhưng sim_tick, đồng hồ, cooldown, spawn, TTL đứng yên; snapshot paused; resume phát sự kiện | scenario pause |
| S10 | Contract v1.1 | `--night` nhận 1–3; snapshot có trường/mảng bắt buộc; scenario validator bao phủ trường mới; state Bóng Mực dùng đúng tên | unit + CLI |
| S11 | Chuỗi ba đêm | Menu → intro từng đảo → chơi → kết quả; thắng nối đêm, thua chơi lại đêm; thắng Đêm 3 hiển thị tổng điểm các đêm thắng | kiểm tra UI thủ công/ảnh |
| S12 | HUD, cài đặt, âm thanh, giao diện | HUD đủ lửa/đồng hồ/đèn/điểm/10 ô/cooldown/prompt/marker; pause và settings lưu âm lượng/độ nhạy; hiệu ứng âm thanh theo danh sách ticket; mức sáng môi trường theo tỉ lệ đèn | kiểm tra UI thủ công/ảnh |
| S13 | Hiệu năng headless và web | Chạy đủ tối đa 21.600 tick dưới 30 giây; game web trung bình ít nhất 30 FPS ở 1280×720 | proof + phép đo web |
| S14 | Harness và tài liệu | Có acceptance criteria cho Phần 3; hướng dẫn agent và skill cập nhật, có trong lịch sử git; mỗi tính năng mới có scenario | git diff/log + bộ scenario |

## Giả định cần dùng khi ticket không chốt chi tiết

| Chỗ chưa chốt | Giả định triển khai | Tác động |
|---|---|---|
| Gia tốc/dừng trong tối đa 0.1 s | Tốc độ ngang tiến tới vận tốc mục tiêu với gia tốc 60 m/s²; điều khiển đầy đủ trên không | Đạt 6 m/s hoặc dừng trong tối đa 6 tick |
| Quy ước góc trên XZ | `x = r cos(theta)`, `z = r sin(theta)` cho góc độ đo từ +X | Dùng chung để sinh điểm theo góc và hướng gió |
| 20 mote đầu Đêm 1 trong 24 vị trí chuẩn | Xáo trộn thứ tự 24 vị trí bằng PRNG có seed rồi lấy 20 vị trí đầu; mỗi lần tái sinh chọn điểm trống | Tái lập theo seed và không trùng vị trí |
| Trần Bóng Mực Đêm 1 không được nhắc lại | Giữ trần 6 như thiết lập gần nhất của project, khai báo trong config | Chỉ giới hạn Đêm 1; Đêm 2/3 dùng trần ticket |
| State `spawning` không nêu thời lượng | Dùng state trong tick spawn và chuyển `wander` từ tick mô phỏng kế tiếp | Thực thể mới không di chuyển/va chạm ở tick spawn |
| Mote rơi chiếm chỗ trong trần 30 | Trần 30 áp dụng tổng mote đang tồn tại, gồm cả mote rơi; TTL 480 tick | Drop có thể làm lượt sinh định kỳ bị bỏ qua |
| TTL/cooldown tính ở bước pause | Bộ đếm chỉ giảm trong simulation tick; lúc pause không giảm | Khớp yêu cầu pause dừng TTL/cooldown |
| Gió cộng vào chuyển động | Gió cộng vectơ vận tốc 2 m/s vào vận tốc điều khiển khi đang hoạt động; hướng được chọn trước lúc báo 2 giây | Có thể tăng tốc theo trục gió; tất định theo seed |
| Vật cản ngoài địa hình mô tả | Chỉ tháp chuông là vật cản vật lý trong core; đá/cỏ trang trí không cản luật | Có thể kiểm chứng pulse dừng ở tháp và đường đi quanh nó |
| Đêm 2 spawn Bóng Mực | Con đầu tiên xuất hiện sau 7 giây; các lượt sau cách nhau 7 giây | Mốc đầu ở tick 420 |
| Điểm sương của Gió Lạc chưa có tọa độ | Dùng tập điểm sinh đom đóm của bản đồ đêm hiện tại làm điểm sương; chọn bằng PRNG có seed để giữ tính tất định | Gió Lạc có thể xuất hiện tại các vị trí mote hợp lệ; spawn được kiểm tra ở tick 1200/2400 |
| Góc nhìn/điều khiển trên web | Giữ camera chuột hiện tại; thêm WASD, Space, Shift, Q, E, Esc/P và các nút menu | Bố cục HUD thích ứng theo viewport |

## Quy tắc hồi quy Phase 1

- Cập nhật test cũ theo số và luật mới (ví dụ chi phí đèn 10, tỏa sáng 3, Bóng Mực 4 m/s, bất tử 90 tick).
- Không giữ các giả định Phase 1 trái Ticket-02: thời lượng 300 s vẫn giữ cho Đêm 1; chế độ mép đảo là tường được thay bằng rơi.
- Các khái niệm còn hiệu lực giữ nguyên: seed tất định, event tick k+1, snapshot tick 0, cạnh lên input, scenario dựng sẵn không phát sự kiện/không tính điểm, thắng ưu tiên dawn nhưng không ưu tiên hết lửa.
