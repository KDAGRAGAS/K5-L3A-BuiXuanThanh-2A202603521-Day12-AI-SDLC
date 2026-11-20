# Bằng chứng phase-3: scenario headless

File này do `npm run proof` sinh ra, không sửa tay. Mỗi scenario chạy đúng lệnh `headless_cmd` trong `game.contract.json`,
chạy hai lần để so sha256 (tính tất định). Output đầy đủ nằm trong `runs/`.

- Máy: win32 x64, 12th Gen Intel(R) Core(TM) i5-12400F, Node v22.23.5
- Kết quả: **22/22 scenario đạt**

| Scenario | Yêu cầu kiểm chứng | Kết quả | sha256 (16 ký tự đầu) |
|---|---|---|---|
| `01-di-chuyen-nhat-dom-dom` | Di chuyển theo move/cam_yaw (60 tick/s, 6 m/s) và nhặt đom đóm trong pickup_radius | đạt | `caeb03a27c58056b` |
| `02-xoay-camera` | cam_yaw_deg = 90 biến move [0,1] thành hướng +X | đạt | `dfe39e5bd9d5a669` |
| `03-nap-va-thap-den` | Ticket-03: nạp đủ đom đóm thắp đèn và tính điểm theo luật mới | đạt | `6f96bfc3c0b0962d` |
| `04-thang-all-lit` | Ticket-03 thay thắng sớm: thắp hết đèn không kết thúc đêm; tiếp tục tới bình minh | đạt | `b3a9d3c379e19a44` |
| `05-toa-sang-xua-bong-muc` | Pulse tốn 3 đom đóm, khóa Bóng Mực trong 5 m, choáng 120 tick và đẩy lùi tổng 4 m | đạt | `4a3088a52738676e` |
| `06-bi-cham-roi-dom-dom` | Bóng Mực chạm: mất 1 lửa, rơi floor(5/2)=2 đom đóm thành mote rơi TTL 480 tick | đạt | `9b3de018f96f7fa9` |
| `07-thua-het-lua` | Hết lửa -> game_over lost/no_flames | đạt | `9b98f86aa06111be` |
| `08-thua-binh-minh` | Hết thời gian đêm -> game_over lost/dawn đúng tick | đạt | `79a0aaf21ddbba5b` |
| `09-vung-an-toan` | Bóng Mực không vào safe_radius quanh đèn đã thắp, người chơi đứng trong vùng không bị chạm | đạt | `8d174cd282a11d5f` |
| `10-mac-dinh-sinh-bong-muc` | Bóng Mực Đêm 1: S1/S2 ở tick 300, thêm một con mỗi 480 tick, id theo thứ tự sinh | đạt | `f09e4444f569da1b` |
| `11-luot-dash` | Lướt 14 m/s trong 0.2 s theo hướng mặt, phát dash và cooldown bắt đầu lúc kích hoạt | đạt | `1a054bc3a5dd5abe` |
| `12-dem-2-buc-phong` | Bục Đêm 2 phóng Mây từ đảo A về phía đảo B và giữ vận tốc tới lúc tiếp đất | đạt | `74033f90d1dba13b` |
| `13-gio-lac-cuop-dom-dom` | Gió Lạc đang chase chạm Mây thì cướp tối đa 3 đom đóm một lần và chuyển flee | đạt | `171d816a0fc90102` |
| `14-bua-gio` | Nhặt Bùa Gió Đêm 2 thì phát charm_picked, áp dụng 600 tick | đạt | `0c6c89e7a78bed5f` |
| `15-tam-dung` | Pause giữ nguyên simulation tick và đồng hồ, ghi snapshot paused, resume theo cạnh lên | đạt | `a4db98d1f7ea9ba4` |
| `16-roi-khoi-dao` | Rơi khỏi đảo mất toàn bộ đom đóm, trừ lửa, chờ 60 tick rồi hồi sinh ở điểm xuất phát | đạt | `429b22cc71f52f03` |
| `17-gio-dem-3` | Gió Đêm 3 được báo trước, hoạt động theo chu kỳ 30 giây, có hướng tất định theo seed | đạt | `1487405b60f2f5bc` |
| `18-dem-3-buc-phong` | Bục Đêm 3 phóng Mây từ tầng 1 và đáp xuống đĩa tầng 2 | đạt | `5c9303b5914eb9e4` |
| `19-gio-lac-pulse` | Gió Lạc đang flee thả lại toàn bộ đom đóm đã cướp khi trúng pulse | đạt | `f53e531eaec5500f` |
| `20-night-start` | Mỗi đêm phát night_start đúng một lần ở simulation tick đầu và ghi đúng số đêm | đạt | `7ff466944d87573a` |
| `21-dom-dom-sinh-lai` | Mote bị nhặt được thay bằng một mote ở điểm trống tại simulation tick 240 | đạt | `798d57410cfc44ce` |
| `22-gio-lac-sinh-va-tran` | Gió Lạc sinh lần lượt ở tick 1200 và 2400; sau khi đủ hai con, lượt tick 3600 bị bỏ qua vì chạm giới hạn | đạt | `3de2c0a08b7555dd` |

## Chạy đủ từng Đêm (seed 123, không input)

| Đêm | Tick | Kết thúc | Tất định | Thời gian |
|---|---:|---|---|---:|
| 1 | 18000 | `{"type":"end","ticks":14400,"state":"lost","score":0}` | đạt (`02c225b0ba9a658c`) | 154 ms |
| 2 | 19800 | `{"type":"end","ticks":16200,"state":"lost","score":0}` | đạt (`b3a9597d0600c494`) | 156 ms |
| 3 | 21600 | `{"type":"end","ticks":18000,"state":"lost","score":0}` | đạt (`6f7a74ee7a0d12bf`) | 193 ms |
