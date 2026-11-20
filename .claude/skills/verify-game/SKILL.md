---
name: verify-game
description: Kiểm chứng game Đảo Đèn Lồng và lưu bằng chứng. Dùng sau khi sửa luật chơi, trước khi gắn tag phase, hoặc khi cần chứng minh một yêu cầu chạy đúng.
---

# Kiểm chứng và lưu bằng chứng

1. Đọc ticket và `docs/notes/phase-N-assumptions.md`; kiểm tra thay đổi cũ để giữ hồi quy. `npm test`: phải xanh. Nếu đỏ, sửa code (không sửa test cho đạt) trừ khi yêu cầu đã đổi; khi đó ghi lý do vào `docs/notes/`.
2. Với mỗi yêu cầu mới của phase, thêm một file `tests/scenarios/NN-ten.json`:
   ```json
   { "requirement": "câu yêu cầu kiểm chứng được", "seed": 1, "ticks": 120,
     "scenario": { ... }, "inputs": { "frames": [ ... ] },
     "expect": { "events": [[tick, "name", {data}]], "end": {...}, "snapshot": [tick, "player.pos", [x,y,z]],
       "snapshots": [[tick, "motes.length", 20], [tick, "drifters.length", 1]] } }
   ```
   `events: []` nghĩa là không được có sự kiện nào; nếu có phần tử thì là dãy con phải xuất hiện đúng thứ tự.
   Tính tick theo contract: bước k tạo trạng thái k+1, sự kiện ghi tick k+1.
3. Chạy `PHASE=phase-N npm run proof` (PowerShell: `$env:PHASE='phase-N'; npm run proof`): sinh `docs/proof/phase-N/RESULTS.md` + `runs/*.jsonl` (đã gồm kiểm tra tất định). Không sửa tay output trong thư mục proof.
4. Cập nhật bảng truy vết trong `docs/proof/phase-N/README.md` (yêu cầu -> cách kiểm chứng -> bằng chứng -> kết quả).
   Chỗ chưa đạt ghi "chưa đạt" kèm lý do.
5. Thứ chỉ nhìn mới thấy (HUD, hiệu ứng): chạy bản web ở 1280×720, chụp màn hình vào `docs/proof/phase-N/screens/` và ghi ảnh chứng minh yêu cầu nào trong README của proof. Nếu có tiêu chí hiệu năng, đo FPS trung bình khi game đang chạy và lưu cách đo/kết quả; không lấy giá trị menu làm bằng chứng.
6. Với Contract v1.1/Phase 2, kiểm tra `--night 1`, `--night 2`, `--night 3`; chạy đủ 18.000/19.800/21.600 tick để kiểm tra tính tất định và thời gian (tối đa 30 giây). Kiểm tra scenario có cho từng tính năng mới: dash, pause, ba bản đồ/đêm, gió, Gió Lạc, Bùa Gió và rơi khỏi đảo.
7. Đối chiếu `game.contract.json` với `src/core/config.js`. Trước khi gắn tag, yêu cầu subagent `reviewer` đọc assumptions, contract, diff, test và proof, rồi xử lý mọi phát hiện.
