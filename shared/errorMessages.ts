export const DEFAULT_ERROR_MESSAGE =
  "تعذر إتمام العملية. أعد المحاولة، وإذا استمرت المشكلة تواصل مع مسؤول النظام.";

const codeMessages: Record<string, string> = {
  UNAUTHORIZED: "انتهت الجلسة أو لم تسجّل الدخول. سجّل الدخول ثم أعد المحاولة.",
  FORBIDDEN: "ليس لديك صلاحية لتنفيذ هذه العملية.",
  BAD_REQUEST: "بيانات الإدخال غير صالحة. راجع الحقول المطلوبة والقيم ثم حاول مجددًا.",
  NOT_FOUND: "السجل المطلوب غير موجود أو لم يعد متاحًا.",
  CONFLICT: "تعذر تنفيذ العملية بسبب تعارض مع البيانات الحالية. حدّث الصفحة وراجع البيانات.",
  TOO_MANY_REQUESTS: "تم إرسال محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.",
  PAYLOAD_TOO_LARGE: "حجم الملف أو البيانات يتجاوز الحد المسموح.",
  TIMEOUT: "استغرقت العملية وقتًا طويلًا. تحقق من الاتصال ثم أعد المحاولة.",
};

// Keep useful Arabic business messages, while rejecting database and runtime details.
export function isUserErrorMessage(message: unknown): message is string {
  return typeof message === "string"
    && message.trim().length > 0
    && message.length <= 600
    && /[\u0621-\u064a]/.test(message)
    && !/^\s*[\[{]/.test(message)
    && !/failed query|params\s*:|sqlstate|\bER_[A-Z_]+\b|\b(?:ECONN\w*|ENOTFOUND|ENOENT|EACCES|EPERM)\b|\b(?:select\s+.+\s+from|insert\s+into|delete\s+from|alter\s+table|update\s+\S+\s+set)\b|node_modules|\bat\s+\S+\s*\(|\b(?:TypeError|ReferenceError|SyntaxError)\b|https?:\/\/|mysql:\/\/|[A-Z]:[\\/]|\b(?:stack|errno)\s*[:=]/i.test(message);
}

export function getUserErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  const details = error && typeof error === "object"
    ? error as { message?: unknown; code?: unknown; name?: unknown; data?: { code?: unknown } }
    : undefined;
  const message = typeof error === "string" ? error : details?.message;
  if (isUserErrorMessage(message)) return message.trim();

  const code = details?.data?.code ?? details?.code;
  if (typeof code === "string" && codeMessages[code]) return codeMessages[code];
  if ((typeof message === "string" && /failed to fetch|network|fetch failed|ECONN|ENOTFOUND/i.test(message))) {
    return "تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت ثم أعد المحاولة.";
  }
  if (details?.name === "AbortError" || (typeof message === "string" && /timeout|timed out/i.test(message))) {
    return codeMessages.TIMEOUT;
  }
  return isUserErrorMessage(fallback) ? fallback : DEFAULT_ERROR_MESSAGE;
}
