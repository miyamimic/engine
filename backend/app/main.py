"""FastAPI 入口——角色扮演叙事引擎后端。

所有响应统一输出 camelCase（与前端对齐）。
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS, get_runtime_llm_config, set_runtime_llm_config
from .engine import get_engine
from .models import (
    ChatRequest,
    ChatResponse,
    SwitchRequest,
    SessionResponse,
    CharacterBrief,
)
from .characters import MOCK_CHARACTERS

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s %(message)s")
logger = logging.getLogger("rp.main")

app = FastAPI(title="角色扮演叙事引擎 后端", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    eng = get_engine()
    cfg = get_runtime_llm_config()
    return {"ok": True, "llm_mode": eng.llm_mode, "llm_config": cfg.mode}


@app.get("/api/llm_config")
async def get_llm_config():
    """返回当前 LLM 配置（api_key 脱敏）。"""
    cfg = get_runtime_llm_config()
    key = cfg.api_key
    masked = (key[:3] + "***" + key[-4:]) if len(key) > 8 else ("***" if key else "")
    return {
        "mode": cfg.mode,
        "endpoint": cfg.endpoint,
        "apiKey": masked,
        "model": cfg.model,
        "hasKey": bool(key),
    }


@app.post("/api/llm_config")
async def update_llm_config(payload: dict):
    """更新 LLM 配置并 reload。字段缺省则保持原值。
    apiKey 含 *** 或为空字符串视为不改（避免脱敏值覆盖真实 key）。
    """
    cur = get_runtime_llm_config()
    new_key = payload.get("apiKey") if "apiKey" in payload else payload.get("api_key")
    if isinstance(new_key, str) and ("***" in new_key or new_key == ""):
        new_key = cur.api_key
    set_runtime_llm_config(
        mode=payload.get("mode"),
        endpoint=payload.get("endpoint"),
        api_key=new_key,
        model=payload.get("model"),
    )
    eng = get_engine()
    mode = eng.reload_llm()
    return {"ok": True, "llm_mode": mode}


@app.post("/api/reload_llm")
async def reload_llm():
    eng = get_engine()
    mode = eng.reload_llm()
    return {"ok": True, "llm_mode": mode}


@app.get("/api/characters")
async def list_characters():
    return [
        CharacterBrief(
            character_id=c.character_id,
            name=c.name,
            instinct_base=c.core.instinct_base,
            speech_filter=c.core.speech_filter,
        ).model_dump(by_alias=True)
        for c in MOCK_CHARACTERS
    ]


def _session_dict(sess) -> dict:
    return SessionResponse(
        session_id=sess.session_id,
        character_id=sess.character.character_id,
        character_name=sess.character.name,
        emotion=sess.emotion,
        background_threads=sess.background_threads,
        triggered_anchors=sess.triggered_anchors,
        messages=sess.messages,
    ).model_dump(by_alias=True)


@app.post("/api/chat")
async def chat(req: ChatRequest):
    eng = get_engine()
    sess = eng.get_or_create_session(req.session_id, req.character_id)
    try:
        char_msg, intent, fallback = await sess.send(req.user_input)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        logger.exception("chat 处理异常")
        raise HTTPException(status_code=500, detail=f"处理失败：{e}")

    return ChatResponse(
        session_id=sess.session_id,
        character_id=sess.character.character_id,
        character_name=sess.character.name,
        reply=char_msg,
        emotion=sess.emotion,
        background_threads=sess.background_threads,
        triggered_anchors=sess.triggered_anchors,
        intent=intent,
        fallback=fallback,
    ).model_dump(by_alias=True)


@app.post("/api/switch")
async def switch_character(req: SwitchRequest):
    from .characters import get_character_by_id
    eng = get_engine()
    sess = eng.get_or_create_session(req.session_id, req.character_id)
    target = get_character_by_id(req.character_id)
    if not target:
        raise HTTPException(status_code=404, detail="角色不存在")
    sess.switch_character(target.model_copy(deep=True))
    return _session_dict(sess)


@app.post("/api/reset_emotion")
async def reset_emotion(req: SwitchRequest):
    eng = get_engine()
    sess = eng.get_or_create_session(req.session_id, req.character_id)
    sess.reset_emotion()
    return _session_dict(sess)


@app.post("/api/clear_history")
async def clear_history(req: SwitchRequest):
    eng = get_engine()
    sess = eng.get_or_create_session(req.session_id, req.character_id)
    sess.clear_history()
    return _session_dict(sess)


@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    eng = get_engine()
    sess = eng.sessions.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="会话不存在")
    return _session_dict(sess)


if __name__ == "__main__":
    import uvicorn
    from .config import HOST, PORT

    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=False)
