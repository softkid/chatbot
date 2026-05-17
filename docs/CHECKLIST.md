# Implementation Checklist
## 🌌 Multi-Tenant Domain-Specific AI Chatbot System (Agentumi Engine)

---

### 1. Database Setup (Supabase) 🗄️
- [ ] Supabase 새 프로젝트 또는 기존 프로젝트 접속 및 SQL Editor 열기
- [ ] `docs/setup.sql` 쿼리를 실행하여 `chatbot_configs`, `chatbot_sessions`, `chatbot_messages` 테이블 및 인덱스 생성
- [ ] Row Level Security (RLS) 정책 추가 (익명 클라이언트의 읽기/쓰기 권한 및 데이터 보안 보장)
- [ ] 테스트용 도메인 설정 샘플 데이터 삽입 (`ai-edu`, `ha-politics` 등 2개 이상)

---

### 2. Backend API Development (Cloudflare Workers & Hono) ⚡
- [ ] `backend` 디렉토리 초기화 및 의존성 모듈 설치 (`hono`, `@supabase/supabase-js`)
- [ ] `backend/src/index.js` 구현:
  - [ ] 도메인 동적 CORS 및 CORS 안전 처리
  - [ ] GET 갱신 요청을 제외한 POST 쓰기 요청에만 적용되는 IP 기반 처리 레이트 리밋 미들웨어
  - [ ] 오류 로깅 및 글로벌 에러 핸들러 추가
- [ ] `backend/src/modules/llm.js` 구현:
  - [ ] Gemini 2.5 Flash API 다이렉트 호출 연동
  - [ ] `chatbot_configs`에 지정된 `system_prompt`를 동적으로 시스템 프롬프트로 병합
- [ ] `backend/src/modules/telegram-widget.js` 구현:
  - [ ] `siteKey` 값을 기반으로 데이터베이스에서 타이틀, 디자인 테마 색상, 퀵 질문 버튼, 웰컴 안내문을 동적으로 조회
  - [ ] 챗봇 UI 돔 구조와 CSS를 실시간 조합하여 하나의 번들로 만드는 동적 스크립트 렌더러 기능
  - [ ] 열림 시 **'X' (닫기) 아이콘으로의 90도 회전 모션 전환 효과** 내장
- [ ] `backend/src/routes/telegram.js` 구현:
  - [ ] `GET /widget.js` — 임베딩용 동적 스크립트 출력 엔드포인트
  - [ ] `POST /send` — 사용자가 질문 전송 시 AI 응답 생성 및 텔레그램 개인 알림 연동
  - [ ] `GET /messages` — 브라우저 폴링용 메시지 목록 조회 엔드포인트
  - [ ] `POST /webhook` — 텔레그램 운영자 답장 수집용 단일 웹훅 핸들러
  - [ ] `GET /set-webhook` — 텔레그램 웹훅 자동 동기화용 유틸리티 라우트
  - [ ] `GET /debug-env` — 환경 변수 및 바인딩 실시간 안전 진단 라우트

---

### 3. Frontend Landing Page & Examples (`chat.globalbusan.xyz`) 🌐
- [ ] `frontend/index.html` 구현:
  - [ ] 프리미엄 디자인(다크 모드, 네온 그래디언트, 글래스모피즘)이 가미된 챗봇 솔루션 소개/랜딩 페이지
  - [ ] 실시간 데모 위젯을 우측 하단에 삽입하여 직접 테스트 가능하게 구성
- [ ] `frontend/example.html` 구현:
  - [ ] 각기 다른 `siteKey`를 사용해 서로 다른 디자인/AI 프롬프트를 보여주는 다중 연동 검증 페이지
- [ ] `frontend/wrangler.toml` 작성 및 Cloudflare Pages 배포 설정 완료

---

### 4. Integration & Security Configuration (Cloudflare Secrets) 🔒
- [ ] wrangler CLI를 통해 배포 환경에 핵심 Secrets 바인딩:
  - [ ] `SUPABASE_URL` / `SUPABASE_KEY` (서비스 전용 / Anon 겸용)
  - [ ] `GEMINI_API_KEY` (구글 인공지능 API 키)
- [ ] 백엔드 `npm run deploy` 실행 및 정상 배포 완료 확인
- [ ] `/api/telegram/set-webhook` 엔드포인트를 한 번 실행하여 텔레그램 웹훅을 Workers와 자동 동기화

---

### 5. Final UAT & QA Verification Checklist 🧪
- [ ] **멀티 테넌트 검증**: 서로 다른 `data-site-key` 값을 가졌을 때 알맞은 타이틀과 테마 색상으로 챗봇이 켜지는지 확인
- [ ] **닫기 아이콘 회전 모션**: 창 열림 시 버튼이 90도 회전하며 'X' 아이콘으로 부드럽게 바뀌는지 확인
- [ ] **AI 자동 답변**: Gemini 2.5 Flash가 도메인별 성격 프롬프트를 정확히 기억하고 알맞은 도메인 언어로 답변하는지 확인
- [ ] **운영자 실시간 답장**: 웹 챗봇에서 보낸 글이 텔레그램에 수신되고, 텔레그램 `답장(Reply)` 발신 시 챗봇 브라우저 창에 실시간 동기화되는지 확인
