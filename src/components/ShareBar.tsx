/**
 * 공유 링크 복사.
 *
 * 이 도구의 사용 방식이 "가중치를 걸고 링크를 주고받는 것"이라 이 버튼이 곧 제품의 절반이다.
 * URL은 이미 App이 매 상태 변화마다 갱신하고 있으므로 여기서는 현재 주소를 그대로 복사한다 —
 * 링크를 따로 조립하면 화면과 어긋날 여지가 생긴다. 언어도 그 주소에 들어 있다.
 *
 * `navigator.clipboard`는 보안 컨텍스트(https·localhost)에서만 동작한다.
 * 실패하면 조용히 넘어가지 않고 주소를 직접 보여준다 — 복사됐다고 착각하는 것이 최악이다.
 */

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";

type Status = "idle" | "copied" | "failed";

export default function ShareBar() {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>("idle");
  const [href, setHref] = useState("");

  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), 2600);
    return () => window.clearTimeout(timer);
  }, [status]);

  const copy = async () => {
    const url = window.location.href;
    setHref(url);
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <div className="sharebar">
      <button type="button" className="sharebar__btn" onClick={copy}>
        {status === "copied" ? t("share.copied") : t("share.copy")}
      </button>

      {/* 상태 변화를 스크린리더에도 알린다 — 시각적 피드백만 두면 안 보인다 */}
      <span className="sr-only" role="status">
        {status === "copied" ? t("share.copiedSr") : ""}
        {status === "failed" ? t("share.failedSr") : ""}
      </span>

      {status === "failed" ? (
        <input
          className="sharebar__fallback num"
          readOnly
          value={href}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={t("share.fallback")}
        />
      ) : null}
    </div>
  );
}
