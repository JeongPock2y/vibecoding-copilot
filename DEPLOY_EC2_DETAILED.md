## EC2 배포 시나리오 (상세)

이 문서는 로컬에서 만든 Flask 앱을 AWS EC2에 안정적으로 배포하는 단계별 시나리오입니다. Ubuntu 22.04/24.04 기준으로 작성했습니다.

요약 아키텍처
- 클라이언트(모바일 브라우저) → Nginx(리버스 프록시, HTTPS) → Gunicorn → Flask 앱 → SQLite (로컬 파일) 또는 RDS

사전 준비
- AWS 계정
- SSH 키 페어
- EC2 인스턴스(권장: t3.small 이상)
- 도메인(HTTPS를 적용하려면 필요)

1) EC2 인스턴스 생성
- AMI: Ubuntu Server 22.04/24.04
- 인스턴스 유형: t3.micro (테스트) 또는 t3.small
- 스토리지: 8GB 이상
- 보안 그룹: SSH(22), HTTP(80), HTTPS(443) 허용(인바운드)

2) SSH 접속 및 시스템 준비
```bash
# 로컬에서
chmod 600 mykey.pem
ssh -i mykey.pem ubuntu@<EC2_PUBLIC_IP>

# 서버에서
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nginx certbot python3-venv python3-pip
```

3) 애플리케이션 코드 배치
```bash
# 홈디렉토리로 이동
cd /home/ubuntu
git clone https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git app
cd app

# (선택) 앱 소유자 변경
sudo chown -R ubuntu:ubuntu /home/ubuntu/app
```

4) 가상환경 및 패키지 설치
```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

5) 시스템 환경 변수 설정 (선택)
- 프로덕션에서 `SECRET_KEY` 등 민감 값은 환경변수로 설정하세요.
```bash
export FLASK_ENV=production
export SECRET_KEY='your-secret'
```

6) 애플리케이션 서비스화 (systemd)
- 시스템 재부팅 후 자동 시작을 위해 `systemd` 서비스파일을 생성합니다.

`/etc/systemd/system/todo.service`:
```ini
[Unit]
Description=Todo Flask App
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/home/ubuntu/app
Environment="PATH=/home/ubuntu/app/venv/bin"
Environment="FLASK_ENV=production"
ExecStart=/home/ubuntu/app/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:8000 app:app

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now todo.service
sudo systemctl status todo.service
```

7) Nginx 리버스 프록시 설정
`/etc/nginx/sites-available/todo` 생성:
```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/todo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

8) HTTPS (Let's Encrypt)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d www.example.com
```

9) 포트 및 보안 확인
- 보안 그룹에서 80, 443 포트가 열려있는지 확인
- `sudo ufw allow 'Nginx Full'` 등의 방화벽 규칙 추가 가능

10) 로그 및 모니터링
- systemd: `sudo journalctl -u todo.service -f`
- nginx: `/var/log/nginx/access.log` `/var/log/nginx/error.log`

팁과 주의사항
- SQLite는 파일 기반이므로 여러 워커, 여러 인스턴스에서 동시 쓰기가 발생하면 문제 생길 수 있습니다. 트래픽이나 동시성 증가 시 RDS(Postgres/MySQL)로 마이그레이션 권장.
- 비밀값은 환경변수 또는 AWS Secrets Manager에 보관하세요.
- 자동 배포: GitHub Actions -> SSH/EC2 배포 또는 CodeDeploy, Elastic Beanstalk 고려

문제가 발생하면 관련 로그(`systemctl`, `gunicorn` 로그, `nginx` 로그)를 확인하고, 오류 메시지를 복사해서 여기에 붙여주세요.
