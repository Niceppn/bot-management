import { useMemo } from 'react'

function SimplePNLChart({ data, width = 800, height = 250 }) {
  const { bars, maxPnl, minPnl, labels, gridLines, zeroY, padding } = useMemo(() => {
    if (!data || data.length === 0) {
      return { bars: [], maxPnl: 0, minPnl: 0, labels: [], gridLines: [] }
    }

    const values = data.map(d => d.pnl)
    const max = Math.max(...values, 1) // At least 1 to avoid division by zero
    const min = Math.min(...values, -1) // At least -1
    const range = max - min || 2

    const padding = { left: 60, right: 30, top: 30, bottom: 50 }
    const chartHeight = height - padding.top - padding.bottom
    const chartWidth = width - padding.left - padding.right
    const barWidth = Math.max(8, (chartWidth / data.length) - 4) // Min 8px width
    const barGap = 4

    // Calculate zero line position
    const zeroY = padding.top + (chartHeight * (max / range))

    // Generate grid lines
    const numGridLines = 5
    const gridLineValues = []
    for (let i = 0; i <= numGridLines; i++) {
      const value = min + (range * i / numGridLines)
      const y = padding.top + chartHeight - ((value - min) / range) * chartHeight
      gridLineValues.push({ value, y })
    }

    // Generate bars
    const totalBarWidth = barWidth + barGap
    const totalBarsWidth = data.length * totalBarWidth
    const startX = padding.left + (chartWidth - totalBarsWidth) / 2

    const barData = data.map((d, i) => {
      const barHeight = Math.abs(d.pnl / range) * chartHeight
      const isPositive = d.pnl >= 0
      const x = startX + i * totalBarWidth
      const y = isPositive ? zeroY - barHeight : zeroY

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

    // Time labels - show max 10 labels
    const labelStep = Math.ceil(data.length / 10)
    const timeLabels = data
      .map((d, i) => {
        if (i % labelStep === 0 || i === data.length - 1) {
          const time = new Date(d.time)
          return {
            x: startX + i * totalBarWidth + barWidth / 2,
            text: time.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })
          }
        }
        return null
      })
      .filter(Boolean)

    return {
      bars: barData,
      maxPnl: max,
      minPnl: min,
      labels: timeLabels,
      gridLines: gridLineValues,
      zeroY,
      padding
    }
  }, [data, width, height])

  if (!data || data.length === 0) {
    return (
      <div style={{
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#12161B',
        borderRadius: '12px',
        border: '1px solid #2B3139'
      }}>
        <p style={{ color: '#8B92A0', fontSize: '14px' }}>No PNL data yet - Start trading to see chart</p>
      </div>
    )
  }

  return (
    <svg width={width} height={height} style={{
      background: '#12161B',
      borderRadius: '12px',
      border: '1px solid #2B3139'
    }}>
      <defs>
        <linearGradient id="profitGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="lossGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {gridLines.map((line, i) => (
        <g key={i}>
          <line
            x1={padding.left}
            y1={line.y}
            x2={width - padding.right}
            y2={line.y}
            stroke={line.value === 0 ? '#8B92A0' : '#2B3139'}
            strokeWidth={line.value === 0 ? 2 : 1}
            strokeDasharray={line.value === 0 ? '0' : '4'}
            opacity={line.value === 0 ? 1 : 0.5}
          />
          <text
            x={padding.left - 10}
            y={line.y + 4}
            fontSize="11"
            fill="#8B92A0"
            textAnchor="end"
            fontFamily="Space Grotesk, monospace"
          >
            ${line.value.toFixed(2)}
          </text>
        </g>
      ))}

      {/* Y-axis */}
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={height - padding.bottom}
        stroke="#2B3139"
        strokeWidth="2"
      />

      {/* X-axis */}
      <line
        x1={padding.left}
        y1={height - padding.bottom}
        x2={width - padding.right}
        y2={height - padding.bottom}
        stroke="#2B3139"
        strokeWidth="2"
      />

      {/* Bars */}
      {bars.map((bar, i) => (
        <g key={i}>
          <rect
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            fill={bar.isPositive ? 'url(#profitGradient)' : 'url(#lossGradient)'}
            rx="3"
            ry="3"
            opacity="0.95"
            style={{ cursor: 'pointer' }}
          >
            <title>{`${labels[Math.floor(i / Math.ceil(bars.length / labels.length))]?.text || 'Time'}: ${bar.pnl >= 0 ? '+' : ''}$${bar.pnl.toFixed(4)}`}</title>
          </rect>
          {bar.height > 15 && (
            <text
              x={bar.x + bar.width / 2}
              y={bar.isPositive ? bar.y + 12 : bar.y + bar.height - 5}
              fontSize="9"
              fill="#FFFFFF"
              textAnchor="middle"
              fontWeight="600"
              fontFamily="Space Grotesk, monospace"
            >
              {bar.pnl >= 0 ? '+' : ''}{bar.pnl.toFixed(2)}
            </text>
          )}
        </g>
      ))}

      {/* X-axis labels */}
      {labels.map((label, i) => (
        <text
          key={i}
          x={label.x}
          y={height - padding.bottom + 20}
          fontSize="10"
          fill="#8B92A0"
          textAnchor="middle"
          fontFamily="Space Grotesk, monospace"
        >
          {label.text}
        </text>
      ))}

      {/* Chart title */}
      <text
        x={width / 2}
        y={20}
        fontSize="13"
        fill="#FFFFFF"
        textAnchor="middle"
        fontWeight="600"
        fontFamily="Inter, sans-serif"
      >
        PNL Over Time
      </text>

      {/* Legend */}
      <g transform={`translate(${width - padding.right - 140}, ${padding.top + 5})`}>
        <rect x="0" y="0" width="16" height="16" fill="url(#profitGradient)" rx="3" />
        <text x="22" y="12" fontSize="11" fill="#8B92A0" fontFamily="Inter, sans-serif">
          Profit
        </text>

        <rect x="70" y="0" width="16" height="16" fill="url(#lossGradient)" rx="3" />
        <text x="92" y="12" fontSize="11" fill="#8B92A0" fontFamily="Inter, sans-serif">
          Loss
        </text>
      </g>

      {/* Summary */}
      <g transform={`translate(${padding.left}, ${height - 15})`}>
        <text fontSize="10" fill="#8B92A0" fontFamily="Space Grotesk, monospace">
          Total: <tspan fill={bars[bars.length - 1]?.isPositive ? '#10b981' : '#ef4444'} fontWeight="600">
            {bars[bars.length - 1]?.pnl >= 0 ? '+' : ''}${bars[bars.length - 1]?.pnl.toFixed(4) || '0.00'}
          </tspan>
          {' | '}
          Trades: <tspan fill="#FFFFFF" fontWeight="600">{bars.length}</tspan>
        </text>
      </g>
    </svg>
  )
}

export default SimplePNLChart
