const SUPABASE_URL = "https://avsophbhivsuzmcuyxyx.supabase.co";
const SUPABASE_KEY = "sb_publishable_1CPRkxPqGVMuJiMSHhoHQQ_1RNkSZWK";

let latestDreamData = null;

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// 1. AI 夢想計算與規劃
async function calculateDream() {
    const dreamName = document.getElementById("dreamName").value;
    const currentMoney = Number(document.getElementById("currentMoney").value);
    const income = Number(document.getElementById("income").value);
    const expense = Number(document.getElementById("expense").value);
    const targetMoney = document.getElementById("targetMoney").value;

    const resultText = document.getElementById("resultText");

    // 前端基本防呆與阻擋
    if (!dreamName || currentMoney < 0 || income <= 0 || expense < 0 || !targetMoney || Number(targetMoney) <= 0) {
        resultText.innerHTML = "✨ 請完整輸入正確的夢想資料，讓星際導師為你規劃。";
        return;
    }

    const targetMoneyNum = Number(targetMoney);
    const monthlySave = income - expense;
    const remainMoney = targetMoneyNum - currentMoney;

    if (monthlySave <= 0) {
        resultText.innerHTML = `<b>【${dreamName}】</b><br>🔮 星際導師感應到你目前每個月的能量（財務收支）處於平衡或負值，暫時無法累積夢想基金。建議先調整生活魔法陣，降低支出或擴大收入來源！`;
        return;
    }

    if (remainMoney <= 0) {
        resultText.innerHTML = `<b>【${dreamName}】</b><br>🎉 太驚人了！你目前的存款已經具備顯化這個夢想的物質條件。別猶豫了，現在就去開啟你的全新篇章吧！`;
        return;
    }

    // 顯示超有感、流動霓虹的未來風載入動畫
    resultText.innerHTML = `<div class="loading-animation">🪐 正在連線到未來時間線，AI 正在為你的夢想編織星路圖...</div>`;
    document.getElementById("shareBtn").style.display = "none";

    try {
        // 呼叫佈署好的 Supabase Edge Function 後端
        const { data, error: funcError } = await supabaseClient.functions.invoke('calculate-dream-ai', {
            body: { dreamName, currentMoney, income, expense, targetMoney: targetMoneyNum }
        });

        if (funcError) throw funcError;

        // 接收從雲端 Edge Function 傳回來的靈魂回覆與數據
        const { aiPlan, needMonths } = data;

        // 將 AI 回覆的換行符號 \n 轉為網頁的 <br> 渲染
        resultText.innerHTML = aiPlan.replace(/\n/g, "<br>");

        // 暫存資料到全域變數，以便使用者點擊「發布到夢想牆」時可以撈取
        latestDreamData = {
            dreamName: dreamName,
            targetMoney: targetMoneyNum,
            currentMoney: currentMoney,
            message: `預計 ${needMonths} 個月達成！衝了！`
        };

        // 秀出「發布到夢想牆」的按鈕
        document.getElementById("shareBtn").style.display = "block";

        // 把這次 AI 規劃結果同步記錄到 dreams 資料表
        const { error: dbError } = await supabaseClient.from("dreams").insert([
            {
                dream_name: dreamName,
                current_status: `目前存款：${currentMoney}，每月收支：+${monthlySave}`,
                target_goal: `目標金額：${targetMoneyNum}`,
                ai_plan: aiPlan
            }
        ]);

        if (dbError) {
            console.error("歷史紀錄存入資料庫失敗：", dbError);
        } else {
            alert("✨ AI 星路圖編織成功並已保存！");
        }

    } catch (err) {
        console.error("AI 規劃失敗，詳細錯誤資訊：", err);
        resultText.innerHTML = "❌ 星際連線中斷或金鑰失效，請確認 Supabase 函式與 OpenAI 狀態。";
    }
}

// 2. 手動發布夢想至便利貼牆
async function addDreamToWall() {
    const nickname = document.getElementById("nickname").value;
    const dreamName = document.getElementById("wallDreamName").value;
    const targetMoney = Number(document.getElementById("wallTargetMoney").value);
    const currentMoney = Number(document.getElementById("wallCurrentMoney").value);
    const message = document.getElementById("message").value;

    if (!nickname || !dreamName || !targetMoney || currentMoney < 0) {
        alert("請完整填寫資料");
        return;
    }

    const { error } = await supabaseClient
        .from("dream_wall")
        .insert([
            {
                nickname: nickname,
                dream_name: dreamName,
                target_money: targetMoney,
                current_money: currentMoney,
                message: message
            }
        ]);

    if (error) {
        console.error(error);
        alert("發布失敗");
        return;
    }

    alert("夢想發布成功！");
    loadDreamWall();
}

// 3. 載入便利貼牆上的所有夢想卡片
async function loadDreamWall() {
    const dreamList = document.getElementById("dreamList");
    if (!dreamList) return;

    const { data, error } = await supabaseClient
        .from("dream_wall")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    dreamList.innerHTML = "";

    if (data.length === 0) {
        dreamList.innerHTML = "<p>目前還沒有夢想紙條，快來成為第一個吧！</p>";
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
                <p class="dream-msg">${dream.message || ""}</p>
                <p class="dream-money">${dream.current_money.toLocaleString()} / ${dream.target_money.toLocaleString()}</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${percent}%"></div>
                </div>
                <p class="dream-percent">完成度 ${percent}%</p>
            </div>
        `;
    });
}

// 4. 將 AI 產生的規劃直接一鍵發布到便利貼牆
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

    const { error } = await supabaseClient
        .from("dream_wall")
        .insert([
            {
                nickname: nickname,
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

// 網頁載入完成後自動撈取夢想牆資料
window.onload = () => {
    loadDreamWall();
};