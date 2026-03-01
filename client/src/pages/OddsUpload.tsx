/**
 * OddsUpload — 盘口数据上传与前置分析
 * 支持 Action Network 风格截图上传 → AI OCR 解析 → 规则前置分析 → 待机队列
 *
 * 截图字段：队名 | 让分(spread) | 赔率(moneyline) | 投注比例(bets%) | 资金比例(money%) | 盘口偏移
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  ImageIcon,
  X,
  RefreshCw,
  Eye,
  Plus,
} from "lucide-react";

// ─── 类型定义 ────────────────────────────────────────────────────────────────

interface ParsedGame {
  gameTime: string;       // 比赛时间（截图左侧，如 "2:00 AM"）
  team1: string;          // 上方队（通常是主场/让分方）
  team2: string;          // 下方队（通常是客场/受让方）
  spread1: string;        // 队1让分，如 "-2.5"
  spread2: string;        // 队2让分，如 "+2.5"
  moneyline1: string;     // 队1赔率，如 "-108"
  moneyline2: string;     // 队2赔率，如 "+104"
  bets1: string;          // 队1投注比例，如 "67%"
  bets2: string;          // 队2投注比例，如 "33%"
  money1: string;         // 队1资金比例，如 "43%"
  money2: string;         // 队2资金比例，如 "57%"
  lineMove: string;       // 盘口偏移，如 "+24%"
  notes: string;          // 用户备注
}

interface AnalysisSignal {
  rule: string;
  label: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  confidence: number;
  reason: string;
  color: string;
}

interface UploadedOdds {
  id: string;
  timestamp: string;
  game: ParsedGame;
  signals: AnalysisSignal[];
  overallScore: number;
  recommendation: string;
  status: "PENDING" | "MERGED" | "EXPIRED";
}

// ─── 规则引擎前置分析 ─────────────────────────────────────────────────────────

function analyzeGame(game: ParsedGame): { signals: AnalysisSignal[]; score: number; recommendation: string } {
  const signals: AnalysisSignal[] = [];
  const notes = (game.notes || "").toLowerCase();

  const spread1 = parseFloat(game.spread1);
  const bets1 = parseFloat(game.bets1);
  const bets2 = parseFloat(game.bets2);
  const money1 = parseFloat(game.money1);
  const money2 = parseFloat(game.money2);
  const lineMove = parseFloat(game.lineMove);

  // 规则1：公众情绪反转 (PUBLIC_FADE) — 投注比例 ≥ 70% 押一方，但盘口未跟随
  if (!isNaN(bets1) && !isNaN(bets2)) {
    const maxBets = Math.max(bets1, bets2);
    const favoredTeam = bets1 > bets2 ? game.team1 : game.team2;
    const fadedTeam = bets1 > bets2 ? game.team2 : game.team1;
    const fadedSpread = bets1 > bets2 ? game.spread2 : game.spread1;

    if (maxBets >= 70) {
      signals.push({
        rule: "PUBLIC_FADE",
        label: "公众情绪反转",
        direction: "LONG",
        confidence: maxBets >= 80 ? 7.5 : 6.5,
        reason: `${maxBets}% 公众押 ${favoredTeam}，市场过度倾斜，押受让方 ${fadedTeam} ${fadedSpread} 有价值（历史胜率约58%）`,
        color: "text-blue-400",
      });
    }
  }

  // 规则2：资金/投注背离 (SHARP_MONEY) — 资金比例与投注比例方向相反（庄家动作）
  if (!isNaN(bets1) && !isNaN(money1)) {
    const bets1Favored = bets1 > 50;
    const money1Favored = money1 > 50;
    if (bets1Favored !== money1Favored) {
      const sharpTeam = money1Favored ? game.team1 : game.team2;
      const sharpSpread = money1Favored ? game.spread1 : game.spread2;
      const sharpMoney = money1Favored ? money1 : money2;
      const publicBets = money1Favored ? bets2 : bets1;
      signals.push({
        rule: "SHARP_MONEY",
        label: "聪明钱背离",
        direction: "LONG",
        confidence: 7.0,
        reason: `资金 ${sharpMoney}% 押 ${sharpTeam}，但公众投注仅 ${100 - publicBets}%，庄家/职业玩家押 ${sharpTeam} ${sharpSpread}`,
        color: "text-yellow-400",
      });
    }
  }

  // 规则3：大让分 (BIG_SPREAD) — 让分 ≥ 8，弱队受让有价值
  if (!isNaN(spread1) && Math.abs(spread1) >= 8) {
    const favoredTeam = spread1 < 0 ? game.team1 : game.team2;
    const fadedTeam = spread1 < 0 ? game.team2 : game.team1;
    const fadedSpread = spread1 < 0 ? game.spread2 : game.spread1;
    signals.push({
      rule: "BIG_SPREAD_FADE",
      label: "大让分反转",
      direction: "LONG",
      confidence: 6.5,
      reason: `让分达 ${Math.abs(spread1)} 分，${favoredTeam} 被高估，押 ${fadedTeam} ${fadedSpread} 受让（均值回归）`,
      color: "text-purple-400",
    });
  }

  // 规则4：盘口逆向移动 (LINE_MOVE) — 盘口向弱队移动（公众押强队但盘口反向）
  if (!isNaN(lineMove) && Math.abs(lineMove) >= 10) {
    signals.push({
      rule: "LINE_MOVE",
      label: "盘口异动",
      direction: lineMove > 0 ? "LONG" : "SHORT",
      confidence: Math.abs(lineMove) >= 20 ? 7.0 : 6.0,
      reason: `盘口偏移 ${game.lineMove}，显著异动，可能有内部信息驱动`,
      color: "text-cyan-400",
    });
  }

  // 规则5：伤病/交易传言（来自备注）
  if (notes.includes("伤") || notes.includes("injury") || notes.includes("out") || notes.includes("questionable")) {
    signals.push({
      rule: "INJURY_PANIC",
      label: "伤病恐慌",
      direction: "LONG",
      confidence: 6.5,
      reason: "关键球员伤病，公众过度反应，盘口可能高估影响",
      color: "text-red-400",
    });
  }
  if (notes.includes("交易") || notes.includes("trade") || notes.includes("传言")) {
    signals.push({
      rule: "TRADE_SHOCK",
      label: "交易传言",
      direction: "SHORT",
      confidence: 6.0,
      reason: "交易传言导致球队士气不稳",
      color: "text-amber-400",
    });
  }
  if (notes.includes("复仇") || notes.includes("revenge")) {
    signals.push({
      rule: "REVENGE_GAME",
      label: "复仇之战",
      direction: "LONG",
      confidence: 7.0,
      reason: "复仇动机强烈，被复仇方有超额发挥动力",
      color: "text-purple-400",
    });
  }
  if (notes.includes("b2b") || notes.includes("背靠背")) {
    signals.push({
      rule: "B2B_FATIGUE",
      label: "背靠背疲劳",
      direction: "SHORT",
      confidence: 5.5,
      reason: "背靠背作战，疲劳队表现下滑",
      color: "text-orange-400",
    });
  }

  // 综合评分
  const score = signals.length === 0
    ? 0
    : Math.min(10, signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length + (signals.length > 1 ? 1 : 0));

  // 生成推荐
  const highSignals = signals.filter(s => s.confidence >= 6.5);
  let recommendation = "无明显信号，等待 /scan 融合实时数据";
  if (highSignals.length >= 1) {
    const longSignals = highSignals.filter(s => s.direction === "LONG");
    const shortSignals = highSignals.filter(s => s.direction === "SHORT");
    if (longSignals.length > shortSignals.length) {
      // LONG = 押受让方（spread 较大的那方）
      const fadedSpread = parseFloat(game.spread1) > 0 ? game.spread1 : game.spread2;
      const fadedTeam = parseFloat(game.spread1) > 0 ? game.team1 : game.team2;
      recommendation = `押 ${fadedTeam} ${fadedSpread}（受让方，${longSignals.map(s => s.label).join("+")}）`;
    } else if (shortSignals.length > longSignals.length) {
      const favoredSpread = parseFloat(game.spread1) < 0 ? game.spread1 : game.spread2;
      const favoredTeam = parseFloat(game.spread1) < 0 ? game.team1 : game.team2;
      recommendation = `押 ${favoredTeam} ${favoredSpread}（让分方，${shortSignals.map(s => s.label).join("+")}）`;
    } else {
      recommendation = "多空信号冲突，建议观望";
    }
  }

  return { signals, score, recommendation };
}

// ─── 存储工具 ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "sea_uploaded_odds_v2";

function loadOdds(): UploadedOdds[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveOdds(list: UploadedOdds[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ─── OCR 调用（OpenRouter Vision）────────────────────────────────────────────

async function ocrParseImage(base64: string, mimeType: string): Promise<ParsedGame[]> {
  const apiKey = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
  const apiUrl = import.meta.env.VITE_FRONTEND_FORGE_API_URL || "https://openrouter.ai/api/v1";

  const prompt = `You are an NBA sports betting data extractor. 
Analyze this Action Network style odds screenshot and extract ALL games shown.

For each game, extract:
- gameTime: time shown on left (e.g. "2:00 AM", "4:30 AM")
- team1: top team name (usually the favorite/home team)
- team2: bottom team name (usually the underdog/away team)  
- spread1: top team spread (e.g. "-2.5", "+10.5")
- spread2: bottom team spread (e.g. "+2.5", "-10.5")
- moneyline1: top team moneyline in the center box (e.g. "-108", "+104")
- moneyline2: bottom team moneyline in the center box
- bets1: top team bet percentage (e.g. "67%")
- bets2: bottom team bet percentage (e.g. "33%")
- money1: top team money percentage (second % column, e.g. "43%")
- money2: bottom team money percentage (e.g. "57%")
- lineMove: line movement shown in green on far right (e.g. "+24%", "+9%"), empty string if not shown

Return ONLY a valid JSON array, no markdown, no explanation:
[{"gameTime":"...","team1":"...","team2":"...","spread1":"...","spread2":"...","moneyline1":"...","moneyline2":"...","bets1":"...","bets2":"...","money1":"...","money2":"...","lineMove":"...","notes":""},...]`;

  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OCR API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  // 提取 JSON
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("未能从响应中提取 JSON");

  const games: ParsedGame[] = JSON.parse(jsonMatch[0]);
  return games;
}

// ─── 辅助组件 ─────────────────────────────────────────────────────────────────

function DirectionIcon({ direction }: { direction: "LONG" | "SHORT" | "NEUTRAL" }) {
  if (direction === "LONG") return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (direction === "SHORT") return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3.5 h-3.5 text-gray-400" />;
}

function scoreColor(score: number) {
  if (score >= 7) return "text-emerald-400";
  if (score >= 5) return "text-amber-400";
  return "text-gray-400";
}

// ─── 盘口数据行组件 ───────────────────────────────────────────────────────────

function GameRow({ game, onEdit, onSubmit }: {
  game: ParsedGame;
  onEdit: (field: keyof ParsedGame, value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div
      className="rounded-lg p-3 space-y-3"
      style={{ background: "oklch(0.10 0.015 250)", border: "1px solid oklch(0.22 0.02 250)" }}
    >
      {/* 时间 + 队名行 */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">{game.gameTime}</span>
        <div className="flex-1 grid grid-cols-2 gap-2">
          <Input
            value={game.team1}
            onChange={e => onEdit("team1", e.target.value)}
            placeholder="队1（让分方）"
            className="font-mono text-xs h-7"
            style={{ background: "oklch(0.14 0.015 250)", border: "1px solid oklch(0.25 0.02 250)" }}
          />
          <Input
            value={game.team2}
            onChange={e => onEdit("team2", e.target.value)}
            placeholder="队2（受让方）"
            className="font-mono text-xs h-7"
            style={{ background: "oklch(0.14 0.015 250)", border: "1px solid oklch(0.25 0.02 250)" }}
          />
        </div>
      </div>

      {/* 数据字段行 */}
      <div className="grid grid-cols-6 gap-1.5 text-xs">
        {[
          { label: "让分1", field: "spread1" as keyof ParsedGame, value: game.spread1, color: "text-primary" },
          { label: "让分2", field: "spread2" as keyof ParsedGame, value: game.spread2, color: "text-primary" },
          { label: "赔率1", field: "moneyline1" as keyof ParsedGame, value: game.moneyline1, color: "text-muted-foreground" },
          { label: "赔率2", field: "moneyline2" as keyof ParsedGame, value: game.moneyline2, color: "text-muted-foreground" },
          { label: "投注%1", field: "bets1" as keyof ParsedGame, value: game.bets1, color: "text-blue-400" },
          { label: "投注%2", field: "bets2" as keyof ParsedGame, value: game.bets2, color: "text-blue-400" },
          { label: "资金%1", field: "money1" as keyof ParsedGame, value: game.money1, color: "text-emerald-400" },
          { label: "资金%2", field: "money2" as keyof ParsedGame, value: game.money2, color: "text-emerald-400" },
          { label: "盘口偏移", field: "lineMove" as keyof ParsedGame, value: game.lineMove, color: "text-green-400" },
        ].map(({ label, field, value, color }) => (
          <div key={field} className="space-y-0.5">
            <div className="text-[9px] text-muted-foreground/60 font-mono uppercase">{label}</div>
            <Input
              value={value}
              onChange={e => onEdit(field, e.target.value)}
              className={`font-mono text-xs h-6 px-1.5 ${color}`}
              style={{ background: "oklch(0.14 0.015 250)", border: "1px solid oklch(0.22 0.02 250)" }}
            />
          </div>
        ))}
        <div className="col-span-3 space-y-0.5">
          <div className="text-[9px] text-muted-foreground/60 font-mono uppercase">备注（伤病/复仇/背靠背）</div>
          <Input
            value={game.notes}
            onChange={e => onEdit("notes", e.target.value)}
            placeholder="可选..."
            className="font-mono text-xs h-6 px-1.5"
            style={{ background: "oklch(0.14 0.015 250)", border: "1px solid oklch(0.22 0.02 250)" }}
          />
        </div>
      </div>

      <Button
        size="sm"
        onClick={onSubmit}
        className="h-7 text-xs font-mono w-full"
        style={{ background: "oklch(0.45 0.18 250)", color: "oklch(0.95 0.005 250)" }}
      >
        <Zap className="w-3 h-3 mr-1.5" />
        前置分析并加入待机队列
      </Button>
    </div>
  );
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────

export default function OddsUpload() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>("image/png");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedGames, setParsedGames] = useState<ParsedGame[]>([]);
  const [history, setHistory] = useState<UploadedOdds[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [manualNotes, setManualNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setHistory(loadOdds()); }, []);

  const pendingCount = history.filter(h => h.status === "PENDING").length;

  // 处理图片文件
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("请上传图片文件");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setImageMime(file.type);
      // 提取 base64
      const b64 = dataUrl.split(",")[1];
      setImageBase64(b64);
      setParsedGames([]);
    };
    reader.readAsDataURL(file);
  }, []);

  // 拖拽处理
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  // 粘贴截图（Ctrl+V）
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) { handleFile(file); break; }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleFile]);

  // OCR 解析
  const handleParse = async () => {
    if (!imageBase64) { toast.error("请先上传截图"); return; }
    setParsing(true);
    try {
      const games = await ocrParseImage(imageBase64, imageMime);
      if (games.length === 0) { toast.error("未识别到比赛数据，请检查截图"); return; }
      // 附加手动备注到每场
      const gamesWithNotes = games.map(g => ({ ...g, notes: g.notes || manualNotes }));
      setParsedGames(gamesWithNotes);
      toast.success(`识别到 ${games.length} 场比赛，请确认后加入队列`);
    } catch (err) {
      toast.error(`解析失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setParsing(false);
    }
  };

  // 编辑解析结果
  const handleEditGame = (idx: number, field: keyof ParsedGame, value: string) => {
    setParsedGames(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  // 提交单场到队列
  const handleSubmitGame = (idx: number) => {
    const game = parsedGames[idx];
    const { signals, score, recommendation } = analyzeGame(game);
    const record: UploadedOdds = {
      id: Date.now().toString() + idx,
      timestamp: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
      game,
      signals,
      overallScore: Math.round(score * 10) / 10,
      recommendation,
      status: "PENDING",
    };
    const updated = [record, ...history];
    saveOdds(updated);
    setHistory(updated);
    setParsedGames(prev => prev.filter((_, i) => i !== idx));
    setExpandedId(record.id);
    toast.success(`${game.team1} vs ${game.team2} 已加入待机队列`);
  };

  // 全部提交
  const handleSubmitAll = () => {
    if (parsedGames.length === 0) return;
    const newRecords: UploadedOdds[] = parsedGames.map((game, idx) => {
      const { signals, score, recommendation } = analyzeGame(game);
      return {
        id: Date.now().toString() + idx,
        timestamp: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
        game,
        signals,
        overallScore: Math.round(score * 10) / 10,
        recommendation,
        status: "PENDING",
      };
    });
    const updated = [...newRecords, ...history];
    saveOdds(updated);
    setHistory(updated);
    setParsedGames([]);
    toast.success(`${newRecords.length} 场比赛已全部加入待机队列`);
  };

  const handleDelete = (id: string) => {
    const updated = history.filter(h => h.id !== id);
    saveOdds(updated);
    setHistory(updated);
    toast.success("已删除");
  };

  const handleMarkMerged = (id: string) => {
    const updated = history.map(h => h.id === id ? { ...h, status: "MERGED" as const } : h);
    saveOdds(updated);
    setHistory(updated);
    toast.success("已标记为已融合");
  };

  const handleClearAll = () => {
    saveOdds([]);
    setHistory([]);
    toast.success("已清空");
  };

  const handleClearImage = () => {
    setImagePreview(null);
    setImageBase64("");
    setParsedGames([]);
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
            上传 Action Network 截图 → AI 自动识别所有字段 → 规则前置分析 → 待机队列
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
            <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-xs text-muted-foreground hover:text-red-400">
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              清空
            </Button>
          )}
        </div>
      </div>

      {/* 流程说明 */}
      <div
        className="rounded-lg p-3 flex items-center gap-4 text-xs font-mono flex-wrap"
        style={{ background: "oklch(0.14 0.015 250)", border: "1px solid oklch(0.22 0.02 250)" }}
      >
        {[
          { icon: ImageIcon, label: "1. 截图/粘贴", color: "text-blue-400" },
          { icon: Eye, label: "2. AI OCR 识别", color: "text-amber-400" },
          { icon: Zap, label: "3. 规则前置分析", color: "text-purple-400" },
          { icon: Database, label: "4. 待机队列", color: "text-emerald-400" },
          { icon: RefreshCw, label: "5. /scan 融合", color: "text-cyan-400" },
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <step.icon className={`w-3.5 h-3.5 ${step.color}`} />
            <span className="text-muted-foreground">{step.label}</span>
            {i < 4 && <span className="text-muted-foreground/30 ml-2">→</span>}
          </div>
        ))}
      </div>

      {/* 上传区域 */}
      <Card style={{ background: "oklch(0.14 0.015 250)", border: "1px solid oklch(0.22 0.02 250)" }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
            上传盘口截图
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!imagePreview ? (
            /* 拖拽上传区 */
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 flex flex-col items-center justify-center py-12 gap-3"
              style={{
                borderColor: isDragging ? "oklch(0.55 0.18 250)" : "oklch(0.28 0.03 250)",
                background: isDragging ? "oklch(0.45 0.18 250 / 0.08)" : "oklch(0.10 0.015 250)",
              }}
            >
              <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground">拖拽截图到此处，或点击选择文件</p>
                <p className="text-xs text-muted-foreground/60 mt-1">也可以直接 <kbd className="px-1 py-0.5 rounded text-[10px]" style={{ background: "oklch(0.20 0.02 250)", border: "1px solid oklch(0.28 0.03 250)" }}>Ctrl+V</kbd> 粘贴截图</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          ) : (
            /* 预览区 */
            <div className="space-y-3">
              <div className="relative rounded-lg overflow-hidden" style={{ border: "1px solid oklch(0.25 0.02 250)" }}>
                <img src={imagePreview} alt="盘口截图" className="w-full max-h-80 object-contain" style={{ background: "oklch(0.10 0.015 250)" }} />
                <button
                  onClick={handleClearImage}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "oklch(0.20 0.02 250)", border: "1px solid oklch(0.30 0.03 250)" }}
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>

              {/* 备注输入 */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">全局备注（可选，将附加到所有识别结果）</Label>
                <Input
                  value={manualNotes}
                  onChange={e => setManualNotes(e.target.value)}
                  placeholder="如：今日有背靠背，主力伤病，复仇之战..."
                  className="font-mono text-sm"
                  style={{ background: "oklch(0.10 0.015 250)", border: "1px solid oklch(0.25 0.02 250)" }}
                />
              </div>

              <Button
                onClick={handleParse}
                disabled={parsing}
                className="w-full font-mono"
                style={{ background: "oklch(0.45 0.18 250)", color: "oklch(0.95 0.005 250)" }}
              >
                {parsing ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "oklch(0.7 0.1 250)", borderTopColor: "transparent" }} />
                    AI 识别中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    AI 识别盘口数据
                  </span>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 解析结果确认 */}
      {parsedGames.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" />
              识别结果（{parsedGames.length} 场）— 确认后加入队列
            </h2>
            <Button
              size="sm"
              onClick={handleSubmitAll}
              className="text-xs font-mono h-7"
              style={{ background: "oklch(0.45 0.18 250 / 0.8)", color: "oklch(0.95 0.005 250)" }}
            >
              <Plus className="w-3 h-3 mr-1" />
              全部加入队列
            </Button>
          </div>

          {parsedGames.map((game, idx) => (
            <GameRow
              key={idx}
              game={game}
              onEdit={(field, value) => handleEditGame(idx, field, value)}
              onSubmit={() => handleSubmitGame(idx)}
            />
          ))}
        </div>
      )}

      {/* 待机队列 */}
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
              : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";

            return (
              <div key={record.id} className="rounded-lg overflow-hidden" style={{ border: "1px solid oklch(0.22 0.02 250)" }}>
                {/* 头部 */}
                <div
                  className="p-3 flex items-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  style={{ background: "oklch(0.14 0.015 250)" }}
                  onClick={() => setExpandedId(isExpanded ? null : record.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {record.game.team1} vs {record.game.team2}
                      </span>
                      <span className="font-mono text-xs text-primary">{record.game.spread1} / {record.game.spread2}</span>
                      {record.game.lineMove && (
                        <span className="font-mono text-xs text-emerald-400">{record.game.lineMove}</span>
                      )}
                      <Badge className={`text-[10px] font-mono ${statusColor}`}>
                        {record.status === "PENDING" ? "待机" : "已融合"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />{record.timestamp}
                      </span>
                      <span className={`text-xs font-mono font-bold ${scoreColor(record.overallScore)}`}>
                        评分 {record.overallScore}/10
                      </span>
                      {record.signals.length > 0 && (
                        <span className="text-xs text-muted-foreground">{record.signals.length} 条信号</span>
                      )}
                      {/* 投注比例快览 */}
                      {record.game.bets1 && (
                        <span className="text-xs font-mono text-blue-400/70">
                          {record.game.bets1}/{record.game.bets2}
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </div>

                {/* 展开详情 */}
                {isExpanded && (
                  <div className="p-4 space-y-4 border-t" style={{ background: "oklch(0.11 0.015 250)", borderColor: "oklch(0.22 0.02 250)" }}>
                    {/* 原始数据表格 */}
                    <div
                      className="rounded-lg p-3 grid grid-cols-5 gap-2 text-xs font-mono"
                      style={{ background: "oklch(0.14 0.015 250)" }}
                    >
                      <div className="text-muted-foreground/60 uppercase text-[9px]">时间</div>
                      <div className="text-muted-foreground/60 uppercase text-[9px]">让分</div>
                      <div className="text-muted-foreground/60 uppercase text-[9px]">赔率</div>
                      <div className="text-muted-foreground/60 uppercase text-[9px]">投注%</div>
                      <div className="text-muted-foreground/60 uppercase text-[9px]">资金%</div>

                      <div className="text-muted-foreground">{record.game.gameTime}</div>
                      <div>
                        <div className="text-primary">{record.game.spread1}</div>
                        <div className="text-primary">{record.game.spread2}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">{record.game.moneyline1}</div>
                        <div className="text-muted-foreground">{record.game.moneyline2}</div>
                      </div>
                      <div>
                        <div className="text-blue-400">{record.game.bets1}</div>
                        <div className="text-blue-400">{record.game.bets2}</div>
                      </div>
                      <div>
                        <div className="text-emerald-400">{record.game.money1}</div>
                        <div className="text-emerald-400">{record.game.money2}</div>
                      </div>
                    </div>

                    {/* 推荐 */}
                    <div className="rounded-lg p-3" style={{ background: "oklch(0.14 0.015 250)", border: "1px solid oklch(0.28 0.05 250 / 0.5)" }}>
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
                          <div key={i} className="rounded-lg p-2.5 flex items-start gap-3" style={{ background: "oklch(0.14 0.015 250)", border: "1px solid oklch(0.22 0.02 250)" }}>
                            <DirectionIcon direction={signal.direction} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-mono font-semibold ${signal.color}`}>{signal.label}</span>
                                <span className="text-[10px] font-mono text-muted-foreground">{signal.rule}</span>
                                <span className={`text-xs font-mono ml-auto ${scoreColor(signal.confidence)}`}>{signal.confidence}/10</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{signal.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        未触发规则，等待 /scan 融合实时数据
                      </div>
                    )}

                    {/* 操作 */}
                    <div className="flex items-center gap-2 pt-1">
                      {record.status === "PENDING" && (
                        <Button size="sm" variant="outline" onClick={() => handleMarkMerged(record.id)} className="text-xs font-mono h-7" style={{ borderColor: "oklch(0.35 0.05 250)", color: "oklch(0.65 0.15 145)" }}>
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          标记已融合
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(record.id)} className="text-xs font-mono h-7 text-muted-foreground hover:text-red-400">
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
      {history.length === 0 && parsedGames.length === 0 && !imagePreview && (
        <div className="rounded-xl p-10 text-center" style={{ background: "oklch(0.14 0.015 250)", border: "1px dashed oklch(0.25 0.02 250)" }}>
          <Database className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">待机队列为空</p>
          <p className="text-xs text-muted-foreground/60 mt-1">上传 Action Network 截图，AI 将自动识别所有比赛盘口数据</p>
        </div>
      )}
    </div>
  );
}
