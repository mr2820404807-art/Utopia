// ===== 地图模式：政治/军事/经济/人口/外交/战争 =====
// 乌托邦 · 一期改造
import { armies, nations, provinceData, wars, gameCtx, onDay, UI } from './state.js';
import { getRelation } from './state.js';
import { sideOf } from './diplomacy.js';

export const MAP_MODES = [
  { id: 'political', name: '政治', icon: '🗺️' },
  { id: 'military', name: '军事', icon: '⚔' },
  { id: 'economy', name: '经济', icon: '💰' },
  { id: 'population', name: '人口', icon: '👥' },
  { id: 'relations', name: '外交', icon: '🤝' },
  { id: 'war', name: '战争', icon: '🔥' },
];

let currentMode = 'political';
export function currentMapMode() { return currentMode; }

// 热度色：0-1 -> 蓝→绿→黄→红
function heatColor(t) {
  t = Math.max(0, Math.min(1, t));
  const stops = [[0.0, [40, 80, 160]], [0.35, [50, 160, 120]], [0.65, [220, 200, 60]], [1.0, [220, 60, 40]]];
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i], [p1, c1] = stops[i + 1];
    if (t >= p0 && t <= p1) {
      const k = (t - p0) / (p1 - p0);
      return `rgba(${Math.round(c0[0] + (c1[0] - c0[0]) * k)},${Math.round(c0[1] + (c1[1] - c0[1]) * k)},${Math.round(c0[2] + (c1[2] - c0[2]) * k)},0.30)`;
    }
  }
  return 'rgba(40,80,160,0.3)';
}

export function setMapMode(mode) {
  currentMode = mode;
  repaintMap();
  const def = MAP_MODES.find(m => m.id === mode);
  if (def) UI.notify('地图模式：' + def.name);
}

export function repaintMap() {
  const me = window.__ownCountry;
  if (currentMode === 'political') {
    UI.repaintBase(); // 原政治地图（含占领重绘）
    return;
  }
  if (currentMode === 'military' || currentMode === 'economy' || currentMode === 'population') {
    let maxV = 1;
    const values = {};
    for (const p of Object.keys(provinceData)) {
      let v = 0;
      if (currentMode === 'military') { const a = armies[p]; v = a ? a.troops : 0; }
      else if (currentMode === 'economy') v = provinceData[p].economy;
      else v = provinceData[p].population;
      values[p] = v;
      if (v > maxV) maxV = v;
    }
    UI.paintProvinces((name) => {
      const v = values[name];
      if (v === undefined) return null;
      return heatColor(Math.pow(v / maxV, 0.45));
    });
    return;
  }
  if (currentMode === 'relations') {
    if (!me) return;
    UI.paintCountries((country) => {
      if (country === me) return 'rgba(255,220,120,0.5)';
      const r = getRelation(me, country);
      const t = (r + 100) / 200;
      // 红(敌) → 灰(中) → 绿(友)
      if (r < -20) return `rgba(220,${Math.round(60 + t * 60)},60,0.35)`;
      if (r > 20) return `rgba(${Math.round(220 - t * 80)},220,${Math.round(60 + t * 40)},0.35)`;
      return 'rgba(130,130,130,0.30)';
    });
    return;
  }
  if (currentMode === 'war') {
    if (!me) return;
    UI.paintCountries((country) => {
      if (country === me) return 'rgba(80,150,255,0.45)';
      const n = nations[country];
      if (!n || !n.alive) return 'rgba(60,60,60,0.25)';
      if (n.overlord === me) return 'rgba(180,100,255,0.4)';
      let side = null;
      for (const w of wars) {
        const s = sideOf(w, country);
        const mySide = sideOf(w, me);
        if (s && mySide) { side = (s === mySide) ? 'ally' : 'enemy'; break; }
      }
      if (side === 'enemy') return 'rgba(255,70,50,0.5)';
      if (side === 'ally') return 'rgba(90,220,140,0.4)';
      return 'rgba(130,130,130,0.28)';
    });
    return;
  }
}

// 动态模式每日刷新
onDay(() => {
  if (currentMode !== 'political') repaintMap();
});
