# Bằng chứng phase-1: scenario headless

File này do `npm run proof` sinh ra, không sửa tay. Mỗi scenario chạy đúng lệnh `headless_cmd` trong `game.contract.json`,
chạy hai lần để so sha256 (tính tất định). Output đầy đủ nằm trong `runs/`.

- Máy: linux x64, Intel(R) Xeon(R) Processor @ 2.30GHz, Node v22.23.5
- Kết quả: **10/10 scenario đạt**, tất định đêm đầy đủ: **đạt**

| Scenario | Yêu cầu kiểm chứng | Kết quả | sha256 (16 ký tự đầu) |
|---|---|---|---|
| `01-di-chuyen-nhat-dom-dom` | Di chuyển theo move/cam_yaw (60 tick/s, 6 m/s) và nhặt đom đóm trong pickup_radius | đạt | `1740ae0f9e93531f` |
| `02-xoay-camera` | cam_yaw_deg = 90 biến move [0,1] thành hướng +X | đạt | `6c78126524b6c6b4` |
| `03-nap-va-thap-den` | Interact (cạnh lên) gần đèn: deposit rồi lantern_lit khi đủ 5 đom đóm | đạt | `6acf96f1c1b2b3b7` |
| `04-thang-all-lit` | Thắp đèn cuối cùng -> game_over won/all_lit, cộng thưởng thời gian và lửa | đạt | `87fd13eaedf39ca7` |
| `05-toa-sang-xua-bong-muc` | Pulse tốn 1 đom đóm, choáng Bóng Mực trong 6 m, đẩy lùi 4 m | đạt | `5cd5215fbbe5bc8e` |
| `06-bi-cham-roi-dom-dom` | Bóng Mực chạm: mất 1 lửa, rơi floor(5*0.5)=2 đom đóm | đạt | `8a07a42de9047e10` |
| `07-thua-het-lua` | Hết lửa -> game_over lost/no_flames | đạt | `1694a82b12b22ec9` |
| `08-thua-binh-minh` | Hết thời gian đêm -> game_over lost/dawn đúng tick | đạt | `eed89b9a67f32c95` |
| `09-vung-an-toan` | Bóng Mực không vào safe_radius quanh đèn đã thắp, người chơi đứng trong vùng không bị chạm | đạt | `c1b8baa6d608a4d8` |
| `10-mac-dinh-sinh-bong-muc` | Bóng Mực mặc định: 2 con ban đầu, sinh thêm S3 đúng tick 1800 (30 s) | đạt | `3acb1baa05582487` |

## Một đêm đầy đủ (seed 123, không input)

- Kết thúc: `{"type":"end","ticks":841,"state":"lost","score":0}`
- Hai lần chạy giống hệt: có (sha256 `60396e90e29b5e7c`)
- Thời gian chạy headless 18000 tick (5 phút game, seed 7, không chết): 49 ms trên máy trên (gồm khởi động Node)
