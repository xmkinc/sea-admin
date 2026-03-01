/**
 * OddsUpload — 盘口数据上传与前置分析
 * 设计：深色战术面板，与整体主题一致
 *
 * 功能：
 * 1. 支持文本粘贴或结构化输入盘口数据
 * 2. 前置分析：调用规则引擎判断信号价值（不触发推送）
 * 3. 本地 localStorage 存储，/scan 时自动融合
 * 4. 支持查看历史上传记录和清除
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Upload,
  Zap,
  Clock,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Database,
  FileText,
  Plus,
} from "lucide-react";

// ─── 类型定义 ────────────────────────────────────────────────────────────────

interface OddsEntry {
  homeTeam: string;
  awayTeam: string;
  spread: string;       // 让分，如 "-3.5" 表示主队让3.5
  overUnder: string;    // 大小分
  gameTime: string;     // 比赛时间（北京时间）
  notes: string;        // 备注（伤病/交易传言等）
}

interface AnalysisSignal {
  rule: string;
  label: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  confidence: number;   // 0-10
  reason: string;
  color: string;
}

interface UploadedOdds {
  id: string;
  timestamp: string;
  entry: OddsEntry;
  signals: AnalysisSignal[];
  overallScore: number;
  recommendation: string;
  status: "PENDING" | "MERGED" | "EXPIRED";
}

// ─── 规则引擎前置分析（纯前端逻辑，不调用API）────────────────────────────────

function analyzeOdds(entry: OddsEntry): { signals: AnalysisSignal[]; score: number; recommendation: string } {
  const signals: AnalysisSignal[] = [];
  const notes = entry.notes.toLowerCase();
  const spreadNum = parseFloat(entry.spread);

  // 规则1：伤病恐慌 — 关键球员伤病导致盘口偏移
  if (notes.includes("伤") || notes.includes("injury") || notes.includes("out") || notes.includes("questionable")) {
    const isStarInjury = notes.includes("主力") || notes.includes("全明星") || notes.includes("star") || notes.includes("mvp");
    signals.push({
      rule: "INJURY_PANIC",
      label: "伤病恐慌",
      direction: "LONG",
      confidence: isStarInjury ? 7.5 : 5.5,
      reason: isStarInjury
        ? "主力球员伤病，公众过度反应，盘口可能高估影响，押受让方有价值"
        : "球员伤病信息，需结合盘口偏移幅度判断",
      color: "text-red-400",
    });
  }

  // 规则2：交易传言 — 球队内部不稳定
  if (notes.includes("交易") || notes.includes("trade") || notes.includes("传言") || notes.includes("rumor")) {
    signals.push({
      rule: "TRADE_SHOCK",
      label: "交易传言",
      direction: "SHORT",
      confidence: 6.0,
      reason: "交易传言导致球队士气不稳，押让分方（做空）有价值",
      color: "text-amber-400",
    });
  }

  // 规则3：大让分（超过8分）— 公众过度看好强队
  if (!isNaN(spreadNum) && Math.abs(spreadNum) >= 8) {
    signals.push({
      rule: "PUBLIC_FADE",
      label: "公众情绪反转",
      direction: "LONG",
      confidence: 6.5,
      reason: `让分达 ${Math.abs(spreadNum)} 分，公众过度押强队，弱队受让有价值（历史胜率约58%）`,
      color: "text-blue-400",
    });
  }

  // 规则4：小让分（1.5-3分）— 接近平局，情绪波动大
  if (!isNaN(spreadNum) && Math.abs(spreadNum) >= 1.5 && Math.abs(spreadNum) <= 3) {
    signals.push({
      rule: "CLOSE_GAME_FADE",
      label: "胶着盘口",
      direction: "NEUTRAL",
      confidence: 5.0,
      reason: `让分仅 ${Math.abs(spreadNum)} 分，比赛结果高度不确定，需结合舆论分析`,
      color: "text-gray-400",
    });
  }

  // 规则5：复仇之战关键词
  if (notes.includes("复仇") || notes.includes("revenge") || notes.includes("rematch") || notes.includes("上次输")) {
    signals.push({
      rule: "REVENGE_GAME",
      label: "复仇之战",
      direction: "LONG",
      confidence: 7.0,
      reason: "复仇动机强烈，被复仇方有超额发挥动力，押其让分有价值",
      color: "text-purple-400",
    });
  }

  // 规则6：背靠背疲劳（B2B）
  if (notes.includes("b2b") || notes.includes("背靠背") || notes.includes("昨天") || notes.includes("连客")) {
    signals.push({
      rule: "B2B_FATIGUE",
      label: "背靠背疲劳",
      direction: "SHORT",
      confidence: 5.5,
      reason: "背靠背作战，疲劳队表现下滑概率高，押对手让分",
      color: "text-orange-400",
    });
  }

  // 规则7：连胜/连败势能
  if (notes.includes("连胜") || notes.includes("win streak") || notes.includes("热火")) {
    signals.push({
      rule: "PEAK_STREAK",
      label: "连胜势能极值",
      direction: "LONG",
      confidence: 6.0,
      reason: "连胜队处于势能极值，市场高估，押受让方（均值回归）",
      color: "text-emerald-400",
    });
  }
  if (notes.includes("连败") || notes.includes("losing streak") || notes.includes("低谷")) {
    signals.push({
      rule: "BLOWOUT_WIN",
      label: "连败反弹",
      direction: "LONG",
      confidence: 5.5,
      reason: "连败队处于低谷，市场过度悲观，有反弹价值",
      color: "text-cyan-400",
    });
  }

  // 计算综合评分
  const score = signals.length === 0
    ? 0
    : Math.min(10, signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length + (signals.length > 1 ? 1 : 0));

  // 生成推荐
  const highSignals = signals.filter(s => s.confidence >= 6.5);
  let recommendation = "无明显信号，等待 /scan 融合实时数据";
  if (highSignals.length >= 2) {
    const longSignals = highSignals.filter(s => s.direction === "LONG");
    const shortSignals = highSignals.filter(s => s.direction === "SHORT");
    if (longSignals.length > shortSignals.length) {
      recommendation = `押 ${entry.awayTeam} ${entry.spread} （受让方，${longSignals.map(s => s.label).join("+")}）`;
    } else if (shortSignals.length > longSignals.length) {
      recommendation = `押 ${entry.homeTeam} ${entry.spread} （让分方，${shortSignals.map(s => s.label).join("+")}）`;
    } else {
      recommendation = "多空信号冲突，建议观望";
    }
  } else if (highSignals.length === 1) {
    const s = highSignals[0];
    recommendation = `初步信号：${s.label}（置信度 ${s.confidence}），等待 /scan 确认`;
  }

  return { signals, score, recommendation };
}

// ─── 存储工具 ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "sea_uploaded_odds";

function loadOdds(): UploadedOdds[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveOdds(list: UploadedOdds[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ─── 解析粘贴文本 ─────────────────────────────────────────────────────────────

function parseRawText(raw: string): Partial<OddsEntry>[] {
  const lines = raw.trim().split("\n").filter(l => l.trim());
  const results: Partial<OddsEntry>[] = [];

  for (const line of lines) {
    // 尝试匹配常见格式：
    // "Lakers -5.5 vs Celtics O/U 220.5"
    // "湖人 -5.5 凯尔特人 大小分220.5"
    // "BOS -3 @ LAL 215.5 [复仇 伤病]"
    const spreadMatch = line.match(/([+-]?\d+\.?\d*)/);
    const ouMatch = line.match(/[Oo]\/?[Uu]\s*(\d+\.?\d*)|大小分\s*(\d+\.?\d*)/);
    const timeMatch = line.match(/(\d{1,2}[:.]\d{2})|(\d{4}-\d{2}-\d{2})/);
    const bracketMatch = line.match(/[\[【](.*?)[\]】]/);

    if (spreadMatch) {
      results.push({
        spread: spreadMatch[1],
        overUnder: ouMatch ? (ouMatch[1] || ouMatch[2]) : "",
        gameTime: timeMatch ? timeMatch[0] : "",
        notes: bracketMatch ? bracketMatch[1] : "",
        homeTeam: "",
        awayTeam: "",
      });
    }
  }

  return results;
}

// ─── 空表单默认值 ─────────────────────────────────────────────────────────────

const EMPTY_ENTRY: OddsEntry = {
  homeTeam: "",
  awayTeam: "",
  spread: "",
  overUnder: "",
  gameTime: "",
  notes: "",
};

// ─── 信号方向图标 ─────────────────────────────────────────────────────────────

function DirectionIcon({ direction }: { direction: "LONG" | "SHORT" | "NEUTRAL" }) {
  if (direction === "LONG") return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (direction === "SHORT") return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3.5 h-3.5 text-gray-400" />;
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export default function OddsUpload() {
  const [tab, setTab] = useState<"manual" | "paste">("manual");
  const [entry, setEntry] = useState<OddsEntry>(EMPTY_ENTRY);
  const [rawText, setRawText] = useState("");
  const [parsedEntries, setParsedEntries] = useState<Partial<OddsEntry>[]>([]);
  const [history, setHistory] = useState<UploadedOdds[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    setHistory(loadOdds());
  }, []);

  const pendingCount = history.filter(h => h.status === "PENDING").length;

  // 手动提交
  const handleManualSubmit = () => {
    if (!entry.homeTeam || !entry.awayTeam || !entry.spread) {
      toast.error("请填写主队、客队和让分");
      return;
    }
    setAnalyzing(true);
    setTimeout(() => {
      const { signals, score, recommendation } = analyzeOdds(entry);
      const record: UploadedOdds = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
        entry,
        signals,
        overallScore: Math.round(score * 10) / 10,
        recommendation,
        status: "PENDING",
      };
      const updated = [record, ...history];
      saveOdds(updated);
      setHistory(updated);
      setEntry(EMPTY_ENTRY);
      setAnalyzing(false);
      setExpandedId(record.id);
      toast.success(`分析完成，发现 ${signals.length} 条信号`);
    }, 800);
  };

  // 粘贴解析提交
  const handlePasteSubmit = () => {
    if (!rawText.trim()) {
      toast.error("请粘贴盘口数据");
      return;
    }
    const parsed = parseRawText(rawText);
    if (parsed.length === 0) {
      toast.error("未能解析出有效盘口数据，请检查格式");
      return;
    }
    setParsedEntries(parsed);
    toast.success(`解析出 ${parsed.length} 条数据，请补全队名后提交`);
  };

  // 提交解析结果
  const handleParsedSubmit = (idx: number, fullEntry: OddsEntry) => {
    const { signals, score, recommendation } = analyzeOdds(fullEntry);
    const record: UploadedOdds = {
      id: Date.now().toString() + idx,
      timestamp: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
      entry: fullEntry,
      signals,
      overallScore: Math.round(score * 10) / 10,
      recommendation,
      status: "PENDING",
    };
    const updated = [record, ...history];
    saveOdds(updated);
    setHistory(updated);
    const newParsed = [...parsedEntries];
    newParsed.splice(idx, 1);
    setParsedEntries(newParsed);
    setExpandedId(record.id);
    toast.success("已加入待机队列");
  };

  // 删除记录
  const handleDelete = (id: string) => {
    const updated = history.filter(h => h.id !== id);
    saveOdds(updated);
    setHistory(updated);
    toast.success("已删除");
  };

  // 清空全部
  const handleClearAll = () => {
    saveOdds([]);
    setHistory([]);
    toast.success("已清空所有记录");
  };

  // 标记为已融合
  const handleMarkMerged = (id: string) => {
    const updated = history.map(h => h.id === id ? { ...h, status: "MERGED" as const } : h);
    saveOdds(updated);
    setHistory(updated);
    toast.success("已标记为已融合");
  };

  const scoreColor = (score: number) => {
    if (score >= 7) return "text-emerald-400";
    if (score >= 5) return "text-amber-400";
    return "text-gray-400";
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            盘口数据上传
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            上传盘口数据 → 前置规则分析 → 存入待机队列 → /scan 时自动融合
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge
              className="font-mono text-xs"
              style={{ background: "oklch(0.45 0.18 250 / 0.2)", color: "oklch(0.75 0.15 250)", border: "1px solid oklch(0.45 0.18 250 / 0.4)" }}
            >
              <Database className="w-3 h-3 mr-1" />
              {pendingCount} 条待机
            </Badge>
          )}
          {history.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-xs text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              清空全部
            </Button>
          )}
        </div>
      </div>

      {/* 流程说明 */}
      <div
        className="rounded-lg p-3 flex items-center gap-6 text-xs font-mono"
        style={{ background: "oklch(0.14 0.015 250)", border: "1px solid oklch(0.22 0.02 250)" }}
      >
        {[
          { icon: Upload, label: "1. 上传盘口", color: "text-blue-400" },
          { icon: Zap, label: "2. 规则前置分析", color: "text-amber-400" },
          { icon: Database, label: "3. 存入待机队列", color: "text-purple-400" },
          { icon: CheckCircle2, label: "4. /scan 自动融合", color: "text-emerald-400" },
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <step.icon className={`w-3.5 h-3.5 ${step.color}`} />
            <span className="text-muted-foreground">{step.label}</span>
            {i < 3 && <span className="text-muted-foreground/30 ml-3">→</span>}
          </div>
        ))}
      </div>

      {/* 上传区域 */}
      <Card style={{ background: "oklch(0.14 0.015 250)", border: "1px solid oklch(0.22 0.02 250)" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
            新增盘口数据
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "manual" | "paste")}>
            <TabsList
              className="mb-4"
              style={{ background: "oklch(0.10 0.015 250)" }}
            >
              <TabsTrigger value="manual" className="text-xs">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                手动填写
              </TabsTrigger>
              <TabsTrigger value="paste" className="text-xs">
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                粘贴解析
              </TabsTrigger>
            </TabsList>

            {/* 手动填写 */}
            <TabsContent value="manual" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">主队（让分方）</Label>
                  <Input
                    value={entry.homeTeam}
                    onChange={e => setEntry({ ...entry, homeTeam: e.target.value })}
                    placeholder="如：Los Angeles Lakers"
                    className="font-mono text-sm"
                    style={{ background: "oklch(0.10 0.015 250)", border: "1px solid oklch(0.25 0.02 250)" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">客队（受让方）</Label>
                  <Input
                    value={entry.awayTeam}
                    onChange={e => setEntry({ ...entry, awayTeam: e.target.value })}
                    placeholder="如：Boston Celtics"
                    className="font-mono text-sm"
                    style={{ background: "oklch(0.10 0.015 250)", border: "1px solid oklch(0.25 0.02 250)" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">让分（主队视角）</Label>
                  <Input
                    value={entry.spread}
                    onChange={e => setEntry({ ...entry, spread: e.target.value })}
                    placeholder="如：-5.5 或 +3"
                    className="font-mono text-sm"
                    style={{ background: "oklch(0.10 0.015 250)", border: "1px solid oklch(0.25 0.02 250)" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">大小分</Label>
                  <Input
                    value={entry.overUnder}
                    onChange={e => setEntry({ ...entry, overUnder: e.target.value })}
                    placeholder="如：220.5"
                    className="font-mono text-sm"
                    style={{ background: "oklch(0.10 0.015 250)", border: "1px solid oklch(0.25 0.02 250)" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">比赛时间（北京）</Label>
                  <Input
                    value={entry.gameTime}
                    onChange={e => setEntry({ ...entry, gameTime: e.target.value })}
                    placeholder="如：03-02 09:30"
                    className="font-mono text-sm"
                    style={{ background: "oklch(0.10 0.015 250)", border: "1px solid oklch(0.25 0.02 250)" }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  备注（伤病/交易传言/复仇/背靠背等关键词）
                </Label>
                <Textarea
                  value={entry.notes}
                  onChange={e => setEntry({ ...entry, notes: e.target.value })}
                  placeholder="如：主力控卫questionable，昨天背靠背，上次输给对手20分复仇之战..."
                  rows={2}
                  className="font-mono text-sm resize-none"
                  style={{ background: "oklch(0.10 0.015 250)", border: "1px solid oklch(0.25 0.02 250)" }}
                />
              </div>

              <Button
                onClick={handleManualSubmit}
                disabled={analyzing}
                className="font-mono"
                style={{ background: "oklch(0.45 0.18 250)", color: "oklch(0.95 0.005 250)" }}
              >
                {analyzing ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "oklch(0.7 0.1 250)", borderTopColor: "transparent" }} />
                    分析中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5" />
                    前置分析并加入队列
                  </span>
                )}
              </Button>
            </TabsContent>

            {/* 粘贴解析 */}
            <TabsContent value="paste" className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  粘贴盘口数据（支持多行，每行一场比赛）
                </Label>
                <Textarea
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder={`支持格式示例：\nLakers -5.5 vs Celtics O/U 220.5 [复仇 背靠背]\nBKN +8.5 @ GSW 228 [交易传言 伤病]\n湖人 -3 凯尔特人 大小分215 [主力questionable]`}
                  rows={5}
                  className="font-mono text-sm resize-none"
                  style={{ background: "oklch(0.10 0.015 250)", border: "1px solid oklch(0.25 0.02 250)" }}
                />
              </div>

              <Button
                onClick={handlePasteSubmit}
                variant="outline"
                className="font-mono text-sm"
                style={{ borderColor: "oklch(0.35 0.05 250)", color: "oklch(0.75 0.05 250)" }}
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                解析文本
              </Button>

              {/* 解析结果编辑 */}
              {parsedEntries.length > 0 && (
                <div className="space-y-3 mt-2">
                  <p className="text-xs text-muted-foreground font-mono">解析出 {parsedEntries.length} 条，请补全队名：</p>
                  {parsedEntries.map((pe, idx) => {
                    const [localEntry, setLocalEntry] = useState<OddsEntry>({
                      homeTeam: pe.homeTeam || "",
                      awayTeam: pe.awayTeam || "",
                      spread: pe.spread || "",
                      overUnder: pe.overUnder || "",
                      gameTime: pe.gameTime || "",
                      notes: pe.notes || "",
                    });
                    return (
                      <div
                        key={idx}
                        className="rounded-lg p-3 space-y-2"
                        style={{ background: "oklch(0.10 0.015 250)", border: "1px solid oklch(0.22 0.02 250)" }}
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={localEntry.homeTeam}
                            onChange={e => setLocalEntry({ ...localEntry, homeTeam: e.target.value })}
                            placeholder="主队"
                            className="font-mono text-xs h-8"
                            style={{ background: "oklch(0.14 0.015 250)", border: "1px solid oklch(0.25 0.02 250)" }}
                          />
                          <Input
                            value={localEntry.awayTeam}
                            onChange={e => setLocalEntry({ ...localEntry, awayTeam: e.target.value })}
                            placeholder="客队"
                            className="font-mono text-xs h-8"
                            style={{ background: "oklch(0.14 0.015 250)", border: "1px solid oklch(0.25 0.02 250)" }}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">让分: {localEntry.spread}</span>
                          {localEntry.overUnder && <span className="font-mono text-xs text-muted-foreground">O/U: {localEntry.overUnder}</span>}
                          {localEntry.notes && <span className="font-mono text-xs text-amber-400">[{localEntry.notes}]</span>}
                          <Button
                            size="sm"
                            onClick={() => handleParsedSubmit(idx, localEntry)}
                            className="ml-auto h-7 text-xs font-mono"
                            style={{ background: "oklch(0.45 0.18 250)", color: "oklch(0.95 0.005 250)" }}
                          >
                            <Zap className="w-3 h-3 mr-1" />
                            分析
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 历史记录 */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4" />
            待机队列（{history.length} 条）
          </h2>

          {history.map((record) => {
            const isExpanded = expandedId === record.id;
            const statusColor = record.status === "PENDING"
              ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
              : record.status === "MERGED"
              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
              : "text-gray-400 bg-gray-500/10 border-gray-500/30";

            return (
              <div
                key={record.id}
                className="rounded-lg overflow-hidden"
                style={{ border: "1px solid oklch(0.22 0.02 250)" }}
              >
                {/* 记录头部 */}
                <div
                  className="p-3 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  style={{ background: "oklch(0.14 0.015 250)" }}
                  onClick={() => setExpandedId(isExpanded ? null : record.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {record.entry.homeTeam || "主队"} vs {record.entry.awayTeam || "客队"}
                      </span>
                      <span className="font-mono text-xs text-primary">
                        {record.entry.spread}
                      </span>
                      {record.entry.overUnder && (
                        <span className="font-mono text-xs text-muted-foreground">
                          O/U {record.entry.overUnder}
                        </span>
                      )}
                      <Badge className={`text-[10px] font-mono ${statusColor}`}>
                        {record.status === "PENDING" ? "待机" : record.status === "MERGED" ? "已融合" : "已过期"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {record.timestamp}
                      </span>
                      <span className={`text-xs font-mono font-bold ${scoreColor(record.overallScore)}`}>
                        评分 {record.overallScore}/10
                      </span>
                      {record.signals.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {record.signals.length} 条信号
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* 展开详情 */}
                {isExpanded && (
                  <div
                    className="p-4 space-y-4 border-t"
                    style={{ background: "oklch(0.11 0.015 250)", borderColor: "oklch(0.22 0.02 250)" }}
                  >
                    {/* 推荐方向 */}
                    <div
                      className="rounded-lg p-3"
                      style={{ background: "oklch(0.14 0.015 250)", border: "1px solid oklch(0.28 0.05 250 / 0.5)" }}
                    >
                      <div className="flex items-start gap-2">
                        <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">前置分析推荐</div>
                          <div className="text-sm font-semibold text-foreground">{record.recommendation}</div>
                        </div>
                      </div>
                    </div>

                    {/* 信号列表 */}
                    {record.signals.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">触发规则</div>
                        {record.signals.map((signal, i) => (
                          <div
                            key={i}
                            className="rounded-lg p-2.5 flex items-start gap-3"
                            style={{ background: "oklch(0.14 0.015 250)", border: "1px solid oklch(0.22 0.02 250)" }}
                          >
                            <DirectionIcon direction={signal.direction} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-mono font-semibold ${signal.color}`}>{signal.label}</span>
                                <span className="text-[10px] font-mono text-muted-foreground">{signal.rule}</span>
                                <span className={`text-xs font-mono ml-auto ${scoreColor(signal.confidence)}`}>
                                  {signal.confidence}/10
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{signal.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        未触发任何规则，等待 /scan 融合实时数据后再判断
                      </div>
                    )}

                    {/* 原始数据 */}
                    {record.entry.notes && (
                      <div className="text-xs font-mono text-muted-foreground">
                        备注：<span className="text-amber-400">{record.entry.notes}</span>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2 pt-1">
                      {record.status === "PENDING" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkMerged(record.id)}
                          className="text-xs font-mono h-7"
                          style={{ borderColor: "oklch(0.35 0.05 250)", color: "oklch(0.65 0.15 145)" }}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          标记已融合
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(record.id)}
                        className="text-xs font-mono h-7 text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        删除
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 空状态 */}
      {history.length === 0 && (
        <div
          className="rounded-xl p-10 text-center"
          style={{ background: "oklch(0.14 0.015 250)", border: "1px dashed oklch(0.25 0.02 250)" }}
        >
          <Database className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">待机队列为空</p>
          <p className="text-xs text-muted-foreground/60 mt-1">上传盘口数据后，前置分析结果将在此显示</p>
        </div>
      )}
    </div>
  );
}
