// 引入 Supabase 邊緣函式必備的 Serve 庫
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// 設定 CORS Headers，允許你的前端網站跨網域呼叫
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 處理瀏覽器預檢請求 (OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. 接收前端傳過來的資料
    const { dreamName, currentMoney, income, expense, targetMoney } = await req.json()

    const monthlySave = income - expense
    const remainMoney = targetMoney - currentMoney
    const needMonths = Math.ceil(remainMoney / monthlySave)

    // 2. 從 Supabase 後端安全取得 OpenAI API Key (絕對不會外流到前端)
    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    
    // 3. 呼叫 OpenAI API (這裡使用便宜又快的 gpt-4o-mini)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `你是一位充滿科技未來感、溫暖且睿智的「DreamScope 夢想導師」。
            你的任務是鼓勵使用者，並針對他們的財務狀況給出有靈魂、有深度、像真朋友一樣的階段性圓夢計畫。
            不要死板，文字要帶有畫面感。
            必須使用繁體中文（台灣習慣用語，例如：存款、支出、目標）。`
          },
          {
            role: 'user',
            content: `我的夢想是：${dreamName}
            目前存款：${currentMoney} 元
            每月收入：${income} 元
            每月支出：${expense} 元
            目標金額：${targetMoney} 元
            經過計算，我每個月可以存 ${monthlySave} 元，還差 ${remainMoney} 元，預計需要 ${needMonths} 個月。
            
            請幫我寫一段充滿靈魂的激勵話語（AI建議），並幫我規劃 5 個量身打造的階段式執行計畫。`
          }
        ],
        temperature: 0.7,
      }),
    })

    const aiData = await response.json()
    const aiReply = aiData.choices[0].message.content

    // 4. 把 AI 生成的靈魂內容回傳給前端
    return new Response(
      JSON.stringify({ aiPlan: aiReply, needMonths, monthlySave, remainMoney }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})