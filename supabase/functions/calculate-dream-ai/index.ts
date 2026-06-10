// 引入 Supabase 邊緣函式必備的 Serve 庫
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// 設定 CORS Headers，允許你的前端網站跨網域呼叫
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { dreamName, currentMoney, income, expense, targetMoney } = await req.json()

    const dream = String(dreamName || "").trim()
    const current = Number(currentMoney)
    const monthlyIncome = Number(income)
    const monthlyExpense = Number(expense)
    const target = Number(targetMoney)

    // 基本防呆
    if (!dream || dream.length < 2) {
      return new Response(
        JSON.stringify({
          error: "夢想名稱太短或沒有輸入。",
          aiPlan: "🪐 我收到的夢想訊號太微弱了。\n\n請輸入一個比較明確的夢想，例如：買重機、存到第一桶金、出國旅行、學會剪輯。"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (
      Number.isNaN(current) ||
      Number.isNaN(monthlyIncome) ||
      Number.isNaN(monthlyExpense) ||
      Number.isNaN(target) ||
      current < 0 ||
      monthlyIncome <= 0 ||
      monthlyExpense < 0 ||
      target <= 0
    ) {
      return new Response(
        JSON.stringify({
          error: "金額資料不合理。",
          aiPlan: "✨ 金額資料看起來有點怪怪的。\n\n請確認目前存款、每月收入、每月支出、目標金額都有正確填寫，這樣我才能幫你算出真正有用的圓夢路線。"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const monthlySave = monthlyIncome - monthlyExpense
    const remainMoney = target - current
    const needMonths = monthlySave > 0 ? Math.ceil(remainMoney / monthlySave) : null

    if (monthlySave <= 0) {
      return new Response(
        JSON.stringify({
          aiPlan:
            `【${dream}】\n\n` +
            `我先認真跟你說：這個夢想不是不能做，而是目前你的每月收支還沒有留下可以推進夢想的空間。\n\n` +
            `你現在每月收入是 ${monthlyIncome.toLocaleString("zh-TW")} 元，支出是 ${monthlyExpense.toLocaleString("zh-TW")} 元，代表每個月暫時存不下錢。\n\n` +
            `所以第一步不是硬衝，而是先把現金流救回來。\n\n` +
            `你可以先做三件事：\n` +
            `1. 找出每月最容易被忽略的小支出。\n` +
            `2. 設定一個低門檻存款目標，例如每月先存 1,000 元。\n` +
            `3. 想辦法增加一個小收入來源，例如接案、打工時數、賣掉不需要的東西。\n\n` +
            `夢想不是靠熱血硬撐，是靠穩定的節奏慢慢堆出來的。`,
          needMonths: null,
          monthlySave,
          remainMoney
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (remainMoney <= 0) {
      return new Response(
        JSON.stringify({
          aiPlan:
            `【${dream}】\n\n` +
            `你其實已經達到這個夢想需要的金額了。\n\n` +
            `現在真正該思考的不是「我能不能做到」，而是「這個夢想是不是現在就值得開始」。\n\n` +
            `如果答案是值得，那就勇敢一點。\n` +
            `如果心裡還有猶豫，也沒關係，先給自己一點時間確認。\n\n` +
            `有時候，最困難的不是存到錢，而是承認自己真的可以開始了。`,
          needMonths: 0,
          monthlySave,
          remainMoney
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY")

    if (!openAiKey) {
      return new Response(
        JSON.stringify({
          error: "OPENAI_API_KEY 尚未設定。",
          aiPlan: "❌ AI 金鑰尚未設定，請確認 Supabase Functions Secrets 裡面有 OPENAI_API_KEY。"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const systemPrompt = `
你是 DreamScope 的 AI 夢想導師。

你的風格：
- 使用繁體中文，符合台灣用語。
- 溫柔、有力量，但不要像罐頭雞湯。
- 可以有一點幽默感，但不要酸人、不要羞辱使用者。
- 邏輯要清楚，文字要有畫面感。
- 請像一位很懂現實、也很願意陪伴使用者的朋友。
- 不要使用過度誇張的宇宙詞彙，不要每句都星際、能量、顯化。
- 可以保留一點夢幻感，但內容要實用。

很重要的防惡搞規則：
如果使用者的夢想看起來是：
1. 純符號
2. 無意義亂打
3. 低俗惡搞
4. 不像真實人生目標
5. 明顯是在測試 AI 會不會亂回答

你不能認真幫他規劃。
你要用溫柔、幽默、但有界線的方式回覆。
例如可以說：
「這個夢想看起來比較像宇宙垃圾訊號，不太像真正想完成的目標。換一個你真的想完成的夢想，我會認真幫你規劃。」

正常夢想的回覆格式請固定如下：

【夢想分析】
用 1 段話說明這個夢想代表什麼，以及使用者目前距離它有多遠。

【財務現況】
清楚列出：
- 目前存款
- 目標金額
- 還差多少
- 每月可存多少
- 預計幾個月達成

【AI 給你的真心話】
寫一段溫柔但有力量的鼓勵，不要太浮誇，不要太制式。

【5 個階段式執行計畫】
請列出 1 到 5 階段。
每一階段都要具體、可執行，不能只寫空泛口號。

【最後提醒】
用 2 到 3 句話收尾，讓使用者感覺自己真的可以開始行動。
`

    const userPrompt = `
我的夢想是：${dream}
目前存款：${current} 元
每月收入：${monthlyIncome} 元
每月支出：${monthlyExpense} 元
目標金額：${target} 元

經過計算：
每月可存：${monthlySave} 元
還差：${remainMoney} 元
預計需要：${needMonths} 個月

請你依照 DreamScope 的格式，幫我產生一份專屬夢想規劃。
`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        temperature: 0.85,
      }),
    })

    const aiData = await response.json()

    if (!response.ok) {
      console.error("OpenAI API Error:", aiData)

      return new Response(
        JSON.stringify({
          error: "OpenAI API 呼叫失敗。",
          aiPlan: "❌ AI 目前連線失敗，請稍後再試，或確認 OpenAI API Key 是否正常。"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const aiReply = aiData.choices?.[0]?.message?.content || "AI 沒有產生內容，請再試一次。"

    return new Response(
      JSON.stringify({
        aiPlan: aiReply,
        needMonths,
        monthlySave,
        remainMoney
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message,
        aiPlan: "❌ 系統處理時發生錯誤，請確認輸入資料與 Supabase Edge Function 狀態。"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})