# Phase 1 (PRD-0): yêu cầu, tiêu chí nghiệm thu, giả định

Nguồn: tab Phase 1 trên lab board (PRD-0 + Test Contract v1.0), đọc ngày 2026-11-20.

## Tiêu chí nghiệm thu (mỗi dòng kiểm chứng được)

| # | Yêu cầu PRD-0 / Contract | Tiêu chí nghiệm thu |
|---|---|---|
| R1 | Một màn Đêm 1 – Đảo Bến, đảo tròn, 5 Đèn Lồng Lớn | Snapshot tick 0 có đúng 5 đèn `L1..L5`, chưa thắp |
| R2 | Đi lại, nhảy, camera 3D | `move [0,1]`, yaw 0, 120 tick -> `player.pos = [0,0,12]`; yaw 90 -> đi theo +X; nhảy làm Y > 0 rồi về 0; bản web có camera góc nhìn thứ ba xoay được |
| R3 | Đom đóm rải rác, nhặt được | Mặc định 40 đom đóm theo seed; đi tới trong `pickup_radius` -> `mote_picked`, `carried` +1 |
| R4 | Nạp ánh sáng vào đèn để thắp | `interact` gần đèn -> `deposit`; đủ `lantern_cost` -> `lantern_lit` |
| R5 | Bóng Mực xuất hiện và đuổi | 2 Bóng Mực ban đầu, thêm 1 con mỗi 30 s (`shade_spawned`), luôn đi về phía Mây |
| R6 | Bị chạm thì mất máu | Trong `shade_hit_radius` -> `player_hit`, `flames` -1, rơi đom đóm theo `hit_drop_ratio` |
| R7 | Tỏa sáng để xua Bóng Mực; Bóng Mực sợ đèn | `pulse` -> Bóng Mực trong `pulse_radius` chuyển `stunned`, bị đẩy lùi; không vào `safe_radius` quanh đèn đã thắp |
| R8 | Thắp hết đèn thì thắng, mất hết máu thì thua, có điểm | `game_over` `won/all_lit`, `lost/no_flames`, `lost/dawn`; điểm theo bảng `score` |
| R9 | HUD, chơi lại | HUD hiện lửa, đom đóm, số đèn, thời gian, điểm, hồi chiêu; R để chơi lại |
| C1 | `game.contract.json` ở gốc repo, tuning đúng số đang dùng | Test so `game.contract.json` với `src/core/config.js` |
| C2 | Tham số headless, 60 tick/s, không cửa sổ, mã thoát | Test CLI: exit 0; sai định dạng -> exit 2 + stderr; thiếu tham số -> exit ≠ 0 |
| C3 | Mô hình tick | Snapshot tick 0 trước input; sự kiện bước k ghi tick k+1; `--ticks N` đúng N bước; `time_left_s` = thời lượng − bước/60 |
| C4 | Inputs/scenario đúng quy ước | Giá trị giữ nguyên khi vắng mặt; nút theo cạnh lên; dựng scenario không phát sự kiện, không cộng điểm |
| C5 | Output JSONL | 3 loại dòng, `end` cuối cùng, tọa độ 3 chữ số thập phân, `sim_tick = tick` |
| C6 | Tính tất định | Cùng seed + scenario + inputs -> file output giống hệt (so sha256) |
| C7 | Chạy trên macOS/Linux | Node thuần, không dependency; CI chạy ubuntu + macos |

## Giả định cho chỗ PRD-0 để mơ hồ

| Chỗ mơ hồ | Giả định của mình | Lý do |
|---|---|---|
| Con số gameplay | Xem `tuning` trong `game.contract.json` (tốc độ 6 m/s, mang tối đa 10, 5 đom đóm/đèn, 3 lửa, đêm 300 s...) | Đủ chặt để phải né, đủ rộng để thắng trong 5 phút |
| "Tỏa sáng tốn ánh sáng" | Tốn `pulse_cost = 1` đom đóm **đang mang**; không đủ thì không tỏa | Ánh sáng = đom đóm; tạo lựa chọn giữa thắp đèn và tự vệ |
| Nạp đèn | Mỗi lần `interact` nạp `min(carried, cost − deposited)` vào đèn chưa thắp gần nhất trong `interact_radius`; có thể nạp nhiều lần | Không phí đom đóm thừa |
| `safe_radius` | Chỉ quanh đèn **đã thắp** | "Bóng Mực sợ những chiếc đèn" (đèn sáng); đèn tắt chưa có ánh sáng |
| Bị chạm | Mất 1 lửa, rơi `floor(carried × 0.5)` đom đóm (mất hẳn), bất tử 2 s, Bóng Mực bị bật lùi 5 m (không choáng) | Tránh bị chạm liên tục khi Bóng Mực dính vào người |
| Bóng Mực | 2 con lúc đầu ở bán kính 36 m, thêm 1 con mỗi 30 s, tối đa 5; luôn đuổi (`chase`), choáng (`stunned`) 3 s khi trúng tỏa sáng; tâm ở Y = 1 | Hành vi đơn giản, dễ dự đoán cho test |
| Bản đồ | Đảo bán kính 40 m; 5 đèn trên vòng 25 m, L1 tại (0,0,25), các đèn sau cách 72°; 40 đom đóm rải ngẫu nhiên theo seed trong vành 4–37 m; còn dưới 15 con thì sinh thêm 1 con mỗi 10 s | L1 khớp ví dụ trong contract |
| Rơi khỏi đảo | Không rơi (`fall_enabled = false`): mép đảo là tường vô hình | Phase 1 chưa yêu cầu |
| Nhảy | Vận tốc 6 m/s, trọng lực 20 m/s², không ảnh hưởng nhặt/va chạm (khoảng cách đo trên XZ) | Contract đo khoảng cách theo XZ |
| Điểm | +10/đom đóm nhặt, +100/đèn thắp, +5/Bóng Mực bị choáng; khi thắng cộng `floor(time_left_s) × 2` + `flames × 50`; thua giữ điểm đã có | Thưởng thắng nhanh và ít bị chạm |
| Thứ tự kết thúc | Cuối mỗi bước: thắng (đủ 5 đèn) > hết lửa > bình minh | Thắp đèn cuối cùng cùng tick bị chạm vẫn tính thắng |
| `dash` | Không có | Không bắt buộc |
| `--night` khác 1 | Báo lỗi, mã thoát 1 | Phase 1 chỉ có Đêm 1 |
| Thiếu file / thiếu tham số | Mã thoát 1; sai định dạng JSON/trường -> mã thoát 2 | Theo contract |
| Windows | Game chạy bằng Node trên macOS/Linux/Windows, không cần Docker | PRD yêu cầu có cách chạy trên macOS/Linux |
