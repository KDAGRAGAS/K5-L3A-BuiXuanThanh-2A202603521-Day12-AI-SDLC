---
name: verify-game
description: Kiểm chứng game Đảo Đèn Lồng và lưu bằng chứng. Dùng sau khi sửa luật chơi, trước khi gắn tag phase, hoặc khi cần chứng minh một yêu cầu chạy đúng.
---

# Kiểm chứng và lưu bằng chứng

1. `npm test`: phải xanh. Nếu đỏ, sửa code (không sửa test cho đạt) trừ khi yêu cầu đã đổi; khi đó ghi lý do vào `docs/notes/`.
2. Với mỗi yêu cầu mới của phase, thêm một file `tests/scenarios/NN-ten.json`:
   ```json
   { "requirement": "câu yêu cầu kiểm chứng được", "seed": 1, "ticks": 120,
     "scenario": { ... }, "inputs": { "frames": [ ... ] },
     "expect": { "events": [[tick, "name", {data}]], "end": {...}, "snapshot": [tick, "player.pos", [x,y,z]] } }
   ```
   `events: []` nghĩa là không được có sự kiện nào; nếu có phần tử thì là dãy con phải xuất hiện đúng thứ tự.
   Tính tick theo contract: bước k tạo trạng thái k+1, sự kiện ghi tick k+1.
3. `PHASE=phase-N npm run proof`: sinh `docs/proof/phase-N/RESULTS.md` + `runs/*.jsonl` (đã gồm kiểm tra tất định).
4. Cập nhật bảng truy vết trong `docs/proof/phase-N/README.md` (yêu cầu -> cách kiểm chứng -> bằng chứng -> kết quả).
   Chỗ chưa đạt ghi "chưa đạt" kèm lý do.
5. Thứ chỉ nhìn mới thấy (HUD, hiệu ứng): chụp màn hình vào `docs/proof/phase-N/screens/` và ghi nó chứng minh yêu cầu nào.
