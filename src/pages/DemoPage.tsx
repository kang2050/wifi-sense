/*
 * Demo Page — 真实 CSI 数据流 + AI 活动识别
 * 数据来源：Python 后端 WebSocket (ws://localhost:8765/ws)
 * 模型：Random Forest，基于 NTU-Fi HAR 统计特征训练
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi, WifiOff, Play, Pause, Activity,
  Eye, AlertTriangle, RotateCcw, ServerCrash,
} from 'lucide-react';
import { CSIWaveform } from '../components/CSIWaveform';
import { CSISpectrogram } from '../components/CSISpectrogram';
import { useCSIStream, type ActivityType } from '../hooks/useCSIStream';

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  empty: '无人',
  standing: '站立',
  sitting: '静坐',
  walking: '走动',
  falling: '跌倒',
};

const ACTIVITY_OPTIONS: { value: ActivityType | 'auto'; label: string; desc: string }[] = [
  { value: 'auto', label: '自动模式', desc: '模型自主识别活动状态' },
  { value: 'empty', label: '无人', desc: '环境静态基线' },
  { value: 'standing', label: '站立', desc: '微弱呼吸信号' },
  { value: 'sitting', label: '静坐', desc: '低幅度周期波动' },
  { value: 'walking', label: '走动', desc: '高频大幅度扰动' },
  { value: 'falling', label: '跌倒', desc: '突发剧烈信号变化' },
];

function ActivityIcon({ activity }: { activity: ActivityType }) {
  const props = { className: 'w-5 h-5', strokeWidth: 1.5 as number };
  switch (activity) {
    case 'walking': return <Activity {...props} />;
    case 'falling': return <AlertTriangle {...props} />;
    default: return <Eye {...props} />;
  }
}

export function DemoPage() {
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | 'auto'>('auto');
  const [viewMode, setViewMode] = useState<'waveform' | 'spectrogram'>('waveform');

  const { isConnected, isRunning, frames, currentFrame, timeline, error, start, stop, reset, setActivity } = useCSIStream();

  const handleActivityChange = async (act: ActivityType | 'auto') => {
    setSelectedActivity(act);
    await setActivity(act);
  };

  const handleReset = async () => {
    await reset();
    setSelectedActivity('auto');
  };

  const legacyFrames = frames.map(f => ({
    timestamp: f.timestamp,
    activity: f.activity,
    subcarriers: f.subcarriers,
    rssi: f.rssi,
    noiseFloor: f.noiseFloor,
    confidence: f.confidence,
    frameIndex: f.frameIndex,
  }));

  return (
    <div className="min-h-screen pt-14 bg-background">
      <div className="flex h-[calc(100vh-3.5rem)]">

        {/* ─── Left Panel ─── */}
        <div className="w-72 border-r border-border flex flex-col overflow-y-auto shrink-0">

          {/* Connection Status */}
          <div className="p-4 border-b border-border">
            <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground font-medium mb-3">DEVICE</p>
            <div className="flex items-center gap-2.5">
              <div className={`w-2 h-2 rounded-full transition-all ${isConnected ? 'bg-foreground animate-pulse' : 'bg-muted-foreground/30'}`} />
              <span className="text-[13px]">{isConnected ? 'AI 后端已连接' : '连接后端中...'}</span>
            </div>
            <AnimatePresence>
              {isConnected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 space-y-1.5 overflow-hidden"
                >
                  {[
                    ['数据源', '真实 CSI 统计模型'],
                    ['采样率', '10 Hz'],
                    ['子载波', '64'],
                    ['分类器', 'Random Forest'],
                    ['协议', '802.11n HT20'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-mono text-muted-foreground/80">{v}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            {error && (
              <div className="mt-3 flex items-start gap-2 p-2 border border-border rounded-md">
                <ServerCrash className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.5} />
                <p className="text-[11px] text-muted-foreground leading-relaxed">{error}</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-4 border-b border-border">
            <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground font-medium mb-3">CONTROLS</p>
            <div className="flex gap-2">
              {!isRunning ? (
                <button
                  onClick={start}
                  disabled={!isConnected}
                  className="flex-1 h-9 px-4 text-[13px] font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Play className="w-3.5 h-3.5" />启动
                </button>
              ) : (
                <button
                  onClick={stop}
                  className="flex-1 h-9 px-4 text-[13px] font-medium rounded-lg border border-foreground/15 hover:bg-foreground/[0.03] transition-all duration-200 inline-flex items-center justify-center gap-2"
                >
                  <Pause className="w-3.5 h-3.5" />暂停
                </button>
              )}
              <button
                onClick={handleReset}
                className="h-9 w-9 rounded-lg border border-foreground/15 hover:bg-foreground/[0.03] transition-all duration-200 inline-flex items-center justify-center"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Activity Mode */}
          <div className="p-4 border-b border-border">
            <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground font-medium mb-3">ACTIVITY MODE</p>
            <div className="space-y-0.5">
              {ACTIVITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleActivityChange(opt.value)}
                  className={`w-full text-left px-3 py-2 rounded-md transition-all duration-200 ${
                    selectedActivity === opt.value ? 'bg-foreground text-background' : 'hover:bg-foreground/[0.03] text-foreground'
                  }`}
                >
                  <span className="text-[13px] font-medium block">{opt.label}</span>
                  <span className={`text-[11px] block mt-0.5 ${selectedActivity === opt.value ? 'opacity-60' : 'text-muted-foreground'}`}>
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* View Toggle */}
          <div className="p-4 border-b border-border">
            <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground font-medium mb-3">VISUALIZATION</p>
            <div className="flex gap-1">
              {(['waveform', 'spectrogram'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex-1 h-8 text-[12px] font-medium rounded-md transition-all duration-200 ${
                    viewMode === mode ? 'bg-foreground text-background' : 'border border-foreground/15 hover:bg-foreground/[0.03]'
                  }`}
                >
                  {mode === 'waveform' ? '波形图' : '频谱图'}
                </button>
              ))}
            </div>
          </div>

          {/* AI Detection */}
          <AnimatePresence>
            {currentFrame && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 border-b border-border">
                <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground font-medium mb-3">AI DETECTION</p>
                <div className="p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <ActivityIcon activity={currentFrame.activity} />
                    <div>
                      <p className="text-[17px] font-semibold tracking-[-0.02em]">{ACTIVITY_LABELS[currentFrame.activity]}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{(currentFrame.confidence * 100).toFixed(1)}% confidence</p>
                    </div>
                  </div>
                  {Object.keys(currentFrame.probabilities).length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {(Object.entries(currentFrame.probabilities) as [ActivityType, number][])
                        .sort(([, a], [, b]) => b - a)
                        .map(([act, prob]) => (
                          <div key={act} className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground w-10 shrink-0">{ACTIVITY_LABELS[act]}</span>
                            <div className="flex-1 h-1 bg-foreground/10 rounded-full overflow-hidden">
                              <div className="h-full bg-foreground/60 rounded-full transition-all duration-300" style={{ width: `${prob * 100}%` }} />
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{(prob * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                    </div>
                  )}
                  <div className="mt-3 space-y-1">
                    {[['RSSI', `${currentFrame.rssi.toFixed(1)} dBm`], ['Noise', `${currentFrame.noiseFloor.toFixed(1)} dBm`], ['Frames', `${frames.length}`]].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-mono">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Signal Stats */}
          <AnimatePresence>
            {currentFrame && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
                <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground font-medium mb-3">SIGNAL</p>
                <div className="space-y-1.5">
                  {(() => {
                    const s = currentFrame.subcarriers;
                    const mean = s.reduce((a, b) => a + b, 0) / 64;
                    const std = Math.sqrt(s.reduce((sum, v) => sum + (v - mean) ** 2, 0) / 64);
                    return [['Mean', mean.toFixed(3)], ['Max', Math.max(...s).toFixed(3)], ['Min', Math.min(...s).toFixed(3)], ['Std', std.toFixed(4)]].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-[12px]">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-mono">{v}</span>
                      </div>
                    ));
                  })()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Right Panel ─── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 relative">
            {!isRunning || frames.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'oklch(0.12 0 0)' }}>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center">
                  {isConnected ? (
                    <>
                      <Wifi className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.15)' }} strokeWidth={1} />
                      <p className="text-[15px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>点击左侧「启动」开始 CSI 数据流</p>
                      <p className="text-[13px] mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>真实 CSI 统计模型 · Random Forest AI 识别</p>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-12 h-12 mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.15)' }} strokeWidth={1} />
                      <p className="text-[15px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>正在连接 AI 后端...</p>
                      <p className="text-[13px] mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>请确认已运行 backend/server.py</p>
                    </>
                  )}
                </motion.div>
              </div>
            ) : viewMode === 'waveform' ? (
              <CSIWaveform frames={legacyFrames} />
            ) : (
              <CSISpectrogram frames={legacyFrames} />
            )}
            {isRunning && currentFrame && (
              <div className="absolute top-4 right-4 flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-md" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                  <span className="font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {new Date().toLocaleTimeString()} · {frames.length} frames
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.8)' }} />
                  <span className="font-mono text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>LIVE · AI</span>
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="h-44 border-t border-border overflow-y-auto">
            <div className="p-4">
              <p className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground font-medium mb-3">ACTIVITY TIMELINE</p>
              <div className="space-y-0.5">
                {timeline.slice(0, 20).map(event => (
                  <div key={event.id} className="flex items-center gap-3 px-3 py-1.5 rounded-md hover:bg-foreground/[0.02]">
                    <ActivityIcon activity={event.activity} />
                    <span className="text-[13px] w-14 shrink-0">{event.label}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">{(event.confidence * 100).toFixed(0)}%</span>
                    <span className="text-[11px] text-muted-foreground/60 font-mono ml-auto">{new Date(event.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
                {timeline.length === 0 && (
                  <p className="text-[13px] text-muted-foreground/40 text-center py-4">启动后将显示 AI 识别的活动记录</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
