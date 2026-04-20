const { onValueCreated, onValueDeleted, onValueUpdated } = require("firebase-functions/v2/database");
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const { getDatabase } = require("firebase-admin/database");
const https = require("https");

initializeApp();

const HOLIDAY_API_KEY = defineSecret("HOLIDAY_API_KEY");

const MEMBERS = {
  dad:   { label: "아빠", emoji: "👨" },
  mom:   { label: "엄마", emoji: "👩" },
  child: { label: "딸",   emoji: "👧" },
};

/* ── 전체 토큰 조회 (멤버당 1개) ── */
async function getAllTokens() {
  const db = getDatabase();
  const snap = await db.ref("fcmTokens").get();
  if (!snap.exists()) return [];
  const tokens = [];
  snap.forEach(memberSnap => {
    const first = Object.values(memberSnap.val() || {}).find(t => t);
    if (first) tokens.push(first);
  });
  return tokens;
}

/* ── 발송자 제외 토큰 조회 (멤버당 1개) ── */
async function getTokens(excludeMemberId) {
  const db = getDatabase();
  const snap = await db.ref("fcmTokens").get();
  if (!snap.exists()) return [];
  const tokens = [];
  snap.forEach(memberSnap => {
    if (memberSnap.key === excludeMemberId) return;
    const first = Object.values(memberSnap.val() || {}).find(t => t);
    if (first) tokens.push(first);
  });
  return tokens;
}

/* ── 푸시 발송 (data-only) ──
   
   ★ 왜 data-only인가:
   notification 또는 webpush.notification을 포함하면
   브라우저가 "자동으로" 알림을 1번 표시하고,
   SW의 push 이벤트에서 showNotification을 호출하면 또 1번 → 합계 2번.
   
   data-only로 보내면 브라우저 자동 표시가 없고,
   SW의 push 이벤트에서만 showNotification → 정확히 1번.
   
   ★ 브라우저 꺼져있을 때:
   모바일에서는 브라우저가 완전히 종료되지 않는 한
   (백그라운드/최소화 상태) SW가 push를 수신할 수 있음.
   PWA로 설치된 경우 더 안정적.
*/
async function sendPush(tokens, title, body) {
  if (!tokens.length) return;
  const messaging = getMessaging();
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));
  for (const chunk of chunks) {
    await messaging.sendEachForMulticast({
      tokens: chunk,
      data: { title, body },
    });
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

/* ── 한국 시간 오늘 날짜 (YYYY-MM-DD) ── */
function getTodayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* ════════════════════════════════════════
   매일 오전 8시 당일 일정 알림
   (KST 08:00 = UTC 23:00 전날)
════════════════════════════════════════ */
exports.morningReminder = onSchedule(
  { schedule: "0 23 * * *", timeZone: "UTC", region: "us-central1" },
  async () => {
    const todayStr = getTodayKST();
    const db = getDatabase();
    const snap = await db.ref("events").get();
    if (!snap.exists()) return;

    const todayEvts = [];
    snap.forEach(child => {
      const e = child.val();
      if (e && e.date === todayStr) {
        todayEvts.push(e);
      }
    });

    if (!todayEvts.length) {
      console.log(`${todayStr} 오늘 일정 없음`);
      return;
    }

    todayEvts.sort((a, b) => (a.time || "ZZ:ZZ").localeCompare(b.time || "ZZ:ZZ"));

    const lines = todayEvts.map(e => {
      const mem = MEMBERS[e.member] || { emoji: "📅", label: "" };
      return `${mem.emoji} ${e.title}${e.time ? " " + e.time : ""}`;
    });

    const title = `📅 오늘 일정 ${todayEvts.length}개`;
    const body = lines.slice(0, 3).join(" / ") + (todayEvts.length > 3 ? ` 외 ${todayEvts.length - 3}건` : "");

    const tokens = await getAllTokens();
    await sendPush(tokens, title, body);
    console.log(`오전 알림 발송: ${todayEvts.length}건 → ${tokens.length}명`);
  }
);


exports.getHolidays = onRequest(
  { region: "us-central1", secrets: [HOLIDAY_API_KEY], cors: true },
  async (req, res) => {
    const year  = req.query.year;
    const month = req.query.month ? String(req.query.month).padStart(2, "0") : null;
    if (!year) { res.status(400).json({ error: "year 파라미터가 필요해요" }); return; }
    const apiKey = HOLIDAY_API_KEY.value();
    const baseUrl = "apis.data.go.kr";
    const path = month
      ? `/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?solYear=${year}&solMonth=${month}&ServiceKey=${apiKey}&_type=json&numOfRows=30`
      : `/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?solYear=${year}&ServiceKey=${apiKey}&_type=json&numOfRows=100`;
    try {
      const data = await new Promise((resolve, reject) => {
        https.get({ hostname: baseUrl, path, headers: { "Accept": "application/json" } }, (response) => {
          let body = "";
          response.on("data", chunk => body += chunk);
          response.on("end", () => { try { resolve(JSON.parse(body)); } catch (e) { reject(new Error("파싱실패: " + body.slice(0,200))); } });
        }).on("error", reject);
      });
      const items = data?.response?.body?.items?.item;
      if (!items) { res.json({ holidays: [] }); return; }
      const list = Array.isArray(items) ? items : [items];
      const holidays = list.map(item => ({
        date: String(item.locdate),
        name: item.dateName,
        isHoliday: item.isHoliday === "Y",
      }));
      res.json({ holidays });
    } catch (e) {
      console.error("공휴일 API 오류:", e);
      res.status(500).json({ error: e.message });
    }
  }
);

exports.onEventCreated = onValueCreated(
  { ref: "/events/{eventId}", region: "us-central1" },
  async (event) => {
    const data = event.data.val();
    if (!data) return;
    const member = MEMBERS[data.member] || { label: "누군가", emoji: "📅" };
    const tokens = await getTokens(data.member);
    await sendPush(tokens, `${member.emoji} ${member.label}가 일정을 추가했어요`, `${formatDate(data.date)} ${data.title}${data.time ? " · " + data.time : ""}`);
  }
);

exports.onEventDeleted = onValueDeleted(
  { ref: "/events/{eventId}", region: "us-central1" },
  async (event) => {
    const data = event.data.val();
    if (!data) return;
    const member = MEMBERS[data.member] || { label: "누군가", emoji: "📅" };
    const tokens = await getTokens(data.member);
    await sendPush(tokens, `${member.emoji} ${member.label}가 일정을 삭제했어요`, `${formatDate(data.date)} ${data.title}`);
  }
);

exports.onEventUpdated = onValueUpdated(
  { ref: "/events/{eventId}", region: "us-central1" },
  async (event) => {
    const after = event.data.after.val();
    if (!after) return;
    const member = MEMBERS[after.member] || { label: "누군가", emoji: "📅" };
    const tokens = await getTokens(after.member);
    await sendPush(tokens, `${member.emoji} ${member.label}가 일정을 수정했어요`, `${formatDate(after.date)} ${after.title}${after.time ? " · " + after.time : ""}`);
  }
);
