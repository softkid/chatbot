import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import telegramRoutes from './routes/telegram.js'

const app = new Hono()

// 1. Security Headers
app.use('*', secureHeaders({
  crossOriginResourcePolicy: "cross-origin",
}))

// 2. Enterprise Dynamic CORS Middleware (Database-driven domain trust)
app.use('*', cors({
  origin: async (origin, c) => {
    if (!origin) return 'https://globalbusan.xyz'
    
    // Always allow localhost
    if (origin.startsWith('http://localhost:')) {
      return origin
    }
    
    try {
      const hostname = new URL(origin).hostname
      
      // Trust default domains
      if (hostname === 'globalbusan.xyz' || hostname.endsWith('.globalbusan.xyz') || 
          hostname === 'agentumi.xyz' || hostname.endsWith('.agentumi.xyz')) {
        return origin
      }

      // Query Supabase chatbot_configs dynamically to check if origin is registered!
      const supabaseUrl = c.env.SUPABASE_URL
      const supabaseKey = c.env.SUPABASE_KEY
      if (supabaseUrl && supabaseKey) {
        const { createClient } = await import('@supabase/supabase-js')
        const supabase = createClient(supabaseUrl, supabaseKey)
        const { data } = await supabase
          .from('chatbot_configs')
          .select('site_domain')
          .or(`site_domain.eq.${hostname},site_domain.eq.${origin}`)
          .limit(1)
        
        if (data && data.length > 0) {
          return origin
        }
      }
    } catch (_) {}
    
    return 'https://globalbusan.xyz'
  },
  credentials: true
}))

// 3. Request Logger
app.use('*', logger())

// 4. Rate Limiter (Excludes GET Polling requests, strictly limits POST mutations)
const rateLimitMap = new Map()
app.use('/api/*', async (c, next) => {
  if (c.req.method === 'GET') {
    await next()
    return
  }

  const ip = c.req.header('cf-connecting-ip') || 'anonymous'
  const now = Date.now()
  const windowMs = 15 * 60 * 1000 // 15 mins
  const limit = 50 // 50 message sends per 15 minutes is very generous

  const entry = rateLimitMap.get(ip)
  if (entry && now - entry.start < windowMs) {
    entry.count++
    if (entry.count > limit) {
      return c.json({ error: 'Too many requests. Please try again later.' }, 429)
    }
  } else {
    rateLimitMap.set(ip, { start: now, count: 1 })
  }

  await next()
})

// 5. Health Check
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString()
  })
})

// 6. Router Mounting
app.route('/api/telegram', telegramRoutes)

// 7. 404 Handler
app.notFound((c) => {
  return c.json({ error: 'Endpoint not found' }, 404)
})

// 8. Error Handler
app.onError((err, c) => {
  console.error('Unhandled server error:', err)
  return c.json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  }, err.status || 500)
})

export default app
