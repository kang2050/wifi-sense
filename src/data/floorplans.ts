/**
 * 大户型平面图数据
 * 坐标系：左上角(0,0)，单位为像素（约 1px ≈ 0.05m，即 200px = 10m）
 * 三套户型：大平层200m² / 别墅单层300m² / 复式两层（下层250m²）
 */

export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'bedroom' | 'living' | 'dining' | 'kitchen' | 'bathroom' | 'study' | 'balcony' | 'hallway' | 'garage' | 'storage';
}

export interface Wall {
  x1: number; y1: number;
  x2: number; y2: number;
  thickness?: number;
  /** 承重墙（混凝土/砖石）/ 非承重墙（轻质隔墙）/ 玻璃门窗 */
  type?: 'bearing' | 'partition' | 'window';
}

export interface Door {
  x: number; y: number;
  width: number;
  rotation: number; // degrees
}

export interface FloorPlan {
  id: string;
  name: string;
  area: number;       // m²
  width: number;      // SVG viewport width
  height: number;     // SVG viewport height
  scale: number;      // meters per 100px
  rooms: Room[];
  walls: Wall[];
  doors: Door[];
  defaultNodes: { x: number; y: number }[];  // 推荐ESP32放置位置
}

// ─── 户型一：200m² 大平层 ─────────────────────────────────────────────────────
// 南北通透，4室2厅2卫，适合3-4口之家
const floorplan1: FloorPlan = {
  id: 'flat-200',
  name: '200㎡ 大平层',
  area: 200,
  width: 1200,
  height: 800,
  scale: 1.5,  // 100px = 1.5m
  rooms: [
    // 入口/门厅
    { id: 'entry', name: '入户门厅', x: 520, y: 320, width: 160, height: 160, type: 'hallway' },
    // 客厅（南向大客厅）
    { id: 'living', name: '客厅', x: 60, y: 260, width: 420, height: 280, type: 'living' },
    // 餐厅
    { id: 'dining', name: '餐厅', x: 60, y: 540, width: 240, height: 200, type: 'dining' },
    // 厨房
    { id: 'kitchen', name: '厨房', x: 300, y: 540, width: 220, height: 200, type: 'kitchen' },
    // 主卧（带主卫）
    { id: 'master', name: '主卧', x: 680, y: 60, width: 460, height: 300, type: 'bedroom' },
    // 主卫
    { id: 'masterbath', name: '主卫', x: 940, y: 360, width: 200, height: 160, type: 'bathroom' },
    // 卧室2
    { id: 'bed2', name: '卧室二', x: 680, y: 360, width: 260, height: 260, type: 'bedroom' },
    // 卧室3
    { id: 'bed3', name: '卧室三', x: 60, y: 60, width: 260, height: 200, type: 'bedroom' },
    // 书房
    { id: 'study', name: '书房', x: 320, y: 60, width: 200, height: 200, type: 'study' },
    // 公共卫生间
    { id: 'bath2', name: '卫生间', x: 520, y: 60, width: 160, height: 200, type: 'bathroom' },
    // 北阳台（餐厅方向）
    { id: 'balcony1', name: '北阳台', x: 60, y: 740, width: 460, height: 40, type: 'balcony' },
    // 南阳台（客厅外）
    { id: 'balcony2', name: '南阳台', x: 60, y: 220, width: 420, height: 40, type: 'balcony' },
  ],
  walls: [
    // ── 外墙（承重墙）
    { x1: 40,   y1: 40,  x2: 1160, y2: 40,  type: 'bearing' },  // 北外墙
    { x1: 1160, y1: 40,  x2: 1160, y2: 760, type: 'bearing' },  // 东外墙
    { x1: 1160, y1: 760, x2: 40,   y2: 760, type: 'bearing' },  // 南外墙
    { x1: 40,   y1: 760, x2: 40,   y2: 40,  type: 'bearing' },  // 西外墙

    // ── 内墙 - 垂直
    { x1: 480, y1: 40,  x2: 480, y2: 260, type: 'partition' }, // 书房/卫生间
    { x1: 520, y1: 260, x2: 520, y2: 500, type: 'partition' }, // 门厅区域
    { x1: 680, y1: 40,  x2: 680, y2: 640, type: 'bearing'   }, // 主结构墙（公私分区）
    { x1: 940, y1: 360, x2: 940, y2: 760, type: 'partition' }, // 主卫/卧室2
    { x1: 320, y1: 40,  x2: 320, y2: 260, type: 'partition' }, // 卧室3/书房

    // ── 内墙 - 水平
    { x1: 40,  y1: 260, x2: 520, y2: 260, type: 'bearing'   }, // 卧室区/公共区分界
    { x1: 40,  y1: 540, x2: 520, y2: 540, type: 'partition' }, // 客厅/餐厅
    { x1: 520, y1: 360, x2: 680, y2: 360, type: 'partition' }, // 门厅/内部
    { x1: 680, y1: 360, x2: 940, y2: 360, type: 'bearing'   }, // 主卧/卧室2
    { x1: 40,  y1: 720, x2: 520, y2: 720, type: 'window'    }, // 北阳台玻璃推拉门
  ],
  doors: [
    { x: 540, y: 318, width: 60, rotation: 0 },
    { x: 200, y: 258, width: 60, rotation: 180 },
    { x: 680, y: 160, width: 60, rotation: 90 },
    { x: 780, y: 358, width: 60, rotation: 0 },
    { x: 160, y: 258, width: 50, rotation: 180 },
  ],
  defaultNodes: [
    { x: 260, y: 390 },   // 客厅中央
    { x: 820, y: 180 },   // 主卧
    { x: 800, y: 480 },   // 卧室2
    { x: 180, y: 130 },   // 卧室3/书房区
    { x: 420, y: 620 },   // 餐厅/厨房
  ],
};

// ─── 户型二：300m² 独栋别墅首层 ─────────────────────────────────────────────
// 单层铺开，5室3厅3卫，带车库和庭院
const floorplan2: FloorPlan = {
  id: 'villa-300',
  name: '300㎡ 别墅首层',
  area: 300,
  width: 1200,
  height: 900,
  scale: 1.8,
  rooms: [
    // 车库
    { id: 'garage',    name: '车库',    x: 40,  y: 40,  width: 240, height: 200, type: 'garage'  },
    // 门廊/入口
    { id: 'porch',     name: '门廊',    x: 280, y: 40,  width: 120, height: 120, type: 'hallway' },
    // 大客厅
    { id: 'living',    name: '客厅',    x: 400, y: 40,  width: 380, height: 320, type: 'living'  },
    // 餐厅
    { id: 'dining',    name: '餐厅',    x: 780, y: 40,  width: 220, height: 200, type: 'dining'  },
    // 开放式厨房
    { id: 'kitchen',   name: '厨房',    x: 1000, y: 40, width: 160, height: 260, type: 'kitchen' },
    // 老人房
    { id: 'elder',     name: '老人房',  x: 40,  y: 240, width: 240, height: 220, type: 'bedroom' },
    // 卧室2
    { id: 'bed2',      name: '卧室二',  x: 40,  y: 460, width: 240, height: 200, type: 'bedroom' },
    // 主卧
    { id: 'master',    name: '主卧',    x: 280, y: 360, width: 320, height: 280, type: 'bedroom' },
    // 主卫
    { id: 'masterbath', name: '主卫',   x: 600, y: 420, width: 180, height: 140, type: 'bathroom' },
    // 客卧
    { id: 'guest',     name: '客卧',    x: 780, y: 280, width: 240, height: 200, type: 'bedroom' },
    // 卫生间1
    { id: 'bath1',     name: '卫生间一', x: 280, y: 160, width: 120, height: 200, type: 'bathroom' },
    // 卫生间2
    { id: 'bath2',     name: '卫生间二', x: 40,  y: 660, width: 140, height: 120, type: 'bathroom' },
    // 书房/影音室
    { id: 'study',     name: '影音室',  x: 780, y: 480, width: 380, height: 220, type: 'study'   },
    // 储藏室
    { id: 'storage',   name: '储藏室',  x: 1020, y: 300, width: 140, height: 180, type: 'storage' },
    // 走廊
    { id: 'hall',      name: '走廊',    x: 280, y: 640, width: 500, height: 100, type: 'hallway' },
    // 后院露台
    { id: 'terrace',   name: '露台',    x: 40,  y: 780, width: 1120, height: 80, type: 'balcony' },
  ],
  walls: [
    // ── 外墙（承重墙）
    { x1: 40,   y1: 40,  x2: 1160, y2: 40,  type: 'bearing' },
    { x1: 1160, y1: 40,  x2: 1160, y2: 860, type: 'bearing' },
    { x1: 1160, y1: 860, x2: 40,   y2: 860, type: 'bearing' },
    { x1: 40,   y1: 860, x2: 40,   y2: 40,  type: 'bearing' },

    // ── 内墙 - 垂直
    { x1: 280,  y1: 40,  x2: 280,  y2: 360, type: 'bearing'   }, // 车库/主屋结构墙
    { x1: 400,  y1: 40,  x2: 400,  y2: 360, type: 'partition' }, // 门廊/客厅
    { x1: 600,  y1: 360, x2: 600,  y2: 560, type: 'partition' }, // 主卫/内部
    { x1: 780,  y1: 40,  x2: 780,  y2: 700, type: 'bearing'   }, // 主结构墙（中轴）
    { x1: 1000, y1: 40,  x2: 1000, y2: 480, type: 'partition' }, // 厨房/餐厅

    // ── 内墙 - 水平
    { x1: 40,  y1: 240, x2: 280, y2: 240, type: 'partition' }, // 车库/老人房
    { x1: 40,  y1: 460, x2: 280, y2: 460, type: 'partition' }, // 老人房/卧室2
    { x1: 40,  y1: 660, x2: 280, y2: 660, type: 'partition' }, // 卧室2/卫生间2
    { x1: 280, y1: 360, x2: 780, y2: 360, type: 'bearing'   }, // 公共区/私人区分界
    { x1: 280, y1: 640, x2: 780, y2: 640, type: 'partition' }, // 走廊隔墙
    { x1: 780, y1: 700, x2: 1160, y2: 700, type: 'bearing'  }, // 影音室/露台
    { x1: 40,  y1: 780, x2: 1160, y2: 780, type: 'window'   }, // 后院玻璃幕墙/推拉门
  ],
  doors: [],
  defaultNodes: [
    { x: 580, y: 200 },    // 客厅
    { x: 900, y: 140 },    // 餐厅
    { x: 430, y: 490 },    // 主卧
    { x: 140, y: 340 },    // 老人房/卧室2
    { x: 960, y: 580 },    // 影音室
    { x: 900, y: 380 },    // 客卧
  ],
};

// ─── 户型三：复式下层 250m² ───────────────────────────────────────────────────
const floorplan3: FloorPlan = {
  id: 'duplex-lower',
  name: '250㎡ 复式·下层',
  area: 250,
  width: 1200,
  height: 860,
  scale: 1.6,
  rooms: [
    { id: 'entry',      name: '入户',      x: 540, y: 380, width: 120, height: 100, type: 'hallway'  },
    { id: 'living',     name: '挑高客厅',  x: 60,  y: 200, width: 480, height: 360, type: 'living'   },
    { id: 'dining',     name: '餐厅',      x: 60,  y: 560, width: 280, height: 240, type: 'dining'   },
    { id: 'kitchen',    name: '中西厨',    x: 340, y: 560, width: 260, height: 240, type: 'kitchen'  },
    { id: 'study',      name: '书房',      x: 60,  y: 60,  width: 260, height: 140, type: 'study'    },
    { id: 'wc1',        name: '卫生间',    x: 320, y: 60,  width: 220, height: 140, type: 'bathroom' },
    { id: 'master',     name: '主卧',      x: 660, y: 60,  width: 480, height: 300, type: 'bedroom'  },
    { id: 'masterbath', name: '主卫+衣帽', x: 660, y: 360, width: 260, height: 200, type: 'bathroom' },
    { id: 'bed2',       name: '卧室二',    x: 920, y: 360, width: 220, height: 200, type: 'bedroom'  },
    { id: 'bed3',       name: '卧室三',    x: 660, y: 560, width: 260, height: 240, type: 'bedroom'  },
    { id: 'bed4',       name: '卧室四',    x: 920, y: 560, width: 220, height: 240, type: 'bedroom'  },
    { id: 'bath2',      name: '卫生间二',  x: 540, y: 480, width: 120, height: 120, type: 'bathroom' },
    { id: 'balcony',    name: '观景阳台',  x: 60,  y: 800, width: 540, height: 40,  type: 'balcony'  },
    { id: 'balcony2',   name: '主卧阳台',  x: 660, y: 800, width: 480, height: 40,  type: 'balcony'  },
  ],
  walls: [
    // ── 外墙（承重墙）
    { x1: 40,   y1: 40,  x2: 1160, y2: 40,  type: 'bearing' },
    { x1: 1160, y1: 40,  x2: 1160, y2: 840, type: 'bearing' },
    { x1: 1160, y1: 840, x2: 40,   y2: 840, type: 'bearing' },
    { x1: 40,   y1: 840, x2: 40,   y2: 40,  type: 'bearing' },

    // ── 内墙 - 垂直
    { x1: 540, y1: 40,  x2: 540, y2: 380, type: 'partition' }, // 书房/卫生间
    { x1: 660, y1: 40,  x2: 660, y2: 800, type: 'bearing'   }, // 主结构墙（贯通）
    { x1: 920, y1: 360, x2: 920, y2: 800, type: 'partition' }, // 卧室2/卧室4

    // ── 内墙 - 水平
    { x1: 40,  y1: 200, x2: 540, y2: 200, type: 'bearing'   }, // 书房/挑高客厅上
    { x1: 40,  y1: 560, x2: 660, y2: 560, type: 'bearing'   }, // 客厅/餐厅结构分界
    { x1: 540, y1: 380, x2: 660, y2: 380, type: 'partition' }, // 入户/走廊
    { x1: 660, y1: 360, x2: 920, y2: 360, type: 'bearing'   }, // 主卧/卧室2
    { x1: 660, y1: 560, x2: 1160, y2: 560, type: 'bearing'  }, // 东侧卧室区分界
    { x1: 40,  y1: 800, x2: 1160, y2: 800, type: 'window'   }, // 阳台玻璃推拉门
  ],
  doors: [],
  defaultNodes: [
    { x: 290, y: 370 },    // 客厅
    { x: 880, y: 180 },    // 主卧
    { x: 180, y: 630 },    // 餐厅
    { x: 780, y: 470 },    // 卧室二
    { x: 780, y: 660 },    // 卧室三/四
    { x: 460, y: 130 },    // 书房/过道区
  ],
};

export const FLOOR_PLANS: FloorPlan[] = [floorplan1, floorplan2, floorplan3];

export const ROOM_COLORS: Record<Room['type'], string> = {
  living:   'oklch(0.96 0 0)',
  bedroom:  'oklch(0.94 0 0)',
  dining:   'oklch(0.95 0 0)',
  kitchen:  'oklch(0.93 0 0)',
  bathroom: 'oklch(0.91 0 0)',
  study:    'oklch(0.94 0 0)',
  balcony:  'oklch(0.97 0 0)',
  hallway:  'oklch(0.92 0 0)',
  garage:   'oklch(0.90 0 0)',
  storage:  'oklch(0.91 0 0)',
};
