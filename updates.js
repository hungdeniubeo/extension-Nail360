(() => {
  'use strict';
  const runtime = globalThis.chrome?.runtime;
  if (!runtime?.getManifest || !runtime?.reload) return;
  const current = runtime.getManifest().version;
  const label = document.querySelector('.version');
  const status = document.getElementById('update-state');
  const button = document.getElementById('reload-extension');
  if (!label || !status || !button) return;
  label.textContent = 'v' + current;
  button.hidden = false;
  status.textContent = 'Chrome đang chạy v' + current;
  let checking = false;
  async function checkDisk() {
    if (checking) return;
    checking = true;
    try {
      // Only read a file from the locally installed extension, not remote code.
      const res = await fetch(runtime.getURL('update-status.json') + '?t=' + Date.now(), {cache:'no-store'});
      if (!res.ok) return;
      const {version} = await res.json();
      if (typeof version !== 'string' || !/^\d+(?:\.\d+){0,3}$/.test(version)) return;
      status.textContent = version === current
        ? 'Đang dùng v' + current + ' · Auto Updater'
        : 'Đã đồng bộ v' + version + ' · Bấm tải lại để áp dụng';
      status.classList.toggle('update-ready', version !== current);
    } catch {
      // An unpacked extension installed without the updater has no marker.
    } finally { checking = false; }
  }
  button.addEventListener('click', () => {
    if (window.confirm('Tải lại extension? Phiên A/B có thể bị xóa. Hãy sao chép hoặc xuất kết quả cần giữ trước.')) runtime.reload();
  });
  checkDisk();
  setInterval(checkDisk, 15000);
  window.addEventListener('focus', checkDisk);
})();
