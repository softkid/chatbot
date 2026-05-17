# 🌌 Multi-Tenant Domain-Specific AI Chatbot System (Agentumi Engine)

이 프로젝트는 단일 백엔드(Cloudflare Workers)와 데이터베이스(Supabase)를 통해 여러 개의 개별 도메인(웹사이트)에 독립된 디자인 테마, 맞춤 AI 프롬프트, 그리고 개별 텔레그램 알림/답장 라우팅을 가능하게 하는 **멀티테넌트 AI 챗봇 솔루션**입니다.

---

## 🏗️ 전체 시스템 구조 및 디렉토리
```text
_z_chatbot/
├── docs/
│   ├── PRD.md            # 제품 기획 및 설계 문서 (상세 아키텍처)
│   ├── CHECKLIST.md      # 세부 구현 체크리스트
│   └── setup.sql         # Supabase 테이블 및 RLS 보안 스키마
├── backend/
│   ├── src/
│   │   ├── index.js      # Hono 메인 엔트리 및 동적 CORS 처리
│   │   ├── routes/
│   │   │   └── telegram.js # 챗봇 API, 텔레그램 웹훅, 동적 스크립트 서빙
│   │   └── modules/
│   │       ├── llm.js    # Google Gemini 2.5 Flash API 연동
│   │       └── telegram-widget.js # Shadow DOM 기반 동적 챗봇 위젯
│   ├── package.json
│   └── wrangler.toml     # Workers 배포 환경 설정
├── frontend/
│   ├── index.html        # chat.globalbusan.xyz 공식 랜딩 페이지
│   ├── example.html      # 멀티테넌트 연동 다중 검증 데모 페이지
│   └── wrangler.toml     # Pages 배포 환경 설정
└── .gitignore            # Git 관리 예외 설정
```

---

## 🚀 1단계: Supabase 데이터베이스 설정 (SQL 실행)

제공해주신 프로젝트(`jgueqnywthkjledvqqrm`)에 테이블을 구축합니다.

1. [Supabase 대시보드](https://supabase.com)에 로그인하고 해당 프로젝트를 선택합니다.
2. 왼쪽 메뉴의 **`SQL Editor`**에 들어갑니다.
3. [setup.sql](file:///d:/_z_chatbot/docs/setup.sql) 파일의 쿼리 내용을 전체 복사하여 실행(`Run`)합니다.
   * `chatbot_configs` (도메인별 개별 설정 테이블)가 생성되고, 테스트용 샘플 세팅(`ai-edu`, `hub-invest`) 2개가 자동으로 채워집니다.
   * `chatbot_sessions` 및 `chatbot_messages` 테이블과 인덱스가 완벽히 세팅됩니다.
   * RLS 보안 정책이 설정되어 프론트엔드와 텔레그램 통신을 안전하게 수행합니다.

---

## ⚡ 2단계: 백엔드 배포 및 Secrets 설정 (Cloudflare Workers)

### 1) 의존성 설치 및 로컬 테스트
터미널을 열고 `backend` 디렉토리로 이동하여 의존성을 설치합니다.
```bash
cd d:\_z_chatbot\backend
npm install
```

### 2) Cloudflare Secrets 등록 (매우 중요)
보안을 위해 데이터베이스 접속 정보와 API Key를 환경 변수가 아닌 **Workers Secrets**로 저장합니다. 아래 명령을 순서대로 실행하고 프롬프트가 나타나면 해당 값을 입력합니다.

```bash
# 1. Supabase 접속 URL 등록
npx wrangler secret put SUPABASE_URL
# 입력값: https://jgueqnywthkjledvqqrm.supabase.co

# 2. Supabase Anon Key 등록
npx wrangler secret put SUPABASE_KEY
# 입력값: sb_publishable_n-LpvYGkVOQD9UiSph1Euw_9KotY20k

# 3. Google Gemini 2.5 Flash API Key 등록
npx wrangler secret put GEMINI_API_KEY
# 입력값: [본인의 구글 Gemini API Key 입력]

# 4. 공용 폴백 텔레그램 봇 토큰 등록 (선택사항 - 각 도메인 설정이 없을 때 사용)
npx wrangler secret put TELEGRAM_BOT_TOKEN
# 입력값: [본인의 텔레그램 봇 토큰]

# 5. 공용 폴백 텔레그램 수신 Chat ID 등록 (선택사항 - 각 도메인 설정이 없을 때 사용)
npx wrangler secret put TELEGRAM_CHAT_ID
# 입력값: [본인의 텔레그램 Chat ID]
```

### 3) 백엔드 최종 배포
```bash
npx wrangler deploy
```
* 성공적으로 완료되면 `https://agentumi-chatbot-backend.[도메인].workers.dev` 형태의 배포 URL이 발급됩니다.

---

## 🌐 3단계: 텔레그램 웹훅(Webhook) 동기화

텔레그램 운영자 답장 기능(Reply)이 즉시 연동되도록 Workers 주소와 웹훅을 동기화합니다.
1. 웹 브라우저를 열고 아래 URL 주소로 접속합니다 (배포 주소로 변경하여 접속).
   ```text
   https://[본인의-Workers-배포-주소]/api/telegram/set-webhook?siteKey=hub-invest
   ```
2. 화면에 `{"success":true,"webhookUrl":"...","telegramResponse":{"ok":true,...}}` 응답이 나오면 양방향 연동 통신이 수립된 것입니다.

---

## 🖥️ 4단계: 소개 페이지 배포 (`chat.globalbusan.xyz` - Cloudflare Pages)

1. 터미널을 열고 `frontend` 디렉토리로 이동합니다.
2. 아래 명령어를 실행하여 Cloudflare Pages에 바로 배포합니다.
   ```bash
   cd d:\_z_chatbot\frontend
   npx wrangler pages deploy . --project-name=agentumi-chatbot-frontend
   ```
3. Cloudflare 대시보드에서 `chat.globalbusan.xyz` 도메인을 이 Pages 프로젝트에 할당해 주시면 소개/랜딩 페이지 세팅이 완료됩니다.

---

## 🧩 5단계: 프론트엔드 사이트 적용 방법 (Embedding)

원하시는 사이트의 HTML 코드 내 `</body>` 태그 바로 직전에 아래의 스크립트 중 하나를 골라 복사해서 붙여넣기만 하시면 즉시 최적화된 챗봇이 우측 하단에 실행됩니다!

### A. 교육 사이트 테넌트 (`ai-edu` - 파란색 테마, 교육 특화 AI 성격)
```html
<script src="https://[본인의-Workers-배포-주소]/api/telegram/widget.js?siteKey=ai-edu" async></script>
```

### B. 글로벌 투자/비즈니스 테넌트 (`hub-invest` - 에메랄드 테마, 격식 있는 투자 AI 성격)
```html
<script src="https://[본인의-Workers-배포-주소]/api/telegram/widget.js?siteKey=hub-invest" async></script>
```

---

## 🐙 6단계: GitHub 저장소 연동 및 소스 업로드

제공해주신 저장소(`https://github.com/softkid/chatbot.git`)로 프로젝트를 업로드합니다.
`d:\_z_chatbot` 디렉토리에서 Git 명령어를 한 차례씩 실행해 주세요.

```bash
cd d:\_z_chatbot
git init
git remote add origin https://github.com/softkid/chatbot.git
git add .
git commit -m "feat: 멀티테넌트 도메인별 독립 챗봇 엔진 최초 릴리즈"
git branch -M main
git push -u origin main
```
