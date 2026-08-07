# 角色扮演叙事引擎 - 需求拆解文档

## 产品概述

- **产品类型**: 角色扮演叙事引擎 Web 应用
- **场景类型**: <scene_type>prototype-app</scene_type>
- **目标用户**: 角色扮演爱好者、叙事游戏玩家、AI 对话体验用户
- **核心价值**: 前端本地代码主导叙事逻辑，LLM 仅作为文本生成模块，通过情绪惯性、后台思绪、记忆锚点等机制，打造具有完整人格连贯性的沉浸式角色扮演体验
- **界面语言**: 中文
- **主题偏好**: 深色主题（深灰/深蓝黑渐变，酒吧/深夜室内氛围）
- **导航模式**: 无导航（单页应用，顶部功能栏 + 侧边调试面板）
- **导航布局**: 无

---

## 页面结构总览

> **说明**：单页应用，所有功能在一个页面内完成。以下为页面区域划分。

**页面文件**: `index.html`

| 区域 | 说明 |
|-----|------|
| 顶部导航栏 | 当前角色名称 + 角色切换下拉菜单 + 设置按钮 + 侧边栏展开/收起按钮 |
| 动态背景层 | 深灰/深蓝黑渐变 + 漂浮粒子动画 + 光晕呼吸效果 |
| 对话主区域 | 垂直滚动对话窗口，左侧角色回复气泡，右侧用户消息气泡 |
| 底部输入区 | 文本输入框 + 发送按钮 |
| 右侧可折叠侧边栏 | 六维情绪雷达图 + 后台思绪列表 + 记忆锚点记录 |

---

## 页面布局建议

- **布局模式**: 主从布局（对话主区 + 右侧调试侧边栏） —— 主视觉重心在对话区域，侧边栏用于观察系统内部状态，可折叠以沉浸对话
- **视觉重心**: 对话内容区 —— 用户核心目标是与角色进行沉浸式角色扮演对话
- **结果承载区**: 对话消息流（气泡式）；初始态为欢迎消息（角色自我介绍 + 场景铺垫）
- **源材料承载区**: 侧边栏实时展示情绪状态、后台思绪、记忆锚点，便于调试和理解系统内部运作

---

## 数据来源声明

| 数据/操作 | 来源类型 | 实现要求 | mock 兜底 |
|---|---|---|---|
| 角色参数配置 | demo-mock | 内置 2 个示例角色（陆沉、阿野）的完整 JSON 配置，存于 `js/character.js` | ✅ 本身就是 mock 数据 |
| 对话历史 | local-persist | localStorage key=`__rp_engine_chat_history`，保存当前对话消息列表，角色切换时保留 | 无 |
| 当前情绪状态 | demo-mock | 前端内存变量，由预处理管道实时计算，角色切换时重置为基线 | 初始值来自角色 baseline |
| 后台思绪列表 | demo-mock | 前端内存变量，随对话轮次递减和更新 | 初始值来自角色 background_threads.active |
| 记忆锚点触发记录 | demo-mock | 前端内存变量，记录已触发的锚点及触发时间 | 初始为空数组 |
| LLM 文本生成 | demo-mock | MockLLM 类基于规则和模板生成回复，可插拔替换为真实 API | ✅ 默认使用 MockLLM 确保开箱即用 |
| LLM API 配置 | local-persist | localStorage key=`__rp_engine_llm_config`，保存用户配置的 API 端点和密钥 | 无（默认走 Mock） |

> 注：LLM 调用为可插拔模块，默认 Mock 实现；用户可自行配置 API 切换为真实调用。此为用户明确的前端演示项目设计，非 mock 降级。

---

## 功能列表

- **页面/区块**: 顶部导航栏
  - **页面目标**: 提供角色切换和系统设置入口
  - **功能点**:
    - **显示当前角色名称**: 实时展示当前正在对话的角色名字
    - **角色切换下拉菜单**: 点击展开角色列表，选择后切换角色，不刷新页面，保留对话历史，重置情绪状态为新角色基线
    - **设置按钮**: 点击弹出设置面板（LLM 接口配置、主题调整等）
    - **侧边栏切换按钮**: 控制右侧调试侧边栏的展开与收起

- **页面/区块**: 动态背景层
  - **页面目标**: 营造沉浸式深夜/酒吧氛围
  - **功能点**:
    - **深色渐变背景**: 深灰到深蓝黑的径向/线性渐变
    - **漂浮粒子动画**: CSS 动画实现 20-30 个半透明光点缓慢随机飘动
    - **光晕呼吸效果**: 微弱的明暗呼吸动画，增强氛围
    - **性能友好**: 动画不阻塞主线程，不影响对话滚动流畅度

- **页面/区块**: 对话主区域
  - **页面目标**: 展示角色扮演对话内容，支持三种消息样式混排
  - **功能点**:
    - **消息气泡渲染**: 用户消息右对齐深色气泡，角色消息左对齐浅色/主题色气泡
    - **三种内容样式解析与渲染**:
      - **言语段**: 普通文本，无特殊格式
      - **动作段**（\*...\*）: 斜体 + 暖橙色/琥珀色
      - **心理活动段**（(...)）: 灰色小字、字号小 1-2 号、透明度 0.7、带括号样式
    - **混合内容按序渲染**: 同一条回复中三种内容按原文顺序逐段排列
    - **对话自动滚动**: 新消息到达时自动滚动到底部
    - **加载状态**: LLM 生成中显示"正在输入..."或打字动画

- **页面/区块**: 底部输入区
  - **页面目标**: 用户输入对话内容并发送
  - **功能点**:
    - **文本输入框**: 支持多行输入，Enter 发送，Shift+Enter 换行
    - **发送按钮**: 点击触发消息发送和全流程处理
    - **输入状态管理**: 发送中禁用输入和按钮，防止重复提交

- **页面/区块**: 右侧可折叠侧边栏（调试面板）
  - **页面目标**: 实时展示系统内部状态，便于调试和观察
  - **功能点**:
    - **六维情绪可视化**: 使用 Chart.js 雷达图展示 anger/fear/joy/sadness/desire/warmth 当前值，随情绪更新实时刷新
    - **后台思绪列表**: 展示当前活跃思绪及剩余轮次，样式为列表项
    - **记忆锚点记录**: 展示对话过程中已触发的记忆锚点列表，包含触发词和反应描述
    - **折叠/展开**: 平滑过渡动画，折叠后不占用对话空间

- **页面/区块**: 预处理管道（调用 LLM 前）
  - **页面目标**: 按顺序执行 5 步预处理，生成结构化提示词
  - **功能点**:
    - **Trigger 匹配**: 遍历 emotion.triggers，检查用户输入关键词，累加 delta 得到 triggerDelta 向量
    - **六维情绪惯性更新**: 对每个维度独立执行 `newValue = oldValue * inertia + (baseline + triggerDelta) * (1 - inertia)`，结果 clamp 到 [0, 1]
    - **后台思绪处理**: 随机抽取 1~2 条活跃思绪，递减 remaining_turns，移除过期思绪，注入提示词
    - **记忆锚点检查**: 匹配锚点 trigger，将 `emotion_shift * weight` 叠加到情绪向量，收集 reaction 文本
    - **结构化提示词组装**: 按 [系统人格]/[当前情绪状态]/[后台思绪]/[记忆唤起]/[对话历史]/[用户输入]/[硬性输出格式约束] 七段式拼接，包含情绪自然语言描述

- **页面/区块**: 后处理管道（LLM 返回后）
  - **页面目标**: 清洗、解析、校验 LLM 输出，确保符合格式和动作要求
  - **功能点**:
    - **代词清洗**: 正则替换指向角色的第三人称代词为第一人称"我"
    - **状语清洗**: 扫描并删除禁止状语列表中的词，在附近插入随机 touch 动作（\*包裹\*）
    - **格式解析**: 提取动作段（\*...\*）、心理活动段（(...)）、言语段，按顺序排列
    - **动作完整性校验**: 检查是否含 control_actions 和 touch_actions 关键词，缺失则重试 LLM 修正（最多 2 次），仍不满足则强制追加缺省动作

- **页面/区块**: LLM 调用模块
  - **页面目标**: 提供可插拔的文本生成能力
  - **功能点**:
    - **MockLLM 类**: 基于情绪状态、思绪、记忆，用模板+随机组合生成包含言语、动作、心理活动的回复，情绪值影响语气和内容倾向
    - **API 接口占位**: 提供可配置的真实 LLM API 调用封装（端点、密钥、模型参数），用户可在设置中切换
    - **统一调用接口**: Mock 和真实 API 实现同一接口，上层逻辑无需感知具体实现

- **页面/区块**: 角色系统
  - **页面目标**: 管理角色数据和状态切换
  - **功能点**:
    - **角色类定义**: 封装角色参数、情绪状态、思绪、记忆等属性和方法
    - **内置 2 个示例角色**:
      - **陆沉**（酒吧老板型）: 本能 observe，愤怒惯性 0.8，温情惯性 0.3，欲望基线高，控制亲和 0.6，触碰亲和 0.7，低沉慵懒
      - **阿野**（年下野狗型）: 本能 attack，愤怒惯性 0.4，温情惯性 0.9，喜悦基线高，控制亲和 0.8，触碰亲和 0.4，直接粗糙
    - **角色切换逻辑**: 切换时重置当前情绪为基线、重置思绪和记忆状态，保留对话历史

---

## 数据共享配置

本项目为单页应用，核心数据通过全局模块变量共享，无需跨页面路由级数据共享。以下为核心数据对象的 TypeScript 接口定义，供代码实现参考：

```ts
// 六维情绪向量
interface EmotionVector {
  anger: number;
  fear: number;
  joy: number;
  sadness: number;
  desire: number;
  warmth: number;
}

// 情绪触发器
interface EmotionTrigger {
  keywords: string[];
  delta: Partial<EmotionVector>;
}

// 后台思绪
interface BackgroundThread {
  content: string;
  remaining_turns: number;
}

// 记忆锚点
interface MemoryAnchor {
  trigger: string;
  emotion_shift: Partial<EmotionVector>;
  reaction: string;
  weight: number;
}

// 动作倾向
interface ActionTendency {
  control_actions: string[];
  touch_actions: string[];
  forbidden_actions: string[];
  control_affinity: number;
  touch_affinity: number;
}

// 言语风格
interface SpeechStyle {
  catchphrases: string[];
  forbidden_phrases: string[];
}

// 角色核心
interface CharacterCore {
  values: string[];
  instinct_base: 'attack' | 'avoid' | 'freeze' | 'fawn' | 'observe';
  speech_filter: 'rough' | 'gentle' | 'formal' | 'casual';
}

// 角色完整定义
interface Character {
  character_id: string;
  name: string;
  core: CharacterCore;
  emotion: {
    current: EmotionVector;
    baseline: EmotionVector;
    inertia: EmotionVector;
    triggers: EmotionTrigger[];
  };
  background_threads: {
    active: BackgroundThread[];
  };
  memory: {
    anchors: MemoryAnchor[];
    triggered: { anchor: MemoryAnchor; triggeredAt: number }[];
  };
  action_tendency: ActionTendency;
  speech: SpeechStyle;
}

// 对话消息
interface ChatMessage {
  id: string;
  role: 'user' | 'character';
  content: string; // 原始文本
  segments: MessageSegment[]; // 解析后的分段
  timestamp: number;
  characterId?: string; // 角色消息时记录角色ID
}

// 消息分段（用于三种样式渲染）
interface MessageSegment {
  type: 'speech' | 'action' | 'thought';
  text: string;
}
```

---

## 技术选型

- **渲染层**: 原生 HTML + CSS + JavaScript（不依赖重型框架，符合用户要求）
- **图表库**: Chart.js（CDN 引入，用于六维情绪雷达图）
- **模块化**: 按文件划分模块（app / character / preprocessor / postprocessor / llm / ui / emotion），使用 IIFE 或 ES Module 组织
- **样式**: 纯 CSS，CSS Variables 管理主题色，CSS Animations 实现粒子和光晕效果
- **响应式**: Flexbox + 媒体查询，适配移动端和桌面端，移动端侧边栏默认收起

---

## 核心质量基线确认

- [x] 核心功能完整可用（情绪惯性公式、预处理管道 5 步、后处理管道 4 步、MockLLM 均有实际逻辑，非空壳）
- [x] 有基本的视觉层次（深色主题 + 动态背景 + 气泡对话 + 三色消息样式 + 侧边栏调试面板）
- [x] 交互有反馈（发送按钮状态、打字加载动画、情绪图实时刷新、侧边栏平滑过渡）
- [x] 边界状态有处理（空对话初始欢迎语、LLM 失败兜底、动作校验重试上限与强制追加、输入为空禁用发送）
- [x] 数据来源声明完整，Mock 为设计要求而非降级

-------

<scene_type>prototype-app</scene_type>

# UI 设计指南

## 1. 设计推导依据

- **参考意图**: Free —— 用户仅提供功能规格，无视觉参考，从产品语义自主建立方向
- **核心情绪 / 应用类型**: 深夜沉浸的角色扮演叙事工具，信息密度中等，强情绪代入感
- **独特记忆点**: 左侧琥珀色动作文本 + 灰色心理活动括号 + 普通言语三段式气泡，配合漂浮光点营造深夜酒吧独处叙事氛围

## 2. Art Direction

- **方向名**: 深夜酒吧叙事
- **Design Style**: Minimal Dark + Soft Glow —— 深色基底配合低饱和暖琥珀强调，模拟深夜室内弱光环境，强化叙事沉浸
- **DNA 参数**: 圆角 md-lg / 阴影 subtle inner glow / 间距 standard / 字体方向：无衬线正文 + 暖调动作斜体 / 装饰手法：漂浮粒子、微弱呼吸光晕
- **应用类型**: Tool（叙事引擎）—— 对话主区 + 右侧可折叠状态侧边栏

## 3. Color System

**色彩关系**: 深蓝黑夜色背景 + 暗灰卡片承载面 + 暖琥珀动作强调色 + 冷灰心理活动辅助色
**配色设计理由**: 主色琥珀对应"动作/行为"语义与深夜酒吧暖光氛围；深底高对比保证长对话可读性；心理活动用低饱和灰降低权重，符合"内心OS"的隐秘感
**主色推导**: 从酒吧暖光、深夜室内、动作语义提取琥珀色，与深蓝黑背景形成冷暖对比，饱和度克制避免霓虹感
**使用比例**: 70% 深中性 / 20% 辅助灰阶 / 10% 琥珀主色；primary 仅用于动作文本、发送按钮、情绪图高亮，不用于边框、tab、普通链接

| 角色 | CSS 变量 | Tailwind Class | HSL 值 | 设计说明 |
|---|---|---|---|---|
| bg | `--background` | `bg-background` | hsl(222 28% 9%) | 深蓝黑夜色渐变基底 |
| card | `--card` | `bg-card` | hsl(220 22% 13%) | 角色气泡、侧边栏面板 |
| text | `--foreground` | `text-foreground` | hsl(210 15% 90%) | 正文与用户气泡文字 |
| textMuted | `--muted-foreground` | `text-muted-foreground` | hsl(217 10% 55%) | 心理活动、时间戳、辅助说明 |
| primary | `--primary` | `bg-primary` / `text-primary` | hsl(28 85% 62%) | 动作文本、发送按钮、情绪激活 |
| primaryForeground | `--primary-foreground` | `text-primary-foreground` | hsl(28 30% 10%) | 主按钮上的文字 |
| accent | `--accent` | `bg-accent` | hsl(217 18% 18%) | hover 浅底、选中态、输入框底 |
| accentForeground | `--accent-foreground` | `text-accent-foreground` | hsl(210 15% 80%) | accent 上的文字与图标 |
| border | `--border` | `border-border` | hsl(217 12% 22%) | 气泡边界、输入框、分隔线 |

**语义色提示**: 情绪六维使用同色系明度区分——愤怒 hsl(0 70% 55%) / 恐惧 hsl(260 40% 60%) / 喜悦 hsl(48 80% 60%) / 悲伤 hsl(210 50% 55%) / 欲望 hsl(330 65% 60%) / 温情 hsl(28 80% 65%)；语义色饱和度均与 primary 琥珀色对齐 ±15%，避免单维度过于刺眼

## 4. 字体与节奏

- **font-display**: Noto Sans SC —— 中文角色名与标题，清晰无衬线保证深色下辨识度
- **font-body**: Noto Sans SC —— 对话正文，重量 400/500；动作段使用 italic 500；心理活动使用 300
- **字号**: 角色名 text-xl；气泡正文 text-base；动作文本 text-base italic；心理活动 text-sm；侧边栏标签 text-xs
- **圆角**: 中偏大 —— 气泡 rounded-2xl，输入框与卡片 rounded-xl，按钮 rounded-full，符合深夜柔软氛围

## 5. 全局布局契约

- **Reference Layout Use**: 按需求结构推导
- **Page / Section Order**: 顶部导航栏 → 主对话区（左角色 / 右用户气泡垂直滚动）→ 底部输入栏；右侧可折叠状态面板（情绪雷达 + 思绪列表 + 记忆锚点）
- **Standard Content Zone**: 对话主区 max-w-3xl `mx-auto`，侧边栏固定宽 320px（桌面端）
- **Shell / Frame Alignment**: 独立滚动 —— 对话区独立纵向滚动，侧边栏独立滚动，顶部导航与底部输入栏固定
- **Padding & Rhythm**: `px-4 md:px-6`，对话气泡间距 `gap-4 md:gap-6`，保持 8px 倍数
- **Full-bleed Zones**: 粒子背景与光晕全视口覆盖 `w-full h-full fixed inset-0`，对话区位于其上层
- **Local Narrowing**: 侧边栏内部内容统一 `p-4`，设置弹层 `max-w-sm`
- **Overflow Strategy**: 思绪列表、记忆锚点列表使用 `overflow-y-auto`；长对话由主容器滚动
- **Flexibility Boundary**: 移动端可折叠侧边栏为底部抽屉或隐藏；不允许改变主色、圆角体系、三段式消息样式

## 6. 视觉与动效

- **装饰**: 漂浮光点粒子（25-30 个，琥珀/蓝白混色，opacity 0.15-0.3）；微弱径向光晕呼吸（中心慢明慢暗，周期 6s）
- **阴影/边界**: 轻 —— 气泡 1px 边框 + 极 subtle 内发光；按钮 hover 时轻微外发光
- **动效**: 克制精致 —— 气泡入场 opacity + 轻微上移 200ms；粒子漂移动画 20-30s 缓慢循环；情绪图数值变化用 easing 过渡 500ms

## 7. 组件原则

- 消息气泡三种段式必须独立样式：言语段无装饰、动作段琥珀斜体、心理活动灰字小字号带括号
- 用户气泡靠右深底白字，角色气泡靠左浅灰底琥珀动作点缀
- 侧边栏折叠按钮、角色下拉、设置按钮必须有 hover / active / focus-visible 三态
- 情绪雷达图六维颜色与语义色一一对应，低透明度填充 + 实线描边
- 加载中状态用三点脉动动画，颜色取 textMuted，不打断叙事氛围

## 8. Image Direction

- **Image Role**: 背景氛围层（纯 CSS 粒子 + 光晕实现，无需位图；角色头像可选）
- **Image Art Direction**: 若使用角色头像，风格为暗调电影感特写，弱光打在脸部一侧，背景模糊呈暖琥珀色调，颗粒感胶片质感，情绪内敛有张力
- **Image Prompt Keywords**: 深夜酒吧暖光、低光人像特写、胶片颗粒、半边脸阴影、琥珀色光晕、模糊背景、电影感构图、情绪内敛
- **Image Avoidance**: 二次元立绘、纯白背景头像、高饱和打光、过度美化磨皮、商务正装照、明显 AI 素材感

## 9. Anti-patterns

- **Split personality**: 不同角色切换时改变气泡样式或配色系统；角色差异只通过内容、情绪曲线、头像体现
- **Phantom tokens**: 编造不存在的语义色变量；情绪维度色使用内联 style 或语义色 class，不混入基础 token
- **Default SaaS drift**: 回到亮蓝主按钮、纯白卡片、无阴影的通用后台风格；必须维持深夜酒吧暖琥珀 + 深蓝黑基调
- **Invisible interaction**: 输入框、按钮、下拉菜单只有 hover 没有 focus-visible；深色主题下用琥珀色描边 + 微弱外发光做键盘焦点
- **Mono-hue tyranny**: 琥珀色铺满按钮、边框、图标、链接、气泡背景；严格限定 primary 只用于动作文本、发送按钮、情绪高亮
- **Mixed message types**: 动作、言语、心理活动混在同一样式里；三段必须独立渲染、独立字号颜色、视觉权重有级差