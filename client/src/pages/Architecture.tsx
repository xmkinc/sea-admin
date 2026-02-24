/*
 * Architecture — V6 Refactor Plan Viewer
 * Shows the 4-layer architecture, issues, migration plan
 * Design: Interactive architecture diagram with expandable sections
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Network,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Layers,
  ArrowRight,
  FileCode,
  ExternalLink,
  Bug,
  Zap,
  Database,
  Monitor,
  Cpu,
} from "lucide-react";

const EMPTY_STATE_IMG = "https://private-us-east-1.manuscdn.com/sessionFile/k8eakjmvwYx2PoANdIvc2n/sandbox/WigDM6MM8okDamK0aRRPUO-img-3_1771928051000_na1fn_c2VhLWVtcHR5LXN0YXRl.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvazhlYWtqbXZ3WXgyUG9BTmRJdmMybi9zYW5kYm94L1dpZ0RNNk1NOG9rRGFtSzBhUlJQVU8taW1nLTNfMTc3MTkyODA1MTAwMF9uYTFmbl9jMlZoTFdWdGNIUjVMWE4wWVhSbC5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=Wn~kokMsV0nkyc93CcelZGcvuUnXmA3TSQVdn2dm9qNakZJxeCv9KINsJqI~3IRfKb~REGac5mRBelWj-ttx7JpbLd~b5cRx8O9mM-KlprpYWlphCakDN1LBzRS2a~-3lMb19yBAaQq13sl6MeipkIWlR~Y6qxHARIFmPyj8oTlAaJU09Cgndj8vGQ4WRgLWSwTfT6TO2dc0Z7n55Z-znS0H9TSoXxpLaiXNQreKoObzXn4w4Bf7oJG5VbgJfyQlqhwUR2bZpuwEAt85ys1pfCACCDWF6gPSXEZeJg2G8W4IFxPbX8I~hbK0n49B2YmYPRPtiFr~vYyX8EZJymRz4w__";

interface Issue {
  id: number;
  title: string;
  severity: "fatal" | "severe" | "medium" | "minor";
  scope: string;
  detail: string;
}

const ISSUES: Issue[] = [
  { id: 1, severity: "fatal", title: "God Module: radar_scan.py 1297行", scope: "主流程", detail: "承担6种职责：ESPN数据获取、Perplexity调用、情绪分析、规则引擎、报告格式化、Telegram推送。" },
  { id: 2, severity: "fatal", title: "功能重复: radar_scan vs nba_scan_today", scope: "主流程", detail: "radar_scan.py(1297行)和nba_scan_today.py(795行)几乎是变体复制，共享7个函数。" },
  { id: 3, severity: "fatal", title: "循环依赖风险", scope: "全局", detail: "telegram_bot→radar_scan→llm_client→config，nba_scan_today→radar_scan(7个函数)。" },
  { id: 4, severity: "fatal", title: "数据结构无定义", scope: "全局", detail: "event、rule_result、score_result全部是裸dict，字段含义散落在20个文件中。" },
  { id: 5, severity: "severe", title: "llm_client.py 职责混杂", scope: "LLM层", detail: "696行混合了HTTP客户端、降级策略、Prompt模板、JSON解析、4种分析函数。" },
  { id: 6, severity: "severe", title: "odds_fetcher.py 过度膨胀", scope: "数据层", detail: "703行包含HTTP客户端、缓存、配额管理、限流器、球队名标准化、盘口分析。" },
  { id: 7, severity: "severe", title: "action_network/ import不规范", scope: "AN子系统", detail: "parser.py用相对路径import，reporter.py依赖openpyxl但未做可选依赖处理。" },
  { id: 8, severity: "severe", title: "球队名匹配逻辑散落5处", scope: "全局", detail: "_fuzzy_team、_team_match、_normalize_nba_team、_get_team_abbr、_team_name_in。" },
  { id: 9, severity: "medium", title: "unified_engine.py 孤岛模块", scope: "USE系统", detail: "808行插件式引擎与主流程完全隔离，Direction枚举与rules_engine重复。" },
  { id: 10, severity: "medium", title: "social_sentiment.py 孤岛模块", scope: "社交数据", detail: "549行依赖不存在的data_api.ApiClient，import会直接报错。" },
  { id: 11, severity: "medium", title: "config.py 配置与常量混杂", scope: "全局", detail: "API Key、URL、阈值常量、模型列表、情绪标签全部在一个文件。" },
  { id: 12, severity: "medium", title: "db_manager.py 原始SQL", scope: "持久化", detail: "603行纯SQL，无ORM、无连接池、无事务管理、无Migration。" },
  { id: 13, severity: "medium", title: "格式化逻辑分散", scope: "输出层", detail: "format_v52_prey_message在radar_scan，format_confidence_line在confidence_scorer等。" },
  { id: 14, severity: "medium", title: "错误处理不一致", scope: "全局", detail: "各模块自行try/except+print，无统一日志框架，无结构化错误类型。" },
  { id: 15, severity: "minor", title: "兼容函数堆积", scope: "维护性", detail: "grok_cross_validate等标记为[Compat]但永远不会被清理。" },
  { id: 16, severity: "minor", title: "无类型提示、无测试", scope: "质量", detail: "9747行代码无type hints、无单元测试、无集成测试。" },
];

interface ArchLayer {
  name: string;
  icon: typeof Monitor;
  color: string;
  modules: { name: string; files: number; desc: string }[];
}

const LAYERS: ArchLayer[] = [
  {
    name: "Presentation Layer（展示层）",
    icon: Monitor,
    color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    modules: [
      { name: "telegram_bot", files: 1, desc: "Telegram交互命令" },
      { name: "cli_runner", files: 1, desc: "GitHub Actions入口" },
      { name: "formatters/telegram_fmt", files: 1, desc: "Telegram格式化" },
      { name: "formatters/markdown_fmt", files: 1, desc: "Markdown格式化" },
      { name: "formatters/excel_fmt", files: 1, desc: "Excel报表" },
    ],
  },
  {
    name: "Orchestration Layer（编排层）",
    icon: Cpu,
    color: "text-primary border-primary/30 bg-primary/10",
    modules: [
      { name: "pipelines/upcoming_scan", files: 1, desc: "即将开赛扫描流水线" },
      { name: "pipelines/review_scan", files: 1, desc: "赛后复盘流水线" },
      { name: "pipelines/auto_review", files: 1, desc: "自动复盘流水线" },
      { name: "di_container", files: 1, desc: "依赖注入容器" },
    ],
  },
  {
    name: "Engine Layer（引擎层）",
    icon: Zap,
    color: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    modules: [
      { name: "engines/sentiment_analyzer", files: 1, desc: "情绪分析引擎" },
      { name: "engines/rules_engine", files: 1, desc: "V6宪法规则引擎" },
      { name: "engines/confidence_scorer", files: 1, desc: "8维度置信度评分" },
      { name: "engines/recency_engine", files: 1, desc: "近因效应时序引擎" },
      { name: "engines/odds_analyzer", files: 1, desc: "盘口分析引擎" },
      { name: "engines/narrative_detector", files: 1, desc: "叙事标签检测" },
    ],
  },
  {
    name: "Data Layer（数据层）",
    icon: Database,
    color: "text-red-400 border-red-500/30 bg-red-500/10",
    modules: [
      { name: "data/espn_client", files: 1, desc: "ESPN API客户端" },
      { name: "data/espn_news", files: 1, desc: "ESPN新闻引擎" },
      { name: "data/perplexity_client", files: 1, desc: "Perplexity搜索" },
      { name: "data/odds_client", files: 1, desc: "Odds API客户端" },
      { name: "data/action_network", files: 3, desc: "Action Network爬虫" },
      { name: "data/llm_gateway", files: 1, desc: "LLM统一网关" },
      { name: "data/db_repository", files: 1, desc: "数据库仓储" },
    ],
  },
];

const SEVERITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  fatal: { bg: "bg-red-500/15", text: "text-red-400", label: "致命" },
  severe: { bg: "bg-amber-500/15", text: "text-amber-400", label: "严重" },
  medium: { bg: "bg-primary/15", text: "text-primary", label: "中等" },
  minor: { bg: "bg-muted", text: "text-muted-foreground", label: "轻微" },
};

export default function Architecture() {
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);

  const toggleIssue = (id: number) => {
    const next = new Set(expandedIssues);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIssues(next);
  };

  const filteredIssues = severityFilter
    ? ISSUES.filter((i) => i.severity === severityFilter)
    : ISSUES;

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Network className="w-5 h-5 text-primary" />
            架构文档
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            V6.0 模块化重构方案 — Claude Opus 4.6 架构分析
          </p>
        </div>
        <a
          href="https://github.com/xmkinc/sports-emotion-arbitrage/blob/main/docs/ARCHITECTURE_REFACTOR_V6.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            完整文档
          </Button>
        </a>
      </div>

      {/* Stats Banner */}
      <div className="relative rounded-xl overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <img src={EMPTY_STATE_IMG} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="relative bg-card/90 backdrop-blur-sm border border-border rounded-xl p-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">总代码行数</div>
              <div className="font-mono text-xl font-bold text-foreground mt-1">9,747</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">模块文件</div>
              <div className="font-mono text-xl font-bold text-foreground mt-1">20</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">架构问题</div>
              <div className="font-mono text-xl font-bold text-red-400 mt-1">16</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">重构后文件</div>
              <div className="font-mono text-xl font-bold text-emerald-400 mt-1">34</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">架构层数</div>
              <div className="font-mono text-xl font-bold text-primary mt-1">4</div>
            </div>
          </div>
        </div>
      </div>

      {/* Four-Layer Architecture */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          目标架构：四层 + 横切关注点
        </h2>

        <div className="space-y-3">
          {LAYERS.map((layer, i) => {
            const Icon = layer.icon;
            return (
              <Card key={layer.name} className={`border-l-3 ${layer.color} bg-card`}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {layer.name}
                    <Badge variant="outline" className="font-mono text-[10px] ml-auto">
                      {layer.modules.reduce((sum, m) => sum + m.files, 0)} 文件
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {layer.modules.map((mod) => (
                      <div key={mod.name} className="bg-muted/30 rounded px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <FileCode className="w-3 h-3 text-muted-foreground" />
                          <code className="font-mono text-xs text-foreground">{mod.name}</code>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{mod.desc}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                {i < LAYERS.length - 1 && (
                  <div className="flex justify-center -mb-2 pb-1">
                    <ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Issues List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Bug className="w-4 h-4 text-red-400" />
            架构问题诊断 ({filteredIssues.length})
          </h2>
          <div className="flex items-center gap-1.5">
            {[null, "fatal", "severe", "medium", "minor"].map((sev) => (
              <button
                key={sev || "all"}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  severityFilter === sev
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {sev ? SEVERITY_STYLES[sev].label : "全部"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          {filteredIssues.map((issue) => {
            const style = SEVERITY_STYLES[issue.severity];
            const expanded = expandedIssues.has(issue.id);
            return (
              <div
                key={issue.id}
                className="bg-card border border-border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleIssue(issue.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/20 transition-colors"
                >
                  {expanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono ${style.bg} ${style.text}`}>
                    #{issue.id}
                  </span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono ${style.bg} ${style.text}`}>
                    {style.label}
                  </span>
                  <span className="text-sm text-foreground flex-1 truncate">{issue.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{issue.scope}</span>
                </button>
                {expanded && (
                  <div className="px-4 pb-3 pt-0 ml-8">
                    <p className="text-xs text-muted-foreground leading-relaxed">{issue.detail}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
