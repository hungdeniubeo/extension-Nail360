# N360 Auto Updater — macOS

Miễn phí, dùng Chrome desktop 116+ và macOS với Perl JSON::PP, curl, unzip, launchd. Không cần sudo, Homebrew hoặc Git. Chỉ dùng source tin cậy từ repo của bạn.

## Cài lần đầu

1. Tải [install.command](https://raw.githubusercontent.com/hungdeniubeo/extension-Nail360/main/macos/install.command) vào Downloads. Đọc nội dung trước khi chạy.
2. Chạy `/bin/bash "$HOME/Downloads/install.command"` trong Terminal.
3. Mở `chrome://extensions`, bật Developer mode, Load unpacked từ `~/Library/Application Support/N360 Support/extension`. Dùng Cmd+Shift+G để nhập đường dẫn. Nếu đã load từ đúng thư mục này thì chỉ Reload, không gỡ extension.

LaunchAgent kiểm tra mỗi 5 phút khi đang đăng nhập, không chạy khi máy ngủ/tắt. Bản đang dùng được giữ nếu lỗi mạng hoặc thiếu runtime. Giữ một bản trước; không tự chạy script trong archive. Phiên bản mới phải tăng manifest version. Bảo vệ repo main và tài khoản GitHub.

## Quản lý

```bash
/bin/bash "$HOME/Library/Application Support/N360 Support/updater.sh" status
/bin/bash "$HOME/Library/Application Support/N360 Support/updater.sh" check
/bin/bash "$HOME/Library/Application Support/N360 Support/updater.sh" rollback
/bin/bash "$HOME/Library/Application Support/N360 Support/updater.sh" stop
```

- `status`: version trên đĩa và LaunchAgent; `check`: kiểm tra ngay.
- `rollback`: phục hồi bản trước, giữ hold tới khi có version cao hơn. Reload extension thủ công.
- `stop`: dừng lịch kiểm tra; chạy lại installer để bật lại. Không xóa source runtime.
- Log: `~/Library/Application Support/N360 Support/updater.log`. Backup chỉ gồm source, không phải dữ liệu Chrome. Lịch sử QA trong Chrome storage.local được giữ khi reload (không gỡ extension). Phiên A/B có thể mất nếu reload thủ công, hãy xuất trước.

## v1.2.1 — Tự tải và tự reload

Bộ updater mới xác định SHA của main bằng API GitHub rồi tải manifest và ZIP từ cùng SHA. Mỗi lần check in rõ version GitHub và version trên đĩa; lỗi mạng hoặc kiểm tra thất bại không ghi đè bản đang dùng. Sau khi đồng bộ, service worker Chrome kiểm tra marker khoảng mỗi phút bằng `alarms` và tự gọi `chrome.runtime.reload()` khi không có UI extension, không có dữ liệu A/B/thông tin trang đang giữ trong phiên, và không có Embedded QA Studio đang hiển thị. Có thể tiếp tục dùng nút reload thủ công; rollback cũng cần reload thủ công. Không tự reload website hoặc thoát Chrome.

Upgrader cũ sẽ từ chối quyền `alarms` mới. Cần nâng cấp bộ updater và extension **một lần**, rồi reload extension lần cuối. Nếu đường tải GitHub chưa nhận commit mới, dùng bộ migration offline từ người phát triển; không cài lại extension từ thư mục khác. Nếu bản đã được rollback (hold-version), migration không tự bỏ hold. Sau đó các bản runtime mới giữ nguyên phạm vi quyền sẽ tự đồng bộ. Nếu đổi quyền, thay entrypoint hoặc nâng cấp updater Mac, cần review/cài thủ công. Chỉ dùng source repo của bạn.

Kiểm tra ngay: `/bin/bash "$HOME/Library/Application Support/N360 Support/updater.sh" check`. Log: `~/Library/Application Support/N360 Support/updater.log`. Chrome/macOS thật chưa được kiểm thử từ môi trường CI giả lập.
