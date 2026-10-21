"""รัน (จากโฟลเดอร์ backend): .venv\\Scripts\\python.exe -m unittest test_backend -v
ไม่เรียกโมเดลจริง — ทดสอบการตรวจอินพุต, การสร้าง prompt, การจัดการ error และการตั้งค่าความปลอดภัยของ agent
"""

import os
import unittest
from unittest import mock

from starlette.testclient import TestClient

import coach
import server

VALID = {
    "level_id": 2,
    "level_title": "คัดกรองยอดโอน",
    "level_desc": "ใช้ IF",
    "mode": "build",
    "flow": {
        "nodes": [{"id": 1, "type": "trigger_form", "config": {"formName": "ฟอร์ม"}}],
        "connections": [],
    },
    "check_items": [
        {"ok": True, "label": "มีบล็อก Form", "detail": ""},
        {"ok": False, "label": "ต่อสาย Form -> IF", "detail": "ยังไม่ได้ต่อ"},
    ],
    "attempt": 2,
}


class PromptTests(unittest.TestCase):
  def test_prompt_contains_failed_checks_and_level(self):
    p = coach.build_prompt(coach.CoachRequest(**VALID))
    self.assertIn("ต่อสาย Form -> IF", p)
    self.assertIn("ระดับ 2", p)
    self.assertIn("<flow>", p)

  def test_attempt_above_3_uses_strongest_level(self):
    p = coach.build_prompt(coach.CoachRequest(**{**VALID, "attempt": 9}))
    self.assertIn("ระดับ 3", p)

  def test_long_fields_are_clipped(self):
    req = dict(VALID)
    req["flow"] = {"nodes": [{"id": 1, "type": "x", "config": {"a": "ก" * 5000}}], "connections": []}
    p = coach.build_prompt(coach.CoachRequest(**req))
    self.assertLess(len(p), 3000)

  def test_empty_flow(self):
    self.assertIn("กระดานว่าง", coach.describe_flow(coach.Flow()))


class AgentSafetyTests(unittest.TestCase):
  def test_agent_has_only_finish_tool_and_no_subagents(self):
    cfg = coach.make_config()
    self.assertEqual([t.name for t in cfg.capabilities.enabled_tools], ["FINISH"])
    self.assertFalse(cfg.capabilities.enable_subagents)
    self.assertIsNotNone(cfg.budget_config)


class EndpointTests(unittest.TestCase):
  def setUp(self):
    self.client = TestClient(server.app)

  def test_health_reports_ai_flag(self):
    with mock.patch.dict(os.environ, {}, clear=True):
      self.assertFalse(self.client.get("/health").json()["ai"])
    with mock.patch.dict(os.environ, {"GEMINI_API_KEY": "x"}):
      self.assertTrue(self.client.get("/health").json()["ai"])

  def test_no_key_returns_503(self):
    with mock.patch.dict(os.environ, {}, clear=True):
      r = self.client.post("/coach", json=VALID)
    self.assertEqual(r.status_code, 503)
    self.assertEqual(r.json()["error"], "no_api_key")

  def test_invalid_request_returns_422(self):
    r = self.client.post("/coach", json={"level_id": "abc"})
    self.assertEqual(r.status_code, 422)

  def test_too_many_nodes_rejected(self):
    bad = {**VALID, "flow": {"nodes": [{"id": i} for i in range(coach.MAX_NODES + 1)], "connections": []}}
    self.assertEqual(self.client.post("/coach", json=bad).status_code, 422)

  def test_oversized_body_returns_413(self):
    bad = {**VALID, "level_desc": "x" * (server.MAX_BODY_BYTES + 10)}
    self.assertEqual(self.client.post("/coach", json=bad).status_code, 413)

  def test_success_with_stubbed_agent(self):
    reply = coach.CoachReply(diagnosis="d", hint="h", next_step="n", concept="c")
    with mock.patch.object(coach, "ask_coach", mock.AsyncMock(return_value=reply)):
      r = self.client.post("/coach", json=VALID)
    self.assertEqual(r.status_code, 200)
    self.assertEqual(r.json()["hint"], "h")

  def test_agent_crash_is_hidden_from_client(self):
    with mock.patch.object(coach, "ask_coach", mock.AsyncMock(side_effect=RuntimeError("secret internals"))):
      r = self.client.post("/coach", json=VALID)
    self.assertEqual(r.status_code, 502)
    self.assertNotIn("secret", r.text)

  def test_cors_allows_frontend_origin_only(self):
    ok = self.client.options("/coach", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
    self.assertEqual(ok.headers.get("access-control-allow-origin"), "http://localhost:5173")
    bad = self.client.options("/coach", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    self.assertIsNone(bad.headers.get("access-control-allow-origin"))


if __name__ == "__main__":
  unittest.main()
