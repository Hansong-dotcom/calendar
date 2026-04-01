const { onValueCreated, onValueDeleted, onValueUpdated } = require("firebase-functions/v2/database");
const { initializeApp } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const { getDatabase } = require("firebase-admin/database");

initializeApp();

const MEMBERS = {
  dad:   { label: "아빠", emoji: "👨" },
  mom:   { label: "엄마", emoji: "👩" },
  child: { label: "딸",   emoji: "👧" },
};

/* ── 토큰 전체 조회 (발송자 제외) ── */
async function getTokens(excludeMemberId) {
  const db = getDatabase();
  const snap = await db.ref("fcmTokens").get();
  if (!snap.exists()) return [];
  const tokens = [];
  snap.forEach(memberSnap => {
    if (memberSnap.key === excludeMemberId) return; // 본인 제외
    memberSnap.forEach(tokenSnap => {
      const t = tokenSnap.val();
      if (t) tokens.push(t);
    });
  });
  return tokens;
}

/* ── 알림 발송 ── */
async function sendPush(tokens, title, body) {
  if (!tokens.length) return;
  const messaging = getMessaging();
  // 토큰을 500개씩 나눠서 발송 (FCM 제한)
  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }
  for (const chunk of chunks) {
    await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: { title, body },
      webpush: {
        notification: {
          title,
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
        },
        fcmOptions: { link: "/" },
      },
    });
  }
}

/* ── 날짜 포맷 ── */
function formatDate(dateStr) {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

/* ════════════════════════════
   일정 추가
════════════════════════════ */
exports.onEventCreated = onValueCreated(
  { ref: "/events/{eventId}", region: "us-central1" },
  async (event) => {
    const data = event.data.val();
    if (!data) return;
    const member = MEMBERS[data.member] || { label: "누군가", emoji: "📅" };
    const tokens = await getTokens(data.member);
    const dateStr = formatDate(data.date);
    await sendPush(
      tokens,
      `${member.emoji} ${member.label}가 일정을 추가했어요`,
      `${dateStr} ${data.title}${data.time ? " · " + data.time : ""}`
    );
  }
);

/* ════════════════════════════
   일정 삭제
════════════════════════════ */
exports.onEventDeleted = onValueDeleted(
  { ref: "/events/{eventId}", region: "us-central1" },
  async (event) => {
    const data = event.data.val();
    if (!data) return;
    const member = MEMBERS[data.member] || { label: "누군가", emoji: "📅" };
    const tokens = await getTokens(data.member);
    const dateStr = formatDate(data.date);
    await sendPush(
      tokens,
      `${member.emoji} ${member.label}가 일정을 삭제했어요`,
      `${dateStr} ${data.title}`
    );
  }
);

/* ════════════════════════════
   일정 수정
════════════════════════════ */
exports.onEventUpdated = onValueUpdated(
  { ref: "/events/{eventId}", region: "us-central1" },
  async (event) => {
    const after = event.data.after.val();
    if (!after) return;
    const member = MEMBERS[after.member] || { label: "누군가", emoji: "📅" };
    const tokens = await getTokens(after.member);
    const dateStr = formatDate(after.date);
    await sendPush(
      tokens,
      `${member.emoji} ${member.label}가 일정을 수정했어요`,
      `${dateStr} ${after.title}${after.time ? " · " + after.time : ""}`
    );
  }
);