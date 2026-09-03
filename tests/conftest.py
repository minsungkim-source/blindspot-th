"""pytest 부트스트랩 — etl/ 을 import 경로에 올린다."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "tests" / "fixtures"

sys.path.insert(0, str(ROOT / "etl"))


def pytest_addoption(parser):
    parser.addoption(
        "--update-vectors",
        action="store_true",
        default=False,
        help="패리티 골든 벡터를 지금의 figi.py 결과로 다시 굽는다 (diff는 사람이 본다).",
    )
