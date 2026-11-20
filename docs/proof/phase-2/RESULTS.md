# Bằng chứng phase-2: scenario headless

File này do `npm run proof` sinh ra, không sửa tay. Mỗi scenario chạy đúng lệnh `headless_cmd` trong `game.contract.json`,
chạy hai lần để so sha256 (tính tất định). Output đầy đủ nằm trong `runs/`.

- Máy: win32 x64, 11th Gen Intel(R) Core(TM) i5-1135G7 @ 2.40GHz, Node v24.11.1
- Kết quả: **22/22 scenario đạt**

| Scenario | Yêu cầu kiểm chứng | Kết quả | sha256 (16 ký tự đầu) |
|---|---|---|---|
| `01-di-chuyen-nhat-dom-dom` | Di chuyển theo move/cam_yaw (60 tick/s, 6 m/s) và nhặt đom đóm trong pickup_radius | đạt | `d24ac17b6b221e8b` |
| `02-xoay-camera` | cam_yaw_deg = 90 biến move [0,1] thành hướng +X | đạt | `3089ab9986796cde` |
| `03-nap-va-thap-den` | Interact (cạnh lên) gần đèn: deposit rồi lantern_lit khi đủ 10 đom đóm | đạt | `43644544b8c9c0da` |
| `04-thang-all-lit` | Thắp đèn cuối cùng -> game_over won/all_lit, cộng thưởng thời gian và lửa | đạt | `6a661945fc22991f` |
| `05-toa-sang-xua-bong-muc` | Pulse tốn 3 đom đóm, khóa Bóng Mực trong 5 m, choáng 120 tick và đẩy lùi tổng 4 m | đạt | `fe479453064275ac` |
| `06-bi-cham-roi-dom-dom` | Bóng Mực chạm: mất 1 lửa, rơi floor(5/2)=2 đom đóm thành mote rơi TTL 480 tick | đạt | `408ee0a63386ac68` |
| `07-thua-het-lua` | Hết lửa -> game_over lost/no_flames | đạt | `9e54e73e61625187` |
| `08-thua-binh-minh` | Hết thời gian đêm -> game_over lost/dawn đúng tick | đạt | `1b06e8f084e6f1df` |
| `09-vung-an-toan` | Bóng Mực không vào safe_radius quanh đèn đã thắp, người chơi đứng trong vùng không bị chạm | đạt | `1d2247e99b0f6c89` |
| `10-mac-dinh-sinh-bong-muc` | Bóng Mực Đêm 1: S1/S2 ở tick 300, thêm một con mỗi 480 tick, id theo thứ tự sinh | đạt | `9ca25282380f58b6` |
| `11-luot-dash` | Lướt 14 m/s trong 0.2 s theo hướng mặt, phát dash và cooldown bắt đầu lúc kích hoạt | đạt | `bfa2852edc3bc6e8` |
| `12-dem-2-buc-phong` | Bục Đêm 2 phóng Mây từ đảo A về phía đảo B và giữ vận tốc tới lúc tiếp đất | đạt | `409752d70f7b8fd3` |
| `13-gio-lac-cuop-dom-dom` | Gió Lạc đang chase chạm Mây thì cướp tối đa 3 đom đóm một lần và chuyển flee | đạt | `1332b2fd9e2d9706` |
| `14-bua-gio` | Nhặt Bùa Gió Đêm 2 thì phát charm_picked, áp dụng 600 tick | đạt | `e5cac736477c318b` |
| `15-tam-dung` | Pause giữ nguyên simulation tick và đồng hồ, ghi snapshot paused, resume theo cạnh lên | đạt | `21b670e762f2c5bc` |
| `16-roi-khoi-dao` | Rơi khỏi đảo mất toàn bộ đom đóm, trừ lửa, chờ 60 tick rồi hồi sinh ở điểm xuất phát | đạt | `6473d48d2398552e` |
| `17-gio-dem-3` | Gió Đêm 3 được báo trước, hoạt động theo chu kỳ 30 giây, có hướng tất định theo seed | đạt | `6e7a2b7686f15f80` |
| `18-dem-3-buc-phong` | Bục Đêm 3 phóng Mây từ tầng 1 và đáp xuống đĩa tầng 2 | đạt | `d97d2ec3d05c5bc9` |
| `19-gio-lac-pulse` | Gió Lạc đang flee thả lại toàn bộ đom đóm đã cướp khi trúng pulse | đạt | `de266c1325bbbecf` |
| `20-night-start` | Mỗi đêm phát night_start đúng một lần ở simulation tick đầu và ghi đúng số đêm | đạt | `9aa76dd415b841f8` |
| `21-dom-dom-sinh-lai` | Mote bị nhặt được thay bằng một mote ở điểm trống tại simulation tick 240 | đạt | `6aaf4c5b57dfa36f` |
| `22-gio-lac-sinh-va-tran` | Gió Lạc sinh lần lượt ở tick 1200 và 2400; sau khi đủ hai con, lượt tick 3600 bị bỏ qua vì chạm giới hạn | đạt | `0f2832fabea50057` |

## Chạy đủ từng Đêm (seed 123, không input)

| Đêm | Tick | Kết thúc | Tất định | Thời gian |
|---|---:|---|---|---:|
| 1 | 18000 | `{"type":"end","ticks":18000,"state":"lost","score":0}` | đạt (`0a26f772fb4f4896`) | 117 ms |
| 2 | 19800 | `{"type":"end","ticks":19800,"state":"lost","score":0}` | đạt (`c41affffacd05e01`) | 121 ms |
| 3 | 21600 | `{"type":"end","ticks":21600,"state":"lost","score":0}` | đạt (`b29be350947d01f0`) | 304 ms |
