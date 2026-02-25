/*
 * SystemConfig — System Configuration Viewer
 * Shows all config parameters, API models, thresholds
 * Design: Grouped config sections with monospace values
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Zap,
  Shield,
  Brain,
  Target,
  TrendingUp,
  AlertTriangle,
  Database,
  Bot,
} from "lucide-react";

interface ConfigItem {
  key: string;
  value: string;
  desc: string;
  type?: "string" | "number" | "model" | "url";
}

const PERPLEXITY_CONFIG: ConfigItem[] = [
  { key: "PERPLEXITY_MODEL", value: "perplexity/sonar-pro-search", desc: "V5.9 主引擎：最强搜索（快+准）", type: "model" },
  { key: "PERPLEXITY_FALLBACK", value: "perplexity/sonar-reasoning-pro", desc: "一级降级：推理搜索", type: "model" },
  { key: "PERPLEXITY_FALLBACK_2", value: "perplexity/sonar-pro", desc: "二级降级：Sonar Pro", type: "model" },
  { key: "PERPLEXITY_BACKEND", value: "openrouter", desc: "搜索引擎只走OpenRouter" },
  { key: "PERPLEXITY_TIMEOUT", value: "60s", desc: "V5.9 单次调用超时", type: "number" },
];

const ANALYSIS_CONFIG: ConfigItem[] = [
  { key: "ANALYSIS_MODEL_PRIMARY", value: "google/gemini-3.1-pro-preview", desc: "主引擎：Gemini 3.1 Pro（推理+分析能力强）", type: "model" },
  { key: "ANALYSIS_MODEL_PRIMARY_BACKEND", value: "openrouter", desc: "主引擎后端" },
  { key: "ANALYSIS_MODEL_FALLBACK", value: "google/gemini-3-pro-preview", desc: "一级降级：Gemini 3 Pro", type: "model" },
  { key: "ANALYSIS_MODEL_FALLBACK_BACKEND", value: "openrouter", desc: "一级降级后端" },
  { key: "ANALYSIS_MODEL_FALLBACK_2", value: "google/gemini-2.5-pro", desc: "二级降级：Gemini 2.5 Pro", type: "model" },
  { key: "ANALYSIS_MODEL_FALLBACK_2_BACKEND", value: "openrouter", desc: "二级降级后端" },
  { key: "ANALYSIS_MODEL_FALLBACK_3", value: "google/gemini-2.5-flash", desc: "三级降级：Gemini 2.5 Flash（兜底）", type: "model" },
  { key: "ANALYSIS_MODEL_FALLBACK_3_BACKEND", value: "openrouter", desc: "三级降级后端" },
  { key: "max_tokens", value: "1500", desc: "情绪分析最大token数", type: "number" },
];

const MULTI_MODEL_POOL: { name: string; model: string; backend: string }[] = [
  { name: "Gemini-3.1-Pro", model: "google/gemini-3.1-pro-preview", backend: "openrouter" },
  { name: "Gemini-3-Pro", model: "google/gemini-3-pro-preview", backend: "openrouter" },
  { name: "Gemini-2.5-Pro", model: "google/gemini-2.5-pro", backend: "openrouter" },
  { name: "Gemini-2.5-Flash", model: "google/gemini-2.5-flash", backend: "openrouter" },
  { name: "Claude-Opus-4.6", model: "anthropic/claude-opus-4.6", backend: "openrouter" },
  { name: "Claude-Sonnet-4", model: "anthropic/claude-sonnet-4", backend: "openrouter" },
];

const THRESHOLD_CONFIG: ConfigItem[] = [
  { key: "RAG_HOT_THRESHOLD", value: "70.0", desc: "RAG热门阈值", type: "number" },
  { key: "RAG_DANGER_THRESHOLD", value: "40.0", desc: "RAG危险阈值", type: "number" },
  { key: "RAG_MIN_SAMPLES", value: "3", desc: "RAG最小样本数", type: "number" },
  { key: "SPREAD_SHIFT_THRESHOLD_NBA", value: "2.0", desc: "盘口偏差阈值（NBA）", type: "number" },
  { key: "REVENGE_LOOKBACK_DAYS", value: "14", desc: "复仇回溯天数", type: "number" },
  { key: "BLOODY_PREY_SENTIMENT_THRESHOLD", value: "8", desc: "血腥猎物情绪阈值", type: "number" },
  { key: "MAX_DAILY_BETS", value: "3", desc: "单日投注上限", type: "number" },
  { key: "PARLAY_BLOCK", value: "True", desc: "串关绝对禁止" },
  { key: "ODDS_RLM_THRESHOLD", value: "1.5", desc: "逆向盘口偏移检测阈值", type: "number" },
];

const EMOTION_TAGS = [
  "大比分屠杀", "逆天绝杀", "1分惜败心态受损", "惊天逆转",
  "孤胆英雄炸裂数据", "连胜势能极值", "连败势能极值",
  "伤病恐慌", "交易传言", "复仇之战",
];

const ESPN_NEWS_TAGS = [
  { tag: "INJURY_PANIC", label: "伤病恐慌", color: "text-red-400 bg-red-500/10 border-red-500/30" },
  { tag: "TRADE_SHOCK", label: "交易震荡", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  { tag: "SUSPENSION", label: "停赛", color: "text-red-400 bg-red-500/10 border-red-500/30" },
  { tag: "COACHING_CHANGE", label: "教练变动", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  { tag: "STAR_PERFORMANCE", label: "球星爆发", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  { tag: "LOSING_STREAK", label: "连败", color: "text-red-400 bg-red-500/10 border-red-500/30" },
  { tag: "WINNING_STREAK", label: "连胜", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  { tag: "BLOWOUT_LOSS", label: "惨败", color: "text-red-400 bg-red-500/10 border-red-500/30" },
  { tag: "BUZZER_BEATER", label: "绝杀", color: "text-primary bg-primary/10 border-primary/30" },
  { tag: "COMEBACK_WIN", label: "逆转胜", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  { tag: "RIVALRY_GAME", label: "宿敌对决", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  { tag: "PLAYOFF_RACE", label: "季后赛争夺", color: "text-primary bg-primary/10 border-primary/30" },
  { tag: "ROOKIE_WATCH", label: "新秀观察", color: "text-primary bg-primary/10 border-primary/30" },
  { tag: "CONTRACT_DISPUTE", label: "合同纠纷", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  { tag: "TEAM_CHEMISTRY", label: "球队化学反应", color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  { tag: "REST_DAY", label: "轮休", color: "text-muted-foreground bg-muted/50 border-muted-foreground/30" },
];

function ConfigRow({ item }: { item: ConfigItem }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <code className="font-mono text-xs text-foreground">{item.key}</code>
        <div className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</div>
      </div>
      <div className="shrink-0 ml-4">
        {item.type === "model" ? (
          <Badge variant="outline" className="font-mono text-[10px] border-primary/30 text-primary">
            {item.value}
          </Badge>
        ) : item.type === "number" ? (
          <span className="font-mono text-sm text-amber-400">{item.value}</span>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">{item.value}</span>
        )}
      </div>
    </div>
  );
}

export default function SystemConfig() {
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          系统配置
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          V5.9.4 配置参数总览 — 模型、阈值、标签、风控
        </p>
      </div>

      <Tabs defaultValue="models" className="space-y-4">
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="models" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            AI模型
          </TabsTrigger>
          <TabsTrigger value="thresholds" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            阈值参数
          </TabsTrigger>
          <TabsTrigger value="tags" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            标签系统
          </TabsTrigger>
        </TabsList>

        {/* Models Tab */}
        <TabsContent value="models" className="space-y-4">
          {/* Perplexity */}
          <Card className="data-card bg-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Perplexity 舆论搜索引擎
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="divide-y divide-border">
                {PERPLEXITY_CONFIG.map((item) => (
                  <ConfigRow key={item.key} item={item} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Analysis Engine */}
          <Card className="data-card bg-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <Brain className="w-4 h-4 text-emerald-400" />
                情绪分析引擎
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="divide-y divide-border">
                {ANALYSIS_CONFIG.map((item) => (
                  <ConfigRow key={item.key} item={item} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Multi-model pool */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-400" />
                多模型对比池
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {MULTI_MODEL_POOL.map((m) => (
                  <div key={m.name} className="flex items-center justify-between bg-muted/30 rounded px-3 py-2">
                    <span className="text-sm text-foreground">{m.name}</span>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-[10px] text-muted-foreground">{m.model}</code>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono ${
                          m.backend === "openrouter"
                            ? "border-primary/30 text-primary"
                            : "border-emerald-500/30 text-emerald-400"
                        }`}
                      >
                        {m.backend}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Thresholds Tab */}
        <TabsContent value="thresholds" className="space-y-4">
          <Card className="data-card bg-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                核心阈值参数
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="divide-y divide-border">
                {THRESHOLD_CONFIG.map((item) => (
                  <ConfigRow key={item.key} item={item} />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Odds Quota Thresholds */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Odds API 配额分级
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { level: "CRITICAL", threshold: 5, color: "text-red-400 border-red-500/30 bg-red-500/10", desc: "所有请求停止" },
                  { level: "HIGH", threshold: 20, color: "text-amber-400 border-amber-500/30 bg-amber-500/10", desc: "仅HIGH优先级" },
                  { level: "NORMAL", threshold: 50, color: "text-primary border-primary/30 bg-primary/10", desc: "HIGH+NORMAL" },
                  { level: "LOW", threshold: 100, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", desc: "全部放行" },
                ].map((q) => (
                  <div key={q.level} className={`rounded-lg border p-3 ${q.color}`}>
                    <div className="font-mono text-xs font-semibold">{q.level}</div>
                    <div className="font-mono text-lg font-bold mt-1">&lt; {q.threshold}</div>
                    <div className="text-[10px] mt-0.5 opacity-80">{q.desc}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Cache TTL */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                缓存 TTL 配置
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-1.5">
                {[
                  { key: "ODDS_CACHE_TTL_UPCOMING", value: "300s (5min)", desc: "即将开赛盘口" },
                  { key: "ODDS_CACHE_TTL_HISTORICAL", value: "86400s (24h)", desc: "历史盘口" },
                  { key: "ODDS_CACHE_TTL_EVENT", value: "600s (10min)", desc: "单场深度盘口" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between bg-muted/30 rounded px-3 py-2">
                    <div>
                      <code className="font-mono text-xs text-foreground">{item.key}</code>
                      <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                    </div>
                    <span className="font-mono text-xs text-amber-400">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tags Tab */}
        <TabsContent value="tags" className="space-y-4">
          {/* Emotion Tags */}
          <Card className="data-card bg-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                情绪标签（篮球专用）
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {EMOTION_TAGS.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="font-mono text-xs border-amber-500/30 text-amber-400 bg-amber-500/5"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ESPN News Narrative Tags */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                ESPN News 叙事标签（16条自动检测）
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {ESPN_NEWS_TAGS.map((t) => (
                  <div key={t.tag} className={`rounded-md border px-2.5 py-1.5 ${t.color}`}>
                    <div className="font-mono text-[10px] opacity-70">{t.tag}</div>
                    <div className="text-xs font-medium mt-0.5">{t.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Revenge Trigger Tags */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-400" />
                复仇盘口陷阱触发标签
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {["大比分屠杀", "逆天绝杀", "1分惜败心态受损", "惊天逆转"].map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="font-mono text-xs border-red-500/30 text-red-400 bg-red-500/5"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                回溯窗口: <span className="font-mono text-foreground">14天</span> | 
                盘口加深: <span className="font-mono text-foreground">NBA +1.0</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
