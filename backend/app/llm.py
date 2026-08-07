"""LLM 调用层——OpenAI 兼容协议（DeepSeek/OpenAI/vLLM 等）+ Mock 兜底。

保留上一轮前端 RealLLM 的接入思路：可插拔、Mock 开箱即用。
本模块对上层提供统一 async 接口 llm_chat(system, user, temperature)。
"""
from __future__ import annotations

import logging
import random
from typing import Awaitable, Callable, Optional

import httpx

from .config import LLMConfig, get_runtime_llm_config

logger = logging.getLogger("rp.llm")

# llm_caller 类型：async (system, user, temperature) -> str
LLMCaller = Callable[[str, str, float], Awaitable[str]]


class MockLLM:
    """纯本地 Mock，用于无网络/未配置时兜底。基于角色参数生成结构化回复。"""

    def __init__(self):
        self._delay = (0.3, 0.6)

    async def chat(self, system: str, user: str, temperature: float = 0.85) -> str:
        import asyncio
        await asyncio.sleep(random.uniform(*self._delay))
        return _mock_generate(user)


def _mock_generate(user_input: str) -> str:
    """极简 Mock：返回符合三段式格式的占位回复，保证后处理能跑通。"""
    actions = ["按住你的肩膀", "指尖蹭过你的手背", "扣住你的手腕", "抚摸头发"]
    thoughts = ["（沉默了一会儿）", "（眼神动了动）", "（呼吸微乱）"]
    speeches = ["……嗯。", "怎么了？", "说下去。", "我知道了。"]
    a = random.choice(actions)
    t = random.choice(thoughts)
    s = random.choice(speeches)
    return f"*{a}*\n{s}\n{t}"


class RealLLM:
    """OpenAI 兼容 LLM 调用。"""

    def __init__(self, config: LLMConfig):
        self.config = config

    async def chat(self, system: str, user: str, temperature: float = 0.85) -> str:
        if not (self.config.endpoint and self.config.api_key and self.config.model):
            raise ValueError("LLM 配置不完整：endpoint/api_key/model")

        body = {
            "model": self.config.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": self.config.max_tokens,
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=self.config.timeout) as client:
            resp = await client.post(
                self.config.endpoint,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.config.api_key}",
                },
                json=body,
            )
            if resp.status_code >= 400:
                raise RuntimeError(f"LLM 接口返回 {resp.status_code}：{resp.text[:200]}")
            data = resp.json()
            content = (data.get("choices") or [{}])[0].get("message", {}).get("content")
            if not content or not str(content).strip():
                raise RuntimeError("LLM 返回内容为空")
            return str(content).strip()


def make_llm_caller(config: Optional[LLMConfig] = None) -> tuple[LLMCaller, str]:
    """根据配置返回 (async caller, mode)。api 配置不全则走 mock。"""
    cfg = config or get_runtime_llm_config()
    if cfg.mode == "api" and cfg.endpoint and cfg.api_key and cfg.model:
        real = RealLLM(cfg)

        async def _caller(system: str, user: str, temperature: float = 0.85) -> str:
            return await real.chat(system, user, temperature)

        return _caller, "api"

    mock = MockLLM()

    async def _caller(system: str, user: str, temperature: float = 0.85) -> str:
        return await mock.chat(system, user, temperature)

    return _caller, "mock"
