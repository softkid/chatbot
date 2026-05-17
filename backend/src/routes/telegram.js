import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import { getLLMResponse } from '../modules/llm.js'
import { renderWidgetScript } from '../modules/telegram-widget.js'

const app = new Hono()

// Helper to create Supabase Client
function getSupabase(c) {
  const url = c.env.SUPABASE_URL || 'https://jgueqnywthkjledvqqrm.supabase.co'
  const key = c.env.SUPABASE_KEY || 'sb_publishable_n-LpvYGkVOQD9UiSph1Euw_9KotY20k'
  return createClient(url, key)
}

// 1. GET /widget.js — 동적 스크립트 서빙 엔드포인트
app.get('/widget.js', async (c) => {
  const siteKey = c.req.query('siteKey')
  if (!siteKey) {
    return c.text('// Error: siteKey parameter is required.', 400, {
      'Content-Type': 'application/javascript'
    })
  }

  try {
    const supabase = getSupabase(c)
    
    // Fetch domain specific configuration
    const { data: config, error } = await supabase
      .from('chatbot_configs')
      .select('*')
      .eq('site_key', siteKey)
      .single()

    if (error || !config) {
      return c.text(`// Error: siteKey "${siteKey}" is not registered.`, 404, {
        'Content-Type': 'application/javascript'
      })
    }

    // Render client script
    const script = renderWidgetScript(config)
    return c.text(script, 200, {
      'Content-Type': 'application/javascript'
    })
  } catch (err) {
    return c.text(`// Error generating widget: ${err.message}`, 500, {
      'Content-Type': 'application/javascript'
    })
  }
})

// 2. GET /messages — 특정 세션 대화기록 조회
app.get('/messages', async (c) => {
  const sessionId = c.req.query('sessionId')
  if (!sessionId) {
    return c.json({ success: false, error: 'sessionId is required.' }, 400)
  }

  try {
    const supabase = getSupabase(c)
    const { data, error } = await supabase
      .from('chatbot_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return c.json({ success: true, data })
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// 3. POST /send — 메시지 전송 및 AI 응답 처리 + 텔레그램 실시간 포워딩
app.post('/send', async (c) => {
  try {
    const { sessionId, siteKey, message } = await c.req.json()
    if (!sessionId || !siteKey || !message) {
      return c.json({ success: false, error: 'Missing parameters.' }, 400)
    }

    const supabase = getSupabase(c)

    // A. Load dynamic config
    const { data: config, error: configErr } = await supabase
      .from('chatbot_configs')
      .select('*')
      .eq('site_key', siteKey)
      .single()

    if (configErr || !config) {
      return c.json({ success: false, error: 'Config not found' }, 404)
    }

    // B. Check or create Session
    const { data: session } = await supabase
      .from('chatbot_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (!session) {
      await supabase
        .from('chatbot_sessions')
        .insert([{ id: sessionId, site_key: siteKey }])
    }

    // C. Record user message
    await supabase
      .from('chatbot_messages')
      .insert([{ session_id: sessionId, sender: 'user', message }])

    // D. Fetch recent conversation history for context
    const { data: historyData } = await supabase
      .from('chatbot_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(10)

    const history = (historyData || [])
      .filter(m => m.message !== message)
      .map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        text: m.message
      }))

    // E. Generate AI response via Gemini API
    const geminiKey = c.env.GEMINI_API_KEY
    const aiReply = await getLLMResponse(message, history, config.system_prompt, geminiKey)

    // F. Record AI response
    await supabase
      .from('chatbot_messages')
      .insert([{ session_id: sessionId, sender: 'bot', message: aiReply }])

    // G. Forward alert notification to Domain Specific Telegram Bot & Group
    const botToken = config.telegram_bot_token || c.env.TELEGRAM_BOT_TOKEN
    const chatId = config.telegram_chat_id || c.env.TELEGRAM_CHAT_ID

    if (botToken && chatId) {
      const telegramText = `🌐 [${config.bot_title}]\n새로운 문의가 등록되었습니다!\n\n👤 세션 ID: ${sessionId}\n💬 질문: ${message}\n🤖 AI 답변: ${aiReply.substring(0, 150)}...\n\n💡 이 메시지에 [답장(Reply)] 기능을 사용해 답변을 작성하시면, 문의 고객의 웹 챗봇 화면에 실시간으로 전달됩니다.`
      
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: telegramText
        })
      })

      if (tgRes.ok) {
        const tgData = await tgRes.json()
        const messageId = tgData.result?.message_id
        if (messageId) {
          // Save telegram message ID to map future operator replies
          await supabase
            .from('chatbot_sessions')
            .update({ telegram_message_id: messageId })
            .eq('id', sessionId)
        }
      }
    }

    return c.json({ success: true, aiReply })
  } catch (err) {
    console.error('Send message process failed:', err)
    return c.json({ success: false, error: err.message }, 500)
  }
})

// 4. POST /webhook — 텔레그램 운영자 답장(Reply) 수집 핸들러
app.post('/webhook', async (c) => {
  try {
    const payload = await c.req.json()
    const msg = payload.message

    // Check if this is a reply to another message
    if (msg && msg.reply_to_message) {
      const replyToId = msg.reply_to_message.message_id
      const adminReplyText = msg.text

      if (replyToId && adminReplyText) {
        const supabase = getSupabase(c)
        
        // Find session mapped to this message_id
        const { data: session, error } = await supabase
          .from('chatbot_sessions')
          .select('*')
          .eq('telegram_message_id', replyToId)
          .single()

        if (session) {
          // Save admin reply to chatbot messages
          await supabase
            .from('chatbot_messages')
            .insert([{
              session_id: session.id,
              sender: 'admin',
              message: adminReplyText
            }])

          return c.json({ success: true, message: 'Operator reply routed successfully.' })
        }
      }
    }

    return c.json({ success: true, message: 'Ignored unrelated event.' })
  } catch (err) {
    console.error('Webhook processing failed:', err)
    return c.json({ success: false, error: err.message }, 500)
  }
})

// 5. GET /set-webhook — 텔레그램 웹훅 연동 자동 수립 API
app.get('/set-webhook', async (c) => {
  const siteKey = c.req.query('siteKey')
  if (!siteKey) {
    return c.json({ success: false, error: 'siteKey parameter is required.' }, 400)
  }

  try {
    const supabase = getSupabase(c)
    const { data: config } = await supabase
      .from('chatbot_configs')
      .select('*')
      .eq('site_key', siteKey)
      .single()

    const botToken = config?.telegram_bot_token || c.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return c.json({ success: false, error: 'Bot token not found.' }, 400)
    }

    // Determine webhook endpoint from request url
    const requestUrl = new URL(c.req.url)
    const webhookUrl = `${requestUrl.origin}/api/telegram/webhook`

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    })

    const tgData = await tgRes.json()
    return c.json({ 
      success: true, 
      webhookUrl, 
      telegramResponse: tgData 
    })
  } catch (err) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

export default app
