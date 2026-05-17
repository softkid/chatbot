-- 🌌 Multi-Tenant AI Chatbot System (Agentumi Engine) Setup Schema
-- 이 스키마는 각 도메인별 챗봇 독립 세팅, 대화 기록 저장, 그리고 Row Level Security(RLS) 보안 정책을 일괄 수립합니다.

-- ==========================================
-- 1. 테이블 생성 (Tables Definition)
-- ==========================================

-- A. 도메인별 개별 설정 테이블
CREATE TABLE IF NOT EXISTS chatbot_configs (
  id SERIAL PRIMARY KEY,
  site_key VARCHAR(100) UNIQUE NOT NULL, -- 도메인을 구별하는 고유 키 (예: 'ai-edu', 'hub-invest')
  site_domain VARCHAR(255) NOT NULL, -- 서비스 도메인 주소 (예: 'ai.globalbusan.xyz')
  bot_title VARCHAR(100) NOT NULL DEFAULT '💬 AI 상담 센터',
  welcome_message TEXT NOT NULL, -- 첫 입장 시 나타날 AI 환영 카드 (HTML 형식 지원)
  system_prompt TEXT NOT NULL, -- Gemini AI용 전용 시스템 프롬프트(성격, 규정 등)
  quick_questions TEXT[] DEFAULT '{}', -- 빠른 선택 질문들
  telegram_bot_token VARCHAR(255), -- 도메인 전용 텔레그램 봇 토큰 (비워둘 시 기본값 백엔드 공용 사용)
  telegram_chat_id VARCHAR(100), -- 도메인 전용 텔레그램 수신 Chat ID (비워둘 시 기본값 백엔드 공용 사용)
  theme_color VARCHAR(20) DEFAULT '#00b894', -- 챗봇 브랜딩 메인 컬러
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- B. 대화 세션 테이블
CREATE TABLE IF NOT EXISTS chatbot_sessions (
  id VARCHAR(100) PRIMARY KEY, -- 브라우저 생성 로컬 세션 키
  site_key VARCHAR(100) REFERENCES chatbot_configs(site_key) ON DELETE CASCADE,
  telegram_message_id BIGINT, -- 텔레그램 연동 메시지 식별용 ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- C. 대화 메시지 로그 테이블
CREATE TABLE IF NOT EXISTS chatbot_messages (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) REFERENCES chatbot_sessions(id) ON DELETE CASCADE,
  sender VARCHAR(20) NOT NULL CHECK (sender IN ('user', 'bot', 'admin')),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 2. 인덱스 생성 (Indexes for High-Performance Queries)
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_chatbot_configs_site_key ON chatbot_configs(site_key);
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_site_key ON chatbot_sessions(site_key);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_session_id ON chatbot_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_created_at ON chatbot_messages(created_at);

-- ==========================================
-- 3. Row Level Security (RLS) 및 보안 정책 적용
-- ==========================================
ALTER TABLE chatbot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_messages ENABLE ROW LEVEL SECURITY;

-- A. chatbot_configs 정책 (누구나 설정은 읽을 수 있게 하고, 관리는 인증된 백엔드만 수행)
CREATE POLICY "Allow public select on chatbot_configs" ON chatbot_configs
    FOR SELECT USING (true);

CREATE POLICY "Allow all on chatbot_configs for authenticated" ON chatbot_configs
    FOR ALL USING (auth.role() = 'authenticated');

-- B. chatbot_sessions 정책 (누구나 세션을 생성하고 조회할 수 있게 허용)
CREATE POLICY "Allow public select on chatbot_sessions" ON chatbot_sessions
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert on chatbot_sessions" ON chatbot_sessions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on chatbot_sessions" ON chatbot_sessions
    FOR UPDATE USING (true);

-- C. chatbot_messages 정책 (누구나 메시지를 기록하고 조회할 수 있게 허용)
CREATE POLICY "Allow public select on chatbot_messages" ON chatbot_messages
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert on chatbot_messages" ON chatbot_messages
    FOR INSERT WITH CHECK (true);

-- ==========================================
-- 4. 트리거 설정 (자동 업데이트 갱신 시간 처리)
-- ==========================================
CREATE OR REPLACE FUNCTION update_chatbot_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chatbot_configs_updated_at
    BEFORE UPDATE ON chatbot_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_chatbot_updated_at_column();

-- ==========================================
-- 5. 실전 테스트용 샘플 세팅 시드 데이터 주입
-- ==========================================

-- A. [교육용 AI 챗봇] (ai.globalbusan.xyz 전용)
INSERT INTO chatbot_configs (
  site_key, 
  site_domain, 
  bot_title, 
  welcome_message, 
  system_prompt, 
  quick_questions, 
  theme_color
) VALUES (
  'ai-edu',
  'ai.globalbusan.xyz',
  '🎓 BUSAN AI 교육 문의',
  '안녕하세요! 부산 AI 교육 플랫폼의 공식 AI 어시스턴트입니다.<br>최신 AI 아카데미 교육 과정, 주간 챌린지, 그리고 무료 설명회 일정 등 궁금하신 점을 물어보시면 즉각 답변 드립니다!<br><br>💡 <b>추천 질문 목록</b><br>• AI 기초 입문 과정은 언제 열리나요?<br>• 주간 코딩 챌린지에 참여하려면 어떻게 하나요?<br>• 설명회 환불 규정을 알고 싶어요.',
  '당신은 부산 AI 교육 플랫폼(ai.globalbusan.xyz)의 교육 컨설팅 전문가인 AI 어시스턴트입니다. 학생, 이직을 희망하는 개발자, 예비 창업자를 대상으로 상세히 안내합니다. 교육비, 일정 등에 대한 안내 시 항상 정중하고 희망찬 태도를 취하며, 필요시 상세 정보를 위해 "상세 상담을 원하시면 고객센터에 글을 접수하겠습니다"라고 대답해 운영자 연결을 돕습니다.',
  ARRAY['AI 아카데미 교육과정 안내', '이번 주 무료 설명회 일정', '코딩 챌린지 및 혜택'],
  '#0984e3'
) ON CONFLICT (site_key) DO NOTHING;

-- B. [투자 및 사업개발 챗봇] (globalbusan.xyz 전용)
INSERT INTO chatbot_configs (
  site_key, 
  site_domain, 
  bot_title, 
  welcome_message, 
  system_prompt, 
  quick_questions, 
  theme_color
) VALUES (
  'hub-invest',
  'globalbusan.xyz',
  '💼 글로벌 비즈니스 투자 안내',
  '반갑습니다. Global BUSAN 투자 및 사업개발 통합 허브의 AI 어시스턴트입니다.<br>글로벌 파트너십 구축, 국내외 신규 프로젝트 등록 절차 및 투자 프로세스 등 전문적인 지원을 실시간 제공합니다.<br><br>💡 <b>추천 질문 목록</b><br>• 투자 파트너십 제안 절차는 어떻게 되나요?<br>• 현재 진행 중인 투자 유치 프로젝트 목록을 보여주세요.<br>• 글로벌 비즈니스 개발 등록 비용은 얼마인가요?',
  '당신은 글로벌 부산 비즈니스 허브(globalbusan.xyz)의 공식 비즈니스 디렉터 AI 어시스턴트입니다. 국내외 전문 투자가 및 창업자들의 파트너십 협상, 자본 유치, 프로젝트 인가 신청 등을 격조 있고 격식 있는 정중한 태도로 설명합니다. 질문이 법무적 검토나 전문 협상이 필요하다면 반드시 "비즈니스 담당자가 확인 후 수동으로 추가 답변을 전송할 수 있도록 즉시 접수 완료하겠습니다"라고 기재해 텔레그램 연동이 자연스럽게 유도되도록 유도합니다.',
  ARRAY['비즈니스 파트너십 등록 절차', '투자 프로젝트 목록 조회', '프로젝트 심사 조건 안내'],
  '#00b894'
) ON CONFLICT (site_key) DO NOTHING;
