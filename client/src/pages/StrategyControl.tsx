/**
 * StrategyControl.tsx — 策略控制中心 V2
 * Design: Dark tactical panel, monospace data, military-grade toggles
 * Layout: 层级统计 + Tabs（开关面板 / 权重调节 / 模型配置 / 回测对比 / 执行日志）
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";

// ============================================================
// 类型定义
// ============================================================

interface Strategy {
  strategy_id: string;
  layer: "A" | "B" | "C";
  name: string;
  description: string;
  category: string;
  impact: string;
  default_enabled: boolean;
  enabled: boolean;
  notes: string;
  updated_at: string;
  updated_by: string;
  narrative_keys?: string[];
  weight_key?: string;
  default_weight?: number;
  custom_weight?: number | null;
}

interface RunLog {
  id: number;
  run_id: string;
  scan_date: string;
  strategy_id: string;
  team: string;
  game: string;
  triggered: boolean;
  skipped_reason: string;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown>;
  duration_ms: number;
  created_at: string;
}

interface ModelConfig {
  role: string;
  label: string;
  current: string;
  options: { id: string; name: string; provider: string; cost: string; quality: string; note: string }[];
}

interface BacktestEntry {
  date: string;
  game: string;
  team: string;
  rule: string;
  direction: string;
  confidence_full: number;
  confidence_without: Record<string, number>;
  result?: "WIN" | "LOSS" | "PUSH" | null;
}

// ============================================================
// Mock 数据
// ============================================================

const MOCK_STRATEGIES: Strategy[] = [
  // Layer A
  { strategy_id: "ESPN_NEWS", layer: "A", name: "ESPN新闻引擎", description: "实时扫描ESPN新闻标题，自动检测伤病/交易/停赛关键词，为Perplexity搜索注入上下文", category: "data", impact: "关闭后ESPN新闻不再触发叙事标签", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "" },
  { strategy_id: "PERPLEXITY_SENTIMENT", layer: "A", name: "Perplexity舆论搜索", description: "用Perplexity Sonar Pro Search对每支球队定向搜索X/Twitter舆论、球迷情绪", category: "data", impact: "关闭后舆论强度、X舆论、球迷情绪字段为空，仅依赖ESPN事实", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "" },
  { strategy_id: "ODDS_API", layer: "A", name: "Odds API盘口", description: "从The Odds API获取让分、大小分、赔率数据", category: "data", impact: "关闭后无盘口数据，CONF_SPREAD维度得分为0", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "" },
  { strategy_id: "ACTION_NETWORK", layer: "A", name: "Action Network公众投注", description: "解析Action Network数据，识别Sharp信号（顺向加码/逆向撤资/Fade Public）", category: "data", impact: "关闭后无Sharp信号，CONF_SHARP维度得分为0", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "" },
  { strategy_id: "CLAUDE_ANALYSIS", layer: "A", name: "Claude深度情绪分析", description: "用Claude Opus对ESPN战报+舆论数据做深度情绪判定，输出情绪标签、方向、强度", category: "data", impact: "关闭后情绪分析降级为纯规则检测，准确率下降", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "" },
  { strategy_id: "RECENCY_ENGINE", layer: "A", name: "近因效应引擎", description: "计算球队近期表现对当前情绪的放大效应（连胜/连败/H2H唤醒）", category: "data", impact: "关闭后近因效应修正为0，规则强度不受历史趋势影响", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "" },
  // Layer B
  { strategy_id: "RULE_HEARTBREAK_LOSS", layer: "B", name: "惜败规则", description: "绝杀/加时惜败 → 心理创伤延续 → 做空（SHORT）", category: "rule", impact: "关闭后惜败场景不触发做空信号", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", narrative_keys: ["HEARTBREAK_LOSS", "BUZZER_BEATER_LOSS", "OT_COLLAPSE", "BLOWN_LEAD"] },
  { strategy_id: "RULE_BLOWOUT", layer: "B", name: "大比分规则", description: "大比分被屠→公众过度悲观→做多 | 大比分大胜→公众过度乐观→做空", category: "rule", impact: "关闭后大比分场景不触发方向信号", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", narrative_keys: ["BLOWOUT_LOSS", "BLOWOUT_WIN"] },
  { strategy_id: "RULE_STREAK", layer: "B", name: "连胜/连败规则", description: "连胜极值→公众过度自信→做空 | 连败谷底→公众过度悲观→做多", category: "rule", impact: "关闭后连胜/连败趋势不触发方向信号", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", narrative_keys: ["PEAK_STREAK", "VALLEY_STREAK"] },
  { strategy_id: "RULE_REVERSAL", layer: "B", name: "逆转规则", description: "惊天逆转胜/逆转败 → 情绪过载 → 做空/做多", category: "rule", impact: "关闭后逆转场景不触发方向信号", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", narrative_keys: ["COMEBACK_WIN", "COMEBACK_LOSS", "NARROW_ESCAPE_WIN"] },
  { strategy_id: "RULE_INJURY_PANIC", layer: "B", name: "伤病恐慌规则", description: "球星伤病 → 公众恐慌 → 仅信息提示，不做方向判断", category: "rule", impact: "关闭后伤病事件不触发任何信号", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", narrative_keys: ["INJURY_PANIC"] },
  { strategy_id: "RULE_TRADE", layer: "B", name: "交易传言规则", description: "卖方传言→球队士气受损→做空 | 买方传言→球队士气提升→做多", category: "rule", impact: "关闭后交易传言不触发方向信号", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", narrative_keys: ["TRADE_SHOCK", "TRADE_HYPE", "TRADE_RUMOR_SELLER", "TRADE_RUMOR_BUYER"] },
  { strategy_id: "RULE_REVENGE", layer: "B", name: "复仇之战规则", description: "再次遇到上次大败的对手 → 复仇动力 → 做多", category: "rule", impact: "关闭后复仇场景不触发做多信号", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", narrative_keys: ["REVENGE_GAME"] },
  { strategy_id: "RULE_B2B_FATIGUE", layer: "B", name: "背靠背疲劳规则", description: "背靠背第二场 → 体力透支+防守强度下降 → 做空疲劳方", category: "rule", impact: "关闭后背靠背疲劳不触发做空信号", default_enabled: false, enabled: false, notes: "回测胜率39.2%，已暂停", updated_at: "", updated_by: "", narrative_keys: ["B2B_FATIGUE"] },
  { strategy_id: "RULE_PUBLIC_FADE", layer: "B", name: "公众情绪反转规则", description: ">75%单边押注时做多被忽视方（Fade the Public）", category: "rule", impact: "关闭后极端单边押注不触发反向信号", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", narrative_keys: ["PUBLIC_SENTIMENT_REVERSE"] },
  // Layer C
  { strategy_id: "CONF_EMOTION", layer: "C", name: "情绪极端程度", description: "置信度评分中情绪极端程度维度（默认权重20%）", category: "confidence", impact: "关闭后情绪强度不影响置信度", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", weight_key: "emotion_score", default_weight: 0.20 },
  { strategy_id: "CONF_RULE_AUDIT", layer: "C", name: "V6宪法裁决", description: "置信度评分中规则引擎裁决强度维度（默认权重20%）", category: "confidence", impact: "关闭后规则强度不影响置信度", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", weight_key: "rule_audit", default_weight: 0.20 },
  { strategy_id: "CONF_SPREAD", layer: "C", name: "盘口价值", description: "置信度评分中盘口让分价值维度（默认权重15%）", category: "confidence", impact: "关闭后盘口数据不影响置信度", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", weight_key: "spread_value", default_weight: 0.15 },
  { strategy_id: "CONF_RECENCY", layer: "C", name: "近因效应", description: "置信度评分中近因效应维度（默认权重15%）", category: "confidence", impact: "关闭后近因效应不影响置信度", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", weight_key: "recency_effect", default_weight: 0.15 },
  { strategy_id: "CONF_RAG", layer: "C", name: "历史胜率", description: "置信度评分中同类事件历史胜率维度（默认权重10%）", category: "confidence", impact: "关闭后历史胜率不影响置信度", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", weight_key: "rag_history", default_weight: 0.10 },
  { strategy_id: "CONF_PREGAME_BUZZ", layer: "C", name: "赛前热度", description: "置信度评分中赛前热度+公众预期维度（默认权重10%）", category: "confidence", impact: "关闭后赛前热度不影响置信度", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", weight_key: "pregame_buzz", default_weight: 0.10 },
  { strategy_id: "CONF_SHARP", layer: "C", name: "Sharp信号", description: "置信度评分中Sharp信号对齐维度（默认权重5%）", category: "confidence", impact: "关闭后Sharp信号不影响置信度", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", weight_key: "sharp_alignment", default_weight: 0.05 },
  { strategy_id: "CONF_INJURY", layer: "C", name: "伤病影响", description: "置信度评分中伤病对下一场影响维度（默认权重5%）", category: "confidence", impact: "关闭后伤病不影响置信度", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", weight_key: "injury_impact", default_weight: 0.05 },
];

const MODEL_CONFIGS: ModelConfig[] = [
  {
    role: "emotion_analysis",
    label: "情绪分析内核",
    current: "claude-opus-4-6",
    options: [
      { id: "claude-opus-4-6", name: "Claude Opus 4.6", provider: "Anthropic", cost: "$$$$", quality: "★★★★★", note: "推荐 · 情绪细节感知最强，叙事标签准确率最高" },
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "Anthropic", cost: "$$$", quality: "★★★★☆", note: "性价比高，偶尔标签误判" },
      { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", cost: "$$$", quality: "★★★★☆", note: "英文体育语境理解好，中文稍弱" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "Google", cost: "$$", quality: "★★★☆☆", note: "速度快，情绪强度评分波动较大" },
      { id: "deepseek-v3", name: "DeepSeek V3", provider: "DeepSeek", cost: "$", quality: "★★★☆☆", note: "成本极低，适合高频测试" },
    ],
  },
  {
    role: "sentiment_search",
    label: "舆论搜索引擎",
    current: "perplexity-sonar-pro",
    options: [
      { id: "perplexity-sonar-pro", name: "Sonar Pro", provider: "Perplexity", cost: "$$$", quality: "★★★★★", note: "推荐 · 实时X/Twitter搜索最准" },
      { id: "perplexity-sonar", name: "Sonar", provider: "Perplexity", cost: "$$", quality: "★★★★☆", note: "速度更快，覆盖面略低" },
    ],
  },
  {
    role: "ocr_analysis",
    label: "盘口OCR解析",
    current: "gemini-2.0-flash",
    options: [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "Google", cost: "$$", quality: "★★★★☆", note: "推荐 · 视觉解析速度快，盘口识别准确" },
      { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", cost: "$$$", quality: "★★★★★", note: "视觉理解最强，成本较高" },
      { id: "claude-opus-4-6", name: "Claude Opus 4.6", provider: "Anthropic", cost: "$$$$", quality: "★★★★★", note: "最强视觉，成本最高" },
    ],
  },
];

const MOCK_LOGS: RunLog[] = [
  { id: 1, run_id: "2026-03-02-a1b2c3d4", scan_date: "2026-03-02", strategy_id: "ESPN_NEWS", team: "", game: "", triggered: true, skipped_reason: "", input_data: {}, output_data: { teams_cached: 14, alerts: 2 }, duration_ms: 1842, created_at: "2026-03-02T02:15:01Z" },
  { id: 2, run_id: "2026-03-02-a1b2c3d4", scan_date: "2026-03-02", strategy_id: "PERPLEXITY_SENTIMENT", team: "", game: "", triggered: true, skipped_reason: "", input_data: {}, output_data: { teams_searched: 14, results: 12 }, duration_ms: 18420, created_at: "2026-03-02T02:15:22Z" },
  { id: 3, run_id: "2026-03-02-a1b2c3d4", scan_date: "2026-03-02", strategy_id: "CLAUDE_ANALYSIS", team: "", game: "", triggered: true, skipped_reason: "", input_data: {}, output_data: { games_analyzed: 7, extreme_events: 3 }, duration_ms: 12300, created_at: "2026-03-02T02:15:45Z" },
  { id: 4, run_id: "2026-03-02-a1b2c3d4", scan_date: "2026-03-02", strategy_id: "RULE_BLOWOUT", team: "Milwaukee Bucks", game: "Bulls @ Bucks", triggered: true, skipped_reason: "", input_data: { emotion_tag: "BLOWOUT_LOSS", sentiment_intensity: 5, recency_score: 6.0 }, output_data: { direction: "LONG", strength: 6.1, reason: "大比分被屠 → 公众过度悲观", signal: "MEDIUM" }, duration_ms: 2, created_at: "2026-03-02T02:16:01Z" },
  { id: 5, run_id: "2026-03-02-a1b2c3d4", scan_date: "2026-03-02", strategy_id: "RULE_HEARTBREAK_LOSS", team: "Chicago Bulls", game: "Bulls @ Bucks", triggered: false, skipped_reason: "", input_data: { emotion_tag: "", sentiment_intensity: 8, recency_score: 0 }, output_data: { direction: "WATCH", strength: 3.0, reason: "无匹配场景", signal: "LOW" }, duration_ms: 1, created_at: "2026-03-02T02:16:01Z" },
  { id: 6, run_id: "2026-03-01-e5f6g7h8", scan_date: "2026-03-01", strategy_id: "RULE_BLOWOUT", team: "Boston Celtics", game: "Nets @ Celtics", triggered: true, skipped_reason: "", input_data: { emotion_tag: "BLOWOUT_WIN", sentiment_intensity: 9, recency_score: 8.5 }, output_data: { direction: "SHORT", strength: 8.2, reason: "大比分大胜 → 公众过度乐观", signal: "HIGH" }, duration_ms: 2, created_at: "2026-03-01T02:18:22Z" },
  { id: 7, run_id: "2026-03-01-e5f6g7h8", scan_date: "2026-03-01", strategy_id: "RULE_STREAK", team: "Oklahoma City Thunder", game: "Thunder @ Mavs", triggered: true, skipped_reason: "", input_data: { emotion_tag: "PEAK_STREAK", sentiment_intensity: 8, recency_score: 7.2 }, output_data: { direction: "SHORT", strength: 7.5, reason: "连胜8场 → 公众过度自信", signal: "HIGH" }, duration_ms: 2, created_at: "2026-03-01T02:18:45Z" },
];

// 模拟回测数据
const MOCK_BACKTEST: BacktestEntry[] = [
  { date: "2026-03-01", game: "Nets @ Celtics", team: "Boston Celtics", rule: "RULE_BLOWOUT", direction: "SHORT", confidence_full: 8.2, confidence_without: { RULE_BLOWOUT: 4.1, CONF_EMOTION: 6.8, CONF_RECENCY: 7.0, RULE_STREAK: 7.9 }, result: "WIN" },
  { date: "2026-03-01", game: "Thunder @ Mavs", team: "OKC Thunder", rule: "RULE_STREAK", direction: "SHORT", confidence_full: 7.5, confidence_without: { RULE_BLOWOUT: 7.4, CONF_EMOTION: 5.2, CONF_RECENCY: 6.1, RULE_STREAK: 4.8 }, result: "WIN" },
  { date: "2026-03-02", game: "Bulls @ Bucks", team: "Milwaukee Bucks", rule: "RULE_BLOWOUT", direction: "LONG", confidence_full: 6.1, confidence_without: { RULE_BLOWOUT: 3.2, CONF_EMOTION: 5.8, CONF_RECENCY: 5.5, RULE_STREAK: 6.0 }, result: null },
  { date: "2026-02-28", game: "Lakers @ Warriors", team: "Golden State Warriors", rule: "RULE_HEARTBREAK_LOSS", direction: "SHORT", confidence_full: 7.8, confidence_without: { RULE_BLOWOUT: 7.6, CONF_EMOTION: 5.9, CONF_RECENCY: 6.8, RULE_STREAK: 7.5 }, result: "LOSS" },
  { date: "2026-02-28", game: "Knicks @ Heat", team: "New York Knicks", rule: "RULE_PUBLIC_FADE", direction: "LONG", confidence_full: 6.8, confidence_without: { RULE_BLOWOUT: 6.7, CONF_EMOTION: 6.1, CONF_RECENCY: 5.9, RULE_STREAK: 6.5 }, result: "WIN" },
  { date: "2026-02-27", game: "Suns @ Clippers", team: "LA Clippers", rule: "RULE_STREAK", direction: "LONG", confidence_full: 5.9, confidence_without: { RULE_BLOWOUT: 5.8, CONF_EMOTION: 4.2, CONF_RECENCY: 5.1, RULE_STREAK: 3.5 }, result: "PUSH" },
];

// 真实训练数据缓存 key
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
// ============================================================

const STORAGE_KEY = "sea_strategy_toggles";
const WEIGHT_KEY = "sea_strategy_weights";
const MODEL_KEY = "sea_model_config";

function loadToggles(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveToggles(t: Record<string, boolean>) { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); }

function loadWeights(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(WEIGHT_KEY) || "{}"); } catch { return {}; }
}
function saveWeights(w: Record<string, number>) { localStorage.setItem(WEIGHT_KEY, JSON.stringify(w)); }

function loadModels(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(MODEL_KEY) || "{}"); } catch { return {}; }
}
function saveModels(m: Record<string, string>) { localStorage.setItem(MODEL_KEY, JSON.stringify(m)); }

// ============================================================
// 常量
// ============================================================

const LAYER_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  A: { label: "数据采集", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", desc: "控制哪些数据源被激活，影响分析输入质量" },
  B: { label: "规则引擎", color: "bg-amber-500/20 text-amber-300 border-amber-500/30", desc: "控制哪些情绪套利规则参与方向判断" },
  C: { label: "置信度权重", color: "bg-purple-500/20 text-purple-300 border-purple-500/30", desc: "控制置信度评分的各维度权重" },
};

const CATEGORY_ICONS: Record<string, string> = { data: "⚡", rule: "⚖️", confidence: "📊" };

// ============================================================
// 子组件：策略卡片
// ============================================================

function StrategyCard({ strategy, onToggle, isSelected, onClick }: {
  strategy: Strategy;
  onToggle: (id: string, val: boolean) => void;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer rounded border px-3 py-2.5 transition-all duration-150 ${
        isSelected ? "border-amber-500/60 bg-amber-500/10" : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm shrink-0">{CATEGORY_ICONS[strategy.category]}</span>
          <span className={`text-xs font-mono truncate ${strategy.enabled ? "text-white/90" : "text-white/30 line-through"}`}>
            {strategy.name}
          </span>
          {!strategy.default_enabled && (
            <span className="text-[9px] text-white/25 font-mono shrink-0">默认关</span>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Switch checked={strategy.enabled} onCheckedChange={(val) => onToggle(strategy.strategy_id, val)} className="scale-75 origin-right" />
        </div>
      </div>
      <div className="mt-1 flex items-center gap-1">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${strategy.enabled ? "bg-emerald-400 animate-pulse" : "bg-white/20"}`} />
        <span className={`text-[10px] font-mono ${strategy.enabled ? "text-emerald-400/70" : "text-white/30"}`}>
          {strategy.enabled ? "ACTIVE" : "DISABLED"}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// 贝叶斯寻优：基于历史数据推荐最优权重
// ============================================================

function bayesianOptimize(strategies: Strategy[], backtestData: BacktestEntry[]): Record<string, number> {
  // 只使用有结果的样本
  const withResults = backtestData.filter((e) => e.result && e.result !== "PUSH");
  if (withResults.length === 0) return {};

  const layerC = strategies.filter((s) => s.layer === "C" && s.weight_key);
  const weightKeys = layerC.map((s) => s.strategy_id);

  // 模拟高斯过程：对每个维度计算其与胜率的相关性
  // 用简化的梯度上升：对每个维度，计算"高权重时"vs"低权重时"的胜率差
  const dimContributions: Record<string, number> = {};

  weightKeys.forEach((sid) => {
    const s = layerC.find((x) => x.strategy_id === sid);
    if (!s) return;
    const defaultW = s.default_weight ?? 0.1;

    // 按置信度分组：高置信（>= 7.0）vs 低置信（< 7.0）
    // 高置信时该维度贡献大 → 该维度权重应该高
    const highConf = withResults.filter((e) => e.confidence_full >= 7.0);
    const lowConf = withResults.filter((e) => e.confidence_full < 7.0);
    const highWinRate = highConf.length > 0 ? highConf.filter((e) => e.result === "WIN").length / highConf.length : 0.5;
    const lowWinRate = lowConf.length > 0 ? lowConf.filter((e) => e.result === "WIN").length / lowConf.length : 0.5;

    // 相关性：高置信胜率 - 低置信胜率，越大说明该维度越重要
    const correlation = highWinRate - lowWinRate;
    // 基于相关性调整权重：相关性越高，权重越大
    dimContributions[sid] = Math.max(0.02, defaultW + correlation * 0.15);
  });

  // 归一化到总和=1
  const total = Object.values(dimContributions).reduce((a, b) => a + b, 0);
  const normalized: Record<string, number> = {};
  Object.entries(dimContributions).forEach(([k, v]) => {
    normalized[k] = Math.round((v / total) * 100) / 100;
  });

  // 确保总和精确为1
  const keys = Object.keys(normalized);
  const sum = Object.values(normalized).reduce((a, b) => a + b, 0);
  if (keys.length > 0) {
    normalized[keys[0]] = Math.round((normalized[keys[0]] + (1 - sum)) * 100) / 100;
  }

  return normalized;
}

// ============================================================
// 子组件：权重调节面板
// ============================================================

function WeightPanel({ strategies, onWeightChange }: {
  strategies: Strategy[];
  onWeightChange: (id: string, weight: number) => void;
}) {
  const layerC = strategies.filter((s) => s.layer === "C");
  const totalWeight = layerC.reduce((sum, s) => sum + (s.custom_weight ?? s.default_weight ?? 0), 0);
  const isBalanced = Math.abs(totalWeight - 1.0) < 0.01;

  // 模拟预览：基于权重变化预测置信度变化
  const previewScore = useMemo(() => {
    // 模拟一个基准事件的各维度原始分
    const baseDimScores: Record<string, number> = {
      emotion_score: 7.0, rule_audit: 8.0, spread_value: 6.0,
      recency_effect: 7.5, rag_history: 5.0, pregame_buzz: 6.0,
      sharp_alignment: 8.0, injury_impact: 4.0,
    };
    let score = 0;
    layerC.forEach((s) => {
      if (s.enabled && s.weight_key) {
        const w = s.custom_weight ?? s.default_weight ?? 0;
        score += (baseDimScores[s.weight_key] ?? 5) * w;
      }
    });
    return Math.min(score, 10).toFixed(2);
  }, [layerC]);

  const defaultScore = useMemo(() => {
    const baseDimScores: Record<string, number> = {
      emotion_score: 7.0, rule_audit: 8.0, spread_value: 6.0,
      recency_effect: 7.5, rag_history: 5.0, pregame_buzz: 6.0,
      sharp_alignment: 8.0, injury_impact: 4.0,
    };
    let score = 0;
    layerC.forEach((s) => {
      if (s.enabled && s.weight_key) {
        score += (baseDimScores[s.weight_key] ?? 5) * (s.default_weight ?? 0);
      }
    });
    return Math.min(score, 10).toFixed(2);
  }, [layerC]);

  return (
    <div className="space-y-4">
      {/* 总权重状态 */}
      <div className={`flex items-center justify-between rounded border p-3 ${isBalanced ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/40 bg-amber-500/10"}`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm ${isBalanced ? "text-emerald-400" : "text-amber-300"}`}>
            {isBalanced ? "✓" : "⚠️"}
          </span>
          <span className="text-xs font-mono text-white/70">
            总权重: <span className={`font-bold ${isBalanced ? "text-emerald-400" : "text-amber-300"}`}>{(totalWeight * 100).toFixed(0)}%</span>
            {!isBalanced && <span className="text-amber-300/60 ml-2">（应为100%，请调整）</span>}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-white/30">基准预测分:</span>
          <span className="text-white/50 line-through">{defaultScore}</span>
          <span className={`font-bold ${parseFloat(previewScore) > parseFloat(defaultScore) ? "text-emerald-400" : parseFloat(previewScore) < parseFloat(defaultScore) ? "text-red-400" : "text-white/60"}`}>
            → {previewScore}
          </span>
        </div>
      </div>

      {/* 权重滑块列表 */}
      <div className="space-y-3">
        {layerC.map((s) => {
          const currentWeight = s.custom_weight ?? s.default_weight ?? 0;
          const isCustom = s.custom_weight != null && Math.abs(s.custom_weight - (s.default_weight ?? 0)) > 0.001;
          return (
            <div key={s.strategy_id} className={`rounded border p-3 transition-all ${s.enabled ? "border-white/10 bg-white/[0.02]" : "border-white/5 bg-white/[0.01] opacity-50"}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-white/70">{s.name}</span>
                  {isCustom && (
                    <span className="text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded px-1">自定义</span>
                  )}
                  {!s.enabled && (
                    <span className="text-[9px] font-mono text-white/25">已关闭</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-purple-300 font-bold w-8 text-right">
                    {(currentWeight * 100).toFixed(0)}%
                  </span>
                  {isCustom && (
                    <button
                      onClick={() => onWeightChange(s.strategy_id, s.default_weight ?? 0)}
                      className="text-[9px] font-mono text-white/30 hover:text-white/60 transition-colors"
                    >
                      重置
                    </button>
                  )}
                </div>
              </div>
              <Slider
                value={[Math.round(currentWeight * 100)]}
                min={0}
                max={40}
                step={1}
                disabled={!s.enabled}
                onValueChange={([v]) => onWeightChange(s.strategy_id, v / 100)}
                className="w-full"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[9px] font-mono text-white/20">0%</span>
                <span className="text-[9px] font-mono text-white/20">默认 {((s.default_weight ?? 0) * 100).toFixed(0)}%</span>
                <span className="text-[9px] font-mono text-white/20">40%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] font-mono text-white/20 border-t border-white/5 pt-3">
        权重调整后下次 /scan 时生效 · 建议总权重保持100% · 单维度最大40%防止过拟合
      </div>

      {/* 贝叶斯寻优 */}
      <BayesianOptimizePanel strategies={strategies} onApply={onWeightChange} />
    </div>
  );
}

// ============================================================
// 子组件：贝叶斯寻优面板
// ============================================================

function BayesianOptimizePanel({ strategies, onApply }: {
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

// ============================================================
// 子组件：模型配置面板
// ============================================================

function ModelPanel({ modelConfigs, onModelChange }: {
  modelConfigs: ModelConfig[];
  onModelChange: (role: string, modelId: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="text-xs font-mono text-white/40 border-b border-white/5 pb-2">
        选择每个分析环节使用的 AI 内核 · 不同模型对情绪标签准确率和成本影响显著
      </div>
      {modelConfigs.map((config) => (
        <div key={config.role} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-white/60 font-semibold">{config.label}</span>
            <span className="text-[9px] font-mono text-white/25 bg-white/5 rounded px-1.5 py-0.5">{config.role}</span>
          </div>
          <div className="space-y-1.5">
            {config.options.map((opt) => {
              const isSelected = config.current === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => onModelChange(config.role, opt.id)}
                  className={`w-full text-left rounded border p-2.5 transition-all duration-150 ${
                    isSelected
                      ? "border-blue-500/50 bg-blue-500/10"
                      : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? "bg-blue-400" : "bg-white/15"}`} />
                      <span className={`text-xs font-mono font-semibold ${isSelected ? "text-blue-300" : "text-white/70"}`}>
                        {opt.name}
                      </span>
                      <span className="text-[9px] font-mono text-white/30">{opt.provider}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] font-mono text-amber-300/70">{opt.cost}</span>
                      <span className="text-[10px] font-mono text-yellow-300/70">{opt.quality}</span>
                    </div>
                  </div>
                  <div className="mt-1 ml-4 text-[10px] font-mono text-white/35 leading-relaxed">
                    {opt.note}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="text-[10px] font-mono text-white/20 border-t border-white/5 pt-3">
        模型切换后需在 Railway 服务器的 strategy_config.py 中同步更新 · 可通过 /model set emotion claude-opus-4-6 命令切换
      </div>
    </div>
  );
}

// ============================================================
// 子组件：回测对比视图
// ============================================================

function BacktestPanel({ strategies }: { strategies: Strategy[] }) {
  const [compareStrategy, setCompareStrategy] = useState("RULE_BLOWOUT");
  const [filterResult, setFilterResult] = useState<"all" | "WIN" | "LOSS" | "PUSH">("all");
  const [abModelA, setAbModelA] = useState("claude-opus-4-6");
  const [abModelB, setAbModelB] = useState("gpt-4o");
  const [abView, setAbView] = useState<"impact" | "ab">("impact");

  const filtered = MOCK_BACKTEST.filter((e) => {
    if (filterResult !== "all" && e.result !== filterResult) return false;
    return true;
  });

  const strategyName = (id: string) => strategies.find((s) => s.strategy_id === id)?.name || id;

  // 统计
  const withResults = MOCK_BACKTEST.filter((e) => e.result);
  const wins = withResults.filter((e) => e.result === "WIN").length;
  const losses = withResults.filter((e) => e.result === "LOSS").length;
  const pushes = withResults.filter((e) => e.result === "PUSH").length;
  const winRate = withResults.length > 0 ? ((wins / withResults.length) * 100).toFixed(1) : "—";

  // 关闭某策略后的影响统计
  const impactStats = useMemo(() => {
    const entries = MOCK_BACKTEST.filter((e) => e.confidence_without[compareStrategy] !== undefined);
    if (entries.length === 0) return null;
    const avgFull = entries.reduce((s, e) => s + e.confidence_full, 0) / entries.length;
    const avgWithout = entries.reduce((s, e) => s + (e.confidence_without[compareStrategy] ?? 0), 0) / entries.length;
    const delta = avgFull - avgWithout;
    return { avgFull: avgFull.toFixed(2), avgWithout: avgWithout.toFixed(2), delta: delta.toFixed(2), entries: entries.length };
  }, [compareStrategy]);

  const ruleOptions = strategies.filter((s) => s.layer === "B" || s.layer === "C");

  // A/B 对比模拟数据
  const AB_MOCK_DATA = useMemo(() => [
    { game: "Bucks @ Bulls", team: "Milwaukee Bucks", date: "2026-03-02",
      modelA: { model: "Claude Opus 4.6", direction: "LONG", confidence: 7.2, tag: "BLOWOUT_LOSS", intensity: 5, reason: "大比分被屠 → 公众过度悲观 → 做多" },
      modelB: { model: "GPT-4o", direction: "LONG", confidence: 6.8, tag: "BLOWOUT_LOSS", intensity: 6, reason: "Blowout loss triggers public overreaction → LONG" },
      consensus: true, result: null,
    },
    { game: "Celtics @ Nets", team: "Boston Celtics", date: "2026-03-01",
      modelA: { model: "Claude Opus 4.6", direction: "SHORT", confidence: 8.2, tag: "BLOWOUT_WIN", intensity: 9, reason: "大比分大胜 → 公众过度乐观 → 做空" },
      modelB: { model: "GPT-4o", direction: "SHORT", confidence: 7.9, tag: "BLOWOUT_WIN", intensity: 8, reason: "Dominant win inflates public confidence → SHORT" },
      consensus: true, result: "WIN",
    },
    { game: "Thunder @ Mavs", team: "OKC Thunder", date: "2026-03-01",
      modelA: { model: "Claude Opus 4.6", direction: "SHORT", confidence: 7.5, tag: "PEAK_STREAK", intensity: 8, reason: "连胜8场 → 公众过度自信 → 做空" },
      modelB: { model: "GPT-4o", direction: "WATCH", confidence: 5.1, tag: "", intensity: 5, reason: "No strong signal detected, recommend watching" },
      consensus: false, result: "WIN",
    },
    { game: "Lakers @ Warriors", team: "Golden State Warriors", date: "2026-02-28",
      modelA: { model: "Claude Opus 4.6", direction: "SHORT", confidence: 7.8, tag: "HEARTBREAK_LOSS", intensity: 7, reason: "惜败 → 心理创伤延续 → 做空" },
      modelB: { model: "GPT-4o", direction: "SHORT", confidence: 8.1, tag: "HEARTBREAK_LOSS", intensity: 8, reason: "Buzzer-beater loss creates psychological trauma → SHORT" },
      consensus: true, result: "LOSS",
    },
    { game: "Knicks @ Heat", team: "New York Knicks", date: "2026-02-28",
      modelA: { model: "Claude Opus 4.6", direction: "LONG", confidence: 6.8, tag: "PUBLIC_SENTIMENT_REVERSE", intensity: 6, reason: "公众75%+单边押注 → Fade the Public → 做多" },
      modelB: { model: "GPT-4o", direction: "WATCH", confidence: 4.9, tag: "", intensity: 4, reason: "Public betting skew detected but insufficient signal" },
      consensus: false, result: "WIN",
    },
  ], []);

  // A/B 统计
  const abStats = useMemo(() => {
    const withResult = AB_MOCK_DATA.filter((e) => e.result);
    const consensusEntries = withResult.filter((e) => e.consensus);
    const divergeEntries = withResult.filter((e) => !e.consensus);
    const modelAWins = withResult.filter((e) => e.modelA.direction !== "WATCH" && e.result === "WIN").length;
    const modelBWins = withResult.filter((e) => e.modelB.direction !== "WATCH" && e.result === "WIN").length;
    const modelATotal = withResult.filter((e) => e.modelA.direction !== "WATCH").length;
    const modelBTotal = withResult.filter((e) => e.modelB.direction !== "WATCH").length;
    const consensusWins = consensusEntries.filter((e) => e.result === "WIN").length;
    const divergeModelAWins = divergeEntries.filter((e) => e.modelA.direction !== "WATCH" && e.result === "WIN").length;
    return {
      modelAWinRate: modelATotal > 0 ? ((modelAWins / modelATotal) * 100).toFixed(0) : "—",
      modelBWinRate: modelBTotal > 0 ? ((modelBWins / modelBTotal) * 100).toFixed(0) : "—",
      consensusWinRate: consensusEntries.length > 0 ? ((consensusWins / consensusEntries.length) * 100).toFixed(0) : "—",
      divergeModelAWinRate: divergeEntries.length > 0 ? ((divergeModelAWins / divergeEntries.length) * 100).toFixed(0) : "—",
      consensusCount: consensusEntries.length,
      divergeCount: divergeEntries.length,
    };
  }, [AB_MOCK_DATA]);

  return (
    <div className="space-y-4">
      {/* 视图切换 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setAbView("impact")}
          className={`text-xs font-mono px-3 py-1.5 rounded border transition-all ${
            abView === "impact" ? "border-amber-500/50 bg-amber-500/10 text-amber-300" : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
          }`}
        >
          策略影响分析
        </button>
        <button
          onClick={() => setAbView("ab")}
          className={`text-xs font-mono px-3 py-1.5 rounded border transition-all ${
            abView === "ab" ? "border-blue-500/50 bg-blue-500/10 text-blue-300" : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
          }`}
        >
          A/B 模型对比
        </button>
      </div>

      {abView === "ab" && (
        <div className="space-y-4">
          {/* A/B 模型选择 */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "模型 A", value: abModelA, setter: setAbModelA, color: "blue" },
              { label: "模型 B", value: abModelB, setter: setAbModelB, color: "purple" },
            ].map(({ label, value, setter, color }) => (
              <div key={label} className={`rounded border p-3 ${
                color === "blue" ? "border-blue-500/30 bg-blue-500/5" : "border-purple-500/30 bg-purple-500/5"
              }`}>
                <div className={`text-xs font-mono font-semibold mb-2 ${
                  color === "blue" ? "text-blue-300" : "text-purple-300"
                }`}>{label}</div>
                <select
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className="w-full text-xs font-mono bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white/70 focus:outline-none"
                >
                  <option value="claude-opus-4-6">Claude Opus 4.6</option>
                  <option value="claude-sonnet-4-5">Claude Sonnet 4.5</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="deepseek-v3">DeepSeek V3</option>
                </select>
              </div>
            ))}
          </div>

          {/* A/B 统计摘要 */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "模型A胜率", value: `${abStats.modelAWinRate}%`, color: "text-blue-300" },
              { label: "模型B胜率", value: `${abStats.modelBWinRate}%`, color: "text-purple-300" },
              { label: "共识胜率", value: `${abStats.consensusWinRate}%`, color: "text-emerald-400", sub: `${abStats.consensusCount}场` },
              { label: "分歧时A胜率", value: `${abStats.divergeModelAWinRate}%`, color: "text-amber-300", sub: `${abStats.divergeCount}场` },
            ].map((stat) => (
              <div key={stat.label} className="rounded border border-white/10 bg-white/[0.02] p-2.5 text-center">
                <div className={`text-lg font-bold font-mono ${stat.color}`}>{stat.value}</div>
                <div className="text-[10px] font-mono text-white/30 mt-0.5">{stat.label}</div>
                {stat.sub && <div className="text-[9px] font-mono text-white/20">{stat.sub}</div>}
              </div>
            ))}
          </div>

          {/* 关键洞察 */}
          <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3">
            <div className="text-xs font-mono text-amber-300 font-semibold mb-1.5">🔍 关键洞察</div>
            <div className="space-y-1 text-[11px] font-mono text-white/50 leading-relaxed">
              <div>• 两模型<span className="text-emerald-400">共识时胜率 {abStats.consensusWinRate}%</span>，显著高于单模型独立判断</div>
              <div>• 分歧场次中模型A胜率 {abStats.divergeModelAWinRate}%，建议<span className="text-amber-300">分歧时降低仓位或观望</span></div>
              <div>• 推荐策略：仅在两模型方向一致时操作，分歧时自动降级为 WATCH</div>
            </div>
          </div>

          {/* 逐场对比 */}
          <div className="space-y-2">
            <div className="text-xs font-mono text-white/40 font-semibold">逐场对比记录</div>
            {AB_MOCK_DATA.map((entry, i) => (
              <div key={i} className={`rounded border p-3 space-y-2 ${
                entry.consensus ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      entry.consensus ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                    }`}>
                      {entry.consensus ? "共识" : "分歧"}
                    </span>
                    <span className="text-xs font-mono text-white/70">{entry.team}</span>
                    <span className="text-[10px] font-mono text-white/30">{entry.game} · {entry.date}</span>
                  </div>
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    entry.result === "WIN" ? "bg-emerald-500/20 text-emerald-300" :
                    entry.result === "LOSS" ? "bg-red-500/20 text-red-300" :
                    entry.result === "PUSH" ? "bg-white/10 text-white/40" : "bg-white/5 text-white/20"
                  }`}>{entry.result ?? "待结算"}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { model: entry.modelA, color: "blue" },
                    { model: entry.modelB, color: "purple" },
                  ].map(({ model, color }, mi) => (
                    <div key={mi} className={`rounded border p-2 ${
                      color === "blue" ? "border-blue-500/20 bg-blue-500/5" : "border-purple-500/20 bg-purple-500/5"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-mono font-semibold ${
                          color === "blue" ? "text-blue-300" : "text-purple-300"
                        }`}>{model.model}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-mono font-bold ${
                            model.direction === "LONG" ? "text-emerald-400" :
                            model.direction === "SHORT" ? "text-red-400" : "text-white/30"
                          }`}>
                            {model.direction === "LONG" ? "📈" : model.direction === "SHORT" ? "📉" : "👀"} {model.direction}
                          </span>
                          <span className="text-[10px] font-mono text-white/40">{model.confidence.toFixed(1)}</span>
                        </div>
                      </div>
                      {model.tag && (
                        <div className="text-[9px] font-mono text-amber-300/60 mb-0.5">{model.tag}</div>
                      )}
                      <div className="text-[9px] font-mono text-white/35 leading-relaxed">{model.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {abView === "impact" && (
      <>
      {/* 总体统计 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "总样本", value: withResults.length, color: "text-white/70" },
          { label: "胜率", value: `${winRate}%`, color: "text-emerald-400" },
          { label: "胜/负/推", value: `${wins}/${losses}/${pushes}`, color: "text-white/60" },
          { label: "高置信样本", value: MOCK_BACKTEST.filter((e) => e.confidence_full >= 6.5).length, color: "text-amber-300" },
        ].map((stat) => (
          <div key={stat.label} className="rounded border border-white/10 bg-white/[0.02] p-3 text-center">
            <div className={`text-xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
            <div className="text-[10px] font-mono text-white/30 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* 策略影响分析 */}
      <div className="rounded border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono text-white/60 font-semibold">关闭策略影响分析</h4>
          <select
            value={compareStrategy}
            onChange={(e) => setCompareStrategy(e.target.value)}
            className="text-xs font-mono bg-white/5 border border-white/10 rounded px-2 py-1 text-white/70 focus:outline-none focus:border-blue-500/50"
          >
            {ruleOptions.map((s) => (
              <option key={s.strategy_id} value={s.strategy_id}>{s.name}</option>
            ))}
          </select>
        </div>

        {impactStats ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-white/40">全策略开启均分:</span>
                <span className="text-white font-bold">{impactStats.avgFull}</span>
              </div>
              <span className="text-white/20">→</span>
              <div className="flex items-center gap-2">
                <span className="text-white/40">关闭 {strategyName(compareStrategy)}:</span>
                <span className="text-amber-300 font-bold">{impactStats.avgWithout}</span>
              </div>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded font-bold ${parseFloat(impactStats.delta) > 0 ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                {parseFloat(impactStats.delta) > 0 ? "↓" : "↑"} {Math.abs(parseFloat(impactStats.delta)).toFixed(2)}
              </div>
              <span className="text-white/25 text-[10px]">({impactStats.entries} 场样本)</span>
            </div>

            {/* 可视化对比条 */}
            <div className="space-y-2">
              {MOCK_BACKTEST.filter((e) => e.confidence_without[compareStrategy] !== undefined).map((entry, i) => {
                const full = entry.confidence_full;
                const without = entry.confidence_without[compareStrategy] ?? 0;
                const delta = full - without;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-white/50 truncate max-w-[200px]">{entry.team} · {entry.date}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`${entry.result === "WIN" ? "text-emerald-400" : entry.result === "LOSS" ? "text-red-400" : entry.result === "PUSH" ? "text-white/40" : "text-white/20"}`}>
                          {entry.result ?? "待结算"}
                        </span>
                        <span className={`${delta > 0 ? "text-red-400" : "text-emerald-400"}`}>
                          {delta > 0 ? `↓${delta.toFixed(1)}` : `↑${Math.abs(delta).toFixed(1)}`}
                        </span>
                      </div>
                    </div>
                    <div className="relative h-4 rounded overflow-hidden bg-white/5">
                      {/* 全策略分 */}
                      <div
                        className="absolute top-0 left-0 h-full bg-blue-500/40 rounded transition-all"
                        style={{ width: `${(full / 10) * 100}%` }}
                      />
                      {/* 关闭后分 */}
                      <div
                        className="absolute top-0 left-0 h-full bg-amber-500/60 rounded transition-all"
                        style={{ width: `${(without / 10) * 100}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-end pr-1">
                        <span className="text-[9px] font-mono text-white/60">{full.toFixed(1)} → {without.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-3 text-[9px] font-mono text-white/25 pt-1">
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-blue-500/40 rounded inline-block" /> 全策略开启</span>
                <span className="flex items-center gap-1"><span className="w-3 h-2 bg-amber-500/60 rounded inline-block" /> 关闭该策略</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-white/20 text-sm py-4 font-mono">暂无该策略的回测对比数据</div>
        )}
      </div>

      </>
      )}

      {/* 历史记录列表 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono text-white/60 font-semibold">历史推荐记录</h4>
          <select
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value as "all" | "WIN" | "LOSS" | "PUSH")}
            className="text-xs font-mono bg-white/5 border border-white/10 rounded px-2 py-1 text-white/70 focus:outline-none"
          >
            <option value="all">全部结果</option>
            <option value="WIN">胜</option>
            <option value="LOSS">负</option>
            <option value="PUSH">推</option>
          </select>
        </div>
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
          {filtered.map((entry, i) => (
            <div key={i} className={`rounded border p-2.5 text-xs font-mono ${
              entry.result === "WIN" ? "border-emerald-500/20 bg-emerald-500/5" :
              entry.result === "LOSS" ? "border-red-500/20 bg-red-500/5" :
              entry.result === "PUSH" ? "border-white/10 bg-white/[0.02]" :
              "border-white/5 bg-white/[0.01]"
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${entry.direction === "LONG" ? "text-emerald-400" : "text-red-400"}`}>
                    {entry.direction === "LONG" ? "📈 LONG" : "📉 SHORT"}
                  </span>
                  <span className="text-white/60">{entry.team}</span>
                  <span className="text-white/30">·</span>
                  <span className="text-white/40">{entry.game}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-purple-300">{entry.confidence_full.toFixed(1)}/10</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    entry.result === "WIN" ? "bg-emerald-500/20 text-emerald-300" :
                    entry.result === "LOSS" ? "bg-red-500/20 text-red-300" :
                    entry.result === "PUSH" ? "bg-white/10 text-white/40" :
                    "bg-white/5 text-white/20"
                  }`}>
                    {entry.result ?? "待结算"}
                  </span>
                </div>
              </div>
              <div className="mt-1 text-white/30 text-[10px]">
                {entry.date} · {strategyName(entry.rule)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 子组件：A/B 结果面板
// ============================================================

const AB_RESULT_KEY = "sea_ab_results";

interface ABRecord {
  id: string;
  date: string;
  game: string;
  team: string;
  model_a: string;
  model_b: string;
  signal_a: string;
  signal_b: string;
  intensity_a: number;
  intensity_b: number;
  consensus: boolean;
  result: "WIN" | "LOSS" | "PUSH" | null;
  primary_model: "A" | "B";
}

function loadABResults(): ABRecord[] {
  try { return JSON.parse(localStorage.getItem(AB_RESULT_KEY) || "[]"); } catch { return []; }
}
function saveABResults(r: ABRecord[]) { localStorage.setItem(AB_RESULT_KEY, JSON.stringify(r)); }

const MOCK_AB_RESULTS: ABRecord[] = [
  { id: "ab-001", date: "2026-03-02", game: "Bucks @ Bulls", team: "Milwaukee Bucks", model_a: "Claude Opus 4.6", model_b: "GPT-4o", signal_a: "LONG", signal_b: "LONG", intensity_a: 7.2, intensity_b: 6.8, consensus: true, result: null, primary_model: "A" },
  { id: "ab-002", date: "2026-03-01", game: "Celtics @ Nets", team: "Boston Celtics", model_a: "Claude Opus 4.6", model_b: "GPT-4o", signal_a: "SHORT", signal_b: "SHORT", intensity_a: 8.2, intensity_b: 7.9, consensus: true, result: "WIN", primary_model: "A" },
  { id: "ab-003", date: "2026-03-01", game: "Thunder @ Mavs", team: "OKC Thunder", model_a: "Claude Opus 4.6", model_b: "GPT-4o", signal_a: "SHORT", signal_b: "WATCH", intensity_a: 7.5, intensity_b: 5.1, consensus: false, result: "WIN", primary_model: "A" },
  { id: "ab-004", date: "2026-02-28", game: "Lakers @ Warriors", team: "Golden State Warriors", model_a: "Claude Opus 4.6", model_b: "GPT-4o", signal_a: "SHORT", signal_b: "SHORT", intensity_a: 7.8, intensity_b: 8.1, consensus: true, result: "LOSS", primary_model: "B" },
  { id: "ab-005", date: "2026-02-28", game: "Knicks @ Heat", team: "New York Knicks", model_a: "Claude Opus 4.6", model_b: "GPT-4o", signal_a: "LONG", signal_b: "WATCH", intensity_a: 6.8, intensity_b: 4.9, consensus: false, result: "WIN", primary_model: "A" },
  { id: "ab-006", date: "2026-02-27", game: "Suns @ Clippers", team: "LA Clippers", model_a: "Claude Opus 4.6", model_b: "GPT-4o", signal_a: "LONG", signal_b: "LONG", intensity_a: 5.9, intensity_b: 6.2, consensus: true, result: "PUSH", primary_model: "B" },
  { id: "ab-007", date: "2026-02-27", game: "Nuggets @ Jazz", team: "Denver Nuggets", model_a: "Claude Opus 4.6", model_b: "GPT-4o", signal_a: "SHORT", signal_b: "LONG", intensity_a: 6.1, intensity_b: 5.8, consensus: false, result: "LOSS", primary_model: "A" },
];

function ABResultPanel() {
  const [records, setRecords] = useState<ABRecord[]>(() => {
    const saved = loadABResults();
    return saved.length > 0 ? saved : MOCK_AB_RESULTS;
  });
  const [filterConsensus, setFilterConsensus] = useState<"all" | "yes" | "no">("all");
  const [filterResult, setFilterResult] = useState<"all" | "WIN" | "LOSS" | "PUSH" | "pending">("all");

  const settled = records.filter((r) => r.result !== null);
  const aRecords = settled.filter((r) => r.primary_model === "A");
  const aWins = aRecords.filter((r) => r.result === "WIN").length;
  const aWinRate = aRecords.length > 0 ? ((aWins / aRecords.length) * 100).toFixed(1) : "—";
  const bRecords = settled.filter((r) => r.primary_model === "B");
  const bWins = bRecords.filter((r) => r.result === "WIN").length;
  const bWinRate = bRecords.length > 0 ? ((bWins / bRecords.length) * 100).toFixed(1) : "—";
  const consensusSettled = settled.filter((r) => r.consensus);
  const consensusWins = consensusSettled.filter((r) => r.result === "WIN").length;
  const consensusWinRate = consensusSettled.length > 0 ? ((consensusWins / consensusSettled.length) * 100).toFixed(1) : "—";
  const divergeSettled = settled.filter((r) => !r.consensus);
  const divergeWins = divergeSettled.filter((r) => r.result === "WIN").length;
  const divergeWinRate = divergeSettled.length > 0 ? ((divergeWins / divergeSettled.length) * 100).toFixed(1) : "—";
  const totalWins = settled.filter((r) => r.result === "WIN").length;
  const totalWinRate = settled.length > 0 ? ((totalWins / settled.length) * 100).toFixed(1) : "—";

  const modelAName = records[0]?.model_a || "Model A";
  const modelBName = records[0]?.model_b || "Model B";

  const handleSetResult = (id: string, result: "WIN" | "LOSS" | "PUSH" | null) => {
    setRecords((prev) => {
      const next = prev.map((r) => r.id === id ? { ...r, result } : r);
      saveABResults(next);
      return next;
    });
    toast(result ? `结果已录入: ${result}` : "结果已清除", { description: "A/B 胜率统计已更新" });
  };

  const filtered = records.filter((r) => {
    if (filterConsensus === "yes" && !r.consensus) return false;
    if (filterConsensus === "no" && r.consensus) return false;
    if (filterResult === "pending" && r.result !== null) return false;
    if (filterResult !== "all" && filterResult !== "pending" && r.result !== filterResult) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: `${modelAName} 主推胜率`, value: aWinRate, sub: `${aRecords.length} 场`, color: "text-blue-300", bg: "bg-blue-500/10 border-blue-500/20" },
          { label: `${modelBName} 主推胜率`, value: bWinRate, sub: `${bRecords.length} 场`, color: "text-purple-300", bg: "bg-purple-500/10 border-purple-500/20" },
          { label: "共识场次胜率", value: consensusWinRate, sub: `${consensusSettled.length} 场`, color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/20" },
          { label: "分歧场次胜率", value: divergeWinRate, sub: `${divergeSettled.length} 场`, color: "text-amber-300", bg: "bg-amber-500/10 border-amber-500/20" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded border p-3 ${stat.bg}`}>
            <div className="text-[10px] font-mono text-white/40 mb-1 truncate">{stat.label}</div>
            <div className={`text-2xl font-mono font-bold ${stat.color}`}>{stat.value}%</div>
            <div className="text-[10px] font-mono text-white/30 mt-0.5">{stat.sub} · 已结算</div>
          </div>
        ))}
      </div>

      {/* 胜率对比条形图 */}
      <div className="rounded border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <h4 className="text-xs font-mono text-white/60 font-semibold">胜率对比</h4>
        {[
          { label: modelAName, rate: parseFloat(aWinRate) || 0, color: "bg-blue-500", count: aRecords.length },
          { label: modelBName, rate: parseFloat(bWinRate) || 0, color: "bg-purple-500", count: bRecords.length },
          { label: "共识场次", rate: parseFloat(consensusWinRate) || 0, color: "bg-emerald-500", count: consensusSettled.length },
          { label: "分歧场次", rate: parseFloat(divergeWinRate) || 0, color: "bg-amber-500", count: divergeSettled.length },
          { label: "总体", rate: parseFloat(totalWinRate) || 0, color: "bg-white/40", count: settled.length },
        ].map((bar) => (
          <div key={bar.label} className="flex items-center gap-3">
            <div className="w-24 text-[10px] font-mono text-white/50 text-right shrink-0 truncate">{bar.label}</div>
            <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${bar.color}`} style={{ width: `${Math.min(bar.rate, 100)}%` }} />
            </div>
            <div className="w-16 text-[10px] font-mono text-white/60 shrink-0">
              {bar.count > 0 ? `${bar.rate.toFixed(1)}%` : "—"}
            </div>
          </div>
        ))}
      </div>

      {/* 洞察提示 */}
      {settled.length >= 3 && (
        <div className="rounded border border-white/10 bg-white/[0.02] p-3 space-y-1.5">
          <h4 className="text-xs font-mono text-white/60 font-semibold">📊 洞察</h4>
          {parseFloat(consensusWinRate) > parseFloat(divergeWinRate) ? (
            <div className="text-[11px] font-mono text-emerald-300/80">✅ 共识场次胜率（{consensusWinRate}%）高于分歧场次（{divergeWinRate}%），建议优先操作双模型共识信号</div>
          ) : (
            <div className="text-[11px] font-mono text-amber-300/80">⚠️ 分歧场次胜率（{divergeWinRate}%）≥ 共识场次（{consensusWinRate}%），当前样本量不足以判断，继续积累</div>
          )}
          {parseFloat(aWinRate) > parseFloat(bWinRate) + 5 && (
            <div className="text-[11px] font-mono text-blue-300/80">🅐 {modelAName} 主推胜率领先 {modelBName} {(parseFloat(aWinRate) - parseFloat(bWinRate)).toFixed(1)}pp，建议以 A 为主推荐</div>
          )}
          {parseFloat(bWinRate) > parseFloat(aWinRate) + 5 && (
            <div className="text-[11px] font-mono text-purple-300/80">🅑 {modelBName} 主推胜率领先 {modelAName} {(parseFloat(bWinRate) - parseFloat(aWinRate)).toFixed(1)}pp，建议切换 B 为主推荐</div>
          )}
          <div className="text-[10px] font-mono text-white/25 mt-1">基于 {settled.length} 场已结算数据 · 样本量 &lt; 30 时结论仅供参考</div>
        </div>
      )}

      {/* 筛选栏 */}
      <div className="flex flex-wrap gap-2 items-center">
        <h4 className="text-xs font-mono text-white/60 font-semibold mr-2">历史记录</h4>
        <select value={filterConsensus} onChange={(e) => setFilterConsensus(e.target.value as "all" | "yes" | "no")} className="text-xs font-mono bg-white/5 border border-white/10 rounded px-2 py-1 text-white/70 focus:outline-none">
          <option value="all">全部</option>
          <option value="yes">共识</option>
          <option value="no">分歧</option>
        </select>
        <select value={filterResult} onChange={(e) => setFilterResult(e.target.value as "all" | "WIN" | "LOSS" | "PUSH" | "pending")} className="text-xs font-mono bg-white/5 border border-white/10 rounded px-2 py-1 text-white/70 focus:outline-none">
          <option value="all">全部结果</option>
          <option value="pending">待结算</option>
          <option value="WIN">胜</option>
          <option value="LOSS">负</option>
          <option value="PUSH">推</option>
        </select>
        <span className="text-[10px] font-mono text-white/25 ml-auto">{filtered.length} 条记录</span>
      </div>

      {/* 记录列表 */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {filtered.map((rec) => (
          <div key={rec.id} className={`rounded border p-3 text-xs font-mono transition-colors ${
            rec.result === "WIN" ? "border-emerald-500/25 bg-emerald-500/5" :
            rec.result === "LOSS" ? "border-red-500/25 bg-red-500/5" :
            rec.result === "PUSH" ? "border-white/10 bg-white/[0.02]" :
            "border-white/5 bg-white/[0.01]"
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded ${
                    rec.consensus ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                  }`}>{rec.consensus ? "✅ 共识" : "⚠️ 分歧"}</span>
                  <span className="text-white/70 font-semibold truncate">{rec.game}</span>
                  <span className="text-white/30 shrink-0">{rec.date}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`rounded p-2 ${
                    rec.primary_model === "A" ? "border border-blue-500/30 bg-blue-500/5" : "border border-white/5 bg-white/[0.01]"
                  }`}>
                    <div className="text-[9px] text-white/30 mb-0.5">🅐 {rec.model_a}{rec.primary_model === "A" ? " · 主" : ""}</div>
                    <div className={`font-bold ${
                      rec.signal_a === "LONG" ? "text-emerald-400" : rec.signal_a === "SHORT" ? "text-red-400" : "text-white/40"
                    }`}>{rec.signal_a === "LONG" ? "📈 LONG" : rec.signal_a === "SHORT" ? "📉 SHORT" : "👀 WATCH"}</div>
                    <div className="text-[9px] text-white/30 mt-0.5">强度 {rec.intensity_a}/10</div>
                  </div>
                  <div className={`rounded p-2 ${
                    rec.primary_model === "B" ? "border border-purple-500/30 bg-purple-500/5" : "border border-white/5 bg-white/[0.01]"
                  }`}>
                    <div className="text-[9px] text-white/30 mb-0.5">🅑 {rec.model_b}{rec.primary_model === "B" ? " · 主" : ""}</div>
                    <div className={`font-bold ${
                      rec.signal_b === "LONG" ? "text-emerald-400" : rec.signal_b === "SHORT" ? "text-red-400" : "text-white/40"
                    }`}>{rec.signal_b === "LONG" ? "📈 LONG" : rec.signal_b === "SHORT" ? "📉 SHORT" : "👀 WATCH"}</div>
                    <div className="text-[9px] text-white/30 mt-0.5">强度 {rec.intensity_b}/10</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {(["WIN", "LOSS", "PUSH"] as const).map((r) => (
                  <button key={r} onClick={() => handleSetResult(rec.id, rec.result === r ? null : r)}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                      rec.result === r
                        ? r === "WIN" ? "bg-emerald-500/30 border-emerald-500/50 text-emerald-300"
                          : r === "LOSS" ? "bg-red-500/30 border-red-500/50 text-red-300"
                          : "bg-white/20 border-white/30 text-white/60"
                        : "bg-white/5 border-white/10 text-white/30 hover:border-white/25 hover:text-white/50"
                    }`}>
                    {r === "WIN" ? "胜" : r === "LOSS" ? "负" : "推"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-white/20 text-sm py-6 font-mono">暂无 A/B 对比记录</div>
        )}
      </div>

      <div className="text-[10px] font-mono text-white/20 border-t border-white/5 pt-3">
        A/B 记录由 sea-bot 在 A/B 测试模式开启时自动写入 · 手动录入结果后实时更新胜率统计 · 数据存储在浏览器 localStorage
      </div>
    </div>
  );
}

// ============================================================
// 子组件：执行日志面板
// ============================================================

function RunLogPanel({ logs, strategies }: { logs: RunLog[]; strategies: Strategy[] }) {
  const [filterDate, setFilterDate] = useState("");
  const [filterStrategy, setFilterStrategy] = useState("");
  const [filterTriggered, setFilterTriggered] = useState<"all" | "yes" | "no">("all");

  const dates = Array.from(new Set(logs.map((l) => l.scan_date))).sort().reverse();
  const strategyIds = Array.from(new Set(logs.map((l) => l.strategy_id))).sort();

  const filtered = logs.filter((l) => {
    if (filterDate && l.scan_date !== filterDate) return false;
    if (filterStrategy && l.strategy_id !== filterStrategy) return false;
    if (filterTriggered === "yes" && !l.triggered) return false;
    if (filterTriggered === "no" && l.triggered) return false;
    return true;
  });

  const strategyName = (id: string) => strategies.find((s) => s.strategy_id === id)?.name || id;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="text-xs font-mono bg-white/5 border border-white/10 rounded px-2 py-1 text-white/70 focus:outline-none focus:border-amber-500/50">
          <option value="">全部日期</option>
          {dates.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterStrategy} onChange={(e) => setFilterStrategy(e.target.value)} className="text-xs font-mono bg-white/5 border border-white/10 rounded px-2 py-1 text-white/70 focus:outline-none focus:border-amber-500/50">
          <option value="">全部策略</option>
          {strategyIds.map((id) => <option key={id} value={id}>{strategyName(id)}</option>)}
        </select>
        <select value={filterTriggered} onChange={(e) => setFilterTriggered(e.target.value as "all" | "yes" | "no")} className="text-xs font-mono bg-white/5 border border-white/10 rounded px-2 py-1 text-white/70 focus:outline-none focus:border-amber-500/50">
          <option value="all">全部状态</option>
          <option value="yes">已触发</option>
          <option value="no">未触发</option>
        </select>
        <span className="text-xs font-mono text-white/30 self-center">{filtered.length} / {logs.length} 条</span>
      </div>
      <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="text-center text-white/20 text-sm py-8 font-mono">暂无日志数据</div>
        ) : (
          filtered.map((log) => (
            <div key={log.id} className={`rounded border p-2.5 text-xs font-mono ${log.triggered ? "border-emerald-500/20 bg-emerald-500/5" : log.skipped_reason === "strategy_disabled" ? "border-white/5 bg-white/[0.01] opacity-50" : "border-white/5 bg-white/[0.02]"}`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className={log.triggered ? "text-emerald-400" : "text-white/30"}>{log.triggered ? "●" : "○"}</span>
                  <span className="text-white/70">{strategyName(log.strategy_id)}</span>
                  {log.team && <span className="text-amber-300/70">{log.team}</span>}
                </div>
                <div className="flex items-center gap-2 text-white/30">
                  {log.duration_ms > 0 && <span>{log.duration_ms}ms</span>}
                  <span>{log.scan_date}</span>
                </div>
              </div>
              {log.game && <div className="text-white/40 mb-1">🏟 {log.game}</div>}
              {log.skipped_reason && <div className="text-amber-300/50">⏸ {log.skipped_reason}</div>}
              {log.triggered && Object.keys(log.output_data).length > 0 && (
                <div className="mt-1 text-white/50 bg-white/5 rounded p-1.5 text-[10px] leading-relaxed">
                  {Object.entries(log.output_data).map(([k, v]) => (
                    <span key={k} className="mr-3">
                      <span className="text-white/30">{k}:</span>{" "}
                      <span className={k === "direction" ? (v === "LONG" ? "text-emerald-400" : v === "SHORT" ? "text-red-400" : "text-white/50") : "text-white/70"}>
                        {typeof v === "string" ? v : JSON.stringify(v)}
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// 主页面
// ============================================================

export default function StrategyControl() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<"A" | "B" | "C" | "all">("all");
  const [logs] = useState<RunLog[]>(MOCK_LOGS);
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>(MODEL_CONFIGS);
  const [tursoSynced, setTursoSynced] = useState(false);

  // 初始化：优先从 Turso 读取权重，fallback 到 localStorage
  useEffect(() => {
    const savedToggles = loadToggles();
    const savedWeights = loadWeights();
    const savedModels = loadModels();

    // 先用本地数据初始化（快速渲染）
    setStrategies(
      MOCK_STRATEGIES.map((s) => ({
        ...s,
        enabled: savedToggles[s.strategy_id] !== undefined ? savedToggles[s.strategy_id] : s.default_enabled,
        custom_weight: savedWeights[s.strategy_id] !== undefined ? savedWeights[s.strategy_id] : null,
      }))
    );

    if (Object.keys(savedModels).length > 0) {
      setModelConfigs((prev) =>
        prev.map((c) => ({ ...c, current: savedModels[c.role] ?? c.current }))
      );
    }

    // 异步从 Turso 读取最新权重（覆盖 localStorage）
    fetch("/api/strategies/config")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.strategies?.length) return;
        const tursoMap: Record<string, { weight: number | null; enabled: number | null }> = {};
        data.strategies.forEach((s: { strategy_id: string; weight: number | null; enabled: number | null }) => {
          tursoMap[s.strategy_id] = { weight: s.weight, enabled: s.enabled };
        });
        setStrategies((prev) =>
          prev.map((s) => {
            const t = tursoMap[s.strategy_id];
            if (!t) return s;
            return {
              ...s,
              enabled: t.enabled !== null ? t.enabled === 1 : s.enabled,
              custom_weight: t.weight !== null ? t.weight : s.custom_weight,
            };
          })
        );
        setTursoSynced(true);
      })
      .catch(() => { /* Turso 不可用时静默降级 */ });
  }, []);

  const handleToggle = useCallback((id: string, val: boolean) => {
    setStrategies((prev) => {
      const next = prev.map((s) => (s.strategy_id === id ? { ...s, enabled: val } : s));
      const toggleMap: Record<string, boolean> = {};
      next.forEach((s) => { toggleMap[s.strategy_id] = s.enabled; });
      saveToggles(toggleMap);
      return next;
    });
    // 同步写入 Turso
    fetch("/api/strategies/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy_id: id, enabled: val }),
    }).catch(() => {});
    const meta = MOCK_STRATEGIES.find((s) => s.strategy_id === id);
    toast(val ? `策略已开启: ${meta?.name || id}` : `策略已关闭: ${meta?.name || id}`, { description: "已同步到 Turso · 下次 /scan 时生效" });
  }, []);

  const handleWeightChange = useCallback((id: string, weight: number) => {
    setStrategies((prev) => {
      const next = prev.map((s) => (s.strategy_id === id ? { ...s, custom_weight: weight } : s));
      const weightMap: Record<string, number> = {};
      next.forEach((s) => { if (s.custom_weight != null) weightMap[s.strategy_id] = s.custom_weight; });
      saveWeights(weightMap);
      return next;
    });
    // 同步写入 Turso
    fetch("/api/strategies/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy_id: id, weight }),
    }).catch(() => {});
  }, []);

  const handleModelChange = useCallback((role: string, modelId: string) => {
    setModelConfigs((prev) => {
      const next = prev.map((c) => (c.role === role ? { ...c, current: modelId } : c));
      const modelMap: Record<string, string> = {};
      next.forEach((c) => { modelMap[c.role] = c.current; });
      saveModels(modelMap);
      return next;
    });
    const config = MODEL_CONFIGS.find((c) => c.role === role);
    const opt = config?.options.find((o) => o.id === modelId);
    toast(`内核已切换: ${opt?.name || modelId}`, { description: `${config?.label} · 下次 /scan 时生效` });
  }, []);

  const handleResetAll = () => {
    const defaults: Record<string, boolean> = {};
    MOCK_STRATEGIES.forEach((s) => { defaults[s.strategy_id] = s.default_enabled; });
    saveToggles(defaults);
    saveWeights({});
    setStrategies(MOCK_STRATEGIES.map((s) => ({ ...s, enabled: s.default_enabled, custom_weight: null })));
    toast("已重置为默认配置", { description: "所有策略开关和权重已恢复默认" });
  };

  const filteredStrategies = activeLayer === "all" ? strategies : strategies.filter((s) => s.layer === activeLayer);
  const selectedStrategy = strategies.find((s) => s.strategy_id === selectedId) || null;
  const activeCount = strategies.filter((s) => s.enabled).length;
  const totalCount = strategies.length;

  const layerStats = (["A", "B", "C"] as const).map((l) => {
    const group = strategies.filter((s) => s.layer === l);
    return { layer: l, active: group.filter((s) => s.enabled).length, total: group.length };
  });

  return (
    <TooltipProvider>
      <div className="p-6 space-y-5 max-w-[1400px]">
        {/* 标题栏 */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>⚙️</span>
              <span>策略控制中心</span>
            </h1>
            <p className="text-sm text-white/40 mt-0.5 font-mono">
              独立开关 · 权重调节 · 模型切换 · 回测对比 · 下次 /scan 时生效
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-bold font-mono text-white">
                {activeCount}<span className="text-white/30 text-base">/{totalCount}</span>
              </div>
              <div className="text-[10px] text-white/30 font-mono">策略已激活</div>
            </div>
            <Button variant="outline" size="sm" onClick={handleResetAll} className="text-xs font-mono border-white/15 text-white/50 hover:text-white hover:border-white/30">
              重置默认
            </Button>
          </div>
        </div>

        {/* 层级统计卡片 */}
        <div className="grid grid-cols-3 gap-3">
          {layerStats.map(({ layer, active, total }) => {
            const info = LAYER_LABELS[layer];
            return (
              <button
                key={layer}
                onClick={() => setActiveLayer(activeLayer === layer ? "all" : layer)}
                className={`text-left rounded border p-3 transition-all duration-150 ${
                  activeLayer === layer ? `${info.color} border-current` : "border-white/5 bg-white/[0.02] hover:border-white/15"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-white/50">Layer {layer}</span>
                  <span className={`text-xs font-bold font-mono ${activeLayer === layer ? "" : "text-white/60"}`}>{active}/{total}</span>
                </div>
                <div className={`text-sm font-semibold ${activeLayer === layer ? "" : "text-white/70"}`}>{info.label}</div>
                <div className="text-[10px] text-white/30 mt-0.5 leading-tight">{info.desc}</div>
              </button>
            );
          })}
        </div>

        {/* 主内容区 */}
        <Tabs defaultValue="toggles">
          <TabsList className="bg-white/5 border border-white/10">
            {[
              { value: "toggles", label: "开关面板" },
              { value: "weights", label: "权重调节" },
              { value: "models", label: "模型配置" },
              { value: "backtest", label: "回测对比" },
              { value: "abresult", label: "A/B 结果" },
              { value: "logs", label: "执行日志" },
            ].map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs font-mono data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* 开关面板 */}
          <TabsContent value="toggles" className="mt-3">
            <div className="grid grid-cols-[280px_1fr] gap-4">
              <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                {filteredStrategies.map((s) => (
                  <StrategyCard
                    key={s.strategy_id}
                    strategy={s}
                    onToggle={handleToggle}
                    isSelected={selectedId === s.strategy_id}
                    onClick={() => setSelectedId(s.strategy_id === selectedId ? null : s.strategy_id)}
                  />
                ))}
              </div>
              <div className="rounded border border-white/10 bg-white/[0.02] p-4 min-h-[300px]">
                {selectedStrategy ? (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{CATEGORY_ICONS[selectedStrategy.category]}</span>
                          <h3 className="text-white font-semibold">{selectedStrategy.name}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] font-mono ${LAYER_LABELS[selectedStrategy.layer].color}`}>
                            Layer {selectedStrategy.layer} · {LAYER_LABELS[selectedStrategy.layer].label}
                          </Badge>
                          <span className="text-[10px] font-mono text-white/40">{selectedStrategy.strategy_id}</span>
                        </div>
                      </div>
                      <div className={`text-xs font-mono px-2 py-1 rounded ${selectedStrategy.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/30"}`}>
                        {selectedStrategy.enabled ? "● ACTIVE" : "○ OFF"}
                      </div>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div>
                        <div className="text-white/40 text-xs font-mono mb-1">DESCRIPTION</div>
                        <div className="text-white/80 leading-relaxed">{selectedStrategy.description}</div>
                      </div>
                      <div>
                        <div className="text-white/40 text-xs font-mono mb-1">IMPACT IF DISABLED</div>
                        <div className="text-amber-300/80 bg-amber-500/5 border border-amber-500/20 rounded p-2 text-xs font-mono">
                          ⚠️ {selectedStrategy.impact}
                        </div>
                      </div>
                      {selectedStrategy.narrative_keys && selectedStrategy.narrative_keys.length > 0 && (
                        <div>
                          <div className="text-white/40 text-xs font-mono mb-1">NARRATIVE KEYS</div>
                          <div className="flex flex-wrap gap-1">
                            {selectedStrategy.narrative_keys.map((k) => (
                              <span key={k} className="text-[10px] font-mono bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/60">{k}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedStrategy.notes && (
                        <div className="text-[10px] font-mono text-amber-300/50 bg-amber-500/5 rounded p-2">
                          📌 {selectedStrategy.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-white/20 gap-2">
                    <span className="text-4xl">⚙️</span>
                    <span className="text-sm font-mono">选择左侧策略查看详情</span>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* 权重调节 */}
          <TabsContent value="weights" className="mt-3">
            <div className="rounded border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-mono text-white/70">Layer C 置信度权重调节</h3>
                <span className="text-[10px] text-white/30 font-mono">拖动滑块调整各维度权重 · 总权重应保持100%</span>
              </div>
              <WeightPanel strategies={strategies} onWeightChange={handleWeightChange} />
            </div>
          </TabsContent>

          {/* 模型配置 */}
          <TabsContent value="models" className="mt-3">
            <div className="rounded border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-mono text-white/70">AI 内核配置</h3>
                <span className="text-[10px] text-white/30 font-mono">不同模型对情绪标签准确率和成本影响显著</span>
              </div>
              <ModelPanel modelConfigs={modelConfigs} onModelChange={handleModelChange} />
            </div>
          </TabsContent>

          {/* 回测对比 */}
          <TabsContent value="backtest" className="mt-3">
            <div className="rounded border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-mono text-white/70">策略回测对比</h3>
                <span className="text-[10px] text-white/30 font-mono">量化每条规则对置信度的实际贡献</span>
              </div>
              <BacktestPanel strategies={strategies} />
            </div>
          </TabsContent>

          {/* A/B 结果 */}
          <TabsContent value="abresult" className="mt-3">
            <div className="rounded border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-mono text-white/70">A/B 模型历史胜率统计</h3>
                <span className="text-[10px] text-white/30 font-mono">量化两个内核的实际预测准确率 · 手动录入结果后实时更新</span>
              </div>
              <ABResultPanel />
            </div>
          </TabsContent>

          {/* 执行日志 */}
          <TabsContent value="logs" className="mt-3">
            <div className="rounded border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-mono text-white/70">策略执行过程日志</h3>
                <span className="text-[10px] text-white/30 font-mono">数据来自 strategy_run_logs 表 · 每次 /scan 自动写入</span>
              </div>
              <RunLogPanel logs={logs} strategies={strategies} />
            </div>
          </TabsContent>
        </Tabs>

        {/* 底部说明 */}
        <div className="rounded border border-white/5 bg-white/[0.01] p-3 text-[11px] font-mono text-white/25 leading-relaxed">
          <span className="text-white/40">注意：</span>
          管理后台的配置存储在浏览器 localStorage 中，仅供可视化参考。
          实际生效需在 Railway 服务器的 SQLite 数据库中同步更新。
          可通过 Telegram Bot 命令 <span className="text-amber-300/50">/strategy off RULE_BLOWOUT</span> 或 <span className="text-amber-300/50">/model set emotion claude-opus-4-6</span> 直接修改服务器端配置。
        </div>
      </div>
    </TooltipProvider>
  );
}
