"""워크플로끼리의 약속.

test.yml은 "갱신일에 러너에서 처음 깨지는 일"을 막으려고 있다. 그러려면 월간 갱신과
**같은 Python 버전·같은 폰트 환경**에서 테스트해야 한다. 한쪽만 올리면 CI는 초록인데
갱신일에 깨지는, test.yml이 생기기 전과 똑같은 상태로 돌아간다.
"""

from __future__ import annotations

import re
from pathlib import Path

WF = Path(__file__).resolve().parents[1] / ".github" / "workflows"


def _py_versions(name: str) -> set[str]:
    return set(re.findall(r'python-version:\s*"([^"]+)"', (WF / name).read_text(encoding="utf-8")))


def _node_versions(name: str) -> set[str]:
    return set(re.findall(r"node-version:\s*(\d+)", (WF / name).read_text(encoding="utf-8")))


def test_python_version_is_the_same_everywhere():
    versions = {n: _py_versions(n) for n in ("test.yml", "refresh-data.yml", "parser-canary.yml")}
    assert all(len(v) == 1 for v in versions.values()), versions
    assert len(set().union(*versions.values())) == 1, versions


def test_node_version_is_the_same_everywhere():
    assert _node_versions("test.yml") == _node_versions("deploy.yml")


def test_test_workflow_installs_the_same_korean_font_as_refresh():
    """og_image의 한글판 검사는 폰트가 없으면 skip된다. 갱신 쪽엔 있고 CI엔 없으면
    그 검사는 CI에서 영원히 skip된 채 초록불로 보인다."""
    assert "fonts-nanum" in (WF / "refresh-data.yml").read_text(encoding="utf-8")
    assert "fonts-nanum" in (WF / "test.yml").read_text(encoding="utf-8")


def test_test_workflow_runs_the_whole_suite():
    txt = (WF / "test.yml").read_text(encoding="utf-8")
    assert re.search(r"pytest tests/(\s|$)", txt), "전체 tests/를 돌려야 한다 — 일부만 돌리면 빈틈이 생긴다"
