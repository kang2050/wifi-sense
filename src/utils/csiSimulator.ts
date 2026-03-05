/**
 * CSI Data Simulator
 * Generates realistic Wi-Fi CSI (Channel State Information) data
 * simulating different human activities.
 */

export type ActivityType = 'empty' | 'standing' | 'walking' | 'sitting' | 'falling';

export interface CSIFrame {
  timestamp: number;
  subcarriers: number[];  // 64 subcarrier amplitudes
  rssi: number;
  noiseFloor: number;
  activity: ActivityType;
  confidence: number;
}

export interface ActivityEvent {
  id: string;
  timestamp: number;
  activity: ActivityType;
  confidence: number;
  duration: number;
}

const SUBCARRIER_COUNT = 64;

// Base amplitude patterns for different activities
const ACTIVITY_PATTERNS: Record<ActivityType, {
  baseAmplitude: number;
  variance: number;
  frequency: number;
  noiseLevel: number;
  rssiRange: [number, number];
}> = {
  empty: {
    baseAmplitude: 0.3,
    variance: 0.02,
    frequency: 0.1,
    noiseLevel: 0.01,
    rssiRange: [-45, -40],
  },
  standing: {
    baseAmplitude: 0.5,
    variance: 0.05,
    frequency: 0.3,
    noiseLevel: 0.03,
    rssiRange: [-50, -45],
  },
  sitting: {
    baseAmplitude: 0.45,
    variance: 0.04,
    frequency: 0.2,
    noiseLevel: 0.02,
    rssiRange: [-48, -43],
  },
  walking: {
    baseAmplitude: 0.7,
    variance: 0.15,
    frequency: 1.2,
    noiseLevel: 0.08,
    rssiRange: [-60, -48],
  },
  falling: {
    baseAmplitude: 0.9,
    variance: 0.3,
    frequency: 3.0,
    noiseLevel: 0.15,
    rssiRange: [-70, -55],
  },
};

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  empty: '无人',
  standing: '站立',
  sitting: '静坐',
  walking: '走动',
  falling: '跌倒',
};

export function getActivityLabel(activity: ActivityType): string {
  return ACTIVITY_LABELS[activity];
}

let globalTime = 0;

export function generateCSIFrame(activity: ActivityType, time?: number): CSIFrame {
  const t = time ?? globalTime++;
  const pattern = ACTIVITY_PATTERNS[activity];
  
  const subcarriers: number[] = [];
  for (let i = 0; i < SUBCARRIER_COUNT; i++) {
    const baseFreq = (i / SUBCARRIER_COUNT) * Math.PI * 2;
    const base = pattern.baseAmplitude + 
      Math.sin(baseFreq + t * pattern.frequency * 0.1) * pattern.variance;
    
    // Add activity-specific modulation
    const activityMod = Math.sin(t * pattern.frequency + i * 0.1) * pattern.variance * 2;
    
    // Add noise
    const noise = (Math.random() - 0.5) * pattern.noiseLevel * 2;
    
    // Add inter-subcarrier correlation
    const correlation = i > 0 ? subcarriers[i - 1] * 0.3 : 0;
    
    const amplitude = Math.max(0, Math.min(1, base + activityMod + noise + correlation * 0.1));
    subcarriers.push(amplitude);
  }

  const rssi = pattern.rssiRange[0] + 
    Math.random() * (pattern.rssiRange[1] - pattern.rssiRange[0]);
  
  const noiseFloor = -90 + Math.random() * 5;

  // Confidence based on signal clarity
  const signalVariance = subcarriers.reduce((sum, v, i) => {
    if (i === 0) return 0;
    return sum + Math.abs(v - subcarriers[i - 1]);
  }, 0) / SUBCARRIER_COUNT;
  
  const confidence = activity === 'empty' 
    ? 0.95 + Math.random() * 0.05
    : Math.min(0.99, 0.7 + signalVariance * 2 + Math.random() * 0.1);

  return {
    timestamp: Date.now(),
    subcarriers,
    rssi,
    noiseFloor,
    activity,
    confidence,
  };
}

// Generate a sequence of activity events for demo timeline
export function generateActivityTimeline(count: number = 20): ActivityEvent[] {
  const activities: ActivityType[] = ['empty', 'standing', 'walking', 'sitting', 'falling'];
  const events: ActivityEvent[] = [];
  let time = Date.now() - count * 60000;

  for (let i = 0; i < count; i++) {
    const activity = activities[Math.floor(Math.random() * activities.length)];
    const duration = 30 + Math.floor(Math.random() * 300);
    const confidence = 0.75 + Math.random() * 0.24;

    events.push({
      id: `evt-${i}`,
      timestamp: time,
      activity,
      confidence,
      duration,
    });

    time += duration * 1000 + Math.random() * 30000;
  }

  return events;
}

// Simulate realistic activity transitions
export class ActivitySimulator {
  private currentActivity: ActivityType = 'empty';
  private transitionTimer = 0;
  private transitionDuration = 0;

  private readonly TRANSITION_PROBS: Record<ActivityType, Partial<Record<ActivityType, number>>> = {
    empty: { standing: 0.3, walking: 0.1 },
    standing: { walking: 0.3, sitting: 0.2, empty: 0.1 },
    walking: { standing: 0.3, sitting: 0.1, falling: 0.02 },
    sitting: { standing: 0.2, empty: 0.1 },
    falling: { sitting: 0.4, empty: 0.2 },
  };

  getActivity(): ActivityType {
    return this.currentActivity;
  }

  setActivity(activity: ActivityType) {
    this.currentActivity = activity;
  }

  tick(): ActivityType {
    this.transitionTimer++;
    
    if (this.transitionTimer >= this.transitionDuration) {
      const probs = this.TRANSITION_PROBS[this.currentActivity];
      const roll = Math.random();
      let cumulative = 0;
      
      for (const [nextActivity, prob] of Object.entries(probs)) {
        cumulative += prob as number;
        if (roll < cumulative * 0.02) { // Scale down probability per tick
          this.currentActivity = nextActivity as ActivityType;
          this.transitionDuration = 50 + Math.floor(Math.random() * 200);
          this.transitionTimer = 0;
          break;
        }
      }
    }

    return this.currentActivity;
  }
}
