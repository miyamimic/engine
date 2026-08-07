import type { EmotionVector } from '../data/types';

interface Props {
  emotion: EmotionVector;
  /** 上一轮的情绪（用于对比），可选 */
  previousEmotion?: EmotionVector;
  /** 情绪变化是否已确认（未确认时新情绪为透明白，确认后变黄） */
  confirmed?: boolean;
  className?: string;
}

const EMOTION_LABELS: { key: keyof EmotionVector; label: string }[] = [
  { key: 'anger', label: '愤怒' },
  { key: 'fear', label: '恐惧' },
  { key: 'joy', label: '喜悦' },
  { key: 'sadness', label: '悲伤' },
  { key: 'desire', label: '欲望' },
  { key: 'warmth', label: '温情' },
];

/**
 * 纯 SVG 六维情绪雷达图。
 * 支持：
 * - 旧情绪（透明白色虚线）+ 新情绪（有色实线）双层叠加
 * - 红绿增减小字标注（↑红 ↓绿）
 * - 确认状态：未确认时新情绪半透明，确认后变亮黄
 */
export default function EmotionRadar({ emotion, previousEmotion, confirmed = true, className }: Props) {
  const size = 240;
  const center = size / 2;
  const radius = size * 0.36;
  const levels = 4;

  const anglePerAxis = (Math.PI * 2) / 6;
  const startAngle = -Math.PI / 2;

  function pointOnRadius(index: number, r: number): [number, number] {
    const angle = startAngle + anglePerAxis * index;
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r];
  }

  const hasPrevious = previousEmotion !== undefined;

  // 新情绪数据点
  const newPoints = EMOTION_LABELS.map((e, i) => {
    const value = Math.max(0, Math.min(1, emotion[e.key]));
    return pointOnRadius(i, radius * value);
  });
  const newPolygon = newPoints.map((p) => p.join(',')).join(' ');

  // 旧情绪数据点
  const oldPoints = hasPrevious
    ? EMOTION_LABELS.map((e, i) => {
        const value = Math.max(0, Math.min(1, previousEmotion![e.key]));
        return pointOnRadius(i, radius * value);
      })
    : [];
  const oldPolygon = oldPoints.map((p) => p.join(',')).join(' ');

  // 新情绪填充/描边颜色：未确认 = 透明白，确认 = 黄
  const newFill = confirmed ? 'hsl(48 90% 60% / 0.28)' : 'rgba(255,255,255,0.12)';
  const newStroke = confirmed ? '#fbbf24' : 'rgba(255,255,255,0.4)';
  const newDotFill = confirmed ? '#fbbf24' : 'rgba(255,255,255,0.5)';

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className || 'w-full h-auto'}
      role="img"
      aria-label="六维情绪雷达图"
    >
      {/* 背景同心多边形 */}
      {Array.from({ length: levels }).map((_, li) => {
        const r = (radius * (li + 1)) / levels;
        const pts = EMOTION_LABELS.map((_, i) => pointOnRadius(i, r).join(',')).join(' ');
        return (
          <polygon key={li} points={pts} fill="none" stroke="hsl(217 12% 22%)" strokeWidth="1" />
        );
      })}

      {/* 轴线 */}
      {EMOTION_LABELS.map((_, i) => {
        const [x, y] = pointOnRadius(i, radius);
        return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="hsl(217 12% 22%)" strokeWidth="1" />;
      })}

      {/* 旧情绪多边形（透明白色虚线） */}
      {hasPrevious && (
        <polygon
          points={oldPolygon}
          fill="rgba(255,255,255,0.05)"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          strokeLinejoin="round"
        />
      )}

      {/* 新情绪多边形 */}
      <polygon
        points={newPolygon}
        fill={newFill}
        stroke={newStroke}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* 新情绪数据点 */}
      {newPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill={newDotFill} />
      ))}

      {/* 红绿增减标注 */}
      {hasPrevious &&
        EMOTION_LABELS.map((e, i) => {
          const oldVal = previousEmotion![e.key];
          const newVal = emotion[e.key];
          const diff = newVal - oldVal;
          if (Math.abs(diff) < 0.005) return null;

          const [px, py] = pointOnRadius(i, radius + 22);
          const isUp = diff > 0;
          const color = isUp ? '#ef4444' : '#22c55e'; // ↑红 ↓绿
          const sign = isUp ? '↑' : '↓';
          return (
            <text
              key={`delta-${e.key}`}
              x={px}
              y={py}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={color}
              style={{ fontSize: '10px', fontWeight: 600 }}
            >
              {sign}{Math.abs(diff).toFixed(2)}
            </text>
          );
        })}

      {/* 标签 */}
      {EMOTION_LABELS.map((e, i) => {
        const labelR = radius + 38;
        const [x, y] = pointOnRadius(i, labelR);
        const angle = startAngle + anglePerAxis * i;
        let textAnchor: 'start' | 'middle' | 'end' = 'middle';
        if (Math.cos(angle) > 0.3) textAnchor = 'start';
        else if (Math.cos(angle) < -0.3) textAnchor = 'end';
        return (
          <text
            key={e.key}
            x={x}
            y={y}
            textAnchor={textAnchor}
            dominantBaseline="middle"
            className="fill-muted-foreground"
            style={{ fontSize: '12px' }}
          >
            {e.label}
          </text>
        );
      })}
    </svg>
  );
}
