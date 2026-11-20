# Phase 4 (Ticket-04): tiêu chí nghiệm thu, kiểm chứng và giả định

Nguồn: Ticket-04 “Bình minh: phát hành v1.0.0” trên lab board Đảo Đèn Lồng, đọc ngày 2026-11-20. Ticket yêu cầu Test Contract v1.3; các yêu cầu Contract v1.0–v1.2 vẫn có hiệu lực. Các lựa chọn dưới đây được ghi trước khi triển khai; cập nhật kết quả ở phần cuối.

## Tiêu chí nghiệm thu

| # | Yêu cầu | Tiêu chí nghiệm thu | Bằng chứng dự kiến |
|---|---|---|---|
| P4-1 | Benchmark đồ họa | `<bench_cmd> --seed 42 --duration 30 --out bench.json`; cửa sổ 1280×720, không fullscreen; tải Đêm 1 với hiệu ứng/ánh sáng chơi thật; đúng 200 Bóng Mực `wander`, 100 đom đóm và L1–L3 sáng với fuel 100. Tắt spawn thêm, damage, pickup, hao fuel và điều kiện kết thúc; Bóng Mực vẫn wander. Không input; Mây tại (0,0,0); camera vòng tâm (0,0,0), R=30, Y=15, bắt đầu (30,15,0), quay ngược chiều kim đồng hồ một vòng/15 s. Warm-up 3 s, đo đúng duration rồi thoát mã 0. | `bench.json`, lệnh và cấu hình renderer/OS; xác minh cảnh và số đo. Ngưỡng máy chấm: avg_fps ≥ 60, p1_low_fps ≥ 30, load_ms ≤ 10000. Ghi rõ nếu không tắt được vsync; `peak_mem_mb` có thể null nếu web không đo RSS, phải giải thích. |
| P4-2 | Soak test | `<soak_cmd> --seed 7 --nights 10 --out soak.json`; một tiến trình chạy 10 đêm xoay vòng 1→2→3. Đêm thứ i dùng seed 7+i, chạy đến kết thúc hoặc hết thời lượng chuẩn. Input theo seed: mỗi 30 tick chọn hướng; mỗi tick xác suất jump 5%, dash 3%, pulse 2%, interact 10%. Ghi RSS sau tải đêm đầu và sau reset đêm cuối. | `soak.json`; đạt khi `crashes=0` và `mem_end_mb ≤ 1.2 × mem_start_mb`. |
| P4-3 | Bảng xếp hạng cục bộ | Sau thắng Đêm 3 hoặc thua ở bất kỳ đêm nào cho nhập tên; tên 3–12 ký tự `[A-Za-z0-9_]` (dấu tiếng Việt là điểm cộng). Mục lưu gồm `name`, tổng `score` các đêm thắng, `nights_won` 0–3, `achieved_at` ISO 8601 có múi giờ, `seed`. Lưu top 10 trên đĩa qua lần khởi động; score giảm dần, hòa điểm thì người đạt trước đứng trước. Có màn hình leaderboard ở menu. | Kiểm tra lưu qua restart, sắp thứ tự/top 10 và xuất `<run_cmd> --export-leaderboard out.json`, định dạng `{"entries":[...]}` đúng thứ tự. |
| P4-4 | Dễ tiếp cận | Cho đổi mọi hành động: 4 hướng, jump, dash, interact, pulse, pause; phát hiện và báo trùng phím; lưu cấu hình; có Khôi phục mặc định. Chỉ báo trực quan cho Bóng Mực xuất hiện (kèm mũi tên hướng ở mép màn hình), gió sắp thổi, 10 giây cuối và đèn `fuel < 30`. Có tùy chọn giảm chuyển động tắt camera shake/chớp màn hình. UI tối thiểu 18 px ở 1280×720, có cỡ chữ lớn ×1.25. | Ảnh màn hình và kiểm tra thao tác, lưu/reload, cảnh báo từng trạng thái tại 1280×720. |
| P4-5 | Đóng gói/tài liệu | Clone sạch, theo README tối đa 3 lệnh là chơi được. README có mô tả, ảnh/GIF, yêu cầu hệ thống, cài đặt, điều khiển, test, headless, bench, soak. CHANGELOG có đủ 4 phase; CREDITS liệt kê asset/âm thanh/công cụ AI; có LICENSE. | Clone sạch và chạy theo hướng dẫn; rà soát các tệp yêu cầu. |
| P4-6 | Contract v1.3 | `game.contract.json` có `contract_version: "1.3"`, thêm `bench_cmd` và `soak_cmd`; giữ mọi yêu cầu v1.0–v1.2. | Sinh contract từ cấu hình, kiểm tra schema/lệnh và chạy test hồi quy Phase 1–3. |
| P4-7 | Retro/demo | Retro 1–2 trang tổng hợp evaluation cả 4 phase, hiệu quả/hạn chế khi dùng AI, lỗi AI và cách phát hiện, harness hữu ích nhất, token/chi phí ước tính và cách tiết kiệm, điều sẽ đổi nếu làm lại. Video MP4 dưới 5 phút: chơi trực tiếp và cho thấy test/headless/benchmark. | Tài liệu retro và video ở Release hoặc `docs/demo/demo.mp4`. |
| P4-8 | Hoàn tất/release | Có bằng chứng Phase 4; tag `phase-4`, GitHub Release `v1.0.0`; commit `bench.json` và `soak.json`; test ẩn Phase 1–3 còn hiệu lực vẫn đạt; repo public và đủ harness/tài liệu. | Kiểm tra tag/release, artifact bằng chứng và hồi quy. |

## Giả định và điểm cần giữ nguyên

| Chỗ chưa chốt | Cách xử lý tài liệu hiện tại | Tác động |
|---|---|---|
| Ticket không nêu đường dẫn lưu leaderboard, cách xử lý tên trùng, hay hành vi khi file hỏng | Lưu tại `.local/leaderboard.json`; cho phép nhiều lượt cùng tên; file thiếu/hỏng/không hợp lệ được đọc như danh sách rỗng. Ghi file dạng JSON `{ "entries": [...] }` | Dữ liệu cục bộ; file hỏng không làm dừng game nhưng cần được khôi phục thủ công nếu muốn giữ dữ liệu cũ |
| Ticket không chốt số lượng bản ghi trước khi cắt top 10 | Mỗi lần nộp điểm, hợp nhất mục hợp lệ, sắp điểm giảm dần rồi thời điểm sớm nhất trước, cắt top 10 | Các mục ngoài top 10 bị loại khỏi tệp |
| Ticket yêu cầu timestamp ISO 8601 có múi giờ nhưng không chốt múi giờ | Giao diện ghi `new Date().toISOString()` (UTC, hậu tố `Z`), là ISO 8601 có múi giờ | Thứ tự hòa điểm so sánh thời gian tuyệt đối |
| Ticket không chốt chi tiết phân vị 95 (nearest-rank hay nội suy), làm tròn, đơn vị/định nghĩa RSS và renderer string | FPS trung bình lấy theo tổng frame/thời gian đo; P1 là nghịch đảo trung bình thời gian của 1% frame chậm nhất; p95 frame time dùng nearest-rank; thời gian ms làm tròn 0.1, MB là MiB làm tròn 0.1; RSS soak là `process.memoryUsage().rss`; renderer lấy từ WebGL renderer info | So sánh số liệu cần cùng phương pháp và runtime |
| Ticket nói camera quay ngược chiều kim đồng hồ, nhìn từ trên xuống, nhưng không chỉ rõ dấu góc trong hệ tọa độ hiện tại | Camera orbit theo góc dương trong mặt phẳng XZ, giữ Y=15; cấu hình seed 42 bắt đầu tại (30,15,0) | Ảnh hưởng đường camera chuẩn và tái lập benchmark |
| Cụm “Đêm thứ i dùng seed 7+i” có thể đếm i từ 0 hoặc 1 | Hiểu i là thứ tự đêm 1-based, tức seed đêm đầu là 8; đây là cách triển khai hiện tại theo `nightSeed = seed + i` với i bắt đầu từ 1 | Seed ảnh hưởng chuỗi input soak |
| Với web, ticket cho phép `peak_mem_mb: null` nếu không đo được RSS; không nêu cách lấy chính xác | `peak_mem_mb` là null vì trang Chrome không có API RSS đáng tin cậy; giải thích ở README và output benchmark | Không báo số giả; RSS của soak được Node đo riêng |
| Benchmark/soak phải tắt nội dung sáng tạo làm sai phép đo; chưa chốt danh sách phần sáng tạo trong repo | Rà soát riêng và loại khỏi hai chế độ đo mà không đổi output headless thường | Tránh kết quả bench/soak khác cảnh chuẩn |

## Kế hoạch kiểm chứng

1. Bổ sung kiểm tra/fixture cho contract 1.3, chế độ bench, soak, export leaderboard và schema output trước khi triển khai tương ứng.
2. Kiểm tra benchmark bằng output JSON hợp lệ, đúng duration/khởi động và cấu hình cảnh; số máy phát triển chỉ tham khảo, không tự tuyên bố đạt ngưỡng máy chấm.
3. Chạy soak đủ 10 đêm trong một tiến trình; kiểm tra `crashes` và tỷ lệ RSS theo ngưỡng.
4. Kiểm tra leaderboard qua thắng Đêm 3 và thua, reload ứng dụng, top 10, hòa điểm, tên không hợp lệ và lệnh export.
5. Chụp ảnh giao diện và kiểm tra thao tác accessibility ở 1280×720; ghi rõ tiêu chí nào chưa có cách kích hoạt/đo.
6. Chạy lại test và proof Phase 1–3 còn hiệu lực; không sửa tay output trong `docs/proof`.

## Ràng buộc phát hành

- Ghi output `bench.json` và `soak.json` thật do lệnh của repo sinh ra; không dùng số mẫu trong ticket làm bằng chứng.
- Không đổi luật/tuning hoặc output headless cũ ngoài phần Ticket-04 cho phép; mọi thay đổi hợp đồng phải được ghi và có hồi quy.
- Ticket yêu cầu tag/release, nhưng chưa thực hiện phát hành trong bước ghi tài liệu này.

## Trạng thái kiểm chứng (2026-11-20)

- `npm test`: 50/50 đạt. Proof Phase 4: 22/22 scenario đạt sau khi khôi phục tăng tốc Ticket-02, sửa dash/pause/rơi/gió và cập nhật scenario bị Ticket-03 thay luật với lý do trong [`phase-3-decisions.md`](phase-3-decisions.md).
- Benchmark: `docs/proof/phase-4/bench.json` sinh từ lệnh đủ 30 giây; 385.5 FPS TB, P1 114.3, p95 5.4 ms, tải 986 ms, vsync tắt, RSS null.
- Soak: lệnh contract dùng `--no-opt --max-semi-space-size=1 --expose-gc`. Tắt TurboFan optimization để tránh mã tối ưu được giữ trong RSS giữa các đêm và giới hạn semi-space để giảm dao động bộ nhớ tạm; luật game, seed và input không đổi. Năm lượt lặp cùng cấu hình: RSS lần lượt 43.2→45.2, 43.1→45.1, 43.1→45.0, 43.1→45.1, 43.1→45.0 MiB (tăng 4.2–4.6%), đều 0 crash. Kết quả contract cuối được ghi ở `docs/proof/phase-4/soak.json`.
- Clone sạch từ commit đã chạy `npm install`, `npm test` (50/50), và smoke server/API thành công. Video MP4 dưới 5 phút đã có trong `docs/demo/` và link ở đầu README; chưa xác nhận có đủ gameplay, test, headless và benchmark. Review độc lập không còn lỗi code. Còn thiếu: bộ ảnh UI đầy đủ tại 1280×720 và tag/release.
