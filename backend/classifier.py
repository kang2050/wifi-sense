"""
CSI Activity Classifier
基于滑动窗口特征提取 + Random Forest 分类器
特征工程方法来自 SenseFi 论文（Cell Press 2023）
"""

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import pickle
import os

ACTIVITIES = ["empty", "standing", "sitting", "walking", "falling"]
WINDOW_SIZE = 30      # 30 帧 = 3 秒（10 Hz）
N_SUBCARRIERS = 64
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")


def extract_features(window: list[list[float]]) -> np.ndarray:
    """
    从 CSI 窗口中提取特征向量
    特征维度：每个子载波的 mean/std + 全局统计量 + 频域特征
    """
    arr = np.array(window)  # (T, 64)

    # 每个子载波的时域统计
    mean_per_sub = arr.mean(axis=0)        # (64,)
    std_per_sub = arr.std(axis=0)          # (64,)
    max_per_sub = arr.max(axis=0)          # (64,)
    min_per_sub = arr.min(axis=0)          # (64,)

    # 全局统计
    global_mean = arr.mean()
    global_std = arr.std()
    global_range = arr.max() - arr.min()

    # 时序差分（捕捉运动变化速率）
    diff = np.diff(arr, axis=0)            # (T-1, 64)
    diff_mean = diff.mean(axis=0)          # (64,)
    diff_std = diff.std(axis=0)            # (64,)

    # 频域：对平均振幅时序做 FFT，取前 10 个幅度
    mean_ts = arr.mean(axis=1)             # (T,)
    fft_mag = np.abs(np.fft.rfft(mean_ts))[:10]

    features = np.concatenate([
        mean_per_sub, std_per_sub, max_per_sub, min_per_sub,
        [global_mean, global_std, global_range],
        diff_mean, diff_std,
        fft_mag,
    ])
    return features


def _generate_training_data(n_samples_per_class: int = 400):
    """
    用统计特征生成训练数据
    参数基于真实 CSI 数据集的发布统计值
    """
    from data_generator import _generate_frame, ACTIVITY_PROFILES
    import time

    X, y = [], []
    rng = np.random.default_rng(42)

    for act_idx, activity in enumerate(ACTIVITIES):
        for _ in range(n_samples_per_class):
            # 生成一个随机时间点的窗口
            t_start = rng.uniform(0, 100)
            window = []
            prev = None
            for i in range(WINDOW_SIZE):
                t = t_start + i * 0.1
                frame = _generate_frame(activity, i, t, prev)
                prev = np.array(frame.subcarriers)
                window.append(frame.subcarriers)
            features = extract_features(window)
            X.append(features)
            y.append(act_idx)

    return np.array(X), np.array(y)


def train_and_save():
    """训练分类器并保存"""
    print("生成训练数据...")
    X, y = _generate_training_data(n_samples_per_class=500)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    print("训练 Random Forest 分类器...")
    clf = RandomForestClassifier(
        n_estimators=200,
        max_depth=15,
        min_samples_split=4,
        random_state=42,
        n_jobs=-1,
    )
    clf.fit(X_scaled, y)

    # 简单评估
    from sklearn.model_selection import cross_val_score
    scores = cross_val_score(clf, X_scaled, y, cv=5, scoring="accuracy")
    print(f"5-fold CV 准确率: {scores.mean():.3f} ± {scores.std():.3f}")

    with open(MODEL_PATH, "wb") as f:
        pickle.dump({"clf": clf, "scaler": scaler}, f)
    print(f"模型已保存到 {MODEL_PATH}")
    return clf, scaler


def load_model():
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            data = pickle.load(f)
        return data["clf"], data["scaler"]
    print("模型文件不存在，开始训练...")
    return train_and_save()


class RealtimeClassifier:
    """实时分类器，维护滑动窗口"""

    def __init__(self):
        self.clf, self.scaler = load_model()
        self.window: list[list[float]] = []

    def push_frame(self, subcarriers: list[float]) -> dict | None:
        self.window.append(subcarriers)
        if len(self.window) > WINDOW_SIZE:
            self.window.pop(0)
        if len(self.window) < WINDOW_SIZE:
            return None   # 窗口未满

        features = extract_features(self.window)
        features_scaled = self.scaler.transform([features])
        probs = self.clf.predict_proba(features_scaled)[0]
        pred_idx = int(np.argmax(probs))
        return {
            "activity": ACTIVITIES[pred_idx],
            "confidence": float(probs[pred_idx]),
            "probabilities": {act: float(p) for act, p in zip(ACTIVITIES, probs)},
        }
