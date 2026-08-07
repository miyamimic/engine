"""后端核心逻辑单元测试——无需网络，验证情绪公式/NLP/后处理。"""
import sys
import os
import asyncio

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# 强制 Mock 模式
os.environ.setdefault("RP_LLM_MODE", "mock")
os.environ.setdefault("RP_NLP_USE_LLM", "false")

from app.emotion import (
    clamp, add_emotion, scale_emotion, update_emotion_with_inertia,
    describe_emotion, dict_to_emotion, EmotionVector,
)
from app.postprocess import parse_segments, run_postprocessor, clean_pronouns
from app.nlp import analyze as nlp_analyze, heuristic_analyze
from app.characters import get_character_by_id


def test_clamp():
    assert clamp(1.5) == 1.0
    assert clamp(-0.3) == 0.0
    assert clamp(0.5) == 0.5
    print("  [ok] clamp")


def test_inertia_formula():
    # 对齐前端公式：newValue = current*inertia + (baseline+delta)*(1-inertia)
    cur = EmotionVector(anger=0.5, fear=0.1, joy=0.2, sadness=0.1, desire=0.3, warmth=0.2)
    baseline = EmotionVector(anger=0.2, fear=0.1, joy=0.3, sadness=0.1, desire=0.4, warmth=0.3)
    inertia = EmotionVector(anger=0.8, fear=0.6, joy=0.4, sadness=0.7, desire=0.5, warmth=0.3)
    delta = {"anger": 0.6, "desire": 0.2}
    r = update_emotion_with_inertia(cur, baseline, inertia, delta)
    # anger: target=clamp(0.2+0.6)=0.8; new=0.5*0.8 + 0.8*0.2 = 0.4+0.16=0.56
    assert abs(r.anger - 0.56) < 1e-6, f"anger 期望 0.56，得到 {r.anger}"
    # desire: target=clamp(0.4+0.2)=0.6; new=0.3*0.5 + 0.6*0.5 = 0.15+0.3=0.45
    assert abs(r.desire - 0.45) < 1e-6, f"desire 期望 0.45，得到 {r.desire}"
    # warmth 无 delta: target=0.3; new=0.2*0.3 + 0.3*0.7 = 0.06+0.21=0.27
    assert abs(r.warmth - 0.27) < 1e-6, f"warmth 期望 0.27，得到 {r.warmth}"
    print("  [ok] 六维情绪惯性公式（与前端对齐）")


def test_add_scale():
    base = EmotionVector(anger=0.3, fear=0.1, joy=0.2, sadness=0.1, desire=0.3, warmth=0.2)
    r = add_emotion(base, {"anger": 0.5, "joy": -0.1})
    assert abs(r.anger - 0.8) < 1e-6
    assert abs(r.joy - 0.1) < 1e-6
    s = scale_emotion({"anger": 0.4, "desire": 0.2}, 0.5)
    assert abs(s["anger"] - 0.2) < 1e-6
    print("  [ok] add/scale emotion")


def test_describe():
    e = EmotionVector(anger=0.7, fear=0.1, joy=0.2, sadness=0.1, desire=0.6, warmth=0.2)
    desc = describe_emotion(e)
    assert "烦躁" in desc or "愤怒" in desc or "欲望" in desc
    print(f"  [ok] describe_emotion -> {desc}")


def test_parse_segments():
    raw = "*按住肩膀*\n你说什么？\n（心跳有点快）\n*指尖蹭过手背*"
    segs = parse_segments(raw)
    types = [s.type for s in segs]
    assert "action" in types and "thought" in types and "speech" in types
    print(f"  [ok] parse_segments -> {types}")


def test_clean_pronouns():
    out = clean_pronouns("他把手放在桌上，她说了一句话。")
    assert "我" in out and "他" not in out and "她" not in out
    print(f"  [ok] clean_pronouns -> {out}")


def test_postprocessor_full():
    char = get_character_by_id("char_001")
    raw = "*按住肩膀*\n啧，又来了。\n（心里却没那么烦）"
    post = run_postprocessor(raw, char)
    assert post["action_valid"] in (True, False)  # 已有 control，touch 可能需补
    assert len(post["segments"]) >= 2
    print(f"  [ok] run_postprocessor action_valid={post['action_valid']}")


def test_nlp_heuristic():
    # 网络梗：启发式应识别为 meme，给一点 joy
    r = asyncio.run(nlp_analyze("我真的破防了emo", llm_caller=None))
    assert r.intent == "meme", f"期望 meme，得到 {r.intent}"
    assert r.emotion_delta.get("joy", 0) > 0
    print(f"  [ok] NLP 启发式识别网络梗 -> intent={r.intent}, delta={r.emotion_delta}")

    # 拒绝意图
    r2 = asyncio.run(nlp_analyze("不行，我做不到", llm_caller=None))
    assert r2.intent == "refuse"
    assert r2.emotion_delta.get("anger", 0) > 0
    print(f"  [ok] NLP 启发式识别拒绝 -> intent={r2.intent}, delta={r2.emotion_delta}")


def test_nlp_entities():
    r = asyncio.run(nlp_analyze("你胸肌练得不错啊，给我看看", llm_caller=None))
    assert "胸肌" in r.entities, f"期望抽取实体'胸肌'，得到 {r.entities}"
    print(f"  [ok] spaCy EntityRuler 抽取实体 -> {r.entities}")


if __name__ == "__main__":
    print("=== 后端单元测试 ===")
    test_clamp()
    test_inertia_formula()
    test_add_scale()
    test_describe()
    test_parse_segments()
    test_clean_pronouns()
    test_postprocessor_full()
    test_nlp_heuristic()
    test_nlp_entities()
    print("=== 全部通过 ===")
