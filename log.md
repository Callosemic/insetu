⚙️  inSetu Service Telemetry:
   ├─ Anchored Directory: /home/jrnguyen/projects/axoneme
   ├─ Configured Port: 5005
   └─ Access URL: http://127.0.0.1:5005

● insetu.service - inSetu Developer OS
     Loaded: loaded (/home/jrnguyen/.config/systemd/user/insetu.service; enabled; preset: enabled)
     Active: active (running) since Thu 2026-09-03 12:01:13 PDT; 10h ago
   Main PID: 934050 (insetu)
      Tasks: 23 (limit: 3295)
     Memory: 687.6M (peak: 874.7M swap: 24.9M swap peak: 42.9M)
        CPU: 44min 48.396s
     CGroup: /user.slice/user-1000.slice/user@1000.service/app.slice/insetu.service
             ├─ 934050 /home/jrnguyen/projects/axoneme/axoneme-cli/.venv/bin/python3 /home/jrnguyen/projects/axoneme/axoneme-cli/.venv/bin/insetu serve
             ├─1150553 /home/jrnguyen/projects/axoneme/axoneme-cli/.venv/bin/python3 /home/jrnguyen/projects/axoneme/axoneme-cli/.venv/bin/insetu serve
             ├─1152750 bash -l
             ├─1152784 /home/jrnguyen/.local/share/pipx/venvs/insetu/bin/python /home/jrnguyen/.local/bin/insetu service status
             └─1152785 systemctl --user status insetu.service

Sep 03 22:29:52 Gookcentre insetu[1150553]: 127.0.0.1 - - [03/Sep/2026 22:29:52] "GET /api/default/system/deltas?since=1788499789.6220493 HTTP/1.1" 200 -
Sep 03 22:29:52 Gookcentre insetu[1150553]: 127.0.0.1 - - [03/Sep/2026 22:29:52] "GET /api/default/system/deltas?since=1788499789.6889544 HTTP/1.1" 200 -
Sep 03 22:29:55 Gookcentre insetu[1150553]: 127.0.0.1 - - [03/Sep/2026 22:29:55] "GET /api/default/system/deltas?since=1788499792.6427476 HTTP/1.1" 200 -
Sep 03 22:29:55 Gookcentre insetu[1150553]: 127.0.0.1 - - [03/Sep/2026 22:29:55] "GET /api/default/system/deltas?since=1788499792.755112 HTTP/1.1" 200 -
Sep 03 22:29:58 Gookcentre insetu[1150553]: 127.0.0.1 - - [03/Sep/2026 22:29:58] "GET /api/default/system/deltas?since=1788499795.6726055 HTTP/1.1" 200 -
Sep 03 22:29:58 Gookcentre insetu[1150553]: 127.0.0.1 - - [03/Sep/2026 22:29:58] "GET /api/default/system/deltas?since=1788499795.8044417 HTTP/1.1" 200 -
Sep 03 22:30:01 Gookcentre insetu[1150553]: 127.0.0.1 - - [03/Sep/2026 22:30:01] "GET /api/default/system/deltas?since=1788499798.693545 HTTP/1.1" 200 -
Sep 03 22:30:01 Gookcentre insetu[1150553]: 127.0.0.1 - - [03/Sep/2026 22:30:01] "GET /api/default/system/deltas?since=1788499798.8679564 HTTP/1.1" 200 -
Sep 03 22:30:04 Gookcentre insetu[1150553]: 127.0.0.1 - - [03/Sep/2026 22:30:04] "GET /api/default/system/deltas?since=1788499801.709732 HTTP/1.1" 200 -
Sep 03 22:30:04 Gookcentre insetu[1150553]: 127.0.0.1 - - [03/Sep/2026 22:30:04] "GET /api/default/system/deltas?since=1788499801.9232008 HTTP/1.1" 200 -
