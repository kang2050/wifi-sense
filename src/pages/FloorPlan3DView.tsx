/**
 * FloorPlan3DView — 三维户型图 + CSI 感知可视化
 * 技术栈：@react-three/fiber + @react-three/drei + Three.js
 *
 * 坐标系映射：
 *   SVG (x,y) → Three.js (x*s - W/2,  elevation,  y*s - H/2)
 *   其中 s = plan.scale/100 (px→m)，Y轴向上，Z轴朝观察者
 *   例如 floorplan1 (scale=1.5): 1200px → 18m，900px → 13.5m
 */

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Line, Grid } from '@react-three/drei';
import * as THREE from 'three';

import type { FloorPlan } from '../data/floorplans';
import { COVERAGE_RADIUS, type Node, type CooperativeLink, type PersonPosition } from '../utils/triangulation';
import type { ActivityType } from '../hooks/useCSIStream';

// ─── 常量 ─────────────────────────────────────────────────────────────────────
const WALL_H   = 2.8;   // 标准层高（m）
const NODE_H   = 1.8;   // 设备安装高度（m）
const PERSON_H = 1.7;   // 人体高度（m）

// ─── 坐标换算 ─────────────────────────────────────────────────────────────────
function sw(x: number, y: number, elev: number, plan: FloorPlan): [number, number, number] {
  const s = plan.scale / 100;
  return [x * s - plan.width * s / 2, elev, y * s - plan.height * s / 2];
}

const ROOM_COLORS: Record<string, string> = {
  living: '#f0ede0', bedroom: '#e8f0e8', bathroom: '#dceef5',
  kitchen: '#f5f0e0', hallway: '#f0f0f0', balcony: '#e8f5e8',
  garage: '#e8e8e8', dining: '#f5ede0',
};

// ─── 房间地面 ─────────────────────────────────────────────────────────────────
function RoomFloor({ room, plan }: { room: FloorPlan['rooms'][0]; plan: FloorPlan }) {
  const s = plan.scale / 100;
  const cx = room.x * s + room.width  * s / 2 - plan.width  * s / 2;
  const cz = room.y * s + room.height * s / 2 - plan.height * s / 2;
  return (
    <mesh position={[cx, 0.001, cz]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[room.width * s, room.height * s]} />
      <meshStandardMaterial color={ROOM_COLORS[room.type] ?? '#f0f0f0'} roughness={0.85} />
    </mesh>
  );
}

// ─── 墙体（按类型决定尺寸/颜色/透明度） ────────────────────────────────────────
function Wall3D({ wall, plan }: { wall: FloorPlan['walls'][0]; plan: FloorPlan }) {
  const s  = plan.scale / 100;
  const dx = (wall.x2 - wall.x1) * s;
  const dz = (wall.y2 - wall.y1) * s;
  const len  = Math.sqrt(dx * dx + dz * dz);
  const ang  = Math.atan2(dz, dx);
  const mx   = (wall.x1 + wall.x2) / 2 * s - plan.width  * s / 2;
  const mz   = (wall.y1 + wall.y2) / 2 * s - plan.height * s / 2;

  const thick   = wall.type === 'bearing' ? 0.25 : wall.type === 'window' ? 0.06 : 0.12;
  const h       = wall.type === 'window' ? WALL_H * 0.55 : WALL_H;
  const yOff    = wall.type === 'window' ? WALL_H * 0.52 : h / 2;
  const color   = wall.type === 'bearing' ? '#333' : wall.type === 'window' ? '#90bcd0' : '#888';
  const opacity = wall.type === 'window' ? 0.38 : 1;

  return (
    <mesh position={[mx, yOff, mz]} rotation={[0, -ang, 0]}>
      <boxGeometry args={[len, h, thick]} />
      <meshStandardMaterial color={color} roughness={0.65} metalness={0.05}
        transparent={wall.type === 'window'} opacity={opacity}
        side={wall.type === 'window' ? THREE.DoubleSide : THREE.FrontSide} />
    </mesh>
  );
}

// ─── ESP32 节点 ───────────────────────────────────────────────────────────────
function Node3D({ node, plan, selected }: { node: Node; plan: FloorPlan; selected: boolean }) {
  const [wx, , wz] = sw(node.x, node.y, NODE_H, plan);
  const col = selected ? '#111' : '#555';
  return (
    <group position={[wx, NODE_H, wz]}>
      {/* 设备本体 */}
      <mesh>
        <boxGeometry args={[0.09, 0.13, 0.04]} />
        <meshStandardMaterial color={col} metalness={0.3} roughness={0.5} />
      </mesh>
      {/* 天线 */}
      <mesh position={[0.04, 0.12, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.18, 6]} />
        <meshStandardMaterial color={col} />
      </mesh>
      {/* 吊装线 */}
      <Line points={[[0, 0, 0], [0, WALL_H - NODE_H, 0]]}
        color="#aaa" lineWidth={0.5} />
      {/* 标签 */}
      <Html position={[0, -0.22, 0]} center
        style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          background: selected ? 'rgba(0,0,0,0.82)' : 'rgba(255,255,255,0.82)',
          color: selected ? '#fff' : '#222',
          fontSize: 11, fontFamily: 'monospace',
          padding: '1px 5px', borderRadius: 4,
          border: '1px solid rgba(0,0,0,0.12)', whiteSpace: 'nowrap',
        }}>{node.label}</div>
      </Html>
      {/* 选中光圈 */}
      {selected && (
        <mesh position={[0, -NODE_H + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.38, 32]} />
          <meshStandardMaterial color="#111" transparent opacity={0.35} />
        </mesh>
      )}
    </group>
  );
}

// ─── 信号覆盖球 ───────────────────────────────────────────────────────────────
function CoverageSphere({ node, plan }: { node: Node; plan: FloorPlan }) {
  const [wx, , wz] = sw(node.x, node.y, NODE_H, plan);
  const r = COVERAGE_RADIUS[node.antenna] * (plan.scale / 100);
  const col = node.antenna === 'phased' ? '#2060b0'
    : node.antenna === 'rotating' ? '#206050'
    : '#404040';
  return (
    <mesh position={[wx, NODE_H, wz]}>
      <sphereGeometry args={[r, 24, 16]} />
      <meshStandardMaterial color={col} transparent opacity={0.038}
        side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

// ─── 人体（cylinder body + sphere head + uncertainty sphere） ─────────────────
function Person3D({ x, y, activity, uncertaintyM, plan }: {
  x: number; y: number; activity: ActivityType;
  uncertaintyM: number; plan: FloorPlan;
}) {
  const [wx, , wz] = sw(x, y, 0, plan);
  const isFall = activity === 'falling';
  const isSit  = activity === 'sitting';

  const col   = isFall ? '#b03020' : activity === 'walking' ? '#204080' : '#2a2a2a';
  const bodyH = isSit ? 0.9 : isFall ? 0.4 : 1.25;
  const bodyY = isSit ? 0.45 : isFall ? 0.2 : bodyH / 2;
  const headY = isFall ? 0.38 : bodyY + bodyH / 2 + 0.18;
  const headX = isFall ? 0.55 : 0;

  return (
    <group position={[wx, 0, wz]}>
      {/* 身体 */}
      <mesh position={[0, bodyY, 0]}
        rotation={isFall ? [0, 0, Math.PI / 2] : [0, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.22, bodyH, 12]} />
        <meshStandardMaterial color={col} roughness={0.7} />
      </mesh>
      {/* 头 */}
      <mesh position={[headX, headY, 0]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial color={col} roughness={0.7} />
      </mesh>
      {/* 不确定性圆球（半透明+线框双层） */}
      <mesh position={[0, PERSON_H / 2, 0]}>
        <sphereGeometry args={[uncertaintyM, 18, 14]} />
        <meshStandardMaterial color={col} transparent opacity={0.05}
          side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, PERSON_H / 2, 0]}>
        <sphereGeometry args={[uncertaintyM, 12, 10]} />
        <meshStandardMaterial color={col} transparent opacity={0.12}
          wireframe depthWrite={false} />
      </mesh>
      {/* 活动标签 */}
      <Html position={[0, PERSON_H + 0.3, 0]} center
        style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          background: 'rgba(0,0,0,0.78)', color: '#fff',
          fontSize: 11, fontFamily: 'DM Sans, sans-serif',
          padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap',
        }}>
          {activity === 'standing' ? '站立' : activity === 'sitting' ? '静坐'
            : activity === 'walking' ? '走动' : '跌倒'}
          &nbsp;±{uncertaintyM.toFixed(2)}m
        </div>
      </Html>
    </group>
  );
}

// ─── 协同链路（3D 线 + 菲涅尔椭球） ─────────────────────────────────────────
function CoopLink3D({ link, plan }: { link: CooperativeLink; plan: FloorPlan }) {
  const s = plan.scale / 100;
  const [ax, , az] = sw(link.ax, link.ay, NODE_H, plan);
  const [bx, , bz] = sw(link.bx, link.by, NODE_H, plan);

  const disturbed = link.disturbance > 0.35;
  const col       = disturbed ? '#c04010' : '#4060a0';
  const linkAlpha = 0.12 + link.disturbance * 0.55;

  // 菲涅尔椭球参数
  const fR    = link.fresnelRadius * s;
  const halfL = link.linkDist      * s / 2;
  const cx    = (ax + bx) / 2;
  const cz    = (az + bz) / 2;
  const angle = Math.atan2(bz - az, bx - ax);

  return (
    <group>
      <Line
        points={[[ax, NODE_H, az], [bx, NODE_H, bz]]}
        color={col} lineWidth={disturbed ? 1.5 + link.disturbance * 2 : 0.8}
        transparent opacity={linkAlpha}
        dashed={!disturbed} dashSize={0.3} gapSize={0.2}
      />
      {/* 菲涅尔椭球：长轴沿链路方向 */}
      <mesh position={[cx, NODE_H, cz]}
        rotation={[0, -angle, 0]}
        scale={[halfL + fR, fR, fR]}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color={col} transparent
          opacity={disturbed ? 0.07 + link.disturbance * 0.1 : 0.025}
          side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ─── 主场景 ───────────────────────────────────────────────────────────────────
function Scene({ plan, nodes, positioning, activity, effectiveUncertaintyM,
  cooperativeLinks, showCoverage, cooperativeMode, isRunning, selectedNodeId }: SceneProps) {
  const s = plan.scale / 100;
  const W = plan.width  * s;
  const D = plan.height * s;

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[W * 0.6, 10, -D * 0.4]} intensity={0.9} castShadow />
      <directionalLight position={[-W * 0.3, 6,  D * 0.5]} intensity={0.35} />

      {/* 地板基底 */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#f2f2ee" roughness={0.9} />
      </mesh>

      {/* 天花板（半透明，轨道时可从上方看进去） */}
      <mesh position={[0, WALL_H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#fff" transparent opacity={0.06}
          side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* 房间地面着色 */}
      {plan.rooms.map(r => <RoomFloor key={r.id} room={r} plan={plan} />)}

      {/* 墙体 */}
      {plan.walls.map((w, i) => <Wall3D key={`w${i}`} wall={w} plan={plan} />)}

      {/* 信号覆盖球 */}
      {showCoverage && nodes.map(n => <CoverageSphere key={`cov-${n.id}`} node={n} plan={plan} />)}

      {/* 协同链路 */}
      {cooperativeMode && cooperativeLinks.map(l =>
        <CoopLink3D key={`cl-${l.idA}-${l.idB}`} link={l} plan={plan} />
      )}

      {/* 节点 */}
      {nodes.map(n =>
        <Node3D key={n.id} node={n} plan={plan} selected={n.id === selectedNodeId} />
      )}

      {/* 人体 */}
      {isRunning && activity !== 'empty' && !positioning.inDeadZone && (
        <Person3D
          x={positioning.x} y={positioning.y}
          activity={activity}
          uncertaintyM={effectiveUncertaintyM}
          plan={plan}
        />
      )}

      {/* 盲区提示 */}
      {isRunning && activity !== 'empty' && positioning.inDeadZone && (
        <Html position={[0, 2, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(255,255,255,0.85)', color: '#555',
            fontSize: 13, padding: '6px 12px', borderRadius: 6,
            border: '1px solid #ddd',
          }}>
            {positioning.microDetectable ? '🐾 检测到生命体征' : '⚠️ 信号盲区'}
          </div>
        </Html>
      )}

      {/* 地面网格 */}
      <Grid position={[0, -0.002, 0]}
        args={[W, D]}
        cellSize={1} cellThickness={0.3} cellColor="#d8d8d8"
        sectionSize={5} sectionThickness={0.7} sectionColor="#b8b8b8"
        fadeDistance={50} fadeStrength={1} infiniteGrid={false} />
    </>
  );
}

// ─── Props 接口 ───────────────────────────────────────────────────────────────
export interface FloorPlan3DViewProps {
  plan:               FloorPlan;
  nodes:              Node[];
  positioning:        PersonPosition;
  activity:           ActivityType;
  effectiveUncertaintyM: number;
  cooperativeLinks:   CooperativeLink[];
  showCoverage:       boolean;
  cooperativeMode:    boolean;
  isRunning:          boolean;
  selectedNodeId:     string | null;
}
type SceneProps = FloorPlan3DViewProps;

// ─── 导出 ─────────────────────────────────────────────────────────────────────
export function FloorPlan3DView(props: FloorPlan3DViewProps) {
  const s  = props.plan.scale / 100;
  const W  = props.plan.width  * s;
  const D  = props.plan.height * s;
  const camDist = Math.max(W, D) * 0.85;

  return (
    <Canvas
      camera={{ position: [W * 0.55, camDist * 0.65, D * 0.9], fov: 48, near: 0.1, far: 500 }}
      shadows gl={{ antialias: true }}
      style={{ background: '#f6f6f2' }}
    >
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
      <OrbitControls
        target={[0, WALL_H / 2, 0]}
        minDistance={2} maxDistance={80}
        maxPolarAngle={Math.PI / 1.75}
        enablePan enableZoom enableRotate
      />
    </Canvas>
  );
}
