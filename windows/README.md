# N360 Support for Windows 10/11

This is the same Chrome extension as macOS. Windows PowerShell 5.1 and Task Scheduler are included in Windows 10/11; no administrator account, Git, Node.js, or Chrome Web Store installation is required. Use only on a Windows account where you are authorized to install developer extensions and scheduled tasks. Chrome 116+ is required.

## Install once

For the offline setup ZIP supplied by the developer, extract the entire ZIP to a local folder. Read `updater.ps1`, then double-click `INSTALL.cmd` from the extracted folder. The included `runtime.zip` is a verified snapshot of v2.0.0. Alternatively, download the repository ZIP, extract it and run `windows/INSTALL.cmd`; with no bundled runtime the installer downloads the latest compatible commit from GitHub.

The installer writes the extension into `%LOCALAPPDATA%\N360 Support\extension` and registers a five-minute scheduled task for the signed-in Windows account. It opens the extension folder. In Chrome, visit `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, paste the folder path above into the folder picker and choose **Select Folder**. Do this only once; keep the same directory and extension ID. If already loaded from this folder, reload rather than remove it. Open https://dev.nail360.info and click N360 Support to test.

`AUTO UPDATE NOT ENABLED` means the scheduled task could not be registered. The extension can still be loaded from the folder if installation completed; `CHECK-UPDATE.cmd` is the manual fallback. If company policy blocks PowerShell, developer mode or tasks, consult IT; do not circumvent the restrictions. If only the bundled runtime is needed, extract `runtime.zip` separately and Load unpacked its inner folder containing manifest.json (that separate folder is not auto-updated).

## Updates and management

- `CHECK-UPDATE.cmd`: check GitHub now.
- `STATUS.cmd`: report local version, scheduled-task state, last result and next run.
- `ROLLBACK.cmd`: restore the previous source folder and hold the rejected version. Reload Chrome extension manually afterward.
- `STOP-AUTO-UPDATE.cmd`: disable the current user's updater task without deleting extension or history. Run INSTALL.cmd again to enable it.

The task checks GitHub's main commit SHA and downloads its manifest and archive from that exact SHA, validates the manifest and required runtime files, stages files locally, keeps one previous version and writes update-status.json. It never runs shell scripts downloaded in the archive. It refuses changed Chrome permissions or entrypoints. Source updates use the trusted repository; protect the account and main branch. The scheduled task invokes the already-installed updater, not remote scripts. The CMD wrappers use a process-scoped PowerShell execution policy for the local reviewed script; they do not change the machine/user execution policy or request elevation. Group Policy still applies. Log: `%LOCALAPPDATA%\N360 Support\updater.log`.

Chrome uses its existing alarm to reload a newer build when extension views and the embedded panel are closed and no A/B or page snapshot is held. Export and clear comparison snapshots before waiting for an automatic reload. After reload, refresh the DEV tab if it contains an old embedded UI. It does not restart Chrome or force the website to reload. Updates need the Windows user to be signed in and the computer awake; browser-side reload needs Chrome running. Updating a runtime version does not upgrade the installed updater script itself.

QA reports are local to the Chrome profile. Switching computers does not synchronize reports, suites, or salon login sessions. Export old reports on Mac if needed. The Windows scheduler and actual Chrome extension behavior have not yet been tested on a Windows machine; run STATUS.cmd after installation to verify registration, then test a future release. The offline source bundle is checked against GitHub and JavaScript syntax is checked before packaging.
