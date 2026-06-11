const SUPABASE_URL = "https://avsophbhivsuzmcuyxyx.supabase.co";
const SUPABASE_KEY = "sb_publishable_1CPRkxPqGVMuJiMSHhoHQQ_1RNkSZWK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let latestDreamData = null;
let latestAiPlanText = "";

// 簡單防惡搞
function isBadDreamInput(text) {
  const value = text.trim();

  if (value.length < 2) return true;

  const onlySymbols = /^[^\u4e00-\u9fa5a-zA-Z0-9]+$/.test(value);
  if (onlySymbols) return true;

  const badWords = [
    "大便", "屎", "糞", "垃圾", "白癡", "智障", "幹你",
    "幹", "靠北", "靠邀", "fuck", "shit"
  ];

  return badWords.some(word => value.toLowerCase().includes(word.toLowerCase()));
}

function formatMoney(num) {
  return Number(num).toLocaleString("zh-TW");
}

// 1. AI 夢想計算與規劃
async function calculateDream() {
  const dreamName = document.getElementById("dreamName").value.trim();
  const currentMoney = Number(document.getElementById("currentMoney").value);
  const income = Number(document.getElementById("income").value);
  const expense = Number(document.getElementById("expense").value);
  const targetMoney = Number(document.getElementById("targetMoney").value);

  const resultText = document.getElementById("resultText");
  const shareBtn = document.getElementById("shareBtn");
  const copyBtn = document.getElementById("copyBtn");

  shareBtn.style.display = "none";
  copyBtn.style.display = "none";

  if (isBadDreamInput(dreamName)) {
    resultText.innerHTML = `
      <div class="ai-plan-content">
        <b>🪐 夢想訊號有點怪怪的</b><br><br>
        我剛剛收到的內容，看起來比較像宇宙垃圾訊號，
        不太像一個真正想完成的夢想。<br><br>
        換一個你真的想完成的目標吧。<br>
        只要你認真輸入，我就會認真幫你規劃。
      </div>
    `;
    return;
  }

  if (
    currentMoney < 0 ||
    income <= 0 ||
    expense < 0 ||
    targetMoney <= 0 ||
    Number.isNaN(currentMoney) ||
    Number.isNaN(income) ||
    Number.isNaN(expense) ||
    Number.isNaN(targetMoney)
  ) {
    resultText.innerHTML = `
      <div class="ai-plan-content">
        ✨ 請完整輸入正確的夢想資料。<br>
        金額不能亂填，不然 AI 會不知道要帶你飛去哪裡。
      </div>
    `;
    return;
  }

  const monthlySave = income - expense;
  const remainMoney = targetMoney - currentMoney;

  if (monthlySave <= 0) {
    resultText.innerHTML = `
      <div class="ai-plan-content">
        <b>【${dreamName}】</b><br><br>
        目前你的每月收入扣掉支出後，還沒有可以穩定存下來的金額。<br><br>
        這不是失敗，而是提醒你：現在第一個目標不是直接衝夢想，
        而是先讓自己的現金流變健康。<br><br>
        建議先從「降低支出」或「增加收入」開始。
      </div>
    `;
    return;
  }

  if (remainMoney <= 0) {
    resultText.innerHTML = `
      <div class="ai-plan-content">
        <b>【${dreamName}】</b><br><br>
        🎉 你目前的存款已經達到這個夢想的目標金額了。<br><br>
        接下來要思考的不是「能不能做到」，而是「現在是不是最適合開始」。
      </div>
    `;
    return;
  }

  resultText.innerHTML = `
    <div class="loading-animation">
      🪐 正在連線到未來時間線，AI 正在為你的夢想編織星路圖...
    </div>
  `;

  try {
    const { data, error: funcError } = await supabaseClient.functions.invoke(
      "calculate-dream-ai",
      {
        body: {
          dreamName,
          currentMoney,
          income,
          expense,
          targetMoney
        }
      }
    );

    if (funcError) throw funcError;

    const { aiPlan, needMonths } = data;

    latestAiPlanText = aiPlan;

    resultText.innerHTML = `
      <div class="result-summary">
        <div class="summary-box">
          <span>夢想</span>
          <strong>${dreamName}</strong>
        </div>

        <div class="summary-box">
          <span>每月可存</span>
          <strong>${formatMoney(monthlySave)} 元</strong>
        </div>

        <div class="summary-box">
          <span>預計時間</span>
          <strong>${needMonths} 個月</strong>
        </div>
      </div>

      <div class="ai-plan-content">
        ${aiPlan.replace(/\n/g, "<br>")}
      </div>
    `;

    latestDreamData = {
      dreamName,
      targetMoney,
      currentMoney,
      message: `預計 ${needMonths} 個月達成。慢慢來，但不要停。`
    };

    shareBtn.style.display = "block";
    copyBtn.style.display = "block";

    const { error: dbError } = await supabaseClient.from("dreams").insert([
      {
        dream_name: dreamName,
        current_status: `目前存款：${currentMoney}，每月收支：+${monthlySave}`,
        target_goal: `目標金額：${targetMoney}`,
        ai_plan: aiPlan
      }
    ]);

    if (dbError) {
      console.error("歷史紀錄存入資料庫失敗：", dbError);
    }

  } catch (err) {
    console.error("AI 規劃失敗：", err);
    resultText.innerHTML = `
      <div class="ai-plan-content">
        ❌ AI 星際連線中斷。<br>
        請確認 Supabase Edge Function、OpenAI API Key 是否正常。
      </div>
    `;
  }
}

// 2. 複製 AI 規劃
async function copyPlan() {
  if (!latestAiPlanText) {
    alert("目前沒有可以複製的 AI 規劃。");
    return;
  }

  await navigator.clipboard.writeText(latestAiPlanText);
  alert("AI 規劃已複製！");
}

// 3. 手動新增夢想到夢想牆
async function addDreamToWall() {
  const nickname = document.getElementById("nickname").value.trim();
  const dreamName = document.getElementById("wallDreamName").value.trim();
  const targetMoney = Number(document.getElementById("wallTargetMoney").value);
  const currentMoney = Number(document.getElementById("wallCurrentMoney").value);
  const message = document.getElementById("message").value.trim();

  if (!nickname || isBadDreamInput(dreamName) || targetMoney <= 0 || currentMoney < 0) {
    alert("請完整填寫合理的夢想資料。");
    return;
  }

  const { error } = await supabaseClient.from("dream_wall").insert([
    {
      nickname,
      dream_name: dreamName,
      target_money: targetMoney,
      current_money: currentMoney,
      message: message || "慢慢來，但不要停。"
    }
  ]);

  if (error) {
    console.error(error);
    alert("發布失敗");
    return;
  }

  alert("夢想卡建立成功！");
  loadDreamWall();
}

// 4. 載入夢想牆
async function loadDreamWall() {
  const dreamList = document.getElementById("dreamList");
  if (!dreamList) return;

  const { data, error } = await supabaseClient
    .from("dream_wall")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    dreamList.innerHTML = "<p>夢想牆載入失敗。</p>";
    return;
  }

  dreamList.innerHTML = "";

  if (!data || data.length === 0) {
    dreamList.innerHTML = "<p>目前還沒有夢想卡，快來成為第一個吧！</p>";
    return;
  }

  data.forEach(dream => {
    const percent = Math.min(
      100,
      Math.round((dream.current_money / dream.target_money) * 100)
    );

    dreamList.innerHTML += `
      <div class="dream-item">
        <h3>${dream.nickname}</h3>
        <p><b>夢想：</b>${dream.dream_name}</p>
        <p class="dream-msg">${dream.message || "慢慢來，但不要停。"}</p>
        <p class="dream-money">
          ${formatMoney(dream.current_money)} / ${formatMoney(dream.target_money)} 元
        </p>

        <div class="progress-bar">
          <div class="progress-fill" style="width:${percent}%"></div>
        </div>

        <p class="dream-percent">完成度 ${percent}%</p>

        <button class="update-btn" onclick="updateDreamProgress('${dream.id}', ${dream.target_money})">
          更新進度
        </button>
      </div>
    `;
  });
}

// 5. 更新夢想進度
// 5. 更新夢想進度
async function updateDreamProgress(id, targetMoney) {
  const newMoney = prompt("請輸入最新目前存款：");

  if (newMoney === null) return;

  const moneyNumber = Number(newMoney);

  if (Number.isNaN(moneyNumber) || moneyNumber < 0) {
    alert("請輸入正確的金額。");
    return;
  }

  const { data, error } = await supabaseClient
    .from("dream_wall")
    .update({
      current_money: moneyNumber
    })
    .eq("id", id)
    .select();

  if (error) {
    console.error("更新失敗：", error);
    alert("更新失敗，請查看 Console 錯誤訊息。");
    return;
  }

  if (!data || data.length === 0) {
    alert("沒有找到這張夢想卡，可能是資料表 id 欄位或 RLS 權限問題。");
    return;
  }

  if (moneyNumber >= targetMoney) {
    alert("🎉 恭喜！這個夢想已經達標了！");
  } else {
    alert("進度已更新！");
  }

  loadDreamWall();
}

// 6. 將 AI 規劃發布到夢想牆
async function sharePlanToWall() {
  if (!latestDreamData) {
    alert("請先產生 AI 規劃");
    return;
  }

  const nickname = prompt("請輸入你想顯示在夢想牆上的暱稱：");

  if (!nickname) {
    alert("請輸入暱稱");
    return;
  }

  const { error } = await supabaseClient.from("dream_wall").insert([
    {
      nickname,
      dream_name: latestDreamData.dreamName,
      target_money: latestDreamData.targetMoney,
      current_money: latestDreamData.currentMoney,
      message: latestDreamData.message
    }
  ]);

  if (error) {
    console.error(error);
    alert("發布到夢想牆失敗");
    return;
  }

  alert("已成功發布到夢想牆！");
  window.location.href = "wall.html";
}

// 7. 載入首頁統計資料
async function loadHomeStats() {
  const totalDreamsEl = document.getElementById("totalDreams");
  const completedDreamsEl = document.getElementById("completedDreams");
  const totalTargetMoneyEl = document.getElementById("totalTargetMoney");

  if (!totalDreamsEl || !completedDreamsEl || !totalTargetMoneyEl) return;

  const { data, error } = await supabaseClient
    .from("dream_wall")
    .select("target_money, current_money");

  if (error) {
    console.error("首頁統計載入失敗：", error);
    return;
  }

  const dreams = data || [];

  const totalDreams = dreams.length;

  const completedDreams = dreams.filter(dream => {
    return Number(dream.current_money) >= Number(dream.target_money);
  }).length;

  const totalTargetMoney = dreams.reduce((sum, dream) => {
    return sum + Number(dream.target_money || 0);
  }, 0);

  totalDreamsEl.textContent = totalDreams;
  completedDreamsEl.textContent = completedDreams;
  totalTargetMoneyEl.textContent = formatMoney(totalTargetMoney) + " 元";
}

window.onload = () => {
  loadDreamWall();
  loadHomeStats();
};