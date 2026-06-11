import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function formatMoney(value: number) {
  return value.toLocaleString("zh-TW")
}

function makeProgressBar(percent: number) {
  const filled = Math.round(percent / 10)
  const empty = 10 - filled
  return "█".repeat(filled) + "░".repeat(empty)
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

    if (!dream || dream.length < 2) {
      return new Response(
        JSON.stringify({
          error: "夢想名稱太短或沒有輸入。",
          aiPlan: "🪐 我收到的夢想訊號太微弱了。\n\n請輸入一個比較明確的夢想，例如：買重機、買安全帽、存到第一桶金、出國旅行、學會剪輯。"
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
    const progressPercent = Math.min(Math.max(Math.round((current / target) * 100), 0), 100)
    const progressBar = makeProgressBar(progressPercent)

    if (monthlySave <= 0) {
      return new Response(
        JSON.stringify({
          aiPlan:
            `【${dream}】\n\n` +
            `我先認真跟你說：這個夢想不是不能做，而是目前你的每月收支還沒有留下可以推進夢想的空間。\n\n` +
            `你現在每月收入是 ${formatMoney(monthlyIncome)} 元，支出是 ${formatMoney(monthlyExpense)} 元，代表每個月暫時存不下錢。\n\n` +
            `所以第一步不是放棄夢想，而是先把現金流救回來。\n\n` +
            `你可以先做三件事：\n` +
            `1. 找出每月最容易被忽略的小支出。\n` +
            `2. 設定一個低門檻存款目標，例如每月先存 1,000 元。\n` +
            `3. 想辦法增加一個小收入來源，例如接案、打工時數、賣掉不需要的東西。\n\n` +
            `夢想不是靠熱血硬撐，是靠穩定的節奏慢慢堆出來的。你現在要做的不是否定自己，而是先把第一步重新站穩。`,
          needMonths: null,
          monthlySave,
          remainMoney,
          progressPercent,
          progressBar
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
            `目前存款：${formatMoney(current)} 元\n` +
            `目標金額：${formatMoney(target)} 元\n` +
            `目前進度：100%\n` +
            `██████████\n\n` +
            `現在真正該思考的不是「我能不能做到」，而是「這個夢想是不是現在就值得開始」。\n\n` +
            `如果答案是值得，那就勇敢一點。\n` +
            `如果心裡還有猶豫，也沒關係，先給自己一點時間確認。\n\n` +
            `有時候，最困難的不是存到錢，而是承認自己真的可以開始了。`,
          needMonths: 0,
          monthlySave,
          remainMoney,
          progressPercent: 100,
          progressBar: "██████████"
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

    console.log("DreamScope v2 Function 已啟動")
    console.log("dream:", dream)

    const today = new Date()
    const reachDate = new Date(today)
    reachDate.setMonth(reachDate.getMonth() + needMonths)

    const reachDateText = reachDate.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })

    const systemPrompt = `
你是 DreamScope，一個懂財務、更懂人的 AI 夢想導航師。

你說話的方式像一個真正了解你的朋友——
不是在填報告，不是在念清單，而是在跟你說話。

你的核心任務只有一件事：
讓使用者看完之後，心裡產生一種感覺——
「我知道我在幹嘛了，而且我真的做得到。」

---

關於語氣，你需要做到：
- 有畫面感、有溫度、有節奏——像在跟朋友對話，不像在讀 PPT
- 現實但不澆冷水，鼓勵但不空泛
- 每一段話結束時，讓人感覺「往前走了一步」，而不是「又多了一堆功課」
- 不使用「親愛的」、「想像一下」、「陽光灑落」這類罐頭開場
- 不浮誇，不過度文青，不說教

---

關於夢想辨識：
- 請依據夢想名稱與目標金額自行推理夢想類型
- SHARK、Arai、Shoei、AGV → 騎士安全帽
- Alpinestars、Dainese、Komine → 騎士防護裝備  
- R6、ZX-6R、Ducati、Ninja → 重機
- M3、M4 + 目標百萬以上 → BMW 車款
- 若不確定，直接說「我猜你說的是……」，不要硬猜
- 若夢想名稱明顯是亂打或無意義，請用輕鬆幽默的方式請對方重新輸入

---

內容請包含以下主題，但**不需要固定格式或固定順序**：
你可以根據這個夢想的特性，決定哪些主題應該多著墨、哪些簡短帶過。

主題清單（自由運用）：
1. 這個夢想是什麼、為什麼值得追
2. 目前進度（百分比 + 進度條 + 一句話）
3. 數字現況：存款、目標、還差多少、每月能存、幾個月能到
4. 這個夢想最讓人期待的 2~3 個畫面或體驗
5. 真正需要提前想到的事（針對這個夢想客製化）
6. 現在這週就能做的 2~3 個小行動（不要只說存錢）
7. 一個有節奏的階段執行方向（不需要硬切 5 段，自然分就好）
8. 加速存到的小計算（多存 1000 或 3000 可以提前多久）
9. 最後一段：給這個人真心說的幾句話——有現實、有方向、但最後一定收在「你做得到」

---

有一件事最重要：
不要讓使用者感覺「看完了但好累」。
每一段結束，都要讓人想繼續讀下去、想繼續前進。
`

const userPrompt = `
夢想：${dream}
目前存款：${current} 元
每月收入：${monthlyIncome} 元 / 支出：${monthlyExpense} 元 / 可存：${monthlySave} 元
目標金額：${target} 元，還差 ${remainMoney} 元
目前進度：${progressPercent}%　${progressBar}
預計 ${needMonths} 個月後的 ${reachDateText} 達成

請幫我寫一份 DreamScope 夢想規劃。
用你自己最自然的方式，讓他看完之後真的想出發。
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
        temperature: 0.72,
        max_tokens: 1500,
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
        remainMoney,
        reachDateText,
        progressPercent,
        progressBar
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