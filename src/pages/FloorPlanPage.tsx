/**
 * Floor Plan Page
 * 大户型平面图 + ESP32 节点自由放置（无数量限制）
 * 天线类型：全向 / 相控阵 / 旋转扫描
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, RotateCcw, Wifi, WifiOff, AlertTriangle, Play, Pause, Info, Settings, Box } from 'lucide-react';
import { FloorPlan3DView } from './FloorPlan3DView';
import { FLOOR_PLANS, ROOM_COLORS, type FloorPlan, type Wall, type Door } from '../data/floorplans';
import {
  computePosition, simulatePersonPath, computeCoveragePolygon,
  computeCooperativeLinks,
  DEFAULT_NODE, type Node, type AntennaType, type CooperativeLink,
} from '../utils/triangulation';
import { useCSIStream, type ActivityType } from '../hooks/useCSIStream';

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  empty: '无人', standing: '站立', sitting: '静坐', walking: '走动', falling: '跌倒',
};

const ANTENNA_META: Record<AntennaType, { label: string; desc: string; color: string; icon: string }> = {
  omni:     { label: '全向天线',   desc: '圆形覆盖，最隐蔽，标准 ESP32',      color: 'oklch(0.35 0 0)', icon: '📡' },
  phased:   { label: '相控阵',     desc: '电子波束成形，覆盖远，可调方向',     color: 'oklch(0.25 0 0)', icon: '🔭' },
  rotating: { label: '旋转扫描',   desc: '360° 扫描，单点全覆盖，有时延',      color: 'oklch(0.45 0 0)', icon: '🔄' },
};

// ─── 人体骨骼姿态 SVG ────────────────────────────────────────────────────────
function PersonSVG({ activity, size = 48 }: { activity: ActivityType; size?: number }) {
  const s = size / 48;
  const c = activity === 'falling' ? 'oklch(0.35 0 0)' : 'oklch(0.12 0 0)';
  const p = { fill: 'none', stroke: c, strokeWidth: 2.5, strokeLinecap: 'round' as const };

  const poses: Record<ActivityType, React.ReactNode> = {
    empty: null,
    standing: <g transform={`scale(${s})`} {...p}>
      <circle cx="24" cy="8" r="5" fill={c} stroke="none"/>
      <line x1="24" y1="13" x2="24" y2="30"/>
      <line x1="24" y1="18" x2="13" y2="26"/><line x1="24" y1="18" x2="35" y2="26"/>
      <line x1="24" y1="30" x2="16" y2="44"/><line x1="24" y1="30" x2="32" y2="44"/>
    </g>,
    sitting: <g transform={`scale(${s})`} {...p}>
      <circle cx="24" cy="10" r="5" fill={c} stroke="none"/>
      <line x1="24" y1="15" x2="24" y2="28"/>
      <line x1="24" y1="20" x2="13" y2="27"/><line x1="24" y1="20" x2="35" y2="27"/>
      <line x1="24" y1="28" x2="13" y2="38"/><line x1="13" y1="38" x2="13" y2="44"/>
      <line x1="24" y1="28" x2="38" y2="30"/>
    </g>,
    walking: <g transform={`scale(${s})`} {...p}>
      <circle cx="24" cy="8" r="5" fill={c} stroke="none"/>
      <line x1="24" y1="13" x2="21" y2="28"/>
      <line x1="22" y1="18" x2="11" y2="24"/><line x1="22" y1="18" x2="34" y2="22"/>
      <line x1="21" y1="28" x2="13" y2="42"/><line x1="21" y1="28" x2="32" y2="42"/>
    </g>,
    falling: <g transform={`scale(${s})`} {...p}>
      <circle cx="10" cy="26" r="5" fill={c} stroke="none"/>
      <line x1="15" y1="26" x2="34" y2="22"/>
      <line x1="25" y1="22" x2="20" y2="11"/><line x1="25" y1="22" x2="28" y2="34"/>
      <line x1="34" y1="22" x2="44" y2="15"/><line x1="34" y1="22" x2="42" y2="33"/>
    </g>,
  };
  return <svg width={size} height={size} viewBox="0 0 48 48">{poses[activity]}</svg>;
}

// ─── 覆盖范围 SVG 元素（射线追踪真实多边形）────────────────────────────────
function CoverageSVG({ node, rotatingAngle, index, walls, doors }: {
  node: Node; rotatingAngle: number; index: number;
  walls: Wall[]; doors: Door[];
}) {
  const pts = computeCoveragePolygon(node, rotatingAngle, walls, doors);
  if (pts.length < 3) return null;
  const pointsStr = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const L = 0.38 + index * 0.05;
  const fillOpacity = node.antenna === 'rotating' ? 0.07 : 0.05;
  return (
    <polygon points={pointsStr}
      fill={`oklch(${L} 0 0 / ${fillOpacity})`}
      stroke={`oklch(${L} 0 0 / 0.22)`}
      strokeWidth="1.5" strokeLinejoin="round"
    />
  );
}

// ─── 协同链路 SVG（菲涅尔椭圆 + 链路线） ────────────────────────────────────
function CooperativeLinkSVG({ link }: { link: CooperativeLink }) {
  const disturbed = link.disturbance > 0.35;
  const cx = (link.ax + link.bx) / 2;
  const cy = (link.ay + link.by) / 2;
  const angle = Math.atan2(link.by - link.ay, link.bx - link.ax) * 180 / Math.PI;
  // 菲涅尔第一区椭圆：长半轴 = linkDist/2 + fresnelRadius，短半轴 = fresnelRadius
  const a = link.linkDist / 2 + link.fresnelRadius;
  const b = link.fresnelRadius;
  // 线条颜色：扰动弱=蓝灰，扰动强=橙
  const hue = disturbed ? 30 : 220;
  const l = disturbed ? 0.35 : 0.55;
  const linkAlpha = 0.12 + link.disturbance * 0.55;
  const ellipseAlpha = 0.08 + link.disturbance * 0.18;

  return (
    <g>
      {/* 菲涅尔椭圆 */}
      <ellipse cx={cx} cy={cy} rx={a} ry={b}
        transform={`rotate(${angle}, ${cx}, ${cy})`}
        fill={`oklch(${l} 0.07 ${hue} / ${ellipseAlpha})`}
        stroke={`oklch(${l} 0.08 ${hue} / ${disturbed ? 0.45 : 0.18})`}
        strokeWidth={disturbed ? 1.2 : 0.8}
        strokeDasharray={disturbed ? undefined : '4 3'}
      />
      {/* 链路线 */}
      <line x1={link.ax} y1={link.ay} x2={link.bx} y2={link.by}
        stroke={`oklch(${l} 0.1 ${hue} / ${linkAlpha})`}
        strokeWidth={disturbed ? 1.5 + link.disturbance * 1.5 : 1}
        strokeDasharray={disturbed ? undefined : '5 4'}
      />
      {/* 扰动标注（仅强扰动时显示） */}
      {disturbed && (
        <text x={cx} y={cy - b - 5}
          textAnchor="middle" fontSize="8" fontFamily="monospace"
          fill={`oklch(0.35 0.08 30 / 0.75)`}>
          {(link.disturbance * 100).toFixed(0)}%
        </text>
      )}
    </g>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────────────────
export function FloorPlanPage() {
  const [selectedPlan, setSelectedPlan] = useState<FloorPlan>(FLOOR_PLANS[0]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [personPos, setPersonPos] = useState({ x: 600, y: 400 });
  const [smoothedPos, setSmoothedPos] = useState({ x: 600, y: 400 });
  const smoothedPosRef = useRef({ x: 600, y: 400 });
  const [displayPos, setDisplayPos] = useState({ x: 600, y: 400 });
  const displayPosRef = useRef({ x: 600, y: 400 });
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [showCoverage, setShowCoverage] = useState(true);
  const [cooperativeMode, setCooperativeMode] = useState(false);
  const [packetRate, setPacketRate] = useState(100);
  // ─── 呼吸积累定位（Widar 3.0 原理）────────────────────────────────────────
  // 静止时积累呼吸周期，相位相干叠加后定位精度随时间提升
  const [observationSecs, setObservationSecs] = useState(0);
  const observationRef = useRef(0);
  const lastActivityRef = useRef<ActivityType>('empty');
  const [rotatingAngle, setRotatingAngle] = useState(0);
  // 旋转扫描频率（转/秒）：0.5=慢/2=标准/5=快/10=高速
  const [scanHz, setScanHz] = useState(3);
  const scanHzRef = useRef(3);
  const svgRef = useRef<SVGSVGElement>(null);

  const { isConnected, isRunning, currentFrame, start, stop } = useCSIStream();
  const activity: ActivityType = currentFrame?.activity ?? 'empty';

  // 旋转天线动画（16ms 高频更新，步长由 scanHz 决定）
  useEffect(() => {
    const t = setInterval(() => {
      const step = scanHzRef.current * 360 * 0.016; // °/frame at 16ms
      setRotatingAngle(a => (a + step) % 360);
    }, 16);
    return () => clearInterval(t);
  }, []);

  // 呼吸积累计时器：静止活动时每 500ms 递增，走动/无人/停止时重置
  // 物理依据：0.4Hz 呼吸频率，每 2.5s 一个完整周期
  // 精度模型：Widar 3.0 实测曲线 → uncertainty × (0.2 + 0.8×e^(-0.077×t))
  useEffect(() => {
    const isStatic = activity === 'sitting' || activity === 'standing' || activity === 'falling';
    if (!isRunning || !isStatic) {
      observationRef.current = 0;
      setObservationSecs(0);
      lastActivityRef.current = activity;
      return;
    }
    // 活动类型切换时重置（换了房间/状态，之前积累作废）
    if (lastActivityRef.current !== activity) {
      observationRef.current = 0;
      setObservationSecs(0);
      lastActivityRef.current = activity;
    }
    const iv = setInterval(() => {
      observationRef.current = Math.min(observationRef.current + 0.5, 120); // 上限 2 分钟
      setObservationSecs(observationRef.current);
    }, 500);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, activity]);

  const handlePlanChange = (plan: FloorPlan) => {
    setSelectedPlan(plan);
    setNodes(
      plan.defaultNodes.slice(0, 3).map((pos, i) => ({
        id: `node-${i}`,
        x: pos.x, y: pos.y,
        label: i === 0 ? 'AP' : `STA${i}`,
        ...DEFAULT_NODE,
      }))
    );
    setSelectedNodeId(null);
  };

  useEffect(() => { handlePlanChange(FLOOR_PLANS[0]); }, []);

  // 人的移动
  useEffect(() => {
    if (!isRunning || activity === 'empty') return;
    const iv = setInterval(() => {
      const pos = simulatePersonPath(selectedPlan.width, selectedPlan.height, activity);
      if (pos.x < 0) return;
      setPersonPos(pos);
      const alpha = activity === 'walking' ? 0.12 : 0.06;
      const prev = smoothedPosRef.current;
      const next = { x: prev.x + alpha * (pos.x - prev.x), y: prev.y + alpha * (pos.y - prev.y) };
      smoothedPosRef.current = next;
      setSmoothedPos({ ...next });
    }, 100);
    return () => clearInterval(iv);
  }, [isRunning, activity, selectedPlan]);

  // 协同链路计算（节点对之间的菲涅尔区扰动）
  const cooperativeLinks = (cooperativeMode && isRunning && activity !== 'empty')
    ? computeCooperativeLinks(nodes, personPos.x, personPos.y, selectedPlan.walls, selectedPlan.doors)
    : [];
  // 强扰动链路数量（disturbance > 0.4 = 人在该链路菲涅尔区内）
  const strongLinks = cooperativeLinks.filter(l => l.disturbance > 0.4).length;
  // 协同增益：每条强扰动链路提供额外约束，误差 × 0.72/链路（对数增益，有上限）
  const cooperativeGain = cooperativeMode ? Math.pow(0.72, strongLinks) : 1;

  // 定位计算（含墙体衰减 + 包速率统计降噪）
  const positioningRaw = computePosition(nodes, personPos.x, personPos.y, rotatingAngle, selectedPlan.walls, selectedPlan.doors, packetRate);
  useEffect(() => {
    if (positioningRaw.inDeadZone) return;
    // EMA 平滑：alpha 降低后每帧可见抖动 ≈ 4cm（原 17cm），更符合真实系统响应
    const alpha = activity === 'walking' ? 0.05 : 0.02;
    const prev = displayPosRef.current;
    const next = { x: prev.x + alpha * (positioningRaw.x - prev.x), y: prev.y + alpha * (positioningRaw.y - prev.y) };
    displayPosRef.current = next;
    setDisplayPos({ ...next });
  });
  const positioning = { ...positioningRaw, x: displayPos.x, y: displayPos.y };

  // ─── 拖拽 ────────────────────────────────────────────────────────────────
  const getSVGCoords = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (selectedPlan.width / rect.width),
      y: (e.clientY - rect.top) * (selectedPlan.height / rect.height),
    };
  }, [selectedPlan]);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const c = getSVGCoords(e);
    setDraggingId(nodeId);
    setSelectedNodeId(nodeId);
    setDragOffset({ x: c.x - node.x, y: c.y - node.y });
  }, [nodes, getSVGCoords]);

  useEffect(() => {
    if (!draggingId) return;
    const onMove = (e: MouseEvent) => {
      const c = getSVGCoords(e);
      setNodes(prev => prev.map(n =>
        n.id === draggingId
          ? { ...n, x: Math.max(50, Math.min(selectedPlan.width - 50, c.x - dragOffset.x)), y: Math.max(50, Math.min(selectedPlan.height - 50, c.y - dragOffset.y)) }
          : n
      ));
    };
    const onUp = () => setDraggingId(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [draggingId, dragOffset, getSVGCoords, selectedPlan]);

  // ─── 节点操作 ────────────────────────────────────────────────────────────
  const addNode = () => {
    const idx = nodes.length;
    const newNode: Node = {
      id: `node-${Date.now()}`,
      x: 150 + (idx % 5) * 160,
      y: 150 + Math.floor(idx / 5) * 160,
      label: idx === 0 ? 'AP' : `STA${idx}`,
      ...DEFAULT_NODE,
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };

  const removeNode = (id: string) => {
    setNodes(prev => {
      const next = prev.filter(n => n.id !== id).map((n, i) => ({ ...n, label: i === 0 ? 'AP' : `STA${i}` }));
      return next;
    });
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const updateNode = (id: string, patch: Partial<Node>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n));
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null;
  const confidenceColor = (c: number) => c > 0.7 ? 'oklch(0.25 0 0)' : c > 0.4 ? 'oklch(0.45 0 0)' : 'oklch(0.65 0 0)';

  // 比例尺换算：1px = scale/100 m，1m = 100/scale px
  const pxPerMeter = 100 / selectedPlan.scale;
  // 人体图标尺寸：按 0.6m 肩宽换算（国标成人肩宽 0.45-0.55m，取 0.6m 含图标边距）
  const personSizePx = Math.round(0.6 * pxPerMeter);
  // 呼吸积累因子（Widar 3.0 精度曲线拟合）
  // 仅对静止活动有效；走动时多普勒定位替代，无需积累
  const isStaticActivity = activity === 'sitting' || activity === 'standing' || activity === 'falling';
  const accumFactor = (isStaticActivity && isRunning && !positioning.inDeadZone)
    ? Math.max(0.20, 0.20 + 0.80 * Math.exp(-0.077 * observationSecs))
    : 1.0;
  const breathingCycles = Math.floor(observationSecs * 0.4); // 0.4Hz 呼吸频率

  // 有效不确定性 = 基础误差 × 协同增益 × 呼吸积累因子
  const effectiveUncertaintyM = positioning.uncertaintyMeters
    * Math.max(cooperativeGain, 0.15)
    * accumFactor;
  // 不确定性圆半径（真实米 → 像素）
  const uncertaintyPx = Math.round(effectiveUncertaintyM * pxPerMeter);

  return (
    <div className="min-h-screen pt-14 bg-background flex flex-col">

      {/* ─── Top Bar ─── */}
      <div className="border-b border-border px-6 py-2.5 flex items-center gap-4 shrink-0 flex-wrap">
        {/* 户型 */}
        <div className="flex items-center gap-1">
          {FLOOR_PLANS.map(plan => (
            <button key={plan.id} onClick={() => handlePlanChange(plan)}
              className={`h-7 px-3 text-[12px] font-medium rounded-md transition-all ${selectedPlan.id === plan.id ? 'bg-foreground text-background' : 'border border-foreground/15 hover:bg-foreground/[0.03]'}`}>
              {plan.name}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border" />

        {/* 节点 */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-muted-foreground font-mono">{nodes.length} 个节点</span>
          <button onClick={addNode}
            className="h-7 px-3 text-[12px] rounded-md border border-foreground/15 hover:bg-foreground/[0.03] inline-flex items-center gap-1.5">
            <Plus className="w-3 h-3" />添加节点
          </button>
          <button onClick={() => handlePlanChange(selectedPlan)}
            className="h-7 w-7 rounded-md border border-foreground/15 hover:bg-foreground/[0.03] inline-flex items-center justify-center" title="重置">
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* 2D / 3D 视图切换 */}
        <div className="flex items-center gap-0.5 border border-foreground/15 rounded-md p-0.5">
          <button onClick={() => setViewMode('2d')}
            className={`h-6 px-2.5 text-[11px] font-medium rounded transition-all ${viewMode === '2d' ? 'bg-foreground text-background' : 'hover:bg-foreground/[0.04]'}`}>
            2D
          </button>
          <button onClick={() => setViewMode('3d')}
            className={`h-6 px-2.5 text-[11px] font-medium rounded transition-all inline-flex items-center gap-1 ${viewMode === '3d' ? 'bg-foreground text-background' : 'hover:bg-foreground/[0.04]'}`}>
            <Box className="w-3 h-3" />3D
          </button>
        </div>

        <div className="h-4 w-px bg-border" />

        <button onClick={() => setShowCoverage(v => !v)}
          className={`h-7 px-3 text-[12px] rounded-md border transition-all ${showCoverage ? 'bg-foreground text-background border-foreground' : 'border-foreground/15 hover:bg-foreground/[0.03]'}`}>
          覆盖范围
        </button>
        <button onClick={() => setCooperativeMode(v => !v)}
          className={`h-7 px-3 text-[12px] rounded-md border transition-all ${cooperativeMode ? 'bg-foreground text-background border-foreground' : 'border-foreground/15 hover:bg-foreground/[0.03]'}`}>
          协同感知
        </button>

        <div className="h-4 w-px bg-border" />

        {/* 包速率选择器 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">采样率</span>
          <div className="flex items-center gap-0.5">
            {[
              { rate: 10,    label: '10',   sub: 'pkt/s' },
              { rate: 100,   label: '100',  sub: 'pkt/s' },
              { rate: 1000,  label: '1K',   sub: 'pkt/s' },
              { rate: 10000, label: '10K',  sub: 'pkt/s' },
            ].map(opt => (
              <button key={opt.rate} onClick={() => setPacketRate(opt.rate)}
                className={`h-7 px-2 text-[11px] rounded-md border transition-all ${
                  packetRate === opt.rate ? 'bg-foreground text-background border-foreground' : 'border-foreground/15 hover:bg-foreground/[0.03]'
                }`}>
                <span className="font-mono">{opt.label}</span>
              </button>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
            ×{(1/Math.sqrt(10/packetRate)).toFixed(1)} 精度
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-foreground animate-pulse' : 'bg-muted-foreground/30'}`} />
          <span className="text-[12px] text-muted-foreground">{isConnected ? 'AI 已连接' : '未连接'}</span>
          {!isRunning
            ? <button onClick={start} disabled={!isConnected}
                className="h-7 px-4 text-[12px] font-medium rounded-md bg-foreground text-background hover:opacity-90 inline-flex items-center gap-1.5 disabled:opacity-40">
                <Play className="w-3 h-3" />启动
              </button>
            : <button onClick={stop}
                className="h-7 px-4 text-[12px] font-medium rounded-md border border-foreground/15 hover:bg-foreground/[0.03] inline-flex items-center gap-1.5">
                <Pause className="w-3 h-3" />暂停
              </button>
          }
        </div>
      </div>

      {/* ─── Main ─── */}
      <div className="flex flex-1 overflow-hidden">

        {/* 平面图 / 3D视图 */}
        <div className={`flex-1 ${viewMode === '3d' ? '' : 'overflow-auto bg-foreground/[0.01] flex items-center justify-center p-6'}`}
          style={viewMode === '3d' ? { position: 'relative' } : undefined}>

          {/* ─── 3D 视图 ─── */}
          {viewMode === '3d' && (
            <FloorPlan3DView
              plan={selectedPlan}
              nodes={nodes}
              positioning={positioning}
              activity={activity}
              effectiveUncertaintyM={effectiveUncertaintyM}
              cooperativeLinks={cooperativeLinks}
              showCoverage={showCoverage}
              cooperativeMode={cooperativeMode}
              isRunning={isRunning}
              selectedNodeId={selectedNodeId}
            />
          )}

          {/* ─── 2D SVG 视图 ─── */}
          {viewMode === '2d' && <svg ref={svgRef}
            viewBox={`0 0 ${selectedPlan.width} ${selectedPlan.height}`}
            className="w-full max-w-4xl border border-border rounded-lg bg-white"
            style={{ maxHeight: 'calc(100vh - 180px)', cursor: 'default' }}
            onClick={() => setSelectedNodeId(null)}
          >
            {/* 房间 */}
            {selectedPlan.rooms.map(room => (
              <g key={room.id}>
                <rect x={room.x} y={room.y} width={room.width} height={room.height}
                  fill={ROOM_COLORS[room.type]} stroke="none"/>
                <text x={room.x + room.width / 2} y={room.y + room.height / 2 - 5}
                  textAnchor="middle" fontSize="11" fill="oklch(0.48 0 0)" fontFamily="DM Sans,sans-serif">
                  {room.name}
                </text>
                <text x={room.x + room.width / 2} y={room.y + room.height / 2 + 9}
                  textAnchor="middle" fontSize="9" fill="oklch(0.68 0 0)" fontFamily="monospace">
                  {Math.round(room.width * room.height * selectedPlan.scale * selectedPlan.scale / 10000)}m²
                </text>
              </g>
            ))}

            {/* 墙体：承重墙（粗/深）/ 非承重墙（细/中）/ 玻璃门（虚线/蓝灰） */}
            {selectedPlan.walls.map((wall, i) => {
              const isBearing   = wall.type === 'bearing';
              const isWindow    = wall.type === 'window';
              return (
                <line key={`wall-${i}`}
                  x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2}
                  stroke={isBearing ? 'oklch(0.15 0 0)' : isWindow ? 'oklch(0.55 0.06 220)' : 'oklch(0.42 0 0)'}
                  strokeWidth={isBearing ? 3.5 : isWindow ? 1.5 : 1.5}
                  strokeDasharray={isWindow ? '6 3' : undefined}
                  opacity={isBearing ? 1 : 0.8}
                />
              );
            })}

            {/* 外框轮廓线 */}
            <rect x="40" y="40" width={selectedPlan.width - 80} height={selectedPlan.height - 80}
              fill="none" stroke="oklch(0.15 0 0)" strokeWidth="3.5"/>

            {/* 覆盖范围（射线追踪多边形，承重墙方向明显缩短） */}
            {showCoverage && nodes.map((node, i) => (
              <CoverageSVG key={`cov-${node.id}`} node={node} rotatingAngle={rotatingAngle} index={i}
                walls={selectedPlan.walls} doors={selectedPlan.doors} />
            ))}

            {/* 协同链路：菲涅尔椭圆 + 扰动链路线 */}
            {cooperativeMode && cooperativeLinks.map(link => (
              <CooperativeLinkSVG key={`link-${link.idA}-${link.idB}`} link={link} />
            ))}

            {/* 人体 */}
            {isRunning && activity !== 'empty' && (
              <>
                {/* 真实位置参考点（细虚线圆） */}
                <circle cx={smoothedPos.x} cy={smoothedPos.y} r="5"
                  fill="oklch(0.6 0 0 / 0.06)" stroke="oklch(0.6 0 0 / 0.14)"
                  strokeWidth="1" strokeDasharray="3 3"/>

                {!positioning.inDeadZone ? (
                  <g>
                    {/* 呼吸脉冲环（静止时显示，随积累逐渐缩紧） */}
                    {isStaticActivity && observationSecs > 2 && (
                      <circle cx={positioning.x} cy={positioning.y}
                        r={uncertaintyPx * 0.65}
                        fill="none"
                        stroke={`oklch(0.4 0.06 200 / ${0.15 + (1 - accumFactor) * 0.25})`}
                        strokeWidth="1" strokeDasharray="3 4">
                        <animate attributeName="r"
                          values={`${uncertaintyPx * 0.55};${uncertaintyPx * 0.72};${uncertaintyPx * 0.55}`}
                          dur="2.5s" repeatCount="indefinite"/>
                        <animate attributeName="opacity"
                          values="0.6;0.2;0.6" dur="2.5s" repeatCount="indefinite"/>
                      </circle>
                    )}
                    {/* 不确定性圆：半径 = uncertaintyMeters × pxPerMeter，1m = 1m */}
                    <circle cx={positioning.x} cy={positioning.y}
                      r={uncertaintyPx}
                      fill={`${confidenceColor(positioning.confidence)}10`}
                      stroke={confidenceColor(positioning.confidence)}
                      strokeWidth="1" strokeDasharray="4 3" opacity="0.55"/>
                    {/* 精度标注：显示真实米数（含协同增益 + 呼吸积累） */}
                    <text x={positioning.x + uncertaintyPx + 4} y={positioning.y - 4}
                      fontSize="9" fill="oklch(0.55 0 0 / 0.7)" fontFamily="monospace"
                      dominantBaseline="middle">
                      ±{effectiveUncertaintyM.toFixed(2)}m
                      {cooperativeMode && strongLinks > 0 && ` ×${(1/cooperativeGain).toFixed(1)}`}
                    </text>
                    {isStaticActivity && observationSecs > 1 && (
                      <text x={positioning.x + uncertaintyPx + 4} y={positioning.y + 7}
                        fontSize="8" fill="oklch(0.45 0.06 200 / 0.75)" fontFamily="monospace"
                        dominantBaseline="middle">
                        {breathingCycles}次呼吸 ↑精
                      </text>
                    )}
                    {/* 人体姿态：按 0.6m 肩宽换算，1px = 真实比例 */}
                    <foreignObject
                      x={positioning.x - personSizePx / 2}
                      y={positioning.y - personSizePx * 0.54}
                      width={personSizePx} height={personSizePx}>
                      <div style={{ width: personSizePx, height: personSizePx }}>
                        <PersonSVG activity={activity} size={personSizePx}/>
                      </div>
                    </foreignObject>
                    <rect x={positioning.x - personSizePx / 2} y={positioning.y + personSizePx * 0.46} width={personSizePx} height="13"
                      rx="3" fill="oklch(0.12 0 0 / 0.82)"/>
                    <text x={positioning.x} y={positioning.y + personSizePx * 0.46 + 9}
                      textAnchor="middle" fontSize="9" fill="white" fontFamily="DM Sans,sans-serif">
                      {ACTIVITY_LABELS[activity]}
                    </text>
                    {/* 穿墙提示 */}
                    {(positioning.wallsBlocking > 0 || positioning.partitionsBlocking > 0) && (
                      <text x={positioning.x} y={positioning.y - personSizePx * 0.54 - 6}
                        textAnchor="middle" fontSize="8" fill="oklch(0.5 0 0 / 0.7)" fontFamily="monospace">
                        {positioning.wallsBlocking > 0 ? `承重×${positioning.wallsBlocking}` : ''}
                        {positioning.wallsBlocking > 0 && positioning.partitionsBlocking > 0 ? ' ' : ''}
                        {positioning.partitionsBlocking > 0 ? `隔墙×${positioning.partitionsBlocking}` : ''}
                      </text>
                    )}
                  </g>
                ) : positioning.microDetectable ? (
                  /* 微弱生命体征检测：信号太弱无法定位，但 CSI 相位变化可感知呼吸/微动 */
                  <g>
                    <circle cx={personPos.x} cy={personPos.y} r="28"
                      fill="none" stroke="oklch(0.55 0 0 / 0.25)" strokeWidth="1" strokeDasharray="4 3"/>
                    <circle cx={personPos.x} cy={personPos.y} r="16"
                      fill="oklch(0.9 0 0 / 0.7)" stroke="oklch(0.5 0 0 / 0.35)" strokeWidth="1.5"/>
                    <text x={personPos.x} y={personPos.y - 2}
                      textAnchor="middle" fontSize="9" fill="oklch(0.35 0 0)" fontFamily="DM Sans,sans-serif">生命</text>
                    <text x={personPos.x} y={personPos.y + 9}
                      textAnchor="middle" fontSize="9" fill="oklch(0.35 0 0)" fontFamily="DM Sans,sans-serif">体征</text>
                  </g>
                ) : (
                  /* 完全盲区 */
                  <g>
                    <circle cx={personPos.x} cy={personPos.y} r="18"
                      fill="oklch(0.88 0 0 / 0.7)" stroke="oklch(0.55 0 0 / 0.4)" strokeWidth="1.5"/>
                    <text x={personPos.x} y={personPos.y + 5}
                      textAnchor="middle" fontSize="13" fill="oklch(0.45 0 0)">?</text>
                  </g>
                )}
              </>
            )}

            {/* 节点（可拖拽，点击选中） */}
            {nodes.map((node, i) => {
              const isSelected = selectedNodeId === node.id;
              const meta = ANTENNA_META[node.antenna];
              return (
                <g key={node.id}
                  transform={`translate(${node.x - 15}, ${node.y - 20})`}
                  style={{ cursor: draggingId === node.id ? 'grabbing' : 'grab' }}
                  onMouseDown={e => handleNodeMouseDown(e, node.id)}
                  onClick={e => { e.stopPropagation(); setSelectedNodeId(node.id); }}
                >
                  {/* 选中光圈 */}
                  {isSelected && <circle cx="15" cy="15" r="20" fill="none" stroke="oklch(0.3 0 0)" strokeWidth="1.5" opacity="0.5"/>}
                  {/* 背景 */}
                  <rect x="0" y="0" width="30" height="30" rx="6"
                    fill={isSelected ? 'oklch(0.12 0 0)' : 'white'}
                    stroke={isSelected ? 'oklch(0.12 0 0)' : 'oklch(0.38 0 0)'}
                    strokeWidth={isSelected ? 2 : 1.5}/>
                  <text x="15" y="21" textAnchor="middle" fontSize="14">{meta.icon}</text>
                  <text x="15" y="40" textAnchor="middle" fontSize="8.5"
                    fill={isSelected ? 'oklch(0.12 0 0)' : 'oklch(0.42 0 0)'} fontFamily="monospace">
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>}

        </div>

        {/* ─── Right Panel ─── */}
        <div className="w-68 border-l border-border flex flex-col shrink-0 overflow-y-auto" style={{ width: 272 }}>

          {/* 选中节点配置 */}
          <AnimatePresence>
            {selectedNode && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="border-b border-border">
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5}/>
                    <span className="text-[11px] tracking-[0.1em] uppercase text-muted-foreground font-medium">
                      {selectedNode.label} 配置
                    </span>
                  </div>
                  <button onClick={() => removeNode(selectedNode.id)}
                    className="h-6 w-6 rounded hover:bg-foreground/[0.05] flex items-center justify-center">
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground"/>
                  </button>
                </div>

                {/* 天线类型 */}
                <div className="px-4 pb-4 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground mb-2">天线类型</p>
                  {(Object.keys(ANTENNA_META) as AntennaType[]).map(type => (
                    <button key={type} onClick={() => updateNode(selectedNode.id, { antenna: type })}
                      className={`w-full text-left px-3 py-2 rounded-md border transition-all ${
                        selectedNode.antenna === type ? 'bg-foreground text-background border-foreground' : 'border-foreground/12 hover:bg-foreground/[0.03]'
                      }`}>
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{ANTENNA_META[type].icon}</span>
                        <div>
                          <p className={`text-[12px] font-medium ${selectedNode.antenna === type ? '' : ''}`}>
                            {ANTENNA_META[type].label}
                          </p>
                          <p className={`text-[10px] mt-0.5 leading-snug ${selectedNode.antenna === type ? 'opacity-60' : 'text-muted-foreground'}`}>
                            {ANTENNA_META[type].desc}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}

                  {/* 方向控制（相控阵） */}
                  {selectedNode.antenna === 'phased' && (
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] text-muted-foreground">波束方向</p>
                        <span className="font-mono text-[11px]">{selectedNode.direction}°</span>
                      </div>
                      <input type="range" min="0" max="359" value={selectedNode.direction}
                        onChange={e => updateNode(selectedNode.id, { direction: Number(e.target.value) })}
                        className="w-full h-1 accent-foreground"/>
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] text-muted-foreground">波束宽度</p>
                        <span className="font-mono text-[11px]">{selectedNode.beamWidth}°</span>
                      </div>
                      <input type="range" min="30" max="180" value={selectedNode.beamWidth}
                        onChange={e => updateNode(selectedNode.id, { beamWidth: Number(e.target.value) })}
                        className="w-full h-1 accent-foreground"/>
                    </div>
                  )}

                  {selectedNode.antenna === 'rotating' && (
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] text-muted-foreground">扫描转速</p>
                        <span className="font-mono text-[11px]">{scanHz} 转/秒</span>
                      </div>
                      {/* 转速预设 */}
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { hz: 0.5, label: '0.5', sub: '慢' },
                          { hz: 2,   label: '2',   sub: '标准' },
                          { hz: 5,   label: '5',   sub: '快' },
                          { hz: 10,  label: '10',  sub: '高速' },
                        ].map(opt => (
                          <button key={opt.hz}
                            onClick={() => { setScanHz(opt.hz); scanHzRef.current = opt.hz; }}
                            className={`py-1.5 rounded text-center border text-[10px] transition-all ${
                              scanHz === opt.hz ? 'bg-foreground text-background border-foreground' : 'border-foreground/12 hover:bg-foreground/[0.03]'
                            }`}>
                            <div className="font-mono font-medium">{opt.label}</div>
                            <div className="opacity-60">{opt.sub}</div>
                          </button>
                        ))}
                      </div>
                      {/* 实时数据 */}
                      <div className="px-2 py-2 border border-border rounded-md space-y-0.5">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">周期</span>
                          <span className="font-mono">{(1000/scanHz).toFixed(0)} ms/圈</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">当前角度</span>
                          <span className="font-mono">{rotatingAngle.toFixed(0)}°</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 定位状态 */}
          <div className="p-4 border-b border-border">
            <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground font-medium mb-3">定位状态</p>
            {!isRunning ? (
              <p className="text-[12px] text-muted-foreground/50">启动后显示</p>
            ) : activity === 'empty' ? (
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 text-muted-foreground" strokeWidth={1.5}/>
                <span className="text-[13px] text-muted-foreground">区域内无人</span>
              </div>
            ) : positioning.inDeadZone ? (
              <div className="space-y-2">
                {positioning.microDetectable ? (
                  <div className="flex items-start gap-2 p-2.5 border border-border rounded-md">
                    <span className="text-base shrink-0 mt-0.5">🐾</span>
                    <div>
                      <p className="text-[12px] font-medium">检测到生命体征</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        信号穿越多面承重墙，强度不足以精确定位，但 CSI 相位变化仍可感知呼吸/微动（可检测熟睡的人或小动物）。
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 p-2 border border-border rounded-md">
                    <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.5}/>
                    <div>
                      <p className="text-[12px] font-medium">信号盲区</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        此位置无节点覆盖。添加更多节点或调整天线方向。
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <PersonSVG activity={activity} size={32}/>
                    <div>
                      <p className="text-[15px] font-semibold">{ACTIVITY_LABELS[activity]}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {(positioning.confidence * 100).toFixed(0)}% 置信度
                      </p>
                    </div>
                  </div>
                  {[
                    ['有效节点', `${Math.round(positioning.coverageQuality * nodes.length)} / ${nodes.length}`],
                    ['定位误差', `≈ ±${effectiveUncertaintyM.toFixed(2)}m${cooperativeMode && strongLinks > 0 ? ` (×${(1/cooperativeGain).toFixed(1)})` : ''}`],
                    ['穿承重墙', `${positioning.wallsBlocking} 面 (+${(positioning.wallsBlocking * 0.4 * Math.max(Math.sqrt(10/packetRate), 0.1)).toFixed(2)}m)`],
                    ['穿非承重墙', `${positioning.partitionsBlocking} 面 (+${(positioning.partitionsBlocking * 0.1 * Math.max(Math.sqrt(10/packetRate), 0.1)).toFixed(2)}m)`],
                    ['采样率', `${packetRate >= 1000 ? `${packetRate/1000}K` : packetRate} pkt/s`],
                    ['精度提升', `×${(1/Math.max(Math.sqrt(10/packetRate), 0.1)).toFixed(1)}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-mono">{v}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>定位精度</span>
                    <span>{positioning.confidence > 0.7 ? '高' : positioning.confidence > 0.4 ? '中' : '低'}</span>
                  </div>
                  <div className="h-1.5 bg-foreground/10 rounded-full">
                    <div className="h-full bg-foreground rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(0, positioning.confidence) * 100}%` }}/>
                  </div>
                </div>

                {/* 呼吸积累精度提升区块 */}
                <div className={`p-2.5 rounded-md border transition-all ${
                  isStaticActivity ? 'border-foreground/15 bg-foreground/[0.02]' : 'border-border'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-muted-foreground">
                      {isStaticActivity ? '相位积累定位' : '动态定位（实时）'}
                    </span>
                    {isStaticActivity && (
                      <span className="text-[10px] font-mono">
                        {breathingCycles} 次呼吸 · {observationSecs.toFixed(0)}s
                      </span>
                    )}
                  </div>
                  {isStaticActivity ? (
                    <>
                      {/* 积累进度条：60s 收敛 */}
                      <div className="h-1.5 bg-foreground/8 rounded-full mb-1.5 relative overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(observationSecs / 60 * 100, 100)}%`,
                            background: `oklch(${0.35 + (1 - accumFactor) * 0.15} 0.08 200)`,
                          }}/>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-muted-foreground">
                          精度增益 ×{(1 / accumFactor).toFixed(1)}
                        </span>
                        <span className="text-muted-foreground">
                          误差 ±{effectiveUncertaintyM.toFixed(2)}m
                          {accumFactor < 0.25 && ' ✓'}
                        </span>
                      </div>
                      {accumFactor > 0.8 && (
                        <p className="text-[9px] text-muted-foreground/60 mt-1">
                          静止 30s 后精度提升 ×3.6，60s 后 ×5
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-[10px] text-muted-foreground/60">
                      走动时使用多普勒实时定位，无需积累
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 协同链路状态 */}
          {cooperativeMode && cooperativeLinks.length > 0 && (
            <div className="p-4 border-b border-border">
              <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground font-medium mb-3">
                协同链路 ({cooperativeLinks.length} 条)
              </p>
              <div className="space-y-2">
                {cooperativeLinks.map(link => {
                  const pct = Math.round(link.disturbance * 100);
                  const active = link.disturbance > 0.35;
                  return (
                    <div key={`${link.idA}-${link.idB}`}
                      className={`px-2.5 py-2 rounded-md border text-[11px] transition-all ${active ? 'border-foreground/20 bg-foreground/[0.03]' : 'border-border'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-[10px]">{link.labelA} ↔ {link.labelB}</span>
                        <span className={`font-mono text-[10px] ${active ? '' : 'text-muted-foreground'}`}>
                          {active ? '⚡' : '·'} {pct}%
                        </span>
                      </div>
                      <div className="h-1 bg-foreground/8 rounded-full">
                        <div className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${pct}%`,
                            background: active
                              ? `oklch(0.35 0.1 30)`
                              : `oklch(0.55 0.06 220)`,
                          }}/>
                      </div>
                      {link.wallLoss > 0 && (
                        <p className="text-[9px] text-muted-foreground mt-1 font-mono">
                          直连路径穿墙 -{link.wallLoss}dBm
                        </p>
                      )}
                    </div>
                  );
                })}
                {strongLinks > 0 && (
                  <div className="px-2.5 py-2 rounded-md border border-foreground/15 bg-foreground/[0.02] text-[10px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">协同约束</span>
                      <span>{strongLinks} 条强链路</span>
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-muted-foreground">精度增益</span>
                      <span>×{(1/cooperativeGain).toFixed(1)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 节点列表 */}
          <div className="p-4 border-b border-border">
            <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground font-medium mb-3">节点列表</p>
            {nodes.length === 0
              ? <p className="text-[12px] text-muted-foreground/50">点击顶部「添加节点」</p>
              : <div className="space-y-1">
                  {nodes.map((node) => (
                    <button key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all ${
                        selectedNodeId === node.id ? 'bg-foreground/[0.06] border border-border' : 'hover:bg-foreground/[0.03]'
                      }`}>
                      <span className="text-sm">{ANTENNA_META[node.antenna].icon}</span>
                      <span className="text-[12px] font-mono flex-1">{node.label}</span>
                      <span className="text-[10px] text-muted-foreground/60">{ANTENNA_META[node.antenna].label}</span>
                    </button>
                  ))}
                </div>
            }
          </div>

          {/* 说明 */}
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.5}/>
              <div className="space-y-1 text-[11px] text-muted-foreground leading-relaxed">
                <p>点击节点图标可配置天线类型</p>
                <p>拖拽节点到任意位置</p>
              </div>
            </div>
            {/* 墙体图例 */}
            <div className="border border-border rounded-md px-3 py-2.5 space-y-1.5">
              <p className="text-[10px] tracking-[0.08em] uppercase text-muted-foreground font-medium mb-2">墙体类型</p>
              {[
                { color: 'oklch(0.15 0 0)', width: 3, dash: false, label: '承重墙',    sub: '-12dBm/面' },
                { color: 'oklch(0.42 0 0)', width: 1.5, dash: false, label: '非承重墙', sub: '-4dBm/面' },
                { color: 'oklch(0.55 0.06 220)', width: 1.5, dash: true, label: '玻璃门/窗', sub: '-2dBm/面' },
              ].map(w => (
                <div key={w.label} className="flex items-center gap-2">
                  <svg width="28" height="10" className="shrink-0">
                    <line x1="2" y1="5" x2="26" y2="5"
                      stroke={w.color} strokeWidth={w.width}
                      strokeDasharray={w.dash ? '5 3' : undefined}/>
                  </svg>
                  <span className="text-[11px]">{w.label}</span>
                  <span className="text-[10px] text-muted-foreground font-mono ml-auto">{w.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
