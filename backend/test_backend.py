"""รัน (จากโฟลเดอร์ backend): .venv\\Scripts\\python.exe -m unittest test_backend -v
ไม่เรียกโมเดลจริง — ทดสอบการตรวจอินพุต, การสร้าง prompt, การจัดการ error และการตั้งค่าความปลอดภัยของ agent
"""

import json
import os
import tempfile
import unittest
from unittest import mock

import httpx
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


GOOD_JSON = '{"diagnosis": "d", "hint": "h", "next_step": "n", "concept": "c"}'


def _openai_reply(content: str, status: int = 200):
  """transport จำลองของ API ที่เข้ากันได้กับ OpenAI — เก็บ request ล่าสุดไว้ตรวจ"""
  seen = {}

  def handler(request: httpx.Request) -> httpx.Response:
    seen["request"] = request
    if status != 200:
      return httpx.Response(status, json={"error": "x"})
    return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})

  return httpx.MockTransport(handler), seen


class OpenAICompatibleTests(unittest.IsolatedAsyncioTestCase):
  ENV = {"THIRX_API_KEY": "secret-key-123", "THIRX_BASE_URL": "https://ai.example.test/v1", "THIRX_MODEL": "m-1"}

  async def ask(self, content, status=200, env=None):
    transport, seen = _openai_reply(content, status)
    with mock.patch.dict(os.environ, env or self.ENV, clear=True):
      try:
        return await coach.ask_openai_compatible(coach.CoachRequest(**VALID), transport=transport), seen
      finally:
        self.seen = seen

  async def test_success_and_request_shape(self):
    reply, seen = await self.ask(GOOD_JSON)
    self.assertEqual(reply.hint, "h")
    req = seen["request"]
    self.assertEqual(str(req.url), "https://ai.example.test/v1/chat/completions")
    self.assertEqual(req.headers["authorization"], "Bearer secret-key-123")
    body = json.loads(req.content)
    self.assertEqual(body["model"], "m-1")
    self.assertNotIn("secret-key-123", req.content.decode())  # คีย์อยู่ใน header เท่านั้น ไม่เข้าไปใน prompt
    self.assertEqual([m["role"] for m in body["messages"]], ["system", "user"])
    self.assertIn("ต่อสาย Form -> IF", body["messages"][1]["content"])

  async def test_tolerates_think_tags_and_code_fences(self):
    wrapped = f"<think>ลองคิดดู {{not json}}</think>\n```json\n{GOOD_JSON}\n```\nหวังว่าช่วยได้"
    reply, _ = await self.ask(wrapped)
    self.assertEqual(reply.diagnosis, "d")

  async def test_invalid_json_raises(self):
    with self.assertRaises(Exception):
      await self.ask("ขอโทษ ตอบไม่ได้")

  async def test_missing_field_raises(self):
    with self.assertRaises(Exception):
      await self.ask('{"diagnosis": "d"}')

  async def test_401_is_auth_failed(self):
    with self.assertRaises(coach.CoachUnavailable) as cm:
      await self.ask("", status=401)
    self.assertEqual(str(cm.exception), "auth_failed")

  async def test_429_is_busy(self):
    with self.assertRaises(coach.CoachUnavailable) as cm:
      await self.ask("", status=429)
    self.assertEqual(str(cm.exception), "busy")

  async def test_server_error_raises_and_does_not_leak_key(self):
    with self.assertRaises(Exception) as cm:
      await self.ask("", status=500)
    self.assertNotIn("secret-key-123", str(cm.exception))

  async def test_plain_http_base_url_is_refused(self):
    env = {**self.ENV, "THIRX_BASE_URL": "http://ai.example.test/v1"}
    with self.assertRaises(coach.CoachUnavailable) as cm:
      await self.ask(GOOD_JSON, env=env)
    self.assertEqual(str(cm.exception), "bad_base_url")

  async def test_localhost_http_is_allowed(self):
    env = {**self.ENV, "THIRX_BASE_URL": "http://localhost:11434/v1"}
    reply, _ = await self.ask(GOOD_JSON, env=env)
    self.assertEqual(reply.next_step, "n")

  async def test_openai_key_alias_and_defaults(self):
    with mock.patch.dict(os.environ, {"OPENAI_API_KEY": "k2"}, clear=True):
      self.assertEqual(coach.api_settings(), ("k2", "https://ai.thirx.com/v1", "Qwen3.8-27B-free"))

  async def test_ask_coach_prefers_api_key_over_vertex(self):
    with mock.patch.dict(os.environ, {**self.ENV, "GOOGLE_CLOUD_PROJECT": "p"}, clear=True):
      self.assertEqual(coach.provider(), "openai")


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
      self.assertEqual(self.client.get("/health").json(), {"ok": True, "ai": False, "reason": "no_api_key", "provider": None})
    with self._auth(True, None):
      self.assertEqual(self.client.get("/health").json()["reason"], "no_project")
    with self._auth(True, "my-proj"):
      self.assertEqual(self.client.get("/health").json(), {"ok": True, "ai": True, "reason": None, "provider": "vertex"})
    with mock.patch.dict(os.environ, {"THIRX_API_KEY": "k-test"}, clear=True):
      self.assertEqual(self.client.get("/health").json(), {"ok": True, "ai": True, "reason": None, "provider": "openai"})

  def test_health_never_leaks_the_key(self):
    with mock.patch.dict(os.environ, {"THIRX_API_KEY": "super-secret-key-value"}, clear=True):
      self.assertNotIn("super-secret", self.client.get("/health").text)

  def test_no_credentials_returns_503(self):
    with self._auth(False, "p"):
      r = self.client.post("/coach", json=VALID)
    self.assertEqual(r.status_code, 503)
    self.assertEqual(r.json()["error"], "no_api_key")

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
