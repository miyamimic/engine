import type { EmotionVector } from '../data/types';

interface Props {
  emotion: EmotionVector;
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
 * 纯 SVG 六维情绪雷达图，避免依赖 ECharts
 */
export default function EmotionRadar({ emotion, className }: Props) {
  const size = 220;
  const center = size / 2;
  const radius = size * 0.38;
  const levels = 4;

  // 六边形顶点计算
  const anglePerAxis = (Math.PI * 2) / 6;
  const startAngle = -Math.PI / 2; // 从顶部开始

  function pointOnRadius(index: number, r: number): [number, number] {
    const angle = startAngle + anglePerAxis * index;
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r];
  }

  const dataPoints = EMOTION_LABELS.map((e, i) => {
    const value = Math.max(0, Math.min(1, emotion[e.key]));
    const r = radius * value;
    return pointOnRadius(i, r);
  });

  const polygonPoints = dataPoints.map((p) => p.join(',')).join(' ');

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
          <polygon
            key={li}
            points={pts}
            fill="none"
            stroke="hsl(217 12% 22%)"
            strokeWidth="1"
          />
        );
      })}

      {/* 轴线 */}
      {EMOTION_LABELS.map((_, i) => {
        const [x, y] = pointOnRadius(i, radius);
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            stroke="hsl(217 12% 22%)"
            strokeWidth="1"
          />
        );
      })}

      {/* 数据多边形 */}
      <polygon
        points={polygonPoints}
        fill="hsl(28 85% 62% / 0.25)"
        stroke="#f59e42"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* 数据点 */}
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="#fbbf64" />
      ))}

      {/* 标签 */}
      {EMOTION_LABELS.map((e, i) => {
        const labelR = radius + 16;
        const [x, y] = pointOnRadius(i, labelR);
        // 根据角度调整文本锚点
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
