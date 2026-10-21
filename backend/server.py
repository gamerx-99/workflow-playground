"""Backend ของ Workflow Automation Lab

รัน (จากโฟลเดอร์ backend):
  .venv\\Scripts\\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8787

Endpoint:
  GET  /health  -> { ok, ai }   ai = true เมื่อตั้ง GEMINI_API_KEY แล้ว
  POST /coach   -> CoachReply   (ดู coach.py)
"""

import asyncio

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
  return JSONResponse({"ok": True, "ai": coach.has_api_key()})


async def coach_endpoint(request: Request) -> JSONResponse:
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
            allow_origins=[
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "null",  # เปิดไฟล์ frontend/index.html ตรงๆ (file://)
            ],
            allow_methods=["GET", "POST"],
            allow_headers=["Content-Type"],
        )
    ],
)
