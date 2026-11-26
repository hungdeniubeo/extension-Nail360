# N360 Support Windows updater. Windows PowerShell 5.1, current user only.
# Installs runtime files from the trusted repo; never executes scripts from a downloaded ZIP.
[CmdletBinding()]
param([ValidateSet('Install','Check','Status','Rollback','Stop','Repair')][string]$Mode='Install')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
$Base = Join-Path $env:LOCALAPPDATA 'N360 Support'
$Active = Join-Path $Base 'extension'
$Previous = Join-Path $Base 'previous'
$Swap = Join-Path $Base '.swap-old'
$Hold = Join-Path $Base 'hold-version'
$InstalledScript = Join-Path $Base 'updater.ps1'
$Identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$TaskName = 'N360 Support Updater - ' + $Identity.User.Value
$Repo = 'hungdeniubeo/extension-Nail360'
$SeedCommit = '8da8d5ab4ed533482d46cf11ece2a94369a6e979'
$SeedHash = 'e27d79ac251a3b41ddbf59812103889e769889fce777f818e84a7357ea5760d4'
$Limit = 20000000
$Stage = $null
$LockStream = $null
$Utf8 = New-Object System.Text.UTF8Encoding($false)
function Log([string]$Message) {
    $line = 'N360: ' + $Message
    Write-Host $line
    try {
        $file = Join-Path $Base 'updater.log'
        if ((Test-Path -LiteralPath $file) -and (Get-Item -LiteralPath $file).Length -gt 1000000) {
            Move-Item -LiteralPath $file -Destination (Join-Path $Base 'updater.old.log') -Force
        }
        [IO.File]::AppendAllText($file, ('{0:u} {1}' -f (Get-Date), $line) + [Environment]::NewLine, $Utf8)
    } catch { }
}
function Version-Text([string]$Text) {
    if ($Text -notmatch '\A(?:0|[1-9][0-9]{0,4})(?:\.(?:0|[1-9][0-9]{0,4})){0,3}\z') { throw 'Invalid Chrome version.' }
    $parts = @($Text.Split('.') | ForEach-Object { [int]$_ })
    if (@($parts | Where-Object { $_ -gt 65535 }).Count) { throw 'Invalid Chrome version component.' }
    while ($parts.Count -lt 4) { $parts += 0 }
    return [version]($parts -join '.')
}
function Read-Manifest([string]$File) {
    $m = Get-Content -LiteralPath $File -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($m.manifest_version -ne 3 -or $m.name -cne 'Nail360PRO Support Toolkit') { throw 'Unexpected manifest.' }
    $keys = @('manifest_version','name','short_name','version','version_name','description','minimum_chrome_version','permissions','host_permissions','action','background','side_panel','icons')
    foreach ($p in $m.PSObject.Properties.Name) { if ($p -cnotin $keys) { throw ('Manifest field changed: ' + $p) } }
    $perms = @($m.permissions | Sort-Object) -join ','
    if ($perms -cne 'activeTab,alarms,scripting,sidePanel,storage') { throw 'Permission scope changed. Review manually.' }
    if (@($m.host_permissions).Count -ne 1 -or $m.host_permissions[0] -cne 'https://dev.nail360.info/*') { throw 'Host permission changed.' }
    if ($m.background.service_worker -cne 'background.js' -or @($m.background.PSObject.Properties).Count -ne 1 -or $m.side_panel.default_path -cne 'panel.html' -or @($m.side_panel.PSObject.Properties).Count -ne 1) { throw 'Entrypoint changed.' }
    foreach ($p in $m.action.PSObject.Properties.Name) { if ($p -cnotin @('default_title','default_icon')) { throw 'Action configuration changed.' } }
    [void](Version-Text ([string]$m.version))
    return [string]$m.version
}
function Check-Assets([string]$Folder) {
    $v = Read-Manifest (Join-Path $Folder 'manifest.json')
    $required = @('manifest.json','background.js','capture.js','core.js','panel.html','panel.css','panel.js','icons/logo.svg','qa-core.js','qa-page.js','studio.js','admin.html','admin.css','admin.js','updates.js','audit-core.js','audit-dom.js','auto-reload.js')
    if ((Version-Text $v) -ge (Version-Text '2.0.0')) { $required += 'support-view.js' }
    foreach ($rel in $required) {
        $p = Join-Path $Folder $rel
        if (!(Test-Path -LiteralPath $p -PathType Leaf) -or (Get-Item -LiteralPath $p).Length -eq 0) { throw ('Missing runtime asset: ' + $rel) }
    }
    return $v
}
function Recover-Swap {
    if (!(Test-Path -LiteralPath $Swap)) { return }
    if (!(Test-Path -LiteralPath $Active)) { Move-Item -LiteralPath $Swap -Destination $Active }
    else {
        if (Test-Path -LiteralPath $Previous) { Remove-Item -LiteralPath $Previous -Recurse -Force }
        Move-Item -LiteralPath $Swap -Destination $Previous
    }
}
function Promote([string]$New) {
    Recover-Swap
    if (Test-Path -LiteralPath $Active) { Move-Item -LiteralPath $Active -Destination $Swap }
    try { Move-Item -LiteralPath $New -Destination $Active }
    catch { Recover-Swap; throw }
    Recover-Swap
}
function Write-Marker([string]$Folder,[string]$Version) {
    [IO.File]::WriteAllText((Join-Path $Folder 'update-status.json'), ('{"version":"' + $Version + '"}'), $Utf8)
}
function Fetch([string]$Url,[string]$Path) {
    # Fixed HTTPS endpoints, no credentials or redirects; keep the old build on failure.
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $Url -UseBasicParsing -OutFile $Path -MaximumRedirection 0 -TimeoutSec 60 -UserAgent 'N360-Windows-Updater/1' -Headers @{'Cache-Control'='no-cache'}
    if ((Get-Item -LiteralPath $Path).Length -gt $Limit) { throw 'Download exceeds size limit.' }
}
function Extract-Runtime([string]$Zip,[string]$Dest,[string]$Commit) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $z = [IO.Compression.ZipFile]::OpenRead($Zip)
    try {
        $root = 'extension-Nail360-' + $Commit + '/'
        $seen = @{}; $total = [long]0; $count = 0
        [void][IO.Directory]::CreateDirectory($Dest)
        foreach ($e in $z.Entries) {
            if (!$e.FullName.StartsWith($root,[StringComparison]::Ordinal)) { continue }
            $rel = $e.FullName.Substring($root.Length)
            if ($rel -cnotmatch '\A(?:(?:icons|assets|lib|src)/(?:[A-Za-z0-9][A-Za-z0-9._-]*/)*)?[A-Za-z0-9][A-Za-z0-9._-]*\.(?:js|mjs|css|html|json|svg|png|jpg|jpeg|webp|gif|woff|woff2|ttf)\z') { continue }
            if ($rel -ieq 'update-status.json') { continue }
            foreach ($part in $rel.Split('/')) {
                if ($part.EndsWith('.') -or $part -imatch '^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)') { throw 'Unsafe Windows filename.' }
            }
            if ($seen.ContainsKey($rel)) { throw ('Duplicate runtime asset: ' + $rel) }
            $seen[$rel] = $true; $count++; $total += $e.Length
            if ($count -gt 300 -or $total -gt $Limit) { throw 'Archive exceeds runtime limit.' }
            $target = Join-Path $Dest $rel
            [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target))
            [IO.Compression.ZipFileExtensions]::ExtractToFile($e,$target,$false)
        }
    } finally { $z.Dispose() }
}
function Check-Update {
    $current = '0'
    if (Test-Path -LiteralPath $Active) { $current = Read-Manifest (Join-Path $Active 'manifest.json') }
    $head = Join-Path $Stage 'head.json'; $remote = Join-Path $Stage 'remote.json'; $zip = Join-Path $Stage 'repo.zip'; $new = Join-Path $Stage 'new'
    Fetch ('https://api.github.com/repos/' + $Repo + '/commits/main') $head
    $sha = [string](Get-Content -LiteralPath $head -Raw -Encoding UTF8 | ConvertFrom-Json).sha
    if ($sha -cnotmatch '\A[0-9a-f]{40}\z') { throw 'Invalid GitHub commit.' }
    Fetch ('https://raw.githubusercontent.com/' + $Repo + '/' + $sha + '/manifest.json') $remote
    $candidate = Read-Manifest $remote
    Log ('GitHub ' + $candidate + ' (' + $sha + '); disk ' + $current + '.')
    if ((Version-Text $candidate) -le (Version-Text $current)) { Log 'No newer version.'; return }
    if (Test-Path -LiteralPath $Hold) {
        $held = (Get-Content -LiteralPath $Hold -Raw).Trim()
        if ((Version-Text $candidate) -le (Version-Text $held)) { Log ('Held version ' + $held + '.'); return }
    }
    Fetch ('https://codeload.github.com/' + $Repo + '/zip/' + $sha) $zip
    Extract-Runtime $zip $new $sha
    $actual = Check-Assets $new
    if ($actual -cne $candidate -or (Get-FileHash -LiteralPath $remote -Algorithm SHA256).Hash -cne (Get-FileHash -LiteralPath (Join-Path $new 'manifest.json') -Algorithm SHA256).Hash) { throw 'Commit manifest mismatch. Disk kept.' }
    Write-Marker $new $actual
    Promote $new
    if (Test-Path -LiteralPath $Hold) { Remove-Item -LiteralPath $Hold -Force }
    Log ('Downloaded ' + $actual + ' (previous: ' + $current + '). Chrome reloads when idle.')
}
function Background-Action {
    # wscript.exe is a GUI host. It waits for the hidden child and returns its exit code.
    # No downloaded code is executed; the launcher is embedded and written locally.
    if (!(Test-Path -LiteralPath $InstalledScript -PathType Leaf)) { throw 'Installed updater.ps1 not found.' }
    $hostExe = Join-Path $env:SystemRoot 'System32\wscript.exe'
    $launcherPath = Join-Path $Base 'updater-launcher.js'
    if (!(Test-Path -LiteralPath $hostExe -PathType Leaf)) { throw 'Windows Script Host is unavailable. Use manual CHECK-UPDATE.cmd.' }
    $source = @'
// N360 Support: windowless local updater launcher; only the installed script.
var shell = new ActiveXObject('WScript.Shell');
var fso = new ActiveXObject('Scripting.FileSystemObject');
var base = fso.GetParentFolderName(WScript.ScriptFullName);
var power = fso.BuildPath(shell.ExpandEnvironmentStrings('%SystemRoot%'), 'System32\\WindowsPowerShell\\v1.0\\powershell.exe');
var updater = fso.BuildPath(base, 'updater.ps1');
function quote(path) {
    if (/["%\r\n]/.test(path)) throw new Error('Unsupported path characters.');
    return '"' + path + '"';
}
var rc = 1;
try {
    var probe = WScript.Arguments.length === 1 && WScript.Arguments.Item(0) === '--probe';
    if (!probe && WScript.Arguments.length !== 0) throw new Error('Unexpected launcher arguments.');
    if (!fso.FileExists(power) || !fso.FileExists(updater)) throw new Error('Installed PowerShell or updater is missing.');
    var args = probe ? ' -NoProfile -NonInteractive -Command "exit 0"' : ' -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ' + quote(updater) + ' -Mode Check';
    rc = shell.Run(quote(power) + args, 0, true);
} catch (e) {
    try {
        var log = fso.OpenTextFile(fso.BuildPath(base, 'updater.log'), 8, true);
        log.WriteLine(new Date().toUTCString() + ' N360: background launcher failed.');
        log.Close();
    } catch (ignored) {}
}
WScript.Quit(rc);
'@
    [IO.File]::WriteAllText($launcherPath,$source,$Utf8)
    $arguments = '//B //NoLogo //E:JScript "' + $launcherPath + '"'
    # Probe actual host and hidden PowerShell child; do not fetch anything or modify the task yet.
    $probe = Start-Process -FilePath $hostExe -ArgumentList ($arguments + ' --probe') -Wait -PassThru
    if ($probe.ExitCode -ne 0) { throw ('Background host probe failed: ' + $probe.ExitCode + '. Contact IT if Windows Script Host is blocked.') }
    return New-ScheduledTaskAction -Execute $hostExe -Argument $arguments -WorkingDirectory $Base
}
function Repair-Terminal {
    # Repair only the task created by this installer, preserving the user's current schedule and enabled state.
    $task = Get-ScheduledTask -TaskName $TaskName -TaskPath '\' -ErrorAction Stop
    $oldActions = @($task.Actions)
    $oldPower = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $oldArgs = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $InstalledScript + '" -Mode Check'
    $hostExe = Join-Path $env:SystemRoot 'System32\wscript.exe'
    $newArgs = '//B //NoLogo //E:JScript "' + (Join-Path $Base 'updater-launcher.js') + '"'
    if ($oldActions.Count -ne 1) { throw 'Unexpected task actions; no changes made.' }
    if (!(($oldActions[0].Execute -ieq $oldPower -and $oldActions[0].Arguments -ceq $oldArgs) -or ($oldActions[0].Execute -ieq $hostExe -and $oldActions[0].Arguments -ceq $newArgs))) { throw 'Task action is not recognized as the N360 updater; no changes made.' }
    $beforeEnabled = [bool]$task.Settings.Enabled
    if ($task.State -eq 'Running') { throw 'Updater is currently running. Close this repair and retry after the current check finishes.' }
    $backup = Join-Path $Base ('task-before-terminal-fix-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.xml')
    Export-ScheduledTask -TaskName $TaskName -TaskPath '\' | Set-Content -LiteralPath $backup -Encoding Unicode
    $action = Background-Action
    Set-ScheduledTask -TaskName $TaskName -TaskPath '\' -Action $action -ErrorAction Stop | Out-Null
    $verified = Get-ScheduledTask -TaskName $TaskName -TaskPath '\' -ErrorAction Stop
    if (@($verified.Actions).Count -ne 1 -or $verified.Actions[0].Execute -ine $action.Execute -or $verified.Actions[0].Arguments -cne $action.Arguments -or [bool]$verified.Settings.Enabled -ne $beforeEnabled) {
        Set-ScheduledTask -TaskName $TaskName -TaskPath '\' -Action $oldActions -ErrorAction Stop | Out-Null
        throw 'Task verification failed; previous action restored.'
    }
    Log ('Terminal fix applied. Task state: ' + $verified.State + '. Existing schedule and enabled state retained.')
    Log ('Previous task definition saved: ' + $backup)
    Log 'No Chrome files or history changed. Use STATUS.cmd to verify the next scheduled result (0 means success).'
}
function Register-Agent {
    # Same current-user, five-minute task; a windowless host starts the local updater.
    $action = Background-Action
    $power = $action.Execute
    $taskArgs = $action.Arguments
    $sid = $Identity.User.Value
    $start = (Get-Date).AddMinutes(1).ToString('yyyy-MM-ddTHH:mm:ss')
    $cmd = [Security.SecurityElement]::Escape($power)
    $argXml = [Security.SecurityElement]::Escape($taskArgs)
    $dirXml = [Security.SecurityElement]::Escape($Base)
    $xml = @"
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>N360 Support: check trusted GitHub runtime updates every five minutes.</Description></RegistrationInfo>
  <Triggers><TimeTrigger><Repetition><Interval>PT5M</Interval></Repetition><StartBoundary>$start</StartBoundary><Enabled>true</Enabled></TimeTrigger></Triggers>
  <Principals><Principal id="Author"><UserId>$sid</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><StartWhenAvailable>true</StartWhenAvailable><Enabled>true</Enabled><ExecutionTimeLimit>PT5M</ExecutionTimeLimit></Settings>
  <Actions Context="Author"><Exec><Command>$cmd</Command><Arguments>$argXml</Arguments><WorkingDirectory>$dirXml</WorkingDirectory></Exec></Actions>
</Task>
"@
    Register-ScheduledTask -TaskName $TaskName -Xml $xml -Force -ErrorAction Stop | Out-Null
    if (!(Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop)) { throw 'Task registration could not be verified.' }
    Log 'Auto updater registered (every five minutes; no console window).'
}
function Install-N360 {
    if (!(Test-Path -LiteralPath $Active)) {
        $seed = Join-Path $PSScriptRoot 'runtime.zip'
        if (Test-Path -LiteralPath $seed) {
            if ((Get-FileHash -LiteralPath $seed -Algorithm SHA256).Hash -ine $SeedHash) { throw 'Bundled runtime checksum mismatch.' }
            $new = Join-Path $Stage 'new'
            Extract-Runtime $seed $new $SeedCommit
            $v = Check-Assets $new
            if ($v -cne '2.0.0') { throw 'Unexpected bundled runtime version.' }
            Write-Marker $new $v
            Promote $new
            Log ('Installed bundled v' + $v + ' offline.')
        } else { Check-Update }
    }
    $v = Check-Assets $Active
    if ($PSCommandPath -ine $InstalledScript) { Copy-Item -LiteralPath $PSCommandPath -Destination $InstalledScript -Force }
    $registered = $true
    try { Register-Agent } catch { $registered = $false; Log ('AUTO UPDATE NOT ENABLED: ' + $_.Exception.Message + '. Extension is installed; use CHECK-UPDATE.cmd manually. Contact IT if policy blocks tasks.') }
    Log ('Extension v' + $v + ' folder: ' + $Active)
    Log 'In Chrome, open chrome://extensions, enable Developer mode and Load unpacked from the folder above. Do not remove an existing copy loaded from that folder.'
    Start-Process explorer.exe -ArgumentList ('"' + $Active + '"')
    if (!$registered) { throw 'Installation completed, but scheduled task registration failed.' }
}
function Rollback-N360 {
    if (!(Test-Path -LiteralPath $Previous) -or !(Test-Path -LiteralPath $Active)) { throw 'No previous build available.' }
    $current = Read-Manifest (Join-Path $Active 'manifest.json')
    $prev = Check-Assets $Previous
    $held = $current
    if (Test-Path -LiteralPath $Hold) { $old = (Get-Content -LiteralPath $Hold -Raw).Trim(); if ((Version-Text $old) -gt (Version-Text $held)) { $held = $old } }
    $new = Join-Path $Stage 'new'
    Copy-Item -LiteralPath $Previous -Destination $new -Recurse
    Write-Marker $new $prev
    [IO.File]::WriteAllText($Hold,$held,$Utf8)
    Promote $new
    Log ('Restored ' + $prev + '; held through ' + $held + '. Reload the extension manually.')
}
try {
    if ($env:OS -ne 'Windows_NT') { throw 'This installer requires Windows.' }
    [void][IO.Directory]::CreateDirectory($Base)
    if ($Mode -eq 'Repair') { Repair-Terminal; exit 0 }
    if ($Mode -eq 'Status') {
        if (Test-Path -LiteralPath $Active) { Log ('Disk version: ' + (Read-Manifest (Join-Path $Active 'manifest.json'))) } else { Log 'Extension is not installed.' }
        $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($task) { $task | Get-ScheduledTaskInfo | Format-List LastRunTime,LastTaskResult,NextRunTime; Log ('Task state: ' + $task.State) } else { Log 'Scheduled task not found.' }
        exit 0
    }
    if ($Mode -eq 'Stop') {
        $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($task) { Disable-ScheduledTask -TaskName $TaskName | Out-Null }
        Log 'Auto updater disabled. Extension and history kept.'; exit 0
    }
    try { $LockStream = [IO.File]::Open((Join-Path $Base 'update.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None) }
    catch { throw 'Another updater is running or the update folder is unavailable.' }
    Recover-Swap
    $Stage = Join-Path $Base ('.stage-' + [guid]::NewGuid().ToString('N'))
    [void][IO.Directory]::CreateDirectory($Stage)
    switch ($Mode) {
        'Install' { Install-N360 }
        'Check' { Check-Update }
        'Rollback' { Rollback-N360 }
    }
} catch {
    Log ('ERROR: ' + $_.Exception.Message)
    exit 1
} finally {
    if ($Stage -and (Test-Path -LiteralPath $Stage)) { Remove-Item -LiteralPath $Stage -Recurse -Force -ErrorAction SilentlyContinue }
    if ($LockStream) { $LockStream.Dispose() }
}
