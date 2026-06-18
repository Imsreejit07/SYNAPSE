import React, { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';

export default function SignalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
  animated
}) {
  const [isHovered, setIsHovered] = useState(false);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
  });

  // Calculate deterministic mock values if not provided
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const latency = data?.latency || `${((hash % 15) * 1.3 + 0.5).toFixed(1)}ns`;
  const cond = data?.conductance || `${(hash % 80) + 10}µS`;

  const activeStyle = isHovered ? {
    ...style,
    stroke: '#00f0ff',
    strokeWidth: (style.strokeWidth || 1) + 1.5,
    opacity: 1
  } : style;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={activeStyle} />
      
      {/* Invisible interaction path for hover effects */}
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        className="cursor-crosshair pointer-events-auto"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Signal Animation */}
      {animated && (
        <circle r="3" fill="#00f0ff" style={{ filter: 'drop-shadow(0 0 4px #00f0ff)', willChange: 'transform' }}>
          <animateMotion dur={`${(hash % 3) + 1.5}s`} repeatCount="indefinite" path={edgePath} />
        </circle>
      )}

      {/* Floating Label */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            textRendering: 'optimizeLegibility'
          }}
          className={`nodrag nopan bg-slate-950/90 border text-[8px] font-mono px-1 py-0.5 rounded-none z-10 transition-colors ${isHovered ? 'border-[#00f0ff] text-white opacity-100' : 'border-slate-700 text-neon-blue opacity-70'}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {latency} • {cond}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
