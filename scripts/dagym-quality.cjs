// Shared by the collector, retry uploader and API. Never treat an auth page as data.
function isAuthSource(value = "") {
  try { return /^\/account(?:\/|$)|\/login(?:\/|$)|\/sign-up(?:\/|$)/i.test(new URL(value, "https://www.dagym-manager.com").pathname); }
  catch { return true; }
}

function validateDailySnapshot(snapshot = {}) {
  const expected = { attendance: ["/dashboard/attendance", "daily"], sales: ["/sales/list", "month-to-date"], members: ["/member/list", "point-in-time"] };
  for (const [key, [path, period]] of Object.entries(expected)) {
    const domain = snapshot.domains?.[key];
    if (!domain?.ok || domain.authenticated !== true || (period !== "point-in-time" && domain.rangeVerified !== true) || isAuthSource(domain.source) || domain.source !== path || domain.period !== period || !Number.isFinite(Date.parse(domain.capturedAt))) {
      throw new Error(`다짐 ${key} 자료 검증 실패: 로그인·조회 화면을 확인해주세요.`);
    }
  }
  for (const key of ["visits", "sales"]) {
    const value = snapshot.metrics?.[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`다짐 ${key} 값 미확인: 0으로 대체하지 않습니다.`);
  }
  return true;
}

module.exports = { isAuthSource, validateDailySnapshot };
