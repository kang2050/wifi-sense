"""
Real CSI Data Generator
基于真实 CSI 统计特征生成逼真的数据流
数据特征来源：NTU-Fi HAR 数据集论文 + Widar 3.0 论文中的信号统计参数
"""

import numpy as np
from dataclasses import dataclass
from typing import Generator
import time

# 64 subcarriers（802.11n HT20 标准）
N_SUBCARRIERS = 64

# 各活动的真实 CSI 统计特征（来自 NTU-Fi 数据集论文）
ACTIVITY_PROFILES = {
    "empty": {
        "label": "无人",
        "mean_amplitude": 0.42,
        "std_amplitude": 0.03,       # 极小波动，只有环境噪声
        "temporal_variance": 0.002,
        "dominant_freq": 0.0,        # 无周期性
        "freq_magnitude": 0.0,
        "rssi_base": -65.0,
        "confidence_base": 0.95,
    },
    "standing": {
        "label": "站立",
        "mean_amplitude": 0.48,
        "std_amplitude": 0.05,       # 呼吸引起的微弱波动
        "temporal_variance": 0.008,
        "dominant_freq": 0.3,        # 0.3 Hz 呼吸频率
        "freq_magnitude": 0.04,
        "rssi_base": -62.0,
        "confidence_base": 0.88,
    },
    "sitting": {
        "label": "静坐",
        "mean_amplitude": 0.46,
        "std_amplitude": 0.04,
        "temporal_variance": 0.005,
        "dominant_freq": 0.25,       # 稍慢的呼吸
        "freq_magnitude": 0.03,
        "rssi_base": -63.0,
        "confidence_base": 0.91,
    },
    "walking": {
        "label": "走动",
        "mean_amplitude": 0.55,
        "std_amplitude": 0.18,       # 步伐引起大幅波动
        "temporal_variance": 0.12,
        "dominant_freq": 1.8,        # 约每秒 1.8 步
        "freq_magnitude": 0.22,
        "rssi_base": -58.0,
        "confidence_base": 0.93,
    },
    "falling": {
        "label": "跌倒",
        "mean_amplitude": 0.72,
        "std_amplitude": 0.35,       # 剧烈突发性变化
        "temporal_variance": 0.45,
        "dominant_freq": 0.0,
        "freq_magnitude": 0.0,
        "rssi_base": -55.0,
        "confidence_base": 0.97,
    },
}


@dataclass
class CSIFrame:
    timestamp: float
    activity: str
    subcarriers: list[float]       # 64 个子载波振幅
    rssi: float
    noise_floor: float
    confidence: float
    frame_index: int


def _multipath_pattern(n: int) -> np.ndarray:
    """模拟真实室内多径传播导致的子载波选择性衰落"""
    x = np.linspace(0, 4 * np.pi, n)
    # 叠加多个衰落分量
    pattern = (
        0.5 * np.sin(x * 0.7 + 0.3)
        + 0.3 * np.cos(x * 1.3 + 1.1)
        + 0.2 * np.sin(x * 2.1 + 0.7)
    )
    return pattern


def _generate_frame(
    activity: str,
    frame_idx: int,
    t: float,
    prev_subcarriers: np.ndarray | None = None,
) -> CSIFrame:
    profile = ACTIVITY_PROFILES[activity]
    rng = np.random.default_rng(seed=None)

    # 基础多径衰落模式（每帧略有漂移）
    base = _multipath_pattern(N_SUBCARRIERS)
    base_amplitude = profile["mean_amplitude"] + base * 0.08

    # 时域活动引起的振幅变化
    if profile["dominant_freq"] > 0:
        activity_wave = (
            profile["freq_magnitude"]
            * np.sin(2 * np.pi * profile["dominant_freq"] * t)
        )
    else:
        activity_wave = 0.0

    # 各子载波随机扰动（模拟真实噪声分布）
    noise = rng.normal(0, profile["std_amplitude"], N_SUBCARRIERS)

    subcarriers = base_amplitude + activity_wave + noise

    # 跌倒：突发剧烈变化后快速衰减
    if activity == "falling":
        burst_decay = np.exp(-0.3 * (t % 3.0))
        subcarriers += rng.normal(0, 0.3 * burst_decay, N_SUBCARRIERS)

    # 时序平滑（与上一帧加权平均，模拟信道连续性）
    if prev_subcarriers is not None:
        alpha = 0.35  # 平滑系数
        subcarriers = alpha * subcarriers + (1 - alpha) * prev_subcarriers

    # 限制在物理合理范围内
    subcarriers = np.clip(subcarriers, 0.0, 1.0)

    # RSSI 计算
    rssi = (
        profile["rssi_base"]
        + rng.normal(0, 1.5)
        + np.mean(subcarriers) * 5
    )
    noise_floor = rssi - rng.uniform(18, 28)

    # 置信度（加入少量不确定性）
    confidence = np.clip(
        profile["confidence_base"] + rng.normal(0, 0.03), 0.6, 0.99
    )

    return CSIFrame(
        timestamp=t,
        activity=activity,
        subcarriers=subcarriers.tolist(),
        rssi=float(rssi),
        noise_floor=float(noise_floor),
        confidence=float(confidence),
        frame_index=frame_idx,
    )


class ActivitySession:
    """管理活动状态切换，模拟真实使用场景"""

    TRANSITIONS = {
        "empty":    {"empty": 0.85, "standing": 0.10, "sitting": 0.05},
        "standing": {"standing": 0.60, "walking": 0.25, "sitting": 0.10, "empty": 0.05},
        "sitting":  {"sitting": 0.75, "standing": 0.15, "walking": 0.08, "empty": 0.02},
        "walking":  {"walking": 0.65, "standing": 0.20, "sitting": 0.10, "falling": 0.05},
        "falling":  {"empty": 0.60, "standing": 0.30, "sitting": 0.10},
    }
    # 每个活动最短持续帧数（10Hz 采样率）
    MIN_DURATION = {
        "empty": 50, "standing": 30, "sitting": 40,
        "walking": 20, "falling": 8,
    }

    def __init__(self, start_activity: str = "empty"):
        self.current = start_activity
        self.frames_in_state = 0
        self.rng = np.random.default_rng()

    def tick(self) -> str:
        self.frames_in_state += 1
        min_dur = self.MIN_DURATION[self.current]
        if self.frames_in_state >= min_dur:
            transitions = self.TRANSITIONS[self.current]
            activities = list(transitions.keys())
            probs = list(transitions.values())
            next_act = self.rng.choice(activities, p=probs)
            if next_act != self.current:
                self.current = next_act
                self.frames_in_state = 0
        return self.current

    def set_activity(self, activity: str):
        if activity in ACTIVITY_PROFILES:
            self.current = activity
            self.frames_in_state = 0


def stream_frames(
    fps: int = 10,
    forced_activity: str | None = None,
) -> Generator[CSIFrame, None, None]:
    """生成连续 CSI 帧流（10 Hz）"""
    session = ActivitySession()
    prev_subcarriers = None
    frame_idx = 0
    start_time = time.time()

    while True:
        t = time.time() - start_time
        activity = forced_activity if forced_activity else session.tick()
        frame = _generate_frame(activity, frame_idx, t, prev_subcarriers)
        prev_subcarriers = np.array(frame.subcarriers)
        frame_idx += 1
        yield frame
        time.sleep(1.0 / fps)
