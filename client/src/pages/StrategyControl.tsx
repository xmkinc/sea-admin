/**
 * StrategyControl.tsx — 策略开关控制中心
 * Design: Dark tactical panel, monospace data, military-grade toggles
 * Layout: 左侧分层策略列表 + 右侧详情/日志面板
 */

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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

// ============================================================
// Mock 数据（Railway 部署时从 localStorage 读取，无后端）
// ============================================================

const MOCK_STRATEGIES: Strategy[] = [
  // Layer A
  { strategy_id: "ESPN_NEWS", layer: "A", name: "ESPN新闻引擎", description: "实时扫描ESPN新闻标题，自动检测伤病/交易/停赛关键词，为Perplexity搜索注入上下文", category: "data", impact: "影响伤病/交易标签触发，关闭后ESPN新闻不再触发叙事标签", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "" },
  { strategy_id: "PERPLEXITY_SENTIMENT", layer: "A", name: "Perplexity舆论搜索", description: "用Perplexity Sonar Pro Search对每支球队定向搜索X/Twitter舆论、球迷情绪", category: "data", impact: "关闭后舆论强度、X舆论、球迷情绪字段为空，仅依赖ESPN事实", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "" },
  { strategy_id: "ODDS_API", layer: "A", name: "Odds API盘口", description: "从The Odds API获取让分、大小分、赔率数据", category: "data", impact: "关闭后无盘口数据，CONF_SPREAD维度得分为0", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "" },
  { strategy_id: "ACTION_NETWORK", layer: "A", name: "Action Network公众投注", description: "解析Action Network数据，识别Sharp信号（顺向加码/逆向撤资/Fade Public）", category: "data", impact: "关闭后无Sharp信号，CONF_SHARP维度得分为0", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "" },
  { strategy_id: "CLAUDE_ANALYSIS", layer: "A", name: "Claude深度情绪分析", description: "用Claude Opus对ESPN战报+舆论数据做深度情绪判定，输出情绪标签、方向、强度", category: "data", impact: "关闭后情绪分析降级为纯规则检测，准确率下降", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "" },
  { strategy_id: "RECENCY_ENGINE", layer: "A", name: "近因效应引擎", description: "计算球队近期表现对当前情绪的放大效应（连胜/连败/H2H唤醒）", category: "data", impact: "关闭后近因效应修正为0，规则强度不受历史趋势影响", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "" },
  // Layer B
  { strategy_id: "RULE_HEARTBREAK_LOSS", layer: "B", name: "惜败规则", description: "绝杀/加时惜败 → 心理创伤延续 → 做空（SHORT）", category: "rule", impact: "关闭后惜败场景不触发做空信号", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", narrative_keys: ["HEARTBREAK_LOSS", "BUZZER_BEATER_LOSS", "OT_COLLAPSE", "BLOWN_LEAD"] },
  { strategy_id: "RULE_BLOWOUT", layer: "B", name: "大比分规则", description: "大比分被屠→公众过度悲观→做多 | 大比分大胜→公众过度乐观→做空", category: "rule", impact: "关闭后大比分场景不触发方向信号", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", narrative_keys: ["BLOWOUT_LOSS", "BLOWOUT_WIN"] },
  { strategy_id: "RULE_STREAK", layer: "B", name: "连胜/连败规则", description: "连胜极值→公众过度自信→做空 | 连败谷底→公众过度悲观→做多", category: "rule", impact: "关闭后连胜/连败趋势不触发方向信号", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", narrative_keys: ["PEAK_STREAK", "VALLEY_STREAK"] },
  { strategy_id: "RULE_REVERSAL", layer: "B", name: "逆转规则", description: "惊天逆转胜/逆转败 → 情绪过载 → 做空/做多", category: "rule", impact: "关闭后逆转场景不触发方向信号", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", narrative_keys: ["COMEBACK_WIN", "COMEBACK_LOSS", "NARROW_ESCAPE_WIN", "UNEXPECTED_HERO"] },
  { strategy_id: "RULE_INJURY_PANIC", layer: "B", name: "伤病恐慌规则", description: "球星伤病 → 公众恐慌 → 仅信息提示，不做方向判断", category: "rule", impact: "关闭后伤病事件不触发任何信号（仅信息层）", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", narrative_keys: ["INJURY_PANIC"] },
  { strategy_id: "RULE_TRADE", layer: "B", name: "交易传言规则", description: "卖方传言→球队士气受损→做空 | 买方传言→球队士气提升→做多", category: "rule", impact: "关闭后交易传言不触发方向信号", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", narrative_keys: ["TRADE_SHOCK", "TRADE_HYPE", "TRADE_RUMOR_SELLER", "TRADE_RUMOR_BUYER"] },
  { strategy_id: "RULE_REVENGE", layer: "B", name: "复仇之战规则", description: "再次遇到上次大败的对手 → 复仇动力 → 做多（弱队复仇强队不触发）", category: "rule", impact: "关闭后复仇场景不触发做多信号", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", narrative_keys: ["REVENGE_GAME"] },
  { strategy_id: "RULE_B2B_FATIGUE", layer: "B", name: "背靠背疲劳规则", description: "背靠背第二场 → 体力透支+防守强度下降 → 做空疲劳方", category: "rule", impact: "关闭后背靠背疲劳不触发做空信号", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", narrative_keys: ["B2B_FATIGUE"] },
  { strategy_id: "RULE_PUBLIC_FADE", layer: "B", name: "公众情绪反转规则", description: ">75%单边押注时做多被忽视方（Fade the Public）", category: "rule", impact: "关闭后极端单边押注不触发反向信号", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", narrative_keys: ["PUBLIC_SENTIMENT_REVERSE"] },
  // Layer C
  { strategy_id: "CONF_EMOTION", layer: "C", name: "情绪极端程度维度", description: "置信度评分中情绪极端程度维度（权重20%）", category: "confidence", impact: "关闭后情绪强度不影响置信度", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", weight_key: "emotion_score", default_weight: 0.20 },
  { strategy_id: "CONF_RULE_AUDIT", layer: "C", name: "V6宪法裁决维度", description: "置信度评分中规则引擎裁决强度维度（权重20%）", category: "confidence", impact: "关闭后规则强度不影响置信度", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", weight_key: "rule_audit", default_weight: 0.20 },
  { strategy_id: "CONF_SPREAD", layer: "C", name: "盘口价值维度", description: "置信度评分中盘口让分价值维度（权重15%）", category: "confidence", impact: "关闭后盘口数据不影响置信度", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", weight_key: "spread_value", default_weight: 0.15 },
  { strategy_id: "CONF_RECENCY", layer: "C", name: "近因效应维度", description: "置信度评分中近因效应维度（权重15%）", category: "confidence", impact: "关闭后近因效应不影响置信度", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", weight_key: "recency_effect", default_weight: 0.15 },
  { strategy_id: "CONF_RAG", layer: "C", name: "历史胜率维度", description: "置信度评分中同类事件历史胜率维度（权重10%）", category: "confidence", impact: "关闭后历史胜率不影响置信度", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", weight_key: "rag_history", default_weight: 0.10 },
  { strategy_id: "CONF_PREGAME_BUZZ", layer: "C", name: "赛前热度维度", description: "置信度评分中赛前热度+公众预期维度（权重10%）", category: "confidence", impact: "关闭后赛前热度不影响置信度", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", weight_key: "pregame_buzz", default_weight: 0.10 },
  { strategy_id: "CONF_SHARP", layer: "C", name: "Sharp信号维度", description: "置信度评分中Sharp信号对齐维度（权重5%）", category: "confidence", impact: "关闭后Sharp信号不影响置信度", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", weight_key: "sharp_alignment", default_weight: 0.05 },
  { strategy_id: "CONF_INJURY", layer: "C", name: "伤病影响维度", description: "置信度评分中伤病对下一场影响维度（权重5%）", category: "confidence", impact: "关闭后伤病不影响置信度", default_enabled: true, enabled: true, notes: "", updated_at: "", updated_by: "", weight_key: "injury_impact", default_weight: 0.05 },
];

const MOCK_LOGS: RunLog[] = [
  { id: 1, run_id: "2026-03-02-a1b2c3d4", scan_date: "2026-03-02", strategy_id: "ESPN_NEWS", team: "", game: "", triggered: true, skipped_reason: "", input_data: {}, output_data: { teams_cached: 14, alerts: 2 }, duration_ms: 1842, created_at: "2026-03-02T02:15:01Z" },
  { id: 2, run_id: "2026-03-02-a1b2c3d4", scan_date: "2026-03-02", strategy_id: "PERPLEXITY_SENTIMENT", team: "", game: "", triggered: true, skipped_reason: "", input_data: {}, output_data: { teams_searched: 14, results: 12 }, duration_ms: 18420, created_at: "2026-03-02T02:15:22Z" },
  { id: 3, run_id: "2026-03-02-a1b2c3d4", scan_date: "2026-03-02", strategy_id: "CLAUDE_ANALYSIS", team: "", game: "", triggered: true, skipped_reason: "", input_data: {}, output_data: { games_analyzed: 7, extreme_events: 3 }, duration_ms: 12300, created_at: "2026-03-02T02:15:45Z" },
  { id: 4, run_id: "2026-03-02-a1b2c3d4", scan_date: "2026-03-02", strategy_id: "RULE_BLOWOUT", team: "Milwaukee Bucks", game: "Bulls @ Bucks", triggered: true, skipped_reason: "", input_data: { emotion_tag: "BLOWOUT_LOSS", sentiment_intensity: 5, recency_score: 6.0 }, output_data: { direction: "LONG", strength: 6.1, reason: "大比分被屠 → 公众过度悲观 | 🔥情绪5/10 | ⚔️H2H0天前(唤醒75%)+0.6", signal: "MEDIUM" }, duration_ms: 2, created_at: "2026-03-02T02:16:01Z" },
  { id: 5, run_id: "2026-03-02-a1b2c3d4", scan_date: "2026-03-02", strategy_id: "RULE_HEARTBREAK_LOSS", team: "Chicago Bulls", game: "Bulls @ Bucks", triggered: false, skipped_reason: "", input_data: { emotion_tag: "", sentiment_intensity: 8, recency_score: 0 }, output_data: { direction: "WATCH", strength: 3.0, reason: "无匹配的情绪套利场景", signal: "LOW" }, duration_ms: 1, created_at: "2026-03-02T02:16:01Z" },
  { id: 6, run_id: "2026-03-01-e5f6g7h8", scan_date: "2026-03-01", strategy_id: "RULE_BLOWOUT", team: "Boston Celtics", game: "Nets @ Celtics", triggered: true, skipped_reason: "", input_data: { emotion_tag: "BLOWOUT_WIN", sentiment_intensity: 9, recency_score: 8.5 }, output_data: { direction: "SHORT", strength: 8.2, reason: "大比分大胜 → 公众过度乐观 | 🔥情绪9/10 | 📈连续3场同向+1.2", signal: "HIGH" }, duration_ms: 2, created_at: "2026-03-01T02:18:22Z" },
];

// ============================================================
// 本地存储持久化
// ============================================================

const STORAGE_KEY = "sea_strategy_toggles";

function loadToggles(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToggles(toggles: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toggles));
}

// ============================================================
// 组件
// ============================================================

const LAYER_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  A: { label: "数据采集", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", desc: "控制哪些数据源被激活，影响分析输入质量" },
  B: { label: "规则引擎", color: "bg-amber-500/20 text-amber-300 border-amber-500/30", desc: "控制哪些情绪套利规则参与方向判断" },
  C: { label: "置信度权重", color: "bg-purple-500/20 text-purple-300 border-purple-500/30", desc: "控制置信度评分的各维度是否参与计算" },
};

const CATEGORY_ICONS: Record<string, string> = {
  data: "⚡",
  rule: "⚖️",
  confidence: "📊",
};

function StrategyCard({
  strategy,
  onToggle,
  isSelected,
  onClick,
}: {
  strategy: Strategy;
  onToggle: (id: string, val: boolean) => void;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`
        group relative cursor-pointer rounded border px-3 py-2.5 transition-all duration-150
        ${isSelected
          ? "border-amber-500/60 bg-amber-500/10"
          : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
        }
      `}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm shrink-0">{CATEGORY_ICONS[strategy.category]}</span>
          <span className={`text-xs font-mono truncate ${strategy.enabled ? "text-white/90" : "text-white/30 line-through"}`}>
            {strategy.name}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {!strategy.default_enabled && (
            <span className="text-[10px] text-white/30 font-mono">默认关</span>
          )}
          <Switch
            checked={strategy.enabled}
            onCheckedChange={(val) => onToggle(strategy.strategy_id, val)}
            className="scale-75 origin-right"
          />
        </div>
      </div>
      {strategy.enabled ? (
        <div className="mt-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-[10px] text-emerald-400/70 font-mono">ACTIVE</span>
        </div>
      ) : (
        <div className="mt-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
          <span className="text-[10px] text-white/30 font-mono">DISABLED</span>
        </div>
      )}
    </div>
  );
}

function StrategyDetail({ strategy }: { strategy: Strategy | null }) {
  if (!strategy) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/20 gap-2">
        <span className="text-4xl">⚙️</span>
        <span className="text-sm font-mono">选择左侧策略查看详情</span>
      </div>
    );
  }

  const layerInfo = LAYER_LABELS[strategy.layer];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{CATEGORY_ICONS[strategy.category]}</span>
            <h3 className="text-white font-semibold">{strategy.name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] font-mono ${layerInfo.color}`}>
              Layer {strategy.layer} · {layerInfo.label}
            </Badge>
            <span className="text-[10px] font-mono text-white/40">{strategy.strategy_id}</span>
          </div>
        </div>
        <div className={`text-xs font-mono px-2 py-1 rounded ${strategy.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/30"}`}>
          {strategy.enabled ? "● ACTIVE" : "○ OFF"}
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <div className="text-white/40 text-xs font-mono mb-1">DESCRIPTION</div>
          <div className="text-white/80 leading-relaxed">{strategy.description}</div>
        </div>
        <div>
          <div className="text-white/40 text-xs font-mono mb-1">IMPACT IF DISABLED</div>
          <div className="text-amber-300/80 leading-relaxed bg-amber-500/5 border border-amber-500/20 rounded p-2 text-xs font-mono">
            ⚠️ {strategy.impact}
          </div>
        </div>
        {strategy.narrative_keys && strategy.narrative_keys.length > 0 && (
          <div>
            <div className="text-white/40 text-xs font-mono mb-1">NARRATIVE KEYS</div>
            <div className="flex flex-wrap gap-1">
              {strategy.narrative_keys.map((k) => (
                <span key={k} className="text-[10px] font-mono bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/60">
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}
        {strategy.weight_key && (
          <div>
            <div className="text-white/40 text-xs font-mono mb-1">CONFIDENCE WEIGHT</div>
            <div className="flex items-center gap-3">
              <span className="text-white/60 font-mono text-xs">{strategy.weight_key}</span>
              <span className="text-purple-300 font-mono font-bold">
                {strategy.custom_weight != null
                  ? `${(strategy.custom_weight * 100).toFixed(0)}%`
                  : `${((strategy.default_weight || 0) * 100).toFixed(0)}%`}
              </span>
              {strategy.custom_weight != null && (
                <span className="text-[10px] text-amber-300/60 font-mono">(自定义)</span>
              )}
            </div>
          </div>
        )}
        {strategy.updated_at && (
          <div className="text-[10px] text-white/20 font-mono border-t border-white/5 pt-2">
            最后修改: {strategy.updated_at} by {strategy.updated_by}
          </div>
        )}
      </div>
    </div>
  );
}

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

  const strategyName = (id: string) =>
    strategies.find((s) => s.strategy_id === id)?.name || id;

  return (
    <div className="space-y-3">
      {/* 过滤器 */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="text-xs font-mono bg-white/5 border border-white/10 rounded px-2 py-1 text-white/70 focus:outline-none focus:border-amber-500/50"
        >
          <option value="">全部日期</option>
          {dates.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={filterStrategy}
          onChange={(e) => setFilterStrategy(e.target.value)}
          className="text-xs font-mono bg-white/5 border border-white/10 rounded px-2 py-1 text-white/70 focus:outline-none focus:border-amber-500/50"
        >
          <option value="">全部策略</option>
          {strategyIds.map((id) => <option key={id} value={id}>{strategyName(id)}</option>)}
        </select>
        <select
          value={filterTriggered}
          onChange={(e) => setFilterTriggered(e.target.value as "all" | "yes" | "no")}
          className="text-xs font-mono bg-white/5 border border-white/10 rounded px-2 py-1 text-white/70 focus:outline-none focus:border-amber-500/50"
        >
          <option value="all">全部状态</option>
          <option value="yes">已触发</option>
          <option value="no">未触发</option>
        </select>
        <span className="text-xs font-mono text-white/30 self-center">
          {filtered.length} / {logs.length} 条
        </span>
      </div>

      {/* 日志列表 */}
      <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="text-center text-white/20 text-sm py-8 font-mono">暂无日志数据</div>
        ) : (
          filtered.map((log) => (
            <div
              key={log.id}
              className={`rounded border p-2.5 text-xs font-mono ${
                log.triggered
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : log.skipped_reason === "strategy_disabled"
                  ? "border-white/5 bg-white/[0.01] opacity-50"
                  : "border-white/5 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className={`${log.triggered ? "text-emerald-400" : "text-white/30"}`}>
                    {log.triggered ? "●" : "○"}
                  </span>
                  <span className="text-white/70">{strategyName(log.strategy_id)}</span>
                  {log.team && (
                    <span className="text-amber-300/70">{log.team}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-white/30">
                  {log.duration_ms > 0 && <span>{log.duration_ms}ms</span>}
                  <span>{log.scan_date}</span>
                </div>
              </div>
              {log.game && (
                <div className="text-white/40 mb-1">🏟 {log.game}</div>
              )}
              {log.skipped_reason && (
                <div className="text-amber-300/50">⏸ {log.skipped_reason}</div>
              )}
              {log.triggered && log.output_data && Object.keys(log.output_data).length > 0 && (
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

  // 初始化：从 localStorage 加载开关状态
  useEffect(() => {
    const saved = loadToggles();
    setStrategies(
      MOCK_STRATEGIES.map((s) => ({
        ...s,
        enabled: saved[s.strategy_id] !== undefined ? saved[s.strategy_id] : s.default_enabled,
      }))
    );
  }, []);

  const handleToggle = useCallback((id: string, val: boolean) => {
    setStrategies((prev) => {
      const next = prev.map((s) => (s.strategy_id === id ? { ...s, enabled: val } : s));
      const toggleMap: Record<string, boolean> = {};
      next.forEach((s) => { toggleMap[s.strategy_id] = s.enabled; });
      saveToggles(toggleMap);
      return next;
    });
    const meta = MOCK_STRATEGIES.find((s) => s.strategy_id === id);
    toast(val ? `策略已开启: ${meta?.name || id}` : `策略已关闭: ${meta?.name || id}`, {
      description: "下次 /scan 时生效",
    });
  }, []);

  const handleResetAll = () => {
    const defaults: Record<string, boolean> = {};
    MOCK_STRATEGIES.forEach((s) => { defaults[s.strategy_id] = s.default_enabled; });
    saveToggles(defaults);
    setStrategies(MOCK_STRATEGIES.map((s) => ({ ...s, enabled: s.default_enabled })));
    toast("已重置为默认配置", { description: "所有策略已恢复默认开关状态" });
  };

  const filtered = activeLayer === "all"
    ? strategies
    : strategies.filter((s) => s.layer === activeLayer);

  const selectedStrategy = strategies.find((s) => s.strategy_id === selectedId) || null;

  const activeCount = strategies.filter((s) => s.enabled).length;
  const totalCount = strategies.length;

  // 按层统计
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
              独立开关每个分析策略 · 过程日志追踪 · 下次 /scan 时生效
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-bold font-mono text-white">
                {activeCount}<span className="text-white/30 text-base">/{totalCount}</span>
              </div>
              <div className="text-[10px] text-white/30 font-mono">策略已激活</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetAll}
              className="text-xs font-mono border-white/15 text-white/50 hover:text-white hover:border-white/30"
            >
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
                className={`
                  text-left rounded border p-3 transition-all duration-150
                  ${activeLayer === layer
                    ? `${info.color} border-current`
                    : "border-white/5 bg-white/[0.02] hover:border-white/15"
                  }
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-white/50">Layer {layer}</span>
                  <span className={`text-xs font-bold font-mono ${activeLayer === layer ? "" : "text-white/60"}`}>
                    {active}/{total}
                  </span>
                </div>
                <div className={`text-sm font-semibold ${activeLayer === layer ? "" : "text-white/70"}`}>
                  {info.label}
                </div>
                <div className="text-[10px] text-white/30 mt-0.5 leading-tight">{info.desc}</div>
              </button>
            );
          })}
        </div>

        {/* 主内容区 */}
        <Tabs defaultValue="toggles">
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger value="toggles" className="text-xs font-mono data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">
              开关面板
            </TabsTrigger>
            <TabsTrigger value="logs" className="text-xs font-mono data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">
              执行日志
            </TabsTrigger>
          </TabsList>

          <TabsContent value="toggles" className="mt-3">
            <div className="grid grid-cols-[280px_1fr] gap-4">
              {/* 左侧策略列表 */}
              <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                {filtered.map((s) => (
                  <StrategyCard
                    key={s.strategy_id}
                    strategy={s}
                    onToggle={handleToggle}
                    isSelected={selectedId === s.strategy_id}
                    onClick={() => setSelectedId(s.strategy_id === selectedId ? null : s.strategy_id)}
                  />
                ))}
              </div>

              {/* 右侧详情 */}
              <div className="rounded border border-white/10 bg-white/[0.02] p-4 min-h-[300px]">
                <StrategyDetail strategy={selectedStrategy} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="logs" className="mt-3">
            <div className="rounded border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-mono text-white/70">策略执行过程日志</h3>
                <span className="text-[10px] text-white/30 font-mono">
                  数据来自 strategy_run_logs 表 · 每次 /scan 自动写入
                </span>
              </div>
              <RunLogPanel logs={logs} strategies={strategies} />
            </div>
          </TabsContent>
        </Tabs>

        {/* 底部说明 */}
        <div className="rounded border border-white/5 bg-white/[0.01] p-3 text-[11px] font-mono text-white/25 leading-relaxed">
          <span className="text-white/40">注意：</span>
          管理后台的开关状态存储在浏览器 localStorage 中，仅供可视化参考。
          实际生效需在 Railway 服务器的 SQLite 数据库（strategy_toggles 表）中同步更新。
          可通过 Telegram Bot 命令 <span className="text-amber-300/50">/strategy off RULE_BLOWOUT</span> 直接修改服务器端开关状态。
        </div>
      </div>
    </TooltipProvider>
  );
}
