import { useMemo } from 'react'

function SimplePNLChart({ data, width = 600, height = 200 }) {
  const { bars, maxPnl, minPnl, labels } = useMemo(() => {
    if (!data || data.length === 0) {
      return { bars: [], maxPnl: 0, minPnl: 0, labels: [] }
    }

    const values = data.map(d => d.pnl)
    const max = Math.max(...values, 0)
    const min = Math.min(...values, 0)
    const range = max - min || 1

    const padding = 40
    const chartHeight = height - padding * 2
    const chartWidth = width - padding * 2
    const barWidth = chartWidth / data.length - 4

    const barData = data.map((d, i) => {
      const barHeight = Math.abs(d.pnl / range) * chartHeight
      const isPositive = d.pnl >= 0
      const x = padding + i * (chartWidth / data.length)
      const y = isPositive
        ? padding + (chartHeight / 2) - barHeight
        : padding + (chartHeight / 2)

      return {
        x,
        y,
        width: barWidth,
        height: barHeight,
        pnl: d.pnl,
        isPositive,
        time: d.time
      }
    })

    const timeLabels = data.map(d => new Date(d.time).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }))

    return { bars: barData, maxPnl: max, minPnl: min, labels: timeLabels }
  }, [data, width, height])

  if (!data || data.length === 0) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#12161B', borderRadius: '12px', border: '1px solid #2B3139' }}>
        <p style={{ color: '#8B92A0', fontSize: '14px' }}>No data available</p>
      </div>
    )
  }

  return (
    <svg width={width} height={height} style={{ background: '#12161B', borderRadius: '12px', border: '1px solid #2B3139' }}>
      {/* Grid lines */}
      <line x1="40" y1="40" x2="40" y2={height - 40} stroke="#2B3139" strokeWidth="1" />
      <line x1="40" y1={height / 2} x2={width - 20} y2={height / 2} stroke="#2B3139" strokeWidth="1" strokeDasharray="4" />

      {/* Bars */}
      {bars.map((bar, i) => (
        <g key={i}>
          <rect
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            fill={bar.isPositive ? '#10b981' : '#ef4444'}
            opacity={0.9}
          />
          <title>
            {labels[i]}: ${bar.pnl.toFixed(4)}
          </title>
        </g>
      ))}

      {/* Y-axis labels */}
      <text x="5" y="45" fontSize="10" fill="#8B92A0">
        ${maxPnl.toFixed(2)}
      </text>
      <text x="5" y={height / 2 + 5} fontSize="10" fill="#8B92A0">
        $0.00
      </text>
      <text x="5" y={height - 35} fontSize="10" fill="#8B92A0">
        ${minPnl.toFixed(2)}
      </text>

      {/* X-axis labels (show first, middle, last) */}
      {labels.length > 0 && (
        <>
          <text x="45" y={height - 20} fontSize="9" fill="#8B92A0">
            {labels[0]}
          </text>
          {labels.length > 2 && (
            <text x={width / 2} y={height - 20} fontSize="9" fill="#8B92A0" textAnchor="middle">
              {labels[Math.floor(labels.length / 2)]}
            </text>
          )}
          {labels.length > 1 && (
            <text x={width - 60} y={height - 20} fontSize="9" fill="#8B92A0" textAnchor="end">
              {labels[labels.length - 1]}
            </text>
          )}
        </>
      )}

      {/* Legend */}
      <g transform={`translate(${width - 150}, 20)`}>
        <rect x="0" y="0" width="12" height="12" fill="#10b981" />
        <text x="18" y="10" fontSize="10" fill="#8B92A0">Profit</text>

        <rect x="0" y="18" width="12" height="12" fill="#ef4444" />
        <text x="18" y="28" fontSize="10" fill="#8B92A0">Loss</text>
      </g>
    </svg>
  )
}

export default SimplePNLChart
