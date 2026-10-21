"""รัน (จากโฟลเดอร์ backend): .venv\\Scripts\\python.exe -m unittest test_backend -v
ไม่เรียกโมเดลจริง — ทดสอบการตรวจอินพุต, การสร้าง prompt, การจัดการ error และการตั้งค่าความปลอดภัยของ agent
"""

import os
import tempfile
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


class VertexConfigTests(unittest.TestCase):
  def test_uses_vertex_standard_mode_without_api_key(self):
    env = {"GOOGLE_CLOUD_PROJECT": "my-proj", "GOOGLE_CLOUD_LOCATION": "asia-southeast1", "GEMINI_API_KEY": "ignored"}
    with mock.patch.dict(os.environ, env, clear=True):
      cfg = coach.make_config()
    self.assertTrue(cfg.vertex)
    self.assertEqual((cfg.project, cfg.location), ("my-proj", "asia-southeast1"))
    self.assertIsNone(cfg.api_key)

  def test_default_location(self):
    with mock.patch.dict(os.environ, {"GOOGLE_CLOUD_PROJECT": "p"}, clear=True):
      self.assertEqual(coach.vertex_settings(), ("p", "us-central1"))


class AgentSafetyTests(unittest.TestCase):
  def test_agent_has_only_finish_tool_and_no_subagents(self):
    cfg = coach.make_config()
    self.assertEqual([t.name for t in cfg.capabilities.enabled_tools], ["FINISH"])
    self.assertFalse(cfg.capabilities.enable_subagents)
    self.assertIsNotNone(cfg.budget_config)


class EndpointTests(unittest.TestCase):
  def setUp(self):
    self.client = TestClient(server.app)

  def _auth(self, logged_in: bool, project: str | None):
    """จำลองสถานะล็อกอิน Google (ไฟล์ ADC) และ project"""
    tmp = tempfile.NamedTemporaryFile(delete=False)
    tmp.close()
    self.addCleanup(os.unlink, tmp.name)
    env = {"GOOGLE_APPLICATION_CREDENTIALS": tmp.name if logged_in else tmp.name + ".missing"}
    if project:
      env["GOOGLE_CLOUD_PROJECT"] = project
    return mock.patch.dict(os.environ, env, clear=True)

  def test_health_reports_auth_state(self):
    with self._auth(False, "p"):
      self.assertEqual(self.client.get("/health").json(), {"ok": True, "ai": False, "reason": "no_login"})
    with self._auth(True, None):
      self.assertEqual(self.client.get("/health").json()["reason"], "no_project")
    with self._auth(True, "my-proj"):
      self.assertEqual(self.client.get("/health").json(), {"ok": True, "ai": True, "reason": None})

  def test_not_logged_in_returns_503(self):
    with self._auth(False, "p"):
      r = self.client.post("/coach", json=VALID)
    self.assertEqual(r.status_code, 503)
    self.assertEqual(r.json()["error"], "no_login")

  def test_missing_project_returns_503(self):
    with self._auth(True, None):
      r = self.client.post("/coach", json=VALID)
    self.assertEqual(r.status_code, 503)
    self.assertEqual(r.json()["error"], "no_project")

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
