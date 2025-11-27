# AWS EC2 배포 가이드 (Ubuntu 기준)

아래 지침은 로컬에서 만든 Flask 앱을 EC2 인스턴스에 배포하는 단계별 안내입니다.

1) EC2 인스턴스 생성
- AWS 콘솔에서 `EC2` → `인스턴스 시작` → Ubuntu Server (예: 22.04) 선택
- 인스턴스 유형: `t3.micro` 등으로 시작
- 보안 그룹: 포트 `22`(SSH), `80`(HTTP) 또는 `5000`(개발용)을 허용

2) SSH 접속
```bash
chmod 600 mykey.pem
ssh -i mykey.pem ubuntu@<EC2_PUBLIC_IP>
```

3) 시스템 준비, Git 및 Python 설치
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-pip git
```

4) 소스 코드 가져오기
```bash
git clone <YOUR_REPO_URL> app
cd app
```

5) 가상환경 생성 및 패키지 설치
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

6) DB 초기화
- 서버 시작 전에 `app.py`가 첫 요청 시 DB를 초기화합니다. (자동 생성)

7) 서비스로 실행 (간단한 방법: gunicorn + systemd)

예: `gunicorn`으로 WSGI 실행
```bash
gunicorn --bind 0.0.0.0:8000 app:app
```

systemd 서비스 예시 (`/etc/systemd/system/todo.service`)
```ini
[Unit]
Description=Todo Flask App
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/app
Environment="PATH=/home/ubuntu/app/venv/bin"
ExecStart=/home/ubuntu/app/venv/bin/gunicorn --workers 3 --bind 0.0.0.0:8000 app:app

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now todo.service
sudo journalctl -u todo.service -f
```

8) (선택) Nginx 리버스 프록시
- 보안(HTTPS)와 포트 80 연결을 위해 Nginx 앞단을 사용하는 것을 권장합니다. Certbot을 이용한 HTTPS 적용 권장.

추가 팁
- `todos.db`는 파일 기반 SQLite 입니다. 트래픽이 늘면 RDS나 다른 DB로 이전 고려
- EC2 보안 그룹과 서버 방화벽(ufw)을 확인하여 포트가 열려 있는지 확인
