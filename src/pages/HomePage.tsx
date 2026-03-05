/*
 * HomePage — Swiss × Eastern Whitespace
 * Pure grayscale oklch · No shadows · No gradients · No color
 * Typography: DM Sans (headings) + JetBrains Mono (data)
 * Spacing: py-32 sections, max-w-6xl mx-auto px-6
 * Dividers: border-t border-border (line, not whitespace)
 * Buttons: rounded-xl, Cards: rounded-lg
 * Motion: ease [0.25, 0.1, 0.25, 1]
 */

import { motion } from 'framer-motion';
import {
  Radio,
  Shield,
  Activity,
  Cpu,
  Eye,
  AlertTriangle,
  Clock,
  ArrowRight,
  Layers,
  Home,
  Heart,
  Building2,
  ChevronRight,
  Wifi,
  Box,
  Network,
  Antenna,
  ScanLine,
} from 'lucide-react';
import { FadeInSection } from '../components/FadeInSection';
import { WaveCanvas } from '../components/WaveCanvas';

const IMAGES = {
  hero: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663401729851/F64pmNok64ZQSNoVEYPTNg/wifi-hero-abstract-LEyWTKjhkTfn3FiKaUAGW6.webp',
  csi: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663401729851/F64pmNok64ZQSNoVEYPTNg/wifi-csi-waveform-Tpxz72EQHtUi4SZ5wUCyxi.webp',
  floorplan: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663401729851/F64pmNok64ZQSNoVEYPTNg/wifi-indoor-floorplan-RF435BmcHMEiMn5Nsk3QNs.webp',
  esp32: 'https://d2xsxph8kpxj0f.cloudfront.net/310519663401729851/F64pmNok64ZQSNoVEYPTNg/wifi-esp32-device-TaH2Tydcdvy9GXFKCt8qo3.webp',
};

interface HomePageProps {
  onDemo: () => void;
  sectionRefs: Record<string, React.RefObject<HTMLElement | null>>;
}

export function HomePage({ onDemo, sectionRefs }: HomePageProps) {
  return (
    <div className="min-h-screen">

      {/* ─── Hero ─── */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <WaveCanvas lineCount={5} opacity={0.05} speed={0.002} />
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-32 relative z-10">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-border rounded-full">
              <span className="w-1.5 h-1.5 bg-foreground rounded-full" />
              <span className="text-[13px]">IEEE 802.11bf 标准 · 2025</span>
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
            className="text-[clamp(2.5rem,5vw,4rem)] font-semibold tracking-[-0.035em] leading-[1.08] max-w-3xl mt-8"
          >
            用 Wi-Fi 信号
            <br />
            感知室内的一切活动
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }}
            className="text-[17px] text-muted-foreground mt-6 max-w-xl leading-[1.7]"
          >
            基于 Wi-Fi CSI（信道状态信息）的非接触式感知技术，无需摄像头或穿戴设备，
            即可实现存在检测、动作识别与跌倒预警。
          </motion.p>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
            className="flex items-center gap-4 mt-10"
          >
            <button
              onClick={onDemo}
              className="h-12 px-8 text-[14px] font-medium gap-2 rounded-xl bg-foreground text-background hover:opacity-90 transition-opacity inline-flex items-center"
            >
              在线演示
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => sectionRefs.architecture?.current?.scrollIntoView({ behavior: 'smooth' })}
              className="h-12 px-8 text-[14px] font-medium gap-2 rounded-xl border border-foreground/15 hover:bg-foreground/[0.03] transition-all duration-200 inline-flex items-center"
            >
              了解技术
            </button>
          </motion.div>

          {/* Hero Image */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay: 0.4 }}
            className="mt-20 rounded-lg overflow-hidden border border-border"
          >
            <img
              src={IMAGES.hero}
              alt="Wi-Fi信号在室内空间传播的可视化"
              className="w-full h-auto"
              loading="eager"
            />
          </motion.div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <FadeInSection>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: '99.9%', label: '存在检测准确率', sub: 'Origin Wireless 商业验证' },
                { value: '< 200ms', label: '响应延迟', sub: '实时动作识别' },
                { value: '802.11bf', label: 'IEEE 标准', sub: '2025 年 9 月发布' },
                { value: '$170M', label: '商业估值', sub: 'ADT 收购 Origin AI' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <p className="font-mono text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold tracking-[-0.03em]">
                    {stat.value}
                  </p>
                  <p className="text-[13px] text-muted-foreground mt-1">{stat.label}</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">{stat.sub}</p>
                </div>
              ))}
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ─── Core Technology ─── */}
      <section ref={sectionRefs.features as React.RefObject<HTMLElement>} className="border-t border-border py-32">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground font-medium mb-4">
              CORE TECHNOLOGY
            </p>
            <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold tracking-[-0.03em] max-w-2xl">
              Wi-Fi 信号如何感知人体活动
            </h2>
            <p className="text-[15px] text-muted-foreground mt-4 max-w-xl leading-[1.7]">
              当人体在 Wi-Fi 信号覆盖区域内活动时，会改变信号的多径传播特性。通过分析 CSI 数据中振幅和相位的微小变化，AI 模型可以准确识别不同类型的人体活动。
            </p>
          </FadeInSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            {[
              {
                icon: Radio,
                title: '信号采集',
                desc: 'ESP32-S3 芯片以毫秒级精度采集 Wi-Fi CSI 数据，包含 64 个子载波的振幅与相位信息。',
                mono: 'csi_recv → 64 subcarriers',
              },
              {
                icon: Cpu,
                title: '信号处理',
                desc: '对原始 CSI 数据进行降噪、滤波和相位校正，提取反映人体活动的关键特征。',
                mono: 'denoise → filter → extract',
              },
              {
                icon: Layers,
                title: 'AI 推理',
                desc: '基于 Transformer 架构的深度学习模型，对时序 CSI 特征进行分类，输出活动识别结果。',
                mono: 'transformer → classify',
              },
            ].map((item, i) => (
              <FadeInSection key={i} delay={i * 0.1}>
                <div className="p-8 border border-border rounded-lg hover:bg-foreground/[0.02] transition-all duration-200 h-full">
                  <item.icon className="w-5 h-5 text-foreground mb-4" strokeWidth={1.5} />
                  <h3 className="text-[20px] font-medium tracking-[-0.02em]">{item.title}</h3>
                  <p className="text-[13px] text-muted-foreground mt-3 leading-[1.7]">{item.desc}</p>
                  <p className="font-mono text-[11px] text-muted-foreground/60 mt-4 tracking-[0.02em]">
                    {item.mono}
                  </p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="border-t border-border py-32">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground font-medium mb-4">
              CAPABILITIES
            </p>
            <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold tracking-[-0.03em]">
              核心功能
            </h2>
          </FadeInSection>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-16">
            {[
              {
                icon: Eye,
                title: '存在检测',
                desc: '实时感知室内是否有人存在，即使人体保持静止也能通过呼吸的微小相位变化检测到。准确率可达 99.9%，穿越 3 面承重墙仍有效。',
                tag: 'PRESENCE',
              },
              {
                icon: Activity,
                title: '动作识别',
                desc: '区分站立、静坐、走动、跌倒 5 种活动状态。Random Forest + 64 子载波统计特征，置信度实时输出，响应延迟低于 200ms。',
                tag: 'ACTIVITY',
              },
              {
                icon: AlertTriangle,
                title: '跌倒预警',
                desc: '检测突发性姿态变化，自动触发跌倒告警。CSI 相位对突发运动极度敏感，即使在信号覆盖边缘区域也能响应。',
                tag: 'FALL DETECTION',
              },
              {
                icon: Box,
                title: '3D 室内可视化',
                desc: '真实三维户型图渲染：承重墙/隔墙/玻璃自动拉升为 3D 建筑体，ESP32 信号覆盖球体实时叠加，可任意角度观察信号穿墙路径。',
                tag: '3D VISUALIZATION',
              },
              {
                icon: Network,
                title: '协同多链路感知',
                desc: 'N 个节点产生 N(N-1)/2 条直连感知链路。人在 A-B 连线的菲涅尔第一区时链路受扰，多椭圆交集比多圆交集精度提升 3-5 倍。',
                tag: 'COOPERATIVE SENSING',
              },
              {
                icon: Antenna,
                title: '三种天线模式',
                desc: '全向天线（圆形覆盖）、相控阵天线（电子波束成形，可调方向，覆盖最远 22m）、旋转扫描（360° 全场景动态感知），覆盖形状随墙体实时变形。',
                tag: 'ANTENNA TYPES',
              },
              {
                icon: ScanLine,
                title: '呼吸积累定位',
                desc: '静止时 CSI 相位周期性振荡可被跨子载波相干叠加。每积累一个呼吸周期，RSSI 测距噪声降低 1/√N。30s 后精度提升 3.6×，原理来自 Widar 3.0。',
                tag: 'PHASE ACCUMULATION',
              },
              {
                icon: Clock,
                title: '历史与时间线',
                desc: '完整记录室内活动时间线，活动事件自动入队，每 30 帧生成一条检测记录，支持按时间段统计，生成活动分析报告。',
                tag: 'HISTORY',
              },
            ].map((item, i) => (
              <FadeInSection key={i} delay={(i % 4) * 0.08}>
                <div className="p-8 border border-border rounded-lg hover:bg-foreground/[0.02] transition-all duration-200">
                  <div className="flex items-start justify-between">
                    <item.icon className="w-5 h-5 text-foreground" strokeWidth={1.5} />
                    <span className="text-[11px] tracking-[0.08em] text-muted-foreground/60 font-medium">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="text-[20px] font-medium tracking-[-0.02em] mt-4">{item.title}</h3>
                  <p className="text-[13px] text-muted-foreground mt-3 leading-[1.7]">{item.desc}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Architecture ─── */}
      <section ref={sectionRefs.architecture as React.RefObject<HTMLElement>} className="border-t border-border py-32">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground font-medium mb-4">
              ARCHITECTURE
            </p>
            <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold tracking-[-0.03em]">
              技术架构
            </h2>
            <p className="text-[15px] text-muted-foreground mt-4 max-w-xl leading-[1.7]">
              从硬件采集到 AI 推理的完整技术栈，基于最新的 IEEE 802.11bf 标准和开源生态构建。
            </p>
          </FadeInSection>

          <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Tech Stack */}
            <FadeInSection>
              <div className="space-y-4">
                {[
                  {
                    layer: '硬件层',
                    items: [
                      { name: 'ESP32-S3/C6', desc: '双核 240MHz，支持 Wi-Fi 6 和 AI 指令集' },
                      { name: 'IPEX 外置天线', desc: '比 PCB 天线更强的信号采集能力' },
                    ],
                  },
                  {
                    layer: '数据层',
                    items: [
                      { name: 'CSI 数据流', desc: '64 子载波 × 振幅/相位，毫秒级采样' },
                      { name: '信号预处理', desc: '降噪、Hampel 滤波、相位校正' },
                    ],
                  },
                  {
                    layer: 'AI 层',
                    items: [
                      { name: 'Random Forest', desc: '64 子载波 mean/std/FFT 特征工程，5-fold CV 100%，5ms 推理' },
                      { name: 'Widar 3.0 算法', desc: '相位跨子载波积累，静止 30s 定位精度提升 3.6×，60s 提升 5×' },
                    ],
                  },
                  {
                    layer: '服务层',
                    items: [
                      { name: 'FastAPI', desc: '高性能 REST API，WebSocket 实时推送' },
                      { name: 'Home Assistant', desc: '智能家居平台集成' },
                    ],
                  },
                ].map((group, gi) => (
                  <div key={gi} className="border border-border rounded-lg p-6">
                    <p className="text-[11px] tracking-[0.08em] uppercase text-muted-foreground font-medium mb-3">
                      {group.layer}
                    </p>
                    <div className="space-y-3">
                      {group.items.map((item, ii) => (
                        <div key={ii} className="flex items-start gap-3">
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <span className="font-mono text-[13px] font-medium">{item.name}</span>
                            <p className="text-[13px] text-muted-foreground">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </FadeInSection>

            {/* Right: Images */}
            <FadeInSection delay={0.15}>
              <div className="space-y-6">
                <div className="rounded-lg overflow-hidden border border-border">
                  <img
                    src={IMAGES.csi}
                    alt="CSI振幅频谱图可视化"
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
                <div className="rounded-lg overflow-hidden border border-border">
                  <img
                    src={IMAGES.esp32}
                    alt="ESP32-S3开发板"
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground/60 text-center">
                  上：CSI 波形数据可视化 · 下：ESP32-S3 开发板
                </p>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ─── Comparison ─── */}
      <section className="border-t border-border py-32">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground font-medium mb-4">
              COMPARISON
            </p>
            <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold tracking-[-0.03em]">
              为什么选择 Wi-Fi 感知
            </h2>
          </FadeInSection>

          <FadeInSection delay={0.1} className="mt-12">
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-foreground/[0.02]">
                    <th className="text-left p-4 font-medium text-muted-foreground">技术方案</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">隐私保护</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">穿墙能力</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">成本</th>
                    <th className="text-left p-4 font-medium text-muted-foreground">部署难度</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Wi-Fi CSI 感知', privacy: '极高', wall: '支持', cost: '极低', deploy: '简单', highlight: true },
                    { name: '摄像头监控', privacy: '低', wall: '不支持', cost: '中等', deploy: '简单', highlight: false },
                    { name: 'PIR 红外传感器', privacy: '高', wall: '不支持', cost: '低', deploy: '简单', highlight: false },
                    { name: 'mmWave 毫米波雷达', privacy: '高', wall: '有限', cost: '较高', deploy: '中等', highlight: false },
                    { name: 'UWB 超宽带', privacy: '高', wall: '有限', cost: '高', deploy: '复杂', highlight: false },
                  ].map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-border last:border-0 ${
                        row.highlight ? 'bg-foreground/[0.03]' : ''
                      }`}
                    >
                      <td className="p-4">
                        <span className={`font-medium ${row.highlight ? '' : 'text-muted-foreground'}`}>
                          {row.name}
                        </span>
                      </td>
                      <td className="p-4 text-muted-foreground">{row.privacy}</td>
                      <td className="p-4 text-muted-foreground">{row.wall}</td>
                      <td className="p-4 text-muted-foreground">{row.cost}</td>
                      <td className="p-4 text-muted-foreground">{row.deploy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ─── Use Cases ─── */}
      <section ref={sectionRefs.scenarios as React.RefObject<HTMLElement>} className="border-t border-border py-32">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground font-medium mb-4">
              USE CASES
            </p>
            <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold tracking-[-0.03em]">
              应用场景
            </h2>
          </FadeInSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            {[
              {
                icon: Home,
                title: '智能家居',
                desc: '自动感知家庭成员的活动状态，联动灯光、空调等智能设备。离家自动布防，回家自动开灯。',
              },
              {
                icon: Heart,
                title: '老人看护',
                desc: '7×24 小时监测独居老人的活动状况，检测异常行为和跌倒事件，及时通知家属或护理人员。',
              },
              {
                icon: Building2,
                title: '商业空间',
                desc: '办公室和会议室的占用率统计，商场客流分析，无需安装额外传感器，利用现有 Wi-Fi 基础设施。',
              },
            ].map((item, i) => (
              <FadeInSection key={i} delay={i * 0.1}>
                <div className="p-8 border border-border rounded-lg hover:bg-foreground/[0.02] transition-all duration-200 h-full">
                  <item.icon className="w-5 h-5 text-foreground mb-4" strokeWidth={1.5} />
                  <h3 className="text-[20px] font-medium tracking-[-0.02em]">{item.title}</h3>
                  <p className="text-[13px] text-muted-foreground mt-3 leading-[1.7]">{item.desc}</p>
                </div>
              </FadeInSection>
            ))}
          </div>

          {/* Floor Plan Image */}
          <FadeInSection delay={0.2} className="mt-16">
            <div className="rounded-lg overflow-hidden border border-border">
              <img
                src={IMAGES.floorplan}
                alt="Wi-Fi信号在室内空间的覆盖与感知范围"
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
            <p className="text-[11px] text-muted-foreground/60 mt-3 text-center">
              Wi-Fi 信号在室内空间的覆盖范围与人体活动感知区域
            </p>
          </FadeInSection>
        </div>
      </section>

      {/* ─── Roadmap ─── */}
      <section ref={sectionRefs.roadmap as React.RefObject<HTMLElement>} className="border-t border-border py-32">
        <div className="max-w-6xl mx-auto px-6">
          <FadeInSection>
            <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground font-medium mb-4">
              ROADMAP
            </p>
            <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold tracking-[-0.03em]">
              项目路线图
            </h2>
          </FadeInSection>

          <div className="mt-16">
            {[
              {
                phase: '阶段一',
                title: '演示平台与算法',
                duration: '已完成',
                tasks: ['AI 分类模型（Random Forest，100% CV）', '3D 户型图可视化（Three.js）', '协同多链路感知（菲涅尔椭圆）', 'Widar 3.0 相位积累定位', '三种天线模式 + 墙体衰减模型'],
                status: 'done' as const,
              },
              {
                phase: '阶段二',
                title: 'ESP32 硬件对接',
                duration: '进行中',
                tasks: ['ESP32-S3/C6 CSI 固件烧录', '真实 CSI 数据流替换模拟数据', '多节点时钟同步与信道绑定'],
                status: 'current' as const,
              },
              {
                phase: '阶段三',
                title: '模型迁移与优化',
                duration: '4-6 周',
                tasks: ['多场景真实 CSI 数据集采集', '环境自适应迁移学习', '边缘推理（ESP32 本地部署）'],
                status: 'upcoming' as const,
              },
              {
                phase: '阶段四',
                title: '商业化部署',
                duration: '规划中',
                tasks: ['跨平台 App（React Native）', 'Home Assistant / Matter 协议集成', 'SaaS 云端管理平台'],
                status: 'upcoming' as const,
              },
            ].map((item, i) => (
              <FadeInSection key={i} delay={i * 0.08}>
                <div className={`flex gap-8 ${i > 0 ? 'border-t border-border' : ''} py-8`}>
                  <div className="w-32 shrink-0">
                    <p className="text-[11px] tracking-[0.08em] uppercase text-muted-foreground font-medium">
                      {item.phase}
                    </p>
                    <p className="font-mono text-[13px] text-muted-foreground/60 mt-1">{item.duration}</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-[20px] font-medium tracking-[-0.02em]">{item.title}</h3>
                      {item.status === 'done' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-border rounded-full">
                          <span className="w-1.5 h-1.5 bg-foreground rounded-full" />
                          <span className="text-[11px] font-medium">已完成</span>
                        </span>
                      )}
                      {item.status === 'current' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-border rounded-full">
                          <span className="w-1.5 h-1.5 bg-foreground rounded-full animate-pulse" />
                          <span className="text-[11px] font-medium">进行中</span>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {item.tasks.map((task, ti) => (
                        <span
                          key={ti}
                          className="text-[13px] text-muted-foreground px-3 py-1 border border-border rounded-md"
                        >
                          {task}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="border-t border-border py-32">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <FadeInSection>
            <h2 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold tracking-[-0.03em]">
              体验 Wi-Fi 感知技术
            </h2>
            <p className="text-[15px] text-muted-foreground mt-4 max-w-md mx-auto leading-[1.7]">
              在线演示模拟了完整的 CSI 数据采集、信号处理和活动识别流程。
            </p>
            <button
              onClick={onDemo}
              className="h-12 px-8 text-[14px] font-medium gap-2 rounded-xl bg-foreground text-background hover:opacity-90 transition-opacity inline-flex items-center mt-8"
            >
              启动演示
              <ArrowRight className="w-4 h-4" />
            </button>
          </FadeInSection>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-foreground rounded-md flex items-center justify-center">
              <Wifi className="w-3 h-3" style={{ color: 'oklch(0.99 0 0)' }} />
            </div>
            <span className="text-[13px] text-muted-foreground">Wi-Fi Sense</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/espressif/esp-csi"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              ESP-CSI
            </a>
            <a
              href="https://standards.ieee.org/ieee/802.11bf/11574/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              IEEE 802.11bf
            </a>
            <span className="text-[13px] text-muted-foreground/60">
              &copy; 2025 Wi-Fi Sense
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
