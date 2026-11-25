# extension-Nail360

# N360 Support v2.0.0

Extension Chrome Manifest V3 độc lập dành cho hỗ trợ kỹ thuật / QA của salon NAIL360PRO. Không phải sản phẩm chính thức của Nail360PRO.


## v2.0.0 — Trợ lý Support đơn giản hơn

**Chỉ có 3 tab:** Quét lỗi, So sánh, Báo lỗi. Mở đúng trang NAIL360PRO DEV → **Quét lỗi trang này**. Không cần chọn smoke test, suite hay mở cửa sổ nhúng để quét. Kết quả lưu vào lịch sử cục bộ và hiển thị ngay ở panel.

- Kết luận rõ: phát hiện bất thường (chưa tự xác nhận nguyên nhân gốc), chưa đủ căn cứ, hoặc chưa thấy lỗi trong phạm vi kiểm. Không lấy số kiểm tra kỹ thuật đạt làm bằng chứng nghiệp vụ đúng. Từng bất thường có số liệu mong đợi/thực tế, hướng xử lý, vị trí, cách tái hiện và nút sao chép báo lỗi.
- Calendar Appointment: nhận diện thử nghiệm từ các nhãn New Appointment / Daily View / All Technician. Nếu không đọc được danh sách ID hoặc tổng/phân trang đủ rõ, báo chưa kiểm được số lịch hẹn, không đếm ô giờ thành booking và không coi lịch trống là lỗi. Adapter vẫn cần xác minh trên salon thật.
- So sánh: chụp A, chuyển trang và chụp B, kết quả tính tự động theo cột đã chọn. Chọn vùng/dán và cách tách ô nằm trong mục tùy chọn. Xác nhận cùng salon, ngày, trạng thái, phạm vi và đơn vị trước khi lưu báo cáo. Mẫu 11/9 không lưu vào lịch sử thật. Kiểm tra tên service trước khi đưa vào báo cáo.
- Báo lỗi: xem các bất thường đang theo dõi, sao chép báo cáo tiếng Việt, cập nhật Chưa báo Dev / Đang xác minh / Đã báo Dev / Đã xử lý / Bỏ qua. Đánh dấu Đã báo Dev không tự gửi tin. Mở lịch sử xem các lần quét, chi tiết, lỗi đã đóng, xuất CSV/JSON. Giữ nguyên storage key và suite trước đây.
- Công cụ nhúng: mở Quét lỗi → Tùy chọn khác → Hiện công cụ ngay trên website. Ghi/phát lại và kiểm tra kỹ thuật cơ bản nằm trong Tùy chọn nâng cao. Không tự tạo/hủy booking, thanh toán hoặc gửi dữ liệu salon lên server.
- Bộ Auto Updater từ v1.2.1 không đổi: cùng quyền, entrypoint và thư mục. Đóng các cửa sổ extension/Studio, lưu và xóa dữ liệu A/B tạm nếu có, để cơ chế tự cập nhật áp dụng khi rảnh. Tải lại website sau khi đổi version nếu còn overlay cũ. Không gỡ extension nếu muốn giữ lịch sử.

Kiểm thử v2: `node --test tests/*.cjs` (46 bài logic/mock); `bash tests/updater-commit-test.sh`; `python tests/browser_test.py`, `python tests/qa_browser_test.py`, `python tests/audit_browser_test.py`, `python tests/support_browser_test.py` (Chromium với trang fixture và bridge Chrome giả lập). Chưa xác minh Chrome/macOS thật hoặc DOM salon sau đăng nhập. Các quy tắc nghiệp vụ v1.2.0 vẫn có giới hạn như dưới đây, không tự kiểm thử mọi hành vi của website.

---

## Tài liệu các phiên bản trước

Các bước/giao diện trong phần lịch sử dưới đây mô tả phiên bản cũ, v2.0.0 thay đổi cách dùng như trên.

## Cài đặt

**Khuyên dùng trên macOS:** cài [N360 Auto Updater](macos/README.md) một lần để tự đồng bộ phiên bản mới từ GitHub và tự reload khi QA rảnh (v1.2.1 trở lên). Các bước dưới đây dành cho cách cài ZIP thủ công.

1. Tải ZIP từ nút Code > Download ZIP trên GitHub rồi giải nén. Dùng Chrome desktop 116 trở lên.
2. Mở `chrome://extensions` trên thanh địa chỉ.
3. Bật **Developer mode** (Chế độ dành cho nhà phát triển).
4. Bấm **Load unpacked** (Tải tiện ích đã giải nén) và chọn thư mục đã giải nén có file `manifest.json` bên trong.
5. Ghim icon N360 Support trong menu Extensions. Mở trang salon mà bạn được phép kiểm tra và bấm icon để mở side panel. Bản v1.0.1 có quyền host riêng cho `https://dev.nail360.info/*`; Chrome vẫn có thể giới hạn quyền trong Site access. Với domain khác, bấm icon ở tab đó để cấp quyền `activeTab`.

## Auto Bug Detection (v1.2.0)

1. Mở salon DEV đã đăng nhập, chọn module cần kiểm. Bấm icon extension → Automation → **Scan for Bugs**. Kết quả tự động hiển thị trong trang (Embedded QA Studio) và lưu vào QA Admin. Có thể mở Studio trước rồi quét.
2. Bất thường (FAIL) hiển thị trước, có mã kiểm tra, module, vị trí, mức độ đề xuất, mong đợi, thực tế, chênh lệch, ảnh hưởng, bước tái hiện và việc cần làm. Chênh lệch đã đo khác với dấu hiệu cần xác minh hoặc lỗi môi trường. PASS chỉ áp dụng cho điều kiện đã kiểm; SKIP là chưa đủ căn cứ/không áp dụng, không phải kết quả đạt. Không có lỗi được xác nhận nếu chưa kiểm tra nghiệp vụ.
3. Mở **QA Admin** từ Studio hoặc side panel. Lọc bất thường theo nghiệp vụ/số liệu, kỹ thuật/UI/API, môi trường; xem từng lượt, cập nhật Open/Investigating/Resolved/Ignored, copy báo cáo tiếng Việt, xuất CSV/JSON. Dữ liệu chỉ lưu trong profile Chrome, tối đa 100 lượt chạy và 40 suite. Tránh thông tin khách hàng trong tên suite, URL/selector và report; kiểm tra trước khi chia sẻ.

### Quy tắc có sẵn

- Appointment: đối chiếu số dòng với phạm vi phân trang được công bố, khi bảng có một dòng/Appointment ID riêng biệt, không có cấu trúc gộp/virtualized. Không tự so sánh hai trang nếu chưa xác nhận cùng phạm vi.
- Service: tìm ID danh mục/Service Line ID lặp và tên dịch vụ trống ở bảng nhận diện được; tên service trùng không tự coi là bug. Không lưu ID/khách hàng vào báo cáo quét tự động.
- Ticket/POS: Quantity × Unit price so với Line subtotal trước giảm giá; Discount và Tax so với số tiền cơ sở × tỷ lệ hiển thị; đối chiếu Grand total với đủ 6 trường subtotal, discount, tax, tip, fees, grand total. Chỉ hỗ trợ số tiền định dạng USD rõ ràng, sai số tối đa 1 cent. Không mặc định khoản thiếu là 0. Công thức hiển thị là kiểm tra tính nhất quán, chưa xác nhận quy tắc tax-inclusive, voucher, hoàn tiền, phụ phí hoặc rounding của salon.
- Reports: so tổng từng cột Sales, Revenue, Tip, Tax, Ticket total với dòng Total khi bảng có phạm vi phân trang đầy đủ và không bị cắt. Không coi Sales và Revenue là cùng chỉ số. Đối chiếu tổng tiền A/B cho hai nguồn cùng chỉ số và cùng phạm vi.
- Turn/Technician: phát hiện vị trí hàng đợi không phải số nguyên dương ở cột Queue/Turn position; cần xác nhận quy ước 0/1. Chưa có quy tắc nghiệp vụ tăng Turn, weight, reset, technician nghỉ và ngoại lệ.
- UI: trạng thái tải, nội dung nhìn thấy, dấu hiệu thông báo lỗi nghiêm trọng. Network: trạng thái online của trình duyệt và HTTP 4xx/5xx của các XHR/fetch cùng origin có responseStatus đọc được trong Performance Resource Timing. Không giám sát toàn bộ Network, không đọc console/request body/token/cookie, không suy đoán nguyên nhân gốc. Không phát request để quét.
- Module được suy ra từ pathname/heading rõ ràng, dữ liệu từ HTML/ARIA table, nhãn–giá trị chuẩn (dl/bảng 2 cột), giới hạn 15 bảng/500 dòng mỗi bảng. Calendar/card, iframe, shadow DOM, selector tùy biến, dữ liệu ẩn hoặc quy tắc chưa xác minh có thể không đọc được. Không có test UI tự động cho mọi nút; Record & Replay vẫn hỗ trợ các tab ARIA đã xác nhận và assertion.

### Kiểm thử nâng cao và phạm vi

Mở mục **Kịch bản nâng cao / Record & Replay** trong Studio → Bắt đầu ghi → click tab ARIA an toàn trên cùng pathname hoặc chọn assertion Thấy phần tử / Có text / Đếm dòng → Lưu suite → Run suite. Không chạy thanh toán, nhập mật khẩu, tạo/hủy booking, submit. Dừng sau bước FAIL hoặc chuyển route. Không lưu text thực tế chứa PII; text mong đợi do QA nhập. Scan for Bugs là read-only; replay có thể click tab khi QA xác nhận và chỉ dùng salon test.

Bản v1.2.0 chưa kiểm thử trực tiếp trên salon thật sau đăng nhập. Các quy tắc dựa trên label/cột tiêu chuẩn, không phải adapter đã được xác thực cho mọi giao diện NAIL360PRO. Admin hiện là trang extension cục bộ, không có lịch chạy nền khi tab đóng, không có server/cloud/team sync. Quyền và entrypoint không đổi, tương thích Auto Updater đã cài.

## Đối chiếu Appointment / Service

- Cùng salon, ngày, múi giờ, bộ lọc trạng thái và phạm vi. Chú ý appointment khác service line.
- Mở trang A, bấm **Quét bảng** trong Trang A. Nếu có nhiều bảng, chọn bảng đúng. Nếu không nhận dạng được, dùng **Chọn vùng** (thử nghiệm, click vào nhóm dòng trên trang, Esc để hủy), hoặc **Dán** danh sách/bảng CSV/TSV.
- Mở trang B, cấp quyền tab nếu cần, và làm tương tự trong Trang B.
- Chọn cột **Service** ở cả hai bên để đối chiếu theo tên dịch vụ; hoặc chọn ID ở cả hai bên để đếm dòng theo appointment. Dùng cột ghép ID + Service khi cần đối chiếu từng booking và cả hai nguồn có cùng loại ID.
- Mở Xem trước để xác minh cột và số dòng; chọn quy tắc tách ô chỉ khi dữ liệu thực sự chứa nhiều service.
- Cột A-B dương: A nhiều hơn B; âm: B nhiều hơn A. Tổng bằng nhau không bảo đảm từng mục đều khớp.
- **Lưu đối chiếu vào Admin**: chỉ cho hai bảng DEV trực tiếp, cùng loại cột, không bị cắt; xác nhận cùng salon, ngày, timezone, status, phạm vi và đơn vị. Tùy chọn lưu tên service lệch (chỉ nếu không có PII), tối đa 12 chi tiết/lượt; CSV vẫn có đầy đủ. **Đối chiếu tổng tiền**: chọn cùng cột tiền USD ở A/B, bỏ cột ghép, xác nhận cùng phạm vi; không bỏ qua ô trống. Kết quả có chênh lệch số tiền và hướng kiểm tra, lưu Admin. Xuất CSV hoặc copy báo cáo để gửi Dev sau khi xác minh.
- Dùng **Thử dữ liệu mẫu 11 vs 9** để kiểm tra giao diện. Mẫu giả lập: Gel Polish 3 vs 2, Pedicure 4 vs 3.

## Phạm vi, quyền và bảo mật

- Yêu cầu quyền activeTab, scripting, sidePanel, storage và quyền host cố định chỉ cho `https://dev.nail360.info/*`; không yêu cầu quyền host toàn bộ website, không dùng API nội bộ, không đọc token/cookie, không gửi dữ liệu qua mạng. Chỉ chụp dữ liệu DOM khi người dùng chủ động thao tác. Dữ liệu giữ trong `chrome.storage.session` và được xóa khi phiên Chrome kết thúc hoặc khi bấm Xóa dữ liệu.
- Có thể lưu dữ liệu khách hàng trong snapshot tạm nếu các bảng có cột đó; tránh chụp thông tin nhạy cảm không cần thiết. Kiểm tra kỹ kết quả trước khi xuất hoặc gửi team. CSV có cơ chế vô hiệu hóa text bắt đầu như công thức.
- Đọc bảng HTML/ARIA đã render trong tab chính. Không tự động đi hết phân trang, cuộn qua toàn bộ virtualized list, đọc iframe/shadow DOM hoặc truy cập backend. Với layout calendar/card tùy biến, tính năng chọn vùng chỉ là nhận dạng thử nghiệm; dùng Dán nếu không khớp. Có giới hạn mỗi bảng 2.000 dòng, 40 cột, 2.000 ký tự mỗi ô và 1 triệu ký tự tổng; có cảnh báo khi bị cắt.
- Nguồn chính thức công khai của sản phẩm: https://www.nail360pro.com/. Extension chưa được kiểm thử trên giao diện salon thật sau đăng nhập; do đó không bảo đảm selector hoặc DOM riêng của NAIL360PRO. Quyền host, activeTab và việc mở side panel thật cần xác nhận trên Chrome của người dùng.

## Kiểm thử

- `node --test tests/core.test.cjs tests/qa-core.test.cjs tests/audit-core.test.cjs`: 31 bài kiểm thử logic.
- `python tests/audit_browser_test.py`: quét trang giả lập, lỗi Appointment 11/9, Ticket, Discount, Tax, báo cáo Admin, lọc loại lỗi, xuất CSV, lưu A/B service và tiền; mock Chrome bridge.
- `python tests/qa_browser_test.py`: kiểm thử runner, record/replay, assertion, admin, triage và xuất CSV trên trang giả lập trong Chromium (mock Chrome bridge, thay origin/path chỉ trong fixture).
- `python tests/browser_test.py`: kiểm thử giao diện DOM trong Chromium (giả lập session storage) và đọc bảng HTML/ARIA, lựa chọn vùng, xuất CSV, tạo báo cáo lỗi. Cần Python Playwright và Chromium. Không kiểm thử Chrome extension API thực tế do môi trường trình duyệt kiểm thử chặn extension.

Bản source GitHub sử dụng logo SVG trong side panel và icon mặc định của Chrome trên toolbar (do giới hạn truyền file nhị phân).

## Cập nhật v1.0.1 — quyền đọc trang DEV

- Giải nén ZIP mới, mở `chrome://extensions` và tải lại extension nếu đã thay file trong thư mục cũ; hoặc gỡ bản cũ rồi Load unpacked từ thư mục mới. Xác nhận phiên bản 1.0.1 và quyền truy cập trang nếu Chrome hỏi.
- Tải lại trang DEV rồi mở panel, thử Quét bảng. Nếu vẫn lỗi, kiểm tra Details > Site access (Quyền truy cập trang web) và gửi chi tiết lỗi hiển thị trong panel (che thông tin nhạy cảm nếu có).

## v1.0.2 — macOS Auto Updater

- Đồng bộ phiên bản từ repo public mỗi 5 phút khi phiên người dùng macOS đang hoạt động. Không cần Chrome Web Store, sudo hoặc token GitHub.
- Có thư mục cài ổn định, kiểm tra phiên bản, sao lưu một phiên bản trước và rollback. Các bản nâng cấp thay đổi quyền/entrypoint cần kiểm tra thủ công.
- Sau khi tải xong, lưu kết quả A/B nếu cần rồi bấm **Tải lại extension**. Chrome không tự áp dụng tất cả cập nhật unpacked ngay khi file thay đổi. Xem [hướng dẫn cài đặt và quản lý](macos/README.md).

## v1.2.1 — Auto Update + Auto Reload (macOS)

- One-time migration from v1.0.2–v1.2.0: replace the Mac updater and load v1.2.1 into the existing stable directory. This release adds only the `alarms` permission; old updaters intentionally refuse a permission change. Reload Chrome extension once after migrating. Do not uninstall it or clear local QA history.
- LaunchAgent resolves the public GitHub main commit through the GitHub API every five minutes, fetches manifest and archive from that exact SHA, compares the manifest bytes, validates permissions and required runtime assets, retains one backup, and logs upstream and disk versions. Failed fetch or validation keeps the installed version. Future runtime releases must increase manifest version.
- Chrome checks the on-disk update marker about once a minute (subject to Chrome alarm scheduling) even without the side panel. It automatically reloads a newer build only when all extension pages are closed, no A/B or captured page info is in session, and no visible embedded QA Studio is found in DEV tabs. If any context cannot be checked, it defers. Close QA/ admin, export and clear A/B if necessary, or choose the existing manual Reload button when ready. A rollback still requires manual reload. No website tab or browser restart is forced. An old injected overlay may need a normal page refresh before use.
- Persistent QA reports and suites stay in `chrome.storage.local`; session data is not silently persisted to disk. A failed reload attempt is rate-limited. This uses a trusted public repository for personal unpacked development, not Chrome Web Store distribution or enterprise policy. Keep main protected, review each commit and secure the GitHub account. No new host access. Mac launchd, real Chrome alarm/reload behavior and access to the public GitHub endpoints still require verification on the Mac.
- `node --test tests/*.cjs` (38 logic/mock tests); `bash tests/updater-commit-test.sh` (7 offline fixture cases). These are not real Chrome/macOS integration tests.

## v1.2.2 — Auto-update smoke release

Bản phát hành kiểm tra luồng nâng cấp từ v1.2.1. Chỉ tăng phiên bản hiển thị và manifest; không thay đổi quyền, tính năng QA, bộ updater hay dữ liệu. Bộ test updater dùng baseline 1.2.1 cố định để có thể chạy lại ở các release tiếp theo.
