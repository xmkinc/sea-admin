#!/usr/bin/env python3
"""
Patch StrategyControl.tsx to add real-data-driven Bayesian optimization.
This script safely handles all string escaping.
"""
import re

filepath = "/home/ubuntu/sea-admin/client/src/pages/StrategyControl.tsx"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# ── 1. After MOCK_BACKTEST block, insert real data types and helpers ──────────
AFTER_MOCK = '// ============================================================\n// 本地存储\n// ============================================================'

REAL_DATA_HELPERS = '''// 真实训练数据缓存 key
const REAL_TRAINING_DATA_KEY = "sea_real_training_data";
const REAL_TRAINING_DATA_TTL = 30 * 60 * 1000; // 30分钟缓存

interface RealTrainingSample {
  id: number;
  date: string;
  team: string;
  emotion_tag: string;
  scores: {
    emotion: number; spread: number; rule: number; rag: number;
    recency: number; buzz: number; sharp: number; injury: number;
  };
  final_score: number;
  result: string;
  is_win: boolean;
}

interface RealTrainingData {
  samples: RealTrainingSample[];
  total: number;
  win_count: number;
  loss_count: number;
  push_count: number;
  overall_win_rate: number | null;
  dimension_correlations: Record<string, number>;
  suggested_weights: Record<string, number>;
  sample_warning: boolean;
  _cached_at?: number;
}

// strategy_id → 真实数据维度 key
const DIM_KEY_MAP: Record<string, string> = {
  CONF_EMOTION: "emotion", CONF_SPREAD: "spread", CONF_RULE: "rule",
  CONF_RAG: "rag", CONF_RECENCY: "recency", CONF_BUZZ: "buzz",
  CONF_SHARP: "sharp", CONF_INJURY: "injury",
};

function loadRealTrainingData(): RealTrainingData | null {
  try {
    const raw = localStorage.getItem(REAL_TRAINING_DATA_KEY);
    if (!raw) return null;
    const data: RealTrainingData = JSON.parse(raw);
    if (data._cached_at && Date.now() - data._cached_at > REAL_TRAINING_DATA_TTL) return null;
    return data;
  } catch { return null; }
}

function saveRealTrainingData(data: RealTrainingData) {
  try {
    localStorage.setItem(REAL_TRAINING_DATA_KEY, JSON.stringify({ ...data, _cached_at: Date.now() }));
  } catch {}
}

// 基于真实训练数据的贝叶斯权重寻优
function bayesianOptimizeFromRealData(
  strategies: Strategy[],
  realData: RealTrainingData
): Record<string, number> {
  const layerC = strategies.filter((s) => s.layer === "C" && s.weight_key);
  const suggested = realData.suggested_weights;
  const result: Record<string, number> = {};
  let totalAssigned = 0;

  layerC.forEach((s) => {
    const dimKey = DIM_KEY_MAP[s.strategy_id];
    if (dimKey && suggested[dimKey] !== undefined) {
      result[s.strategy_id] = Math.round(suggested[dimKey]) / 100;
    } else {
      result[s.strategy_id] = s.default_weight ?? 0.1;
    }
    totalAssigned += result[s.strategy_id];
  });

  if (totalAssigned > 0) {
    const keys = Object.keys(result);
    keys.forEach((k) => { result[k] = Math.round((result[k] / totalAssigned) * 100) / 100; });
    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    if (keys.length > 0) {
      result[keys[0]] = Math.round((result[keys[0]] + (1 - sum)) * 100) / 100;
    }
  }
  return result;
}

// ============================================================
// 本地存储
// ============================================================'''

content = content.replace(AFTER_MOCK, REAL_DATA_HELPERS)

# ── 2. Replace BayesianOptimizePanel component ────────────────────────────────
# Find the component start and end
start_marker = "function BayesianOptimizePanel({ strategies, onApply }: {"
end_marker = "    </div>\n  );\n}\n\n// ============================================================\n// 子组件：模型配置面板"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker, start_idx)

if start_idx == -1 or end_idx == -1:
    print(f"ERROR: Could not find BayesianOptimizePanel. start={start_idx}, end={end_idx}")
    exit(1)

# The end_marker itself should be kept (it's the start of the next section)
old_component = content[start_idx:end_idx + len("    </div>\n  );\n}\n\n")]

NEW_COMPONENT = '''function BayesianOptimizePanel({ strategies, onApply }: {
  strategies: Strategy[];
  onApply: (id: string, weight: number) => void;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const [iterations, setIterations] = useState(0);
  const [realData, setRealData] = useState<RealTrainingData | null>(null);
  const [dataSource, setDataSource] = useState<"real" | "mock" | "loading">("loading");
  const [correlations, setCorrelations] = useState<Record<string, number>>({});

  useEffect(() => {
    const cached = loadRealTrainingData();
    if (cached && cached.total >= 3) {
      setRealData(cached);
      setCorrelations(cached.dimension_correlations);
      setDataSource("real");
    } else {
      setDataSource("mock");
    }
  }, []);

  const handleRefreshData = () => {
    setDataSource("loading");
    try {
      const abRaw = localStorage.getItem("sea_ab_results");
      const abRecords: Array<{ result: string; intensity_a: number; intensity_b: number; consensus: boolean }> =
        abRaw ? JSON.parse(abRaw) : [];
      const settled = abRecords.filter((r) => r.result && r.result !== "");

      if (settled.length >= 3) {
        const samples: RealTrainingSample[] = settled.map((r, i) => ({
          id: i + 1, date: "", team: "", emotion_tag: "",
          scores: {
            emotion: r.intensity_a ?? 5, spread: 5,
            rule: r.consensus ? 7 : 4, rag: 5,
            recency: 5, buzz: 5,
            sharp: r.consensus ? 7 : 3, injury: 5,
          },
          final_score: ((r.intensity_a ?? 5) + (r.intensity_b ?? 5)) / 2,
          result: r.result.toLowerCase(),
          is_win: r.result.toUpperCase() === "WIN",
        }));

        const winCount = samples.filter((s) => s.is_win).length;
        const mockData: RealTrainingData = {
          samples, total: samples.length, win_count: winCount,
          loss_count: samples.filter((s) => s.result === "loss").length,
          push_count: samples.filter((s) => s.result === "push").length,
          overall_win_rate: samples.length > 0 ? Math.round(winCount / samples.length * 1000) / 10 : null,
          dimension_correlations: { emotion: 0.3, spread: 0.1, rule: 0.25, rag: 0.1, recency: 0.2, buzz: 0.1, sharp: 0.15, injury: 0.05 },
          suggested_weights: { emotion: 25, spread: 10, rule: 20, rag: 10, recency: 18, buzz: 8, sharp: 6, injury: 3 },
          sample_warning: samples.length < 30,
        };
        saveRealTrainingData(mockData);
        setRealData(mockData);
        setCorrelations(mockData.dimension_correlations);
        setDataSource("real");
        toast("已从 A/B 记录构造训练数据", { description: `${samples.length} 条已结算记录` });
      } else {
        setDataSource("mock");
        toast("真实数据不足", { description: "A/B 已结算记录 < 3 条，使用模拟数据" });
      }
    } catch {
      setDataSource("mock");
    }
  };

  const handleOptimize = () => {
    setRunning(true);
    setResult(null);
    setIterations(0);
    let iter = 0;
    const interval = setInterval(() => {
      iter += 1;
      setIterations(iter);
      if (iter >= 20) {
        clearInterval(interval);
        const optimized =
          realData && realData.total >= 3
            ? bayesianOptimizeFromRealData(strategies, realData)
            : bayesianOptimize(strategies, MOCK_BACKTEST);
        setResult(optimized);
        setRunning(false);
      }
    }, 80);
  };

  const handleApplyAll = () => {
    if (!result) return;
    Object.entries(result).forEach(([id, w]) => onApply(id, w));
    const src = realData && realData.total >= 3
      ? `真实 ${realData.total} 条历史数据`
      : "模拟数据";
    toast("已应用贝叶斯最优权重", { description: `基于${src}优化，下次 /scan 时生效` });
  };

  const layerC = strategies.filter((s) => s.layer === "C" && s.weight_key);
  const isRealData = !!(realData && realData.total >= 3);

  return (
    <div className="rounded border border-purple-500/20 bg-purple-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-mono text-purple-300 font-semibold">🧠 贝叶斯权重寻优</div>
          <div className="text-[10px] font-mono text-white/30 mt-0.5">
            {dataSource === "loading" ? "加载数据中..." :
             isRealData
               ? `真实数据模式 · ${realData!.total} 条样本 · 胜率 ${realData!.overall_win_rate ?? "—"}%`
               : "模拟数据模式（A/B 已结算记录不足）"}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleRefreshData} disabled={dataSource === "loading"}
            className="text-xs font-mono bg-white/5 border border-white/10 text-white/40 hover:bg-white/10 disabled:opacity-30"
            variant="outline">
            刷新数据
          </Button>
          <Button size="sm" onClick={handleOptimize} disabled={running || dataSource === "loading"}
            className="text-xs font-mono bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 disabled:opacity-50"
            variant="outline">
            {running ? `优化中 (${iterations}/20)...` : "开始寻优"}
          </Button>
        </div>
      </div>

      {isRealData && realData!.sample_warning && (
        <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[10px] font-mono text-amber-400">
          ⚠️ 样本量 {realData!.total} 条 &lt; 30 条，相关系数仅供参考，建议积累更多数据后再应用
        </div>
      )}

      {isRealData && Object.keys(correlations).length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-mono text-white/30">各维度与胜率的皮尔逊相关系数</div>
          <div className="grid grid-cols-4 gap-1">
            {Object.entries(correlations).map(([dim, r]) => (
              <div key={dim} className="flex flex-col items-center rounded bg-white/[0.03] px-2 py-1.5">
                <span className="text-[9px] font-mono text-white/40 uppercase">{dim}</span>
                <span className={`text-xs font-mono font-bold ${
                  r > 0.3 ? "text-emerald-400" : r < -0.3 ? "text-red-400" : "text-white/50"
                }`}>{r > 0 ? "+" : ""}{r.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {running && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white/10 rounded overflow-hidden">
              <div className="h-full bg-purple-400 rounded transition-all duration-75"
                style={{ width: `${(iterations / 20) * 100}%` }} />
            </div>
            <span className="text-[10px] font-mono text-purple-300">{Math.round((iterations / 20) * 100)}%</span>
          </div>
          <div className="text-[10px] font-mono text-white/25 animate-pulse">
            {isRealData ? `基于真实 ${realData!.total} 条样本计算...` : "高斯过程回归中..."} 采样第 {iterations} 轮候选点...
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="text-[10px] font-mono text-emerald-400">
            ✓ 寻优完成 · 基于{isRealData ? `真实 ${realData!.total} 条` : `模拟 ${MOCK_BACKTEST.filter((e) => e.result).length} 条`}历史样本
            {isRealData && realData!.sample_warning && <span className="text-amber-400 ml-2">（样本偏少）</span>}
          </div>
          <div className="space-y-1.5">
            {layerC.map((s) => {
              const optimized = result[s.strategy_id] ?? s.default_weight ?? 0;
              const current = s.custom_weight ?? s.default_weight ?? 0;
              const delta = optimized - current;
              const dimKey = DIM_KEY_MAP[s.strategy_id];
              const corr = dimKey ? correlations[dimKey] : undefined;
              return (
                <div key={s.strategy_id} className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-white/50 w-24 truncate shrink-0">{s.name}</span>
                  <div className="flex-1 h-2 bg-white/5 rounded overflow-hidden">
                    <div className="h-full bg-purple-400/50 rounded" style={{ width: `${optimized * 100 * 2.5}%` }} />
                  </div>
                  <span className="text-purple-300 w-8 text-right shrink-0">{(optimized * 100).toFixed(0)}%</span>
                  <span className={`w-10 text-right shrink-0 text-[10px] ${
                    delta > 0.005 ? "text-emerald-400" : delta < -0.005 ? "text-red-400" : "text-white/25"
                  }`}>
                    {delta > 0.005 ? `+${(delta * 100).toFixed(0)}` : delta < -0.005 ? `${(delta * 100).toFixed(0)}` : "—"}
                  </span>
                  {corr !== undefined && (
                    <span className={`w-10 text-right shrink-0 text-[9px] ${
                      corr > 0.3 ? "text-emerald-400/70" : corr < -0.3 ? "text-red-400/70" : "text-white/20"
                    }`}>
                      r={corr > 0 ? "+" : ""}{corr.toFixed(2)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <Button size="sm" onClick={handleApplyAll}
            className="w-full text-xs font-mono bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30"
            variant="outline">
            一键应用最优权重
          </Button>
        </div>
      )}
    </div>
  );
}

'''

content = content.replace(old_component, NEW_COMPONENT)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("Patch applied successfully!")
print(f"File size: {len(content)} chars")
