"""The implementation must match the design-first contract (docs/api/openapi.yaml, D12)."""

import os
import subprocess
import sys

import pytest
import yaml

from app.main import API_PREFIX, app
from tests.conftest import BACKEND

CONTRACT = os.path.join(BACKEND, "..", "docs", "api", "openapi.yaml")
METHODS = ("get", "post", "put", "patch", "delete")


@pytest.fixture(scope="module")
def contract() -> dict:
    with open(CONTRACT) as f:
        return yaml.safe_load(f)


def _ops(paths: dict, strip: str = "") -> dict[tuple[str, str], dict]:
    return {(m, p.removeprefix(strip)): op for p, item in paths.items() for m, op in item.items() if m in METHODS}


def _header_params(op: dict, spec: dict) -> set[str]:
    out = set()
    for p in op.get("parameters", []):
        if "$ref" in p:
            p = spec["components"]["parameters"][p["$ref"].split("/")[-1]]
        if p.get("in") == "header" and p.get("required"):
            out.add(p["name"].lower())
    return out


def test_every_implemented_operation_is_in_the_contract(contract: dict) -> None:
    impl = _ops(app.openapi()["paths"], API_PREFIX)
    designed = _ops(contract["paths"])
    for (method, path), op in impl.items():
        assert (method, path) in designed, f"{method.upper()} {path} is not in docs/api/openapi.yaml"
        assert op["operationId"] == designed[(method, path)]["operationId"], f"operationId differs for {method} {path}"


def test_required_headers_match(contract: dict) -> None:
    impl_spec = app.openapi()
    impl = _ops(impl_spec["paths"], API_PREFIX)
    designed = _ops(contract["paths"])
    for k, op in impl.items():
        want = _header_params(designed[k], contract)
        have = {p["name"].lower() for p in op.get("parameters", []) if p.get("in") == "header" and p.get("required")}
        assert want <= have, f"{k}: contract requires headers {want - have}"


def test_contract_coverage_report(contract: dict) -> None:
    """Not a failure: shows how much of the contract Phase 2 implements (the rest lands in Phases 3–6)."""
    impl = set(_ops(app.openapi()["paths"], API_PREFIX))
    designed = set(_ops(contract["paths"]))
    print(f"\ncontract coverage: {len(impl & designed)}/{len(designed)} operations implemented")
    assert impl <= designed


def test_models_match_migrations() -> None:
    """`alembic check` fails if the models and the migration history disagree."""
    r = subprocess.run(  # noqa: S603
        [sys.executable, "-m", "alembic", "check"], cwd=BACKEND, capture_output=True, text=True, env=os.environ.copy()
    )
    assert r.returncode == 0, r.stdout + r.stderr
