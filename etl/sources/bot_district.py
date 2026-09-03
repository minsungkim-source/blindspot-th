"""BOT 군별 예수신·지점수 (cb_t3E-district.zip) — Phase 2 (ADM2).

검증 완료: 8.9MB, 24개 파일(2005-2026), 각 파일에 월별 시트.
2018년 이전은 .xls(xlrd), 2019년 이후는 .xlsx(openpyxl).

각주 원문: "Especially Districts which have four commercial banks or more."
→ 2026-01 시트 기준 약 306행. 928개 군 전부가 아니다.
   빠진 622개 군은 '상업은행이 4곳 미만인 군'이라는 정보 그 자체다.
   결측으로 숨길지 갭 신호로 쓸지는 제품 결정 사항.
"""

from __future__ import annotations

import io
import zipfile

import pandas as pd
import requests

URL = ("https://www.bot.or.th/content/dam/bot/documents/en/statistics/"
       "financial-institutions-statistics/cb_t3E-district.zip")

# 시트 레이아웃(검증): 3행=그룹헤더, 4행=서브헤더, 5행=Head Office, 6행부터 주/군
HEADER_ROW = 4
FIRST_DATA_ROW = 5


def load(config: dict) -> dict:
    r = requests.get(URL, timeout=180)
    r.raise_for_status()
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    names = [n for n in zf.namelist() if n.endswith((".xls", ".xlsx"))]
    latest = sorted(names)[-1]

    # TODO(Phase 2): 최신 시트를 골라 파싱하고, 주 헤더 행으로 군을 그룹핑한다.
    #                주 이름 행은 수치 셀이 비어 있고 다음 행부터 군이 이어진다.
    raise NotImplementedError(f"bot_district: {latest} 파싱 미구현 (Phase 2)")
