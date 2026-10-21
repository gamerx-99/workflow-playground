"""Backend ของ Workflow Automation Lab

รัน (จากโฟลเดอร์ backend):
  .venv\\Scripts\\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8787

Endpoint:
  GET  /health  -> { ok, ai, reason, provider }   ai = true เมื่อตั้ง API key (หรือ Google Login + project) แล้ว
                                        reason = no_api_key | no_project เมื่อ ai = false
  POST /coach   -> CoachReply   (ดู coach.py)
"""

import asyncio
import os

import pydantic
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

import coach

coach.load_dotenv()

MAX_BODY_BYTES = 64 * 1024
COACH_TIMEOUT_SECONDS = 60
_coach_slots = asyncio.Semaphore(2)  # เรียกโมเดลพร้อมกันได้ไม่เกิน 2 งาน


async def health(request: Request) -> JSONResponse:
  problem = coach.auth_problem()
  return JSONResponse({"ok": True, "ai": problem is None, "reason": problem, "provider": coach.provider()})


DEFAULT_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


def allowed_origins() -> list[str]:
  """Origin ของหน้าเว็บที่อนุญาตให้เรียก backend นี้ — ตั้งเพิ่มได้ด้วย ALLOWED_ORIGINS="a,b"

  ไม่รวม "null" โดยค่าเริ่มต้น: หน้าที่ถูก sandbox จะส่ง Origin: null ได้ จึงเลี่ยงการป้องกันนี้ได้
  (ผลคือเปิดหน้าเว็บแบบ file:// แล้ว AI Coach จะใช้ไม่ได้ — ถ้าจำเป็นให้ตั้ง ALLOWED_ORIGINS=null เอง)"""
  configured = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]
  return configured or DEFAULT_ALLOWED_ORIGINS


async def coach_endpoint(request: Request) -> JSONResponse:
  # CORS กันแค่การ "อ่านผล" ไม่ได้กันการส่งคำขอ — เว็บอื่นที่ผู้ใช้เปิดอยู่ยิงมาที่ localhost ได้ และการเรียกโมเดลมีค่าใช้จ่าย
  # จึงปฏิเสธคำขอที่มี Origin นอกรายการ และบังคับ application/json (ทำให้เว็บอื่นต้องผ่าน preflight ที่ถูกปฏิเสธ)
  origin = request.headers.get("origin")
  if origin and origin not in allowed_origins():
    return JSONResponse({"error": "origin_forbidden"}, status_code=403)
  if not request.headers.get("content-type", "").lower().startswith("application/json"):
    return JSONResponse({"error": "unsupported_media_type"}, status_code=415)
  raw = await request.body()
  if len(raw) > MAX_BODY_BYTES:
    return JSONResponse({"error": "too_large"}, status_code=413)
  try:
    req = coach.CoachRequest.model_validate_json(raw)
  except pydantic.ValidationError:
    return JSONResponse({"error": "invalid_request"}, status_code=422)

  if _coach_slots.locked():
    return JSONResponse({"error": "busy"}, status_code=429)
  async with _coach_slots:
    try:
      reply = await asyncio.wait_for(coach.ask_coach(req), COACH_TIMEOUT_SECONDS)
    except coach.CoachUnavailable as e:
      return JSONResponse({"error": str(e)}, status_code=503)
    except asyncio.TimeoutError:
      return JSONResponse({"error": "timeout"}, status_code=504)
    except Exception:  # noqa: BLE001 — ไม่ปล่อยรายละเอียดภายในออกไปให้ผู้ใช้
      return JSONResponse({"error": "coach_failed"}, status_code=502)
  return JSONResponse(reply.model_dump())


app = Starlette(
    routes=[
        Route("/health", health, methods=["GET"]),
        Route("/coach", coach_endpoint, methods=["POST"]),
    ],
    middleware=[
        Middleware(
            CORSMiddleware,
            allow_origins=allowed_origins(),
            allow_methods=["GET", "POST"],
            allow_headers=["Content-Type"],
        )
    ],
)
