/**
 * Wi-Fi CSI 三角定位算法
 * 支持三种天线类型：全向 / 相控阵 / 旋转扫描
 * 支持墙体信号衰减模型（承重墙 / 非承重墙 / 玻璃门 / 门口）
 */

import type { Wall, Door } from '../data/floorplans';

export type AntennaType = 'omni' | 'phased' | 'rotating';

export interface Node {
  id: string;
  x: number;
  y: number;
  label: string;
  antenna: AntennaType;
  direction: number;    // 朝向角度（度），0=向右，顺时针
  beamWidth: number;    // 波束宽度（度）
}

export interface PersonPosition {
  x: number;
  y: number;
  confidence: number;
  coverageQuality: number;
  inDeadZone: boolean;
  closestNode: string | null;
  uncertaintyMeters: number;   // 真实定位不确定性半径（米），UI 按比例尺转换为 px
  microDetectable: boolean;    // 信号弱但可检测微弱生命体征（呼吸/小动物）
  wallsBlocking: number;       // 遮挡承重墙数量（-12dBm/面，+0.40m 误差/面）
  partitionsBlocking: number;  // 遮挡非承重墙数量（-4dBm/面，+0.10m 误差/面）
}

// 覆盖半径（像素）：omni 280px≈14m / phased 420px≈21m / rotating 320px≈16m
export const COVERAGE_RADIUS: Record<AntennaType, number> = {
  omni: 280,
  phased: 420,
  rotating: 320,
};

// 墙体穿越信号损耗（dBm/面）
const WALL_LOSS: Record<string, number> = {
  bearing:   12,   // 承重墙（混凝土/砖石 200mm）
  partition:  4,   // 非承重墙（石膏板/轻质隔墙 100mm）
  window:     2,   // 玻璃幕墙/阳台推拉门
};
const DOOR_LOSS = 1;           // 门口通道（视为半开）

// 定位最低可用 RSSI
const MIN_RSSI_POSITION = -80; // dBm，低于此无法定位
const MIN_RSSI_MICRO    = -88; // dBm，低于此无法检测微弱生命体征

// 默认节点配置
export const DEFAULT_NODE: Omit<Node, 'id' | 'x' | 'y' | 'label'> = {
  antenna: 'omni',
  direction: 0,
  beamWidth: 90,
};

// ─── 路径损耗模型 ────────────────────────────────────────────────────────────

function distanceToRSSI(distance: number, antenna: AntennaType): number {
  const rssiAt1m = antenna === 'phased' ? -30 : -35;
  const n = 2.8; // 路径损耗指数（室内含遮挡）
  if (distance < 1) return rssiAt1m;
  return rssiAt1m - 10 * n * Math.log10(distance / 50);
}

function rssiToWeight(rssi: number): number {
  return Math.pow(10, rssi / 20);
}

/** RSSI 反推估算距离 */
function rssiToDistance(rssi: number, antenna: AntennaType): number {
  const rssiAt1m = antenna === 'phased' ? -30 : -35;
  const n = 2.8;
  return 50 * Math.pow(10, (rssiAt1m - rssi) / (10 * n));
}

// ─── 线段相交判断 ─────────────────────────────────────────────────────────────

/**
 * 判断射线 (ax,ay)→(bx,by) 是否与线段 (cx,cy)-(dx,dy) 相交
 * 返回相交时射线上的参数 t（0~1 内有效），否则 null
 */
function raySegmentIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): number | null {
  const rx = bx - ax, ry = by - ay;
  const sx = dx - cx, sy = dy - cy;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-10) return null; // 平行
  const t = ((cx - ax) * sy - (cy - ay) * sx) / denom;
  const u = ((cx - ax) * ry - (cy - ay) * rx) / denom;
  // t 避开端点附近（0.02/0.98）防止节点或目标刚好贴墙时误判
  if (t > 0.02 && t < 0.98 && u >= 0 && u <= 1) return t;
  return null;
}

// ─── 墙体衰减计算 ─────────────────────────────────────────────────────────────

interface WallLossResult {
  loss: number;          // 总衰减（dBm）
  bearingCount: number;  // 穿越承重墙数量（混凝土/砖石，影响大）
  partitionCount: number; // 穿越非承重墙数量（轻质隔板，影响小）
}

/**
 * 计算从 (fromX,fromY) 到 (toX,toY) 射线穿越所有墙体的总信号衰减
 * 若相交点在门口范围内，改用门口衰减
 */
function computeWallLoss(
  fromX: number, fromY: number,
  toX: number,   toY: number,
  walls: Wall[],
  doors: Door[],
): WallLossResult {
  let loss = 0;
  let bearingCount = 0;
  let partitionCount = 0;

  for (const wall of walls) {
    const t = raySegmentIntersect(fromX, fromY, toX, toY, wall.x1, wall.y1, wall.x2, wall.y2);
    if (t === null) continue;

    const hx = fromX + t * (toX - fromX);
    const hy = fromY + t * (toY - fromY);

    const nearDoor = doors.some(d => {
      const dist = Math.sqrt((hx - d.x) ** 2 + (hy - d.y) ** 2);
      return dist < d.width * 0.6;
    });

    if (nearDoor) {
      loss += DOOR_LOSS;
    } else {
      const wallType = wall.type ?? 'partition';
      loss += WALL_LOSS[wallType] ?? 4;
      if (wallType === 'bearing')   bearingCount++;
      if (wallType === 'partition') partitionCount++;
      // window 不计数（玻璃衰减小，多径影响可忽略）
    }
  }

  return { loss, bearingCount, partitionCount };
}

// ─── 射线方向有效距离计算 ─────────────────────────────────────────────────────

/**
 * 从 (nx,ny) 向 theta 方向发射，穿越所有墙体后的有效覆盖距离
 * 公式：effectiveR = maxR × 10^(-cumulativeLoss / (10 × n))
 * 每穿过一面墙就折减一次，墙越多/越厚，剩余覆盖距离越短
 */
function computeEffectiveRange(
  nx: number, ny: number,
  theta: number,
  maxR: number,
  walls: Wall[],
  doors: Door[],
): number {
  const n = 2.8;
  const endX = nx + maxR * Math.cos(theta);
  const endY = ny + maxR * Math.sin(theta);

  const hits: { dist: number; loss: number }[] = [];
  for (const wall of walls) {
    const t = raySegmentIntersect(nx, ny, endX, endY, wall.x1, wall.y1, wall.x2, wall.y2);
    if (t === null) continue;
    const dist = t * maxR;
    const hx = nx + t * (endX - nx);
    const hy = ny + t * (endY - ny);
    const nearDoor = doors.some(d => Math.sqrt((hx - d.x) ** 2 + (hy - d.y) ** 2) < d.width * 0.6);
    const loss = nearDoor ? DOOR_LOSS : (WALL_LOSS[wall.type ?? 'partition'] ?? 4);
    hits.push({ dist, loss });
  }
  hits.sort((a, b) => a.dist - b.dist);

  let cumLoss = 0;
  let effR = maxR;
  for (const hit of hits) {
    if (hit.dist >= effR) break; // 墙在信号已衰死的区域外
    cumLoss += hit.loss;
    effR = maxR * Math.pow(10, -cumLoss / (10 * n));
  }
  return effR;
}

/**
 * 计算节点真实覆盖多边形（按方向射线追踪，墙体折减覆盖距离）
 * - 全向天线：每 5° 一条射线，共 72 点，形成非正圆多边形
 * - 相控阵/旋转：扇形顶点 + 每 1° 一条射线，形成不规则扇形
 */
export function computeCoveragePolygon(
  node: Node,
  rotatingAngle: number,
  walls: Wall[],
  doors: Door[],
): { x: number; y: number }[] {
  const maxR = COVERAGE_RADIUS[node.antenna];
  const facing = node.antenna === 'rotating' ? rotatingAngle : node.direction;
  const half = node.beamWidth / 2;

  const pts: { x: number; y: number }[] = [];

  if (node.antenna === 'omni') {
    for (let deg = 0; deg < 360; deg += 5) {
      const theta = (deg * Math.PI) / 180;
      const r = computeEffectiveRange(node.x, node.y, theta, maxR, walls, doors);
      pts.push({ x: node.x + r * Math.cos(theta), y: node.y + r * Math.sin(theta) });
    }
  } else {
    // 扇形：先放顶点，再遍历扇形内每 1°
    pts.push({ x: node.x, y: node.y });
    for (let i = 0; i <= Math.ceil(node.beamWidth); i++) {
      const theta = ((facing - half + i) * Math.PI) / 180;
      const r = computeEffectiveRange(node.x, node.y, theta, maxR, walls, doors);
      pts.push({ x: node.x + r * Math.cos(theta), y: node.y + r * Math.sin(theta) });
    }
  }
  return pts;
}

// ─── 角度覆盖判断（相控阵/旋转） ─────────────────────────────────────────────

function isInAngularCoverage(node: Node, px: number, py: number, rotatingAngle: number): boolean {
  if (node.antenna === 'omni') return true;
  const dx = px - node.x;
  const dy = py - node.y;
  const angleToTarget = (Math.atan2(dy, dx) * 180) / Math.PI;
  const facing = node.antenna === 'rotating' ? rotatingAngle : node.direction;
  const half = node.beamWidth / 2;
  const diff = ((angleToTarget - facing) % 360 + 540) % 360 - 180;
  return Math.abs(diff) <= half;
}

// ─── 主定位函数 ──────────────────────────────────────────────────────────────

export function computePosition(
  nodes: Node[],
  trueX: number,
  trueY: number,
  rotatingAngle: number = 0,
  walls: Wall[] = [],
  doors: Door[] = [],
  packetRate: number = 10,
): PersonPosition {
  // 包速率统计降噪：N 包平均 → 噪声 × 1/√(N/10)
  // 10pkt/s = 基准；100pkt/s → √10 ≈ 3.16× 改善；1000pkt/s → √100 = 10× 改善
  const noiseFactor = Math.sqrt(10 / Math.max(packetRate, 1));

  if (nodes.length === 0) {
    return { x: trueX, y: trueY, confidence: 0, coverageQuality: 0, inDeadZone: true, closestNode: null, uncertaintyMeters: 5, microDetectable: false, wallsBlocking: 0, partitionsBlocking: 0 };
  }

  const nodeData = nodes.map(node => {
    const dx = trueX - node.x;
    const dy = trueY - node.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 计算墙体衰减
    const { loss: wallLoss, bearingCount, partitionCount } = computeWallLoss(node.x, node.y, trueX, trueY, walls, doors);

    // 真实 RSSI（含路径损耗 + 墙体衰减 + 随机噪声）
    // 基础噪声 ±6dBm，包速率越高 → 多包平均 → 噪声 × 1/√(packetRate/10)
    const rssiIdeal = distanceToRSSI(dist, node.antenna) - wallLoss;
    const rssi = rssiIdeal + (Math.random() - 0.5) * 6 * noiseFactor;

    // 几何范围 + 信号强度双重判断
    const inGeometric = dist <= COVERAGE_RADIUS[node.antenna] && isInAngularCoverage(node, trueX, trueY, rotatingAngle);
    const inRange = inGeometric && rssi > MIN_RSSI_POSITION;

    // 微弱生命体征检测（CSI 相位对呼吸/微动敏感，信号更弱时仍可检测）
    const microDetectable = rssiIdeal > MIN_RSSI_MICRO;

    return { node, dist, rssi, inRange, microDetectable, bearingCount, partitionCount };
  });

  const inRangeNodes = nodeData.filter(n => n.inRange);
  const sorted = [...nodeData].sort((a, b) => a.dist - b.dist);
  const closestNode = sorted[0];
  const anyMicro = nodeData.some(n => n.microDetectable);
  const relevant = nodeData.filter(n => n.inRange || n.microDetectable);
  const maxBearingWalls    = Math.max(...relevant.map(n => n.bearingCount),   0);
  const maxPartitionWalls  = Math.max(...relevant.map(n => n.partitionCount), 0);

  if (inRangeNodes.length === 0) {
    return {
      x: trueX, y: trueY, confidence: 0, coverageQuality: 0, inDeadZone: true,
      closestNode: closestNode?.node.id ?? null,
      uncertaintyMeters: 5,
      microDetectable: anyMicro,
      wallsBlocking: maxBearingWalls,
      partitionsBlocking: maxPartitionWalls,
    };
  }

  // ─── 距离加权定位（Distance-Weighted Centroid Localization）───────────────
  // 角度噪声来源：RSSI 无法给出方向信息，只能估算距离
  // 单节点 ±20°，双节点 ±12°，三节点+ ±6°（来自 Widar/SpotFi 精度测评）
  // 承重墙额外 +5°/面（混凝土反射造成严重多径），非承重墙 +2°/面（轻质散射较小）
  const ANG_NOISE_DEG = inRangeNodes.length >= 3 ? 6 : inRangeNodes.length === 2 ? 12 : 20;

  let sumW = 0, sumWX = 0, sumWY = 0;
  for (const nd of inRangeNodes) {
    const w = rssiToWeight(nd.rssi);
    const distEst = rssiToDistance(nd.rssi, nd.node.antenna);
    const angleTrue = Math.atan2(trueY - nd.node.y, trueX - nd.node.x);
    const angNoise = (ANG_NOISE_DEG + nd.bearingCount * 5 + nd.partitionCount * 2) * Math.PI / 180;
    const angle = angleTrue + (Math.random() - 0.5) * angNoise;
    sumW  += w;
    sumWX += w * (nd.node.x + distEst * Math.cos(angle));
    sumWY += w * (nd.node.y + distEst * Math.sin(angle));
  }

  const estX = sumWX / sumW;
  const estY = sumWY / sumW;

  // 置信度
  const nodeCountFactor = Math.min(inRangeNodes.length / 3, 1);
  const distFactor = 1 - Math.min(closestNode.dist / COVERAGE_RADIUS[closestNode.node.antenna], 1);
  const wallPenalty = Math.min(maxBearingWalls * 0.12 + maxPartitionWalls * 0.04, 0.35);
  const confidence = Math.max(0, nodeCountFactor * 0.7 + distFactor * 0.3 - wallPenalty);
  const coverageQuality = Math.min(inRangeNodes.length / 3, 1);

  // ─── 真实定位不确定性（米）──────────────────────────────────────────────────
  // 数据来源：IEEE 802.11 RSSI 定位精度综述 + Widar3.0 / IndoorAtlas 测评
  // 1节点 ±2m  2节点 ±1.2m  3节点 ±0.65m  4节点+ ±0.4m
  // 承重墙每面 +0.40m（混凝土严重散射，RSSI 测距偏差大）
  // 非承重墙每面 +0.10m（轻质隔墙，散射弱，影响相对小）
  const BASE_ACCURACY_M = [2.0, 1.2, 0.65, 0.4];
  const nodeIdx = Math.min(inRangeNodes.length - 1, 3);
  // 基础误差 × noiseFactor（包速率越高，RSSI 测距越准，位置误差越小）
  // 不可突破物理极限（多径/障碍），下限取基准的 1/10
  const uncertaintyMeters = (BASE_ACCURACY_M[nodeIdx]
    + maxBearingWalls   * 0.40
    + maxPartitionWalls * 0.10) * Math.max(noiseFactor, 0.1);

  return {
    x: estX, y: estY, confidence, coverageQuality,
    inDeadZone: false, closestNode: closestNode.node.id,
    uncertaintyMeters, microDetectable: true,
    wallsBlocking: maxBearingWalls,
    partitionsBlocking: maxPartitionWalls,
  };
}

// ─── 协同感知：多链路菲涅尔区扰动计算 ──────────────────────────────────────────

/**
 * 协同链路：节点 A 发射 → 节点 B 直接接收（非反射路径）
 * 当人进入 A-B 连线的菲涅尔第一区，信号衰落可量化为 disturbance 值
 */
export interface CooperativeLink {
  idA: string; idB: string;
  labelA: string; labelB: string;
  ax: number; ay: number;
  bx: number; by: number;
  linkDist: number;      // 链路长度（px）
  disturbance: number;   // 0-1，菲涅尔区扰动强度（>0.4 = 人在链路上）
  fresnelRadius: number; // 菲涅尔第一区半径（px，在链路中点处）
  wallLoss: number;      // A-B 直连路径穿墙损耗（dBm）
}

/**
 * 计算所有节点对之间的协同链路扰动
 *
 * 物理原理：
 *   人处于 A-B 连线上时，直接阻断信号路径 → disturbance → 1
 *   人垂直偏离链路越远，扰动指数衰减（高斯分布）
 *   菲涅尔第一区半径：r_F ≈ √(λ·d_A·d_B/(d_A+d_B))
 *   此处使用视觉比例：fresnelRadius = √(linkDist × 3.5)
 *
 * 多链路效果：
 *   N 个节点 → N(N-1)/2 条链路
 *   3 节点=3条，4节点=6条，6节点=15条
 *   扰动链路的椭圆交集 → 人的位置精度 >> 单节点圆形定位
 */
export function computeCooperativeLinks(
  nodes: Node[],
  personX: number,
  personY: number,
  walls: Wall[],
  doors: Door[],
): CooperativeLink[] {
  const links: CooperativeLink[] = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const linkDist = Math.sqrt(dx * dx + dy * dy);
      if (linkDist < 20) continue;

      // A-B 直连路径穿墙损耗
      const { loss: wallLoss } = computeWallLoss(a.x, a.y, b.x, b.y, walls, doors);

      // 人到 A-B 线段的垂直距离
      const t = Math.max(0, Math.min(1,
        ((personX - a.x) * dx + (personY - a.y) * dy) / (linkDist * linkDist)
      ));
      const projX = a.x + t * dx;
      const projY = a.y + t * dy;
      const dPerp = Math.sqrt((personX - projX) ** 2 + (personY - projY) ** 2);

      // 菲涅尔区半径（视觉比例，物理近似）
      const fresnelRadius = Math.sqrt(linkDist * 3.5);

      // 扰动：高斯衰减 × 穿墙折减
      const wallFactor = Math.min(wallLoss / 25, 0.75);
      const disturbance = Math.exp(-(dPerp * dPerp) / (2 * fresnelRadius * fresnelRadius))
        * (1 - wallFactor);

      links.push({
        idA: a.id, idB: b.id,
        labelA: a.label, labelB: b.label,
        ax: a.x, ay: a.y, bx: b.x, by: b.y,
        linkDist, disturbance, fresnelRadius, wallLoss,
      });
    }
  }

  return links;
}

// ─── 人员路径模拟 ─────────────────────────────────────────────────────────────

export function simulatePersonPath(
  floorWidth: number,
  floorHeight: number,
  activity: string,
): { x: number; y: number } {
  const cx = floorWidth / 2;
  const cy = floorHeight / 2;
  const t = Date.now() / 1000;

  switch (activity) {
    case 'walking':
      return {
        x: cx + Math.cos(t * 0.3) * (floorWidth * 0.3),
        y: cy + Math.sin(t * 0.2) * (floorHeight * 0.25),
      };
    case 'empty': return { x: -999, y: -999 };
    case 'standing':
    case 'sitting':
      return { x: cx + Math.sin(t * 0.1) * 5, y: cy * 0.8 + Math.cos(t * 0.1) * 5 };
    case 'falling':
      return { x: cx + Math.cos(t * 2) * 30, y: cy + Math.sin(t * 2) * 20 };
    default:
      return { x: cx, y: cy };
  }
}
