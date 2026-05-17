export async function getLLMResponse(message, history = [], systemPrompt, apiKey) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.')
  }

  // Fallback default system prompt if none is found
  const prompt = systemPrompt || '당신은 공식 AI 어시스턴트입니다. 친절하고 정확하게 답변을 제공하세요.'

  // Format conversation history for Gemini API
  const contents = []
  
  // Format history messages
  for (const h of history) {
    contents.push({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    })
  }

  // Append new user message
  contents.push({
    role: 'user',
    parts: [{ text: message }]
  })

  const payload = {
    contents,
    systemInstruction: {
      parts: [{ text: prompt }]
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000
    }
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    )

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Gemini API Error (HTTP ${response.status}): ${errText}`)
    }

    const resJson = await response.json()
    const aiText = resJson.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (!aiText) {
      throw new Error('Empty AI response received from Gemini.')
    }

    return aiText
  } catch (error) {
    console.error('Gemini API Integration Failure:', error)
    throw error
  }
}
