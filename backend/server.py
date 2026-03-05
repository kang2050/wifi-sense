"""
Wi-Fi Sense Backend Server
FastAPI + WebSocket，提供真实 CSI 数据流和 AI 活动识别
"""

import asyncio
import json
import threading
import time
from collections import deque
from typing import Any

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from data_generator import (
    ActivitySession,
    CSIFrame,
    ACTIVITY_PROFILES,
    stream_frames,
)
from classifier import RealtimeClassifier

app = FastAPI(title="Wi-Fi Sense API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局状态
_classifier = RealtimeClassifier()
_session = ActivitySession()
_frame_buffer: deque[dict] = deque(maxlen=500)
_timeline: list[dict] = []
_connected_clients: set[WebSocket] = set()
_forced_activity: str | None = None
_is_running = False
_frame_idx = 0
_start_time = time.time()


def _frame_to_dict(frame: CSIFrame, ai_result: dict | None) -> dict:
    return {
        "type": "frame",
        "timestamp": frame.timestamp,
        "frameIndex": frame.frame_index,
        "activity": ai_result["activity"] if ai_result else frame.activity,
        "confidence": ai_result["confidence"] if ai_result else frame.confidence,
        "probabilities": ai_result["probabilities"] if ai_result else {},
        "subcarriers": frame.subcarriers,
        "rssi": frame.rssi,
        "noiseFloor": frame.noise_floor,
    }


async def _broadcast(message: dict):
    if not _connected_clients:
        return
    data = json.dumps(message)
    dead = set()
    for ws in _connected_clients:
        try:
            await ws.send_text(data)
        except Exception:
            dead.add(ws)
    _connected_clients.difference_update(dead)


def _data_loop():
    """后台线程：持续生成 CSI 帧"""
    global _frame_idx, _start_time, _is_running, _session

    prev_subcarriers = None
    frame_idx = 0

    from data_generator import _generate_frame
    import time as _time

    while True:
        if not _is_running:
            _time.sleep(0.1)
            continue

        t = _time.time() - _start_time
        activity = _forced_activity if _forced_activity else _session.tick()

        frame = _generate_frame(
            activity, frame_idx, t,
            np.array(prev_subcarriers) if prev_subcarriers else None,
        )
        prev_subcarriers = frame.subcarriers
        frame_idx += 1

        # AI 推理
        ai_result = _classifier.push_frame(frame.subcarriers)

        frame_dict = _frame_to_dict(frame, ai_result)
        _frame_buffer.append(frame_dict)

        # 每 30 帧记录一次活动事件
        if frame_idx % 30 == 0 and ai_result:
            event = {
                "type": "event",
                "id": f"evt-{frame_idx}",
                "timestamp": _time.time() * 1000,
                "activity": ai_result["activity"],
                "confidence": ai_result["confidence"],
                "label": ACTIVITY_PROFILES[ai_result["activity"]]["label"],
            }
            _timeline.append(event)
            if len(_timeline) > 100:
                _timeline.pop(0)
            asyncio.run_coroutine_threadsafe(
                _broadcast(event),
                _event_loop,
            )

        asyncio.run_coroutine_threadsafe(
            _broadcast(frame_dict),
            _event_loop,
        )

        _time.sleep(0.1)  # 10 Hz


_event_loop: asyncio.AbstractEventLoop = None


@app.on_event("startup")
async def startup():
    global _event_loop
    _event_loop = asyncio.get_event_loop()
    t = threading.Thread(target=_data_loop, daemon=True)
    t.start()


# ── REST 接口 ──────────────────────────────────────────────

@app.get("/api/status")
def get_status():
    return {
        "running": _is_running,
        "forcedActivity": _forced_activity,
        "frameCount": len(_frame_buffer),
        "timelineCount": len(_timeline),
        "activities": list(ACTIVITY_PROFILES.keys()),
    }


@app.post("/api/start")
def start_stream():
    global _is_running, _start_time, _session
    _is_running = True
    _start_time = time.time()
    _session = ActivitySession()
    return {"ok": True}


@app.post("/api/stop")
def stop_stream():
    global _is_running
    _is_running = False
    return {"ok": True}


@app.post("/api/reset")
def reset_stream():
    global _is_running, _frame_buffer, _timeline, _session, _forced_activity
    _is_running = False
    _frame_buffer.clear()
    _timeline.clear()
    _session = ActivitySession()
    _forced_activity = None
    return {"ok": True}


@app.post("/api/activity/{activity}")
def set_activity(activity: str):
    global _forced_activity
    if activity == "auto":
        _forced_activity = None
    elif activity in ACTIVITY_PROFILES:
        _forced_activity = activity
    else:
        return {"ok": False, "error": "unknown activity"}
    return {"ok": True}


@app.get("/api/timeline")
def get_timeline():
    return {"events": list(reversed(_timeline))[:50]}


# ── WebSocket ──────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    _connected_clients.add(ws)

    # 发送初始状态
    await ws.send_text(json.dumps({
        "type": "connected",
        "activities": {k: v["label"] for k, v in ACTIVITY_PROFILES.items()},
        "running": _is_running,
    }))

    # 发送缓冲区里最近的帧（让前端立即有数据显示）
    recent = list(_frame_buffer)[-50:]
    for f in recent:
        await ws.send_text(json.dumps(f))

    try:
        while True:
            await ws.receive_text()   # 保持连接
    except WebSocketDisconnect:
        _connected_clients.discard(ws)
