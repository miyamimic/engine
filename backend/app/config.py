"""配置：LLM 接入与运行参数。

LLM 采用 OpenAI 兼容协议（DeepSeek / OpenAI / 本地 vLLM 等均可）。
优先读环境变量初始化；运行时可通过 set_runtime_llm_config 覆盖（前端设置面板调用）。
未配置则走 MockLLM（开箱即用，不依赖网络）。
"""
from __future__ import annotations

import os
from dataclasses import dataclass, replace


@dataclass(frozen=True)
class LLMConfig:
    mode: str            # "mock" | "api"
    endpoint: str        # OpenAI 兼容 /v1/chat/completions
    api_key: str
    model: str
    temperature: float = 0.85
    max_tokens: int = 500
    timeout: float = 30.0


def load_llm_config() -> LLMConfig:
    mode = os.getenv("RP_LLM_MODE", "mock").strip().lower()
    if mode not in ("mock", "api"):
        mode = "mock"
    return LLMConfig(
        mode=mode,
        endpoint=os.getenv("RP_LLM_ENDPOINT", "").strip(),
        api_key=os.getenv("RP_LLM_API_KEY", "").strip(),
        model=os.getenv("RP_LLM_MODEL", "").strip(),
        temperature=float(os.getenv("RP_LLM_TEMPERATURE", "0.85")),
        max_tokens=int(os.getenv("RP_LLM_MAX_TOKENS", "500")),
        timeout=float(os.getenv("RP_LLM_TIMEOUT", "30")),
    )


# ---- 运行时配置覆盖（前端设置面板可修改） ----
_runtime_config: LLMConfig | None = None


def get_runtime_llm_config() -> LLMConfig:
    global _runtime_config
    if _runtime_config is not None:
        return _runtime_config
    _runtime_config = load_llm_config()
    return _runtime_config


def set_runtime_llm_config(
    mode: str | None = None,
    endpoint: str | None = None,
    api_key: str | None = None,
    model: str | None = None,
) -> LLMConfig:
    """更新运行时 LLM 配置（未传入的字段保持原值）。空字符串视为未设置。"""
    global _runtime_config
    cur = get_runtime_llm_config()
    updates: dict[str, object] = {}
    if mode is not None:
        m = mode.strip().lower()
        if m in ("mock", "api"):
            updates["mode"] = m
    if endpoint is not None:
        updates["endpoint"] = endpoint.strip()
    if api_key is not None:
        # 空字符串不覆盖（前端可能传空表示不改）；显式传 "" 也允许清空
        updates["api_key"] = api_key.strip()
    if model is not None:
        updates["model"] = model.strip()
    _runtime_config = replace(cur, **updates)  # type: ignore[arg-type]
    return _runtime_config


# NLP 意图分析层是否启用 LLM（关闭则仅用 spaCy 规则 + 启发式，泛化弱但零网络）
NLP_USE_LLM: bool = os.getenv("RP_NLP_USE_LLM", "true").strip().lower() in ("1", "true", "yes", "on")

# 服务运行配置
HOST: str = os.getenv("RP_HOST", "0.0.0.0")
PORT: int = int(os.getenv("RP_PORT", "8000"))
CORS_ORIGINS: list[str] = [
    o.strip() for o in os.getenv("RP_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if o.strip()
]

