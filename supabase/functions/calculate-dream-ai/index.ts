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
            `目前存款：${current.toLocaleString("zh-TW")} 元\n` +
            `目標金額：${target.toLocaleString("zh-TW")} 元\n\n` +
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

    const dreamType = (() => {
      const d = dream.toLowerCase()

      if (/相機|canon|nikon|sony|fuji|攝影|鏡頭|r6 mark|a7|拍照/.test(d)) return "攝影器材"
      if (/rtx|顯卡|gpu|電腦|pc|主機|5090|5080|4070|4080/.test(d)) return "電腦硬體"
      if (/iphone|手機|ipad|macbook|apple|安卓|android/.test(d)) return "3C產品"
      if (/重機|機車|r6|zx|ninja|cbr|yzf|ducati|kawasaki|yamaha/.test(d)) return "重機交通"
      if (/旅遊|旅行|日本|韓國|出國|機票|住宿/.test(d)) return "旅行體驗"
      if (/存錢|投資|0050|股票|基金|第一桶金/.test(d)) return "財務目標"

      return "一般夢想"
    })()

    const today = new Date()
    const reachDate = new Date(today)
    reachDate.setMonth(reachDate.getMonth() + needMonths)

    const reachDateText = reachDate.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })

    const systemPrompt = `
你是 DreamScope 的 AI 夢想規劃師。

請使用繁體中文，台灣自然語氣。
你的任務不是寫雞湯，而是幫使用者把夢想拆成「財務 + 行動 + 現實提醒」。

重要規則：
1. 不要寫罐頭開頭，例如「想像一下陽光灑落」、「親愛的夢想追逐者」。
2. 不要每次都寫一樣的五階段。
3. 必須根據夢想類型客製化內容。
4. 必須使用使用者提供的金額數字。
5. 必須列出達標月份與達標日期。
6. 如果夢想是商品，要提醒除了本體價格外，可能還有周邊成本。
7. 不要假裝知道最新價格，只能根據使用者輸入的目標金額分析。
8. 語氣要像懂現實的朋友：鼓勵，但不浮誇。

防惡搞規則：
如果夢想名稱明顯是亂打、低俗、純符號、無意義文字，請不要認真規劃。
請用溫和幽默方式請使用者重新輸入真正想完成的夢想。

請固定輸出以下格式：

【夢想類型判斷】
說明這個夢想屬於哪一類，以及這類夢想真正需要注意的地方。

【財務進度】
列出：
- 目前存款
- 目標金額
- 還差金額
- 每月可存
- 預估達成時間
- 預估達成日期

【這個夢想真正要準備的事】
根據夢想類型輸出客製化內容：

如果是攝影器材：
請提到鏡頭、記憶卡、電池、修圖軟體、拍攝練習、是否先租借體驗。

如果是電腦硬體：
請提到電源供應器、機殼空間、CPU瓶頸、散熱、螢幕規格、是否真的需要這張卡。

如果是3C產品：
請提到保護殼、保固、容量是否真的需要、舊機折抵、購買時機。

如果是重機交通：
請提到駕照、保險、稅金、裝備、停車、保養、輪胎、是否先試乘。

如果是旅行體驗：
請提到機票、住宿、交通、餐費、保險、行程安排、緊急預備金。

如果是財務目標：
請提到風險控管、定期定額、緊急預備金、不要梭哈。

如果是一般夢想：
請根據夢想名稱自行判斷最合理的準備事項。

【5 個階段式執行計畫】
每個階段都要有：
- 時間
- 具體行動
- 檢查標準

不能只寫「努力存錢」、「保持動力」這種空話。

【加速達標建議】
請計算：
如果每月多存 1000 元，大約可提前多久。
如果每月多存 3000 元，大約可提前多久。
如果無法提前很多，也要誠實說。

【AI 給你的真心話】
用 3 到 5 句話收尾。
要真誠、實際、有鼓勵感。
不要浮誇。
`

    const userPrompt = `
夢想名稱：${dream}
夢想類型：${dreamType}

目前存款：${current} 元
每月收入：${monthlyIncome} 元
每月支出：${monthlyExpense} 元
每月可存：${monthlySave} 元

目標金額：${target} 元
還差金額：${remainMoney} 元
預計需要：${needMonths} 個月
預估達成日期：${reachDateText}

請根據以上資料，產生一份真正客製化的 DreamScope 夢想規劃。
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
        temperature: 0.65,
        max_tokens: 1400,
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
        dreamType,
        reachDateText
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