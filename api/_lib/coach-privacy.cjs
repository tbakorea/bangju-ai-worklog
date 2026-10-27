function redactText(value) {
  return value.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[이메일 제거]')
    .replace(/(?:\+82[-\s]?)?0?1[016789][-\s]?\d{3,4}[-\s]?\d{4}/g, '[연락처 제거]')
    .replace(/\b\d{6}[-\s]?[1-4]\d{6}\b/g, '[식별번호 제거]')
    .replace(/\bBearer\s+\S+/gi, '[인증정보 제거]')
    .replace(/([가-힣]{2,4})(?=\s*(회원|고객|님))/g, '해당 ');
}
function redactCoachContext(value) {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redactCoachContext);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/^(?:email|phone|telephone|contact|address|birthDate|memberName|memberId|password|secret|accessToken|refreshToken|rawData)$/i.test(key))
    .map(([key, item]) => [key, redactCoachContext(item)]));
}
module.exports = { redactText, redactCoachContext };
