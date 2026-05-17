export function renderWidgetScript(config) {
  const theme = config.theme_color || '#00b894';
  const title = config.bot_title || '💬 AI 상담 센터';
  const welcome = config.welcome_message || '안녕하세요. 무엇을 도와드릴까요?';
  const siteKey = config.site_key;
  
  // Format quick questions array into HTML buttons
  let quickButtonsHtml = '';
  if (config.quick_questions && config.quick_questions.length > 0) {
    quickButtonsHtml = config.quick_questions.map(q => 
      `<button class="floating-q-btn" onclick="this.getRootNode().host.dispatchEvent(new CustomEvent('send-quick', {detail: '${q}'}))">⚡ ${q}</button>`
    ).join('');
  }

  return `
(function() {
  if (window.AgentumiChatbotInitialized) return;
  window.AgentumiChatbotInitialized = true;

  // 1. Detect dynamic server backend URL from script src
  const scriptTag = document.currentScript || document.querySelector('script[src*="/widget.js"]');
  const backendUrl = scriptTag ? new URL(scriptTag.src).origin : 'https://chat.globalbusan.xyz';

  // 2. Initialize browser session
  let sessionId = localStorage.getItem('agentumi_session_${siteKey}');
  if (!sessionId) {
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('agentumi_session_${siteKey}', sessionId);
  }

  // 3. Create Widget Host Element
  const container = document.createElement('div');
  container.id = 'agentumi-chatbot-root';
  document.body.appendChild(container);

  // 4. Attach Shadow DOM (prevents parent style bleeding)
  const shadow = container.attachShadow({ mode: 'open' });

  // 5. Inject Premium Styles
  const styles = document.createElement('style');
  styles.textContent = \`
    :host {
      --primary: ${theme};
      --primary-dark: ${theme}e0;
      --bg: #ffffff;
      --bg-secondary: #f5f6fa;
      --text: #2f3640;
      --text-secondary: #7f8fa6;
      --border: #dcdde1;
      --shadow: rgba(0, 0, 0, 0.15);
      
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    @media (prefers-color-scheme: dark) {
      :host {
        --bg: #1e272e;
        --bg-secondary: #2f3640;
        --text: #f5f6fa;
        --text-secondary: #9c88ff;
        --border: #3d3d3d;
        --shadow: rgba(0, 0, 0, 0.4);
      }
    }

    /* Floating Toggle Button */
    .widget-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      border: none;
      box-shadow: 0 4px 20px var(--shadow);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s;
      z-index: 999999;
    }
    .widget-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 24px var(--shadow);
    }
    .widget-btn svg {
      width: 28px;
      height: 28px;
      fill: #ffffff;
      transition: transform 0.3s ease, opacity 0.3s ease;
    }
    .widget-btn .icon-close { display: none; }
    .widget-btn.open .icon-chat { display: none; }
    .widget-btn.open .icon-close { display: inline-block; transform: rotate(90deg); }

    /* Quick Floating Menu */
    .quick-floating-menu {
      position: fixed;
      bottom: 95px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: flex-end;
      z-index: 999997;
      transition: opacity 0.3s, transform 0.3s;
    }
    .quick-floating-menu.hide {
      opacity: 0;
      transform: translateY(10px);
      pointer-events: none;
    }
    .floating-q-btn {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 20px;
      padding: 10px 16px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 12px var(--shadow);
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .floating-q-btn:hover {
      background: var(--bg-secondary);
      color: var(--primary);
      border-color: var(--primary);
      transform: translateY(-2px);
    }

    /* Main Chat Panel */
    .widget-panel {
      position: fixed;
      bottom: 100px;
      right: 24px;
      width: 380px;
      max-height: 600px;
      height: calc(100vh - 140px);
      border-radius: 20px;
      background: var(--bg);
      box-shadow: 0 12px 36px var(--shadow);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 999998;
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      pointer-events: none;
      transition: opacity 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      border: 1px solid var(--border);
    }
    .widget-panel.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    /* Panel Header */
    .panel-header {
      padding: 20px;
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      color: #ffffff;
      font-size: 16px;
      font-weight: 700;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }
    .panel-header .subtitle {
      font-size: 11px;
      opacity: 0.85;
      font-weight: 400;
      margin-top: 4px;
    }

    /* Message Area */
    .chat-messages {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: var(--bg);
    }

    /* Message Bubbles */
    .msg {
      max-width: 80%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 13.5px;
      line-height: 1.5;
      word-break: break-all;
      animation: msgFade 0.2s ease;
    }
    @keyframes msgFade {
      from { opacity: 0; transform: translateY(5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .msg.user {
      align-self: flex-end;
      background: var(--primary);
      color: #ffffff;
      border-bottom-right-radius: 4px;
    }
    .msg.bot {
      align-self: flex-start;
      background: var(--bg-secondary);
      color: var(--text);
      border-bottom-left-radius: 4px;
    }
    .msg.admin {
      align-self: flex-start;
      background: #ffeaa7;
      color: #2d3436;
      border-left: 4px solid #f1c40f;
      border-bottom-left-radius: 4px;
    }
    .msg .label {
      font-size: 10px;
      font-weight: 700;
      margin-bottom: 4px;
      opacity: 0.8;
      text-transform: uppercase;
    }

    /* Input Area */
    .chat-input-area {
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 8px;
    }
    .chat-input-area input {
      flex: 1;
      padding: 10px 16px;
      border: 1.5px solid var(--border);
      border-radius: 24px;
      background: var(--bg-secondary);
      color: var(--text);
      font-size: 13.5px;
      outline: none;
      transition: border-color 0.2s;
    }
    .chat-input-area input:focus {
      border-color: var(--primary);
    }
    .chat-input-area button {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--primary);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }
    .chat-input-area button:hover { transform: scale(1.05); }
    .chat-input-area button svg { width: 18px; height: 18px; fill: #ffffff; }

    .powered-by {
      text-align: center;
      padding: 6px 0;
      font-size: 10px;
      color: var(--text-secondary);
      background: var(--bg-secondary);
      border-top: 1px solid var(--border);
    }

    /* Typing Dots */
    .typing-dots {
      display: flex;
      gap: 4px;
      padding: 4px 0;
    }
    .typing-dots span {
      width: 6px;
      height: 6px;
      background: var(--text-secondary);
      border-radius: 50%;
      animation: typing 1.4s infinite both;
    }
    .typing-dots span:nth-child(2) { animation-delay: .2s; }
    .typing-dots span:nth-child(3) { animation-delay: .4s; }
    @keyframes typing {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }

    @media (max-width: 480px) {
      .widget-panel {
        width: calc(100vw - 32px);
        right: 16px;
        bottom: 90px;
        max-height: calc(100vh - 120px);
      }
      .widget-btn { bottom: 16px; right: 16px; }
      .quick-floating-menu { bottom: 85px; right: 16px; }
    }
  \`;

  // 6. Create DOM Structure
  const wrapper = document.createElement('div');
  wrapper.innerHTML = \`
    <div class="quick-floating-menu" id="agentumi-floating-questions">
      ${quickButtonsHtml}
    </div>
    
    <button class="widget-btn" id="agentumi-toggle" aria-label="Open chat">
      <svg class="icon-chat" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
      <svg class="icon-close" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
    </button>

    <div class="widget-panel" id="agentumi-panel">
      <div class="panel-header">
        <div>\${escapeHtml("${title}")}</div>
        <div class="subtitle">🤖 AI 즉시 답변 · 운영자 실시간 대기 중</div>
      </div>
      <div class="chat-messages" id="agentumi-messages">
        <div class="msg bot">
          ${welcome}
        </div>
      </div>
      <div class="chat-input-area">
        <input type="text" id="agentumi-input" placeholder="메시지를 입력하세요..." />
        <button id="agentumi-send" aria-label="Send">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
      <div class="powered-by">Powered by Agentumi AI</div>
    </div>
  \`;

  shadow.appendChild(styles);
  shadow.appendChild(wrapper);

  // 7. Event & Logic Handlers
  const btn = shadow.getElementById('agentumi-toggle');
  const panel = shadow.getElementById('agentumi-panel');
  const qMenu = shadow.getElementById('agentumi-floating-questions');
  const msgs = shadow.getElementById('agentumi-messages');
  const input = shadow.getElementById('agentumi-input');
  const sendBtn = shadow.getElementById('agentumi-send');

  let isOpen = false;
  let loadedMessagesCount = 0;

  // Toggle View
  btn.addEventListener('click', function() {
    isOpen = !isOpen;
    btn.classList.toggle('open', isOpen);
    panel.classList.toggle('open', isOpen);
    
    if (qMenu) {
      qMenu.classList.toggle('hide', isOpen || qMenu.children.length === 0);
    }

    if (isOpen) {
      setTimeout(() => input.focus(), 100);
      scrollToBottom();
    }
  });

  // Handle Quick Question Dispatcher
  container.addEventListener('send-quick', function(e) {
    sendUserMessage(e.detail);
    if (qMenu) qMenu.classList.add('hide');
    btn.click();
  });

  // Send Actions
  sendBtn.addEventListener('click', () => sendUserMessage(input.value));
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendUserMessage(input.value);
  });

  function scrollToBottom() {
    msgs.scrollTop = msgs.scrollHeight;
  }

  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  function appendMessage(sender, text) {
    const bubble = document.createElement('div');
    bubble.className = 'msg ' + sender;
    
    let labelText = '';
    if (sender === 'bot') labelText = '🤖 AI 답변';
    else if (sender === 'admin') labelText = '👤 담당자 답변';
    
    bubble.innerHTML = labelText 
      ? \`<div class="label">\${labelText}</div>\${text.replace(/\\n/g, '<br>')}\`
      : text.replace(/\\n/g, '<br>');
      
    msgs.appendChild(bubble);
    scrollToBottom();
  }

  // AI Typing Indicator
  let typingElem = null;
  function showTyping() {
    if (typingElem) return;
    typingElem = document.createElement('div');
    typingElem.className = 'msg bot';
    typingElem.innerHTML = \`<div class="label">🤖 AI 답변</div><div class="typing-dots"><span></span><span></span><span></span></div>\`;
    msgs.appendChild(typingElem);
    scrollToBottom();
  }

  function hideTyping() {
    if (typingElem) {
      typingElem.remove();
      typingElem = null;
    }
  }

  // Post Message to Server
  async function sendUserMessage(text) {
    if (!text || !text.trim()) return;
    text = text.trim();
    input.value = '';
    
    appendMessage('user', escapeHtml(text));
    showTyping();

    try {
      const res = await fetch(\`\${backendUrl}/api/telegram/send\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          siteKey: '${siteKey}',
          message: text
        })
      });

      const data = await res.json();
      hideTyping();

      if (data.success && data.aiReply) {
        appendMessage('bot', data.aiReply);
      } else {
        appendMessage('bot', '죄송합니다. 메시지 전송 과정에서 에러가 발생했습니다.');
      }
    } catch (err) {
      hideTyping();
      appendMessage('bot', '네트워크 연결 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
    
    fetchMessages(); // Trigger update instantly
  }

  // Load / Poll Messages
  async function fetchMessages() {
    try {
      const res = await fetch(\`\${backendUrl}/api/telegram/messages?sessionId=\${sessionId}\`);
      const data = await res.json();
      
      if (data.success && data.data) {
        const remoteMsgs = data.data;
        if (remoteMsgs.length > loadedMessagesCount) {
          // Clear initial default welcome message if we load saved user messages
          if (loadedMessagesCount === 0 && remoteMsgs.length > 0) {
            msgs.innerHTML = '';
          }
          
          for (let i = loadedMessagesCount; i < remoteMsgs.length; i++) {
            const m = remoteMsgs[i];
            appendMessage(m.sender, m.message);
          }
          loadedMessagesCount = remoteMsgs.length;
        }
      }
    } catch (_) {}
  }

  // Start polling loop every 4 seconds
  fetchMessages();
  setInterval(fetchMessages, 4000);

})();
  `;
}
