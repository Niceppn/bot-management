import { useMemo } from 'react'

function SimplePNLChart({ data, width = 600, height = 200 }) {
  const { path, maxPnl, minPnl, points } = useMemo(() => {
    if (!data || data.length === 0) {
      return { path: '', maxPnl: 0, minPnl: 0, points: [] }
    }

    const values = data.map(d => d.pnl)
    const max = Math.max(...values, 0)
    const min = Math.min(...values, 0)
    const range = max - min || 1

    const padding = 20
    const chartHeight = height - padding * 2
    const chartWidth = width - padding * 2
    const step = chartWidth / (data.length - 1 || 1)

    const pts = data.map((d, i) => ({
      x: padding + i * step,
      y: padding + chartHeight - ((d.pnl - min) / range) * chartHeight,
      pnl: d.pnl
    }))

    const pathStr = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

    return { path: pathStr, maxPnl: max, minPnl: min, points: pts }
  }, [data, width, height])

  if (!data || data.length === 0) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa', borderRadius: '12px' }}>
        <p style={{ color: '#6c757d', fontSize: '14px' }}>No data available</p>
      </div>
    )
  }

  return (
    <svg width={width} height={height} style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e9ecef' }}>
      {/* Grid lines */}
      <line x1="20" y1="20" x2="20" y2={height - 20} stroke="#dee2e6" strokeWidth="1" />
      <line x1="20" y1={height - 20} x2={width - 20} y2={height - 20} stroke="#dee2e6" strokeWidth="1" />

      {/* Zero line */}
      {minPnl < 0 && maxPnl > 0 && (
        <line
          x1="20"
          y1={20 + (height - 40) * (1 - (0 - minPnl) / (maxPnl - minPnl))}
          x2={width - 20}
          y2={20 + (height - 40) * (1 - (0 - minPnl) / (maxPnl - minPnl))}
          stroke="#dee2e6"
          strokeWidth="1"
          strokeDasharray="4"
        />
      )}

      {/* Line */}
      <path
        d={path}
        fill="none"
        stroke={data[data.length - 1]?.pnl >= 0 ? '#10b981' : '#ef4444'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="3"
          fill={p.pnl >= 0 ? '#10b981' : '#ef4444'}
        />
      ))}

      {/* Labels */}
      <text x="25" y="15" fontSize="10" fill="#6c757d">
        ${maxPnl.toFixed(2)}
      </text>
      <text x="25" y={height - 10} fontSize="10" fill="#6c757d">
        ${minPnl.toFixed(2)}
      </text>
    </svg>
  )
}

export default SimplePNLChart
