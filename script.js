const SUPABASE_URL = "https://avsophbhivsuzmcuyxyx.supabase.co";
const SUPABASE_KEY = "sb_publishable_1CPRkxPqGVMuJiMSHhoHQQ_1RNkSZWK";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let latestDreamData = null;
let latestAiPlanText = "";

// ─────────────────────────────────────────────
// 【修正 7】暱稱也經過同樣的過濾
// 共用一份 badWords，供 isBadInput 使用
// ─────────────────────────────────────────────
const BAD_WORDS = [
    "大便", "屎", "糞", "垃圾", "白癡", "智障", "幹你",
    "幹", "靠北", "靠邀", "fuck", "shit"
];

function isBadInput(text) {
    const value = String(text || "").trim();
    if (value.length < 2) return true;
    const onlySymbols = /^[^\u4e00-\u9fa5a-zA-Z0-9]+$/.test(value);
    if (onlySymbols) return true;
    return BAD_WORDS.some(word => value.toLowerCase().includes(word.toLowerCase()));
}

// 舊名保留，供 index.html 中的 onclick 繼續使用
function isBadDreamInput(text) {
    return isBadInput(text);
}

function formatMoney(num) {
    return Number(num).toLocaleString("zh-TW");
}

// ─────────────────────────────────────────────
// 【修正 6】取代 prompt() 的通用 Modal 輸入框
// ─────────────────────────────────────────────
function showInputModal({ title, placeholder, onConfirm }) {
    // 若已存在就移除重建
    const old = document.getElementById("_inputModal");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "_inputModal";
    overlay.style.cssText = `
        position:fixed;inset:0;z-index:99999;
        display:flex;align-items:center;justify-content:center;
        background:rgba(3,7,18,0.82);backdrop-filter:blur(10px);
        padding:24px;
    `;

    overlay.innerHTML = `
        <div style="
            width:min(460px,96%);padding:32px;border-radius:28px;
            background:rgba(15,23,42,0.97);
            border:1px solid rgba(255,255,255,0.14);
            box-shadow:0 30px 90px rgba(0,0,0,0.65),0 0 45px rgba(168,85,247,0.18);
        ">
            <h3 style="margin:0 0 18px;color:#f8fafc;font-size:1.1rem;">${title}</h3>
            <input id="_modalInput" type="text" placeholder="${placeholder}"
                style="width:100%;padding:14px 16px;border-radius:14px;
                border:1px solid rgba(148,163,184,0.22);
                background:rgba(15,23,42,0.78);font-size:16px;color:#f8fafc;
                box-sizing:border-box;"
            />
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px;">
                <button id="_modalCancel" style="
                    margin:0;padding:13px;border-radius:14px;
                    background:rgba(255,255,255,0.08);color:#cbd5e1;
                    font-size:15px;font-weight:700;cursor:pointer;border:none;
                ">取消</button>
                <button id="_modalConfirm" style="
                    margin:0;padding:13px;border-radius:14px;
                    background:linear-gradient(90deg,#ff6ec7,#a855f7,#3b82f6);
                    color:#fff;font-size:15px;font-weight:800;
                    cursor:pointer;border:none;
                ">確認</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const input = document.getElementById("_modalInput");
    input.focus();

    const close = () => overlay.remove();

    document.getElementById("_modalCancel").onclick = close;
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

    const confirm = () => {
        const val = input.value.trim();
        close();
        onConfirm(val);
    };

    document.getElementById("_modalConfirm").onclick = confirm;
    input.addEventListener("keydown", e => { if (e.key === "Enter") confirm(); });
}

// ─────────────────────────────────────────────
// 1. AI 夢想計算與規劃
// ─────────────────────────────────────────────
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

    if (isBadInput(dreamName)) {
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
        currentMoney < 0 || income <= 0 || expense < 0 || targetMoney <= 0 ||
        Number.isNaN(currentMoney) || Number.isNaN(income) ||
        Number.isNaN(expense) || Number.isNaN(targetMoney)
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

    // 【修正 3】存款已超過目標時，顯示「已達成」提示
    if (remainMoney <= 0) {
        resultText.innerHTML = `
            <div class="ai-plan-content">
                <b>【${dreamName}】</b><br><br>
                🎉 你目前的存款已經達到這個夢想的目標金額了！<br><br>
                這個夢想已經在你的口袋裡了。<br>
                接下來要思考的不是「能不能做到」，而是「現在就行動了」。<br><br>
                要把這個達成紀錄發布到夢想牆上嗎？
            </div>
        `;
        latestDreamData = { dreamName, targetMoney, currentMoney, message: "已達成目標！🎉" };
        latestAiPlanText = `【${dreamName}】存款已達成目標金額 ${formatMoney(targetMoney)} 元。`;
        shareBtn.style.display = "block";
        copyBtn.style.display = "block";
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
            { body: { dreamName, currentMoney, income, expense, targetMoney } }
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

        const { error: dbError } = await supabaseClient.from("dreams").insert([{
            dream_name: dreamName,
            current_status: `目前存款：${currentMoney}，每月收支：+${monthlySave}`,
            target_goal: `目標金額：${targetMoney}`,
            ai_plan: aiPlan,
            user_id: currentUser ? currentUser.id : null,
            user_email: currentUser ? currentUser.email : null
        }]);

        if (dbError) console.error("歷史紀錄存入資料庫失敗：", dbError);

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

// ─────────────────────────────────────────────
// 2. 複製 AI 規劃
// ─────────────────────────────────────────────
async function copyPlan() {
    if (!latestAiPlanText) {
        alert("目前沒有可以複製的 AI 規劃。");
        return;
    }
    await navigator.clipboard.writeText(latestAiPlanText);
    alert("AI 規劃已複製！");
}

// ─────────────────────────────────────────────
// 3. 手動新增夢想到夢想牆
// 【修正 7】暱稱也過濾
// ─────────────────────────────────────────────
async function addDreamToWall() {
    const nickname = document.getElementById("nickname").value.trim();
    const dreamName = document.getElementById("wallDreamName").value.trim();
    const targetMoney = Number(document.getElementById("wallTargetMoney").value);
    const currentMoney = Number(document.getElementById("wallCurrentMoney").value);
    const message = document.getElementById("message").value.trim();

    if (isBadInput(nickname)) {
        alert("暱稱包含不適當的內容，請重新輸入。");
        return;
    }

    if (isBadInput(dreamName)) {
        alert("夢想名稱包含不適當的內容，請重新輸入。");
        return;
    }

    if (targetMoney <= 0 || currentMoney < 0 || Number.isNaN(targetMoney) || Number.isNaN(currentMoney)) {
        alert("請填寫正確的金額。");
        return;
    }

    const { error } = await supabaseClient.from("dream_wall").insert([{
        nickname,
        dream_name: dreamName,
        target_money: targetMoney,
        current_money: currentMoney,
        message: message || "慢慢來，但不要停。",
        user_id: currentUser ? currentUser.id : null,
        user_email: currentUser ? currentUser.email : null
    }]);

    if (error) {
        console.error(error);
        alert("發布失敗：" + error.message);
        return;
    }

    alert("夢想卡建立成功！");
    loadDreamWall();
}

// ─────────────────────────────────────────────
// 4. 載入夢想牆
// 【修正 2】只有在有 #dreamList 時才執行，避免首頁多餘呼叫
// ─────────────────────────────────────────────
async function loadDreamWall() {
    const dreamList = document.getElementById("dreamList");
    if (!dreamList) return; // 首頁沒有此元素，直接結束

    dreamList.innerHTML = "<p>夢想牆載入中...</p>";

    const { data, error } = await supabaseClient
        .from("dream_wall")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("夢想牆載入失敗：", error);
        dreamList.innerHTML = "<p>夢想牆載入失敗，請查看 Console 錯誤訊息。</p>";
        return;
    }

    if (!data || data.length === 0) {
        dreamList.innerHTML = "<p>目前還沒有夢想卡，快來成為第一個吧！</p>";
        return;
    }

    dreamList.innerHTML = "";

    data.forEach(dream => {
        const currentMoney = Number(dream.current_money || 0);
        const targetMoney = Number(dream.target_money || 1);
        const percent = Math.min(100, Math.round((currentMoney / targetMoney) * 100));

        // 【修正 3】已達成的卡片顯示特殊樣式
        const isCompleted = currentMoney >= targetMoney;

        const card = document.createElement("div");
        card.className = "dream-item" + (isCompleted ? " dream-completed" : "");

        card.innerHTML = `
            ${isCompleted ? '<div class="completed-badge">🎉 已達成</div>' : ""}
            <h3>${escapeHtml(dream.nickname)}</h3>
            <p><b>夢想：</b>${escapeHtml(dream.dream_name)}</p>
            <p class="dream-msg">${escapeHtml(dream.message || "慢慢來，但不要停。")}</p>
            <p class="dream-money">
                ${formatMoney(currentMoney)} / ${formatMoney(targetMoney)} 元
            </p>
            <div class="progress-bar">
                <div class="progress-fill" style="width:${percent}%"></div>
            </div>
            <p class="dream-percent">完成度 ${percent}%</p>
            <button class="update-btn">更新進度</button>
        `;

        card.addEventListener("click", () => {
            openPlanModal(dream.dream_name || "AI 夢想導航紀錄", dream.ai_plan || "");
        });

        const updateBtn = card.querySelector(".update-btn");
        updateBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            // 【修正 1 & 4】更新時驗證是否為本人的卡片
            updateDreamProgress(dream.id, targetMoney, dream.user_id);
        });

        dreamList.appendChild(card);
    });
}

// ─────────────────────────────────────────────
// 5. 更新夢想進度
// 【修正 1】驗證本人身份
// 【修正 6】改用自訂 Modal，取代 prompt()
// ─────────────────────────────────────────────
async function updateDreamProgress(id, targetMoney, ownerId) {
    // 【修正 1】有登入者：只能更新自己的卡片
    if (ownerId && currentUser && currentUser.id !== ownerId) {
        alert("⚠️ 你只能更新自己的夢想進度喔！");
        return;
    }

    // 【修正 1】此卡片有綁定 user_id，但目前未登入
    if (ownerId && !currentUser) {
        alert("⚠️ 這張夢想卡需要登入才能更新。請先使用 Google 登入。");
        return;
    }

    // 【修正 6】用自訂 Modal 取代 prompt()
    showInputModal({
        title: "📊 更新目前存款",
        placeholder: "請輸入最新存款金額（例如：120000）",
        onConfirm: async (newMoney) => {
            if (newMoney === "" || newMoney === null) return;

            const moneyNumber = Number(newMoney);
            if (Number.isNaN(moneyNumber) || moneyNumber < 0) {
                alert("請輸入正確的金額。");
                return;
            }

            const { data, error } = await supabaseClient
                .from("dream_wall")
                .update({ current_money: moneyNumber })
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

            // 【修正 3】達標時顯示慶祝提示
            if (moneyNumber >= targetMoney) {
                alert("🎉 恭喜！這個夢想已經達標了！你辦到了！");
            } else {
                alert("✅ 進度已更新！繼續加油！");
            }

            loadDreamWall();
        }
    });
}

// ─────────────────────────────────────────────
// 6. 將 AI 規劃發布到夢想牆
// 【修正 6】暱稱改用自訂 Modal，取代 prompt()
// 【修正 7】暱稱也過濾
// ─────────────────────────────────────────────
async function sharePlanToWall() {
    if (!latestDreamData) {
        alert("請先產生 AI 規劃");
        return;
    }

    showInputModal({
        title: "🌌 請輸入顯示在夢想牆上的暱稱",
        placeholder: "例如：追夢的阿明",
        onConfirm: async (nickname) => {
            if (!nickname) {
                alert("請輸入暱稱");
                return;
            }

            // 【修正 7】暱稱過濾
            if (isBadInput(nickname)) {
                alert("暱稱包含不適當的內容，請重新輸入。");
                return;
            }

            const { error } = await supabaseClient.from("dream_wall").insert([{
                nickname,
                dream_name: latestDreamData.dreamName,
                target_money: latestDreamData.targetMoney,
                current_money: latestDreamData.currentMoney,
                message: latestDreamData.message,
                ai_plan: latestAiPlanText,
                user_id: currentUser ? currentUser.id : null,
                user_email: currentUser ? currentUser.email : null
            }]);

            if (error) {
                console.error(error);
                alert("發布到夢想牆失敗");
                return;
            }

            alert("已成功發布到夢想牆！");
            window.location.href = "wall.html";
        }
    });
}

// ─────────────────────────────────────────────
// 7. 載入首頁統計資料
// 【修正 2】移除首頁不需要的 loadDreamWall() 呼叫
// ─────────────────────────────────────────────
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

    totalDreamsEl.textContent = dreams.length;

    completedDreamsEl.textContent = dreams.filter(d =>
        Number(d.current_money) >= Number(d.target_money)
    ).length;

    totalTargetMoneyEl.textContent =
        formatMoney(dreams.reduce((sum, d) => sum + Number(d.target_money || 0), 0)) + " 元";

    const totalSavedMoneyEl = document.getElementById("totalSavedMoney");
    if (totalSavedMoneyEl) {
        totalSavedMoneyEl.textContent =
            formatMoney(dreams.reduce((sum, d) => sum + Number(d.current_money || 0), 0)) + " 元";
    }
}

// ─────────────────────────────────────────────
// 工具函式
// ─────────────────────────────────────────────
function escapeHtml(text) {
    return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function openPlanModal(title, plan) {
    const modalTitle = document.getElementById("modalTitle");
    const modalPlanText = document.getElementById("modalPlanText");
    const planModal = document.getElementById("planModal");
    if (!modalTitle || !modalPlanText || !planModal) return;

    modalTitle.innerText = `🌌 ${title}`;
    modalPlanText.innerHTML = plan
        ? escapeHtml(plan).replace(/\n/g, "<br>")
        : "這張夢想卡目前沒有 AI 規劃紀錄。";

    planModal.style.display = "flex";
}

function closePlanModal() {
    const planModal = document.getElementById("planModal");
    if (planModal) planModal.style.display = "none";
}

window.addEventListener("click", function (event) {
    const planModal = document.getElementById("planModal");
    if (event.target === planModal) closePlanModal();
});

// ─────────────────────────────────────────────
// Google 登入
// ─────────────────────────────────────────────
let currentUser = null;

async function checkGoogleUser() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) { console.error("取得登入狀態失敗：", error); return; }

    const user = data.session?.user || null;
    currentUser = user;

    const loginBtn = document.getElementById("googleLoginBtn");
    if (!loginBtn) return;

    if (user) {
        loginBtn.innerHTML = `
            <span class="login-email">${user.email}</span>
            <span class="logout-text">登出</span>
        `;
        loginBtn.onclick = signOutGoogle;
    } else {
        loginBtn.innerHTML = "使用 Google 登入";
        loginBtn.onclick = signInWithGoogle;
    }
}

async function signInWithGoogle() {
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: "https://brucelay0412.github.io/DreamScope/" }
    });
    if (error) { console.error("Google 登入失敗：", error); alert("Google 登入失敗"); }
}

async function signOutGoogle() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) { console.error("登出失敗：", error); alert("登出失敗"); return; }
    currentUser = null;
    alert("已登出");
    location.reload();
}

// ─────────────────────────────────────────────
// 頁面載入
// 【修正 2】首頁不再呼叫 loadDreamWall()，各頁面按需載入
// ─────────────────────────────────────────────
window.onload = async () => {
    await checkGoogleUser();

    // wall.html 才需要載入夢想牆
    if (document.getElementById("dreamList")) {
        loadDreamWall();
    }

    // index.html 才需要載入統計
    if (document.getElementById("totalDreams")) {
        loadHomeStats();
    }
};
