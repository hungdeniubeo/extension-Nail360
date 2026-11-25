# extension-Nail360

# N360 Support Toolkit v1.0.1

Extension Chrome Manifest V3 độc lập dành cho hỗ trợ kỹ thuật / QA của salon NAIL360PRO. Không phải sản phẩm chính thức của Nail360PRO.

## Cài đặt

1. Tải ZIP từ nút Code > Download ZIP trên GitHub rồi giải nén. Dùng Chrome desktop 116 trở lên.
2. Mở `chrome://extensions` trên thanh địa chỉ.
3. Bật **Developer mode** (Chế độ dành cho nhà phát triển).
4. Bấm **Load unpacked** (Tải tiện ích đã giải nén) và chọn thư mục đã giải nén có file `manifest.json` bên trong.
5. Ghim icon N360 Support trong menu Extensions. Mở trang salon mà bạn được phép kiểm tra và bấm icon để mở side panel. Bản v1.0.1 có quyền host riêng cho `https://dev.nail360.info/*`; Chrome vẫn có thể giới hạn quyền trong Site access. Với domain khác, bấm icon ở tab đó để cấp quyền `activeTab`.

## Đối chiếu Appointment / Service

- Cùng salon, ngày, múi giờ, bộ lọc trạng thái và phạm vi. Chú ý appointment khác service line.
- Mở trang A, bấm **Quét bảng** trong Trang A. Nếu có nhiều bảng, chọn bảng đúng. Nếu không nhận dạng được, dùng **Chọn vùng** (thử nghiệm, click vào nhóm dòng trên trang, Esc để hủy), hoặc **Dán** danh sách/bảng CSV/TSV.
- Mở trang B, cấp quyền tab nếu cần, và làm tương tự trong Trang B.
- Chọn cột **Service** ở cả hai bên để đối chiếu theo tên dịch vụ; hoặc chọn ID ở cả hai bên để đếm dòng theo appointment. Dùng cột ghép ID + Service khi cần đối chiếu từng booking và cả hai nguồn có cùng loại ID.
- Mở Xem trước để xác minh cột và số dòng; chọn quy tắc tách ô chỉ khi dữ liệu thực sự chứa nhiều service.
- Cột A-B dương: A nhiều hơn B; âm: B nhiều hơn A. Tổng bằng nhau không bảo đảm từng mục đều khớp.
- Xuất CSV hoặc sao chép kết quả. Tạo bug report từ kết quả, chỉnh sửa bước tái hiện và thông tin môi trường rồi sao chép. Việc gửi báo cáo do người dùng quyết định.
- Dùng **Thử dữ liệu mẫu 11 vs 9** để kiểm tra giao diện. Mẫu giả lập: Gel Polish 3 vs 2, Pedicure 4 vs 3.

## Phạm vi, quyền và bảo mật

- Yêu cầu quyền activeTab, scripting, sidePanel, storage và quyền host cố định chỉ cho `https://dev.nail360.info/*`; không yêu cầu quyền host toàn bộ website, không dùng API nội bộ, không đọc token/cookie, không gửi dữ liệu qua mạng. Chỉ chụp dữ liệu DOM khi người dùng chủ động thao tác. Dữ liệu giữ trong `chrome.storage.session` và được xóa khi phiên Chrome kết thúc hoặc khi bấm Xóa dữ liệu.
- Có thể lưu dữ liệu khách hàng trong snapshot tạm nếu các bảng có cột đó; tránh chụp thông tin nhạy cảm không cần thiết. Kiểm tra kỹ kết quả trước khi xuất hoặc gửi team. CSV có cơ chế vô hiệu hóa text bắt đầu như công thức.
- Đọc bảng HTML/ARIA đã render trong tab chính. Không tự động đi hết phân trang, cuộn qua toàn bộ virtualized list, đọc iframe/shadow DOM hoặc truy cập backend. Với layout calendar/card tùy biến, tính năng chọn vùng chỉ là nhận dạng thử nghiệm; dùng Dán nếu không khớp. Có giới hạn mỗi bảng 2.000 dòng, 40 cột, 2.000 ký tự mỗi ô và 1 triệu ký tự tổng; có cảnh báo khi bị cắt.
- Nguồn chính thức công khai của sản phẩm: https://www.nail360pro.com/. Extension chưa được kiểm thử trên giao diện salon thật sau đăng nhập; do đó không bảo đảm selector hoặc DOM riêng của NAIL360PRO. Quyền host, activeTab và việc mở side panel thật cần xác nhận trên Chrome của người dùng.

## Kiểm thử

- `node --test tests/core.test.cjs`: 9 bài kiểm thử logic.
- `python tests/browser_test.py`: kiểm thử giao diện DOM trong Chromium (giả lập session storage) và đọc bảng HTML/ARIA, lựa chọn vùng, xuất CSV, tạo báo cáo lỗi. Cần Python Playwright và Chromium. Không kiểm thử Chrome extension API thực tế do môi trường trình duyệt kiểm thử chặn extension.

Bản source GitHub sử dụng logo SVG trong side panel và icon mặc định của Chrome trên toolbar (do giới hạn truyền file nhị phân).

## Cập nhật v1.0.1 — quyền đọc trang DEV

- Giải nén ZIP mới, mở `chrome://extensions` và tải lại extension nếu đã thay file trong thư mục cũ; hoặc gỡ bản cũ rồi Load unpacked từ thư mục mới. Xác nhận phiên bản 1.0.1 và quyền truy cập trang nếu Chrome hỏi.
- Tải lại trang DEV rồi mở panel, thử Quét bảng. Nếu vẫn lỗi, kiểm tra Details > Site access (Quyền truy cập trang web) và gửi chi tiết lỗi hiển thị trong panel (che thông tin nhạy cảm nếu có).
