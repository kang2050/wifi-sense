/**
 * useCSIStream — 连接后端 WebSocket，接收真实 CSI 数据流
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL  = (import.meta.env.VITE_WS_URL  as string) ?? 'ws://localhost:8765/ws';
const API_BASE = (import.meta.env.VITE_API_BASE as string) ?? 'http://localhost:8765';

export type ActivityType = 'empty' | 'standing' | 'sitting' | 'walking' | 'falling';

export interface CSIFrame {
  type: 'frame';
  timestamp: number;
  frameIndex: number;
  activity: ActivityType;
  confidence: number;
  probabilities: Record<ActivityType, number>;
  subcarriers: number[];
  rssi: number;
  noiseFloor: number;
}

export interface ActivityEvent {
  id: string;
  timestamp: number;
  activity: ActivityType;
  confidence: number;
  label: string;
}

export interface CSIStreamState {
  isConnected: boolean;
  isRunning: boolean;
  frames: CSIFrame[];
  currentFrame: CSIFrame | null;
  timeline: ActivityEvent[];
  error: string | null;
}

export function useCSIStream() {
  const [state, setState] = useState<CSIStreamState>({
    isConnected: false,
    isRunning: false,
    frames: [],
    currentFrame: null,
    timeline: [],
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const framesRef = useRef<CSIFrame[]>([]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setState(s => ({ ...s, isConnected: true, error: null }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'connected') {
        setState(s => ({ ...s, isRunning: msg.running }));
        return;
      }

      if (msg.type === 'frame') {
        const frame = msg as CSIFrame;
        framesRef.current = [...framesRef.current.slice(-199), frame];
        setState(s => ({
          ...s,
          currentFrame: frame,
          frames: framesRef.current,
        }));
        return;
      }

      if (msg.type === 'event') {
        const event: ActivityEvent = {
          id: msg.id,
          timestamp: msg.timestamp,
          activity: msg.activity,
          confidence: msg.confidence,
          label: msg.label,
        };
        setState(s => ({
          ...s,
          timeline: [event, ...s.timeline].slice(0, 50),
        }));
      }
    };

    ws.onerror = () => {
      setState(s => ({ ...s, error: '无法连接后端服务，请确认已启动 backend/server.py' }));
    };

    ws.onclose = () => {
      setState(s => ({ ...s, isConnected: false }));
      // 3 秒后自动重连
      setTimeout(connect, 3000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const start = useCallback(async () => {
    await fetch(`${API_BASE}/api/start`, { method: 'POST' });
    setState(s => ({ ...s, isRunning: true }));
  }, []);

  const stop = useCallback(async () => {
    await fetch(`${API_BASE}/api/stop`, { method: 'POST' });
    setState(s => ({ ...s, isRunning: false }));
  }, []);

  const reset = useCallback(async () => {
    await fetch(`${API_BASE}/api/reset`, { method: 'POST' });
    framesRef.current = [];
    setState(s => ({
      ...s,
      isRunning: false,
      frames: [],
      currentFrame: null,
      timeline: [],
    }));
  }, []);

  const setActivity = useCallback(async (activity: ActivityType | 'auto') => {
    await fetch(`${API_BASE}/api/activity/${activity}`, { method: 'POST' });
  }, []);

  return { ...state, start, stop, reset, setActivity };
}
