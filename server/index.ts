import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========== Turso HTTP Client ==========
const TURSO_DB_URL = process.env.TURSO_DB_URL || "https://sea-memory-xmkinc.aws-ap-northeast-1.turso.io";
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjE3ODA4NjI0NDUsImlhdCI6MTc3MzA4NjQ0NSwiaWQiOiIwMTljZDQyZi0yODAxLTdmMDAtYjRkOS1kOTQ2MmVkMTM1MTQiLCJyaWQiOiIwOGUxZGNmNC04NTAzLTQyZjYtODY2OS0xMGQxODE2YmM5ZjAifQ.rgxX3pd4Imsw0S-hDqzmZ1MwBSUaitz5P3U62HuE4xrXhqLjUhx7rYIRVFGdOL8HdDttLgWGTGXZ3SVjzGR7BQ";

interface TursoValue {
  type: string;
  value: string | null;
}

function fromTursoValue(cell: TursoValue): string | number | null {
  if (!cell || cell.type === "null") return null;
  if (cell.type === "integer") return parseInt(cell.value as string, 10);
  if (cell.type === "float") return parseFloat(cell.value as string);
  return cell.value;
}

async function tursoQuery(sql: string, args: (string | number | null)[] = []): Promise<Record<string, unknown>[]> {
  const body = {
    requests: [
      {
        type: "execute",
        stmt: {
          sql,
          args: args.map((a) => {
            if (a === null) return { type: "null" };
            if (typeof a === "number") return Number.isInteger(a) ? { type: "integer", value: String(a) } : { type: "float", value: String(a) };
            return { type: "text", value: String(a) };
          }),
        },
      },
      { type: "close" },
    ],
  };

  const resp = await fetch(`${TURSO_DB_URL}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TURSO_AUTH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Turso HTTP ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as { results: { type: string; response?: { result: { cols: { name: string }[]; rows: TursoValue[][] } } }[] };
  const result = data.results?.[0];
  if (result?.type !== "ok" || !result.response) return [];

  const { cols, rows } = result.response.result;
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      obj[col.name] = fromTursoValue(row[i]);
    });
    return obj;
  });
}

// ========== Express App ==========
async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json());

  // CORS for dev
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    next();
  });

  // ========== API Routes ==========

  // GET /api/health — 服务健康检查
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), turso_url: TURSO_DB_URL });
  });

  // GET /api/dashboard/summary — Dashboard 统计汇总
  app.get("/api/dashboard/summary", async (_req, res) => {
    try {
      const [roiRows, signalRows, todayRows, settledRows] = await Promise.all([
        tursoQuery(`SELECT
          COUNT(*) as total_decisions,
          SUM(CASE WHEN result IN ('win','half_win') THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN result IN ('loss','half_loss') THEN 1 ELSE 0 END) as losses,
          SUM(CASE WHEN result = 'push' THEN 1 ELSE 0 END) as pushes,
          SUM(CASE WHEN result IS NULL THEN 1 ELSE 0 END) as pending
          FROM decisions`),
        tursoQuery(`SELECT COUNT(*) as total FROM confidence_scores`),
        tursoQuery(`SELECT COUNT(*) as today FROM decisions WHERE date(created_at) = date('now')`),
        tursoQuery(`SELECT
          COUNT(*) as settled,
          SUM(CASE WHEN was_correct = 1 THEN 1 ELSE 0 END) as correct
          FROM confidence_scores WHERE was_correct IS NOT NULL`),
      ]);

      const roi = roiRows[0] || {};
      const total = Number(roi.total_decisions) || 0;
      const wins = Number(roi.wins) || 0;
      const losses = Number(roi.losses) || 0;
      const settled = Number(settledRows[0]?.settled) || 0;
      const correct = Number(settledRows[0]?.correct) || 0;

      res.json({
        total_decisions: total,
        wins,
        losses,
        pushes: Number(roi.pushes) || 0,
        pending: Number(roi.pending) || 0,
        win_rate: settled > 0 ? Math.round((correct / settled) * 1000) / 10 : null,
        total_signals: Number(signalRows[0]?.total) || 0,
        today_decisions: Number(todayRows[0]?.today) || 0,
        settled_signals: settled,
        correct_signals: correct,
      });
    } catch (err) {
      console.error("/api/dashboard/summary error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/signals — 最近信号列表
  app.get("/api/signals", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const rows = await tursoQuery(
        `SELECT id, prey_event_id, team, opponent, game_date, direction,
                confidence_score, signal_level, emotion_tag, model_used,
                was_correct, settled_at, created_at
         FROM confidence_scores
         ORDER BY created_at DESC
         LIMIT ?`,
        [limit]
      );
      res.json({ signals: rows, total: rows.length });
    } catch (err) {
      console.error("/api/signals error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/reviews — 决策复盘列表
  app.get("/api/reviews", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const rows = await tursoQuery(
        `SELECT id, prey_event_id, team, opponent, game_date, direction,
                bet_type, spread, result, created_at, settled_at
         FROM decisions
         ORDER BY created_at DESC
         LIMIT ?`,
        [limit]
      );
      res.json({ reviews: rows, total: rows.length });
    } catch (err) {
      console.error("/api/reviews error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/reviews/roi — ROI 统计
  app.get("/api/reviews/roi", async (_req, res) => {
    try {
      const rows = await tursoQuery(
        `SELECT
          bet_type,
          COUNT(*) as total,
          SUM(CASE WHEN result IN ('win','half_win') THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN result IN ('loss','half_loss') THEN 1 ELSE 0 END) as losses,
          SUM(CASE WHEN result = 'push' THEN 1 ELSE 0 END) as pushes
         FROM decisions
         WHERE result IS NOT NULL
         GROUP BY bet_type`
      );
      res.json({ roi_by_type: rows });
    } catch (err) {
      console.error("/api/reviews/roi error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/strategies/config — 读取策略权重配置
  app.get("/api/strategies/config", async (_req, res) => {
    try {
      const rows = await tursoQuery(
        `SELECT strategy_id, weight, enabled, updated_at
         FROM strategy_weights
         ORDER BY strategy_id`
      );
      // 同时获取最新的权重历史
      const history = await tursoQuery(
        `SELECT weights_json, created_at
         FROM weight_history
         ORDER BY created_at DESC
         LIMIT 5`
      );
      res.json({ strategies: rows, weight_history: history });
    } catch (err) {
      console.error("/api/strategies/config error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/strategies/config — 更新策略权重
  app.post("/api/strategies/config", async (req, res) => {
    try {
      const { strategy_id, weight, enabled } = req.body;
      if (!strategy_id) {
        return res.status(400).json({ error: "strategy_id is required" });
      }
      await tursoQuery(
        `INSERT INTO strategy_weights (strategy_id, weight, enabled, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(strategy_id) DO UPDATE SET
           weight = excluded.weight,
           enabled = excluded.enabled,
           updated_at = excluded.updated_at`,
        [strategy_id, weight ?? null, enabled !== undefined ? (enabled ? 1 : 0) : null]
      );
      res.json({ success: true, strategy_id });
    } catch (err) {
      console.error("/api/strategies/config POST error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/strategies/backtest — 回测数据
  app.get("/api/strategies/backtest", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const rows = await tursoQuery(
        `SELECT cs.id, cs.prey_event_id, cs.team, cs.opponent, cs.game_date,
                cs.direction, cs.confidence_score, cs.signal_level,
                cs.was_correct, cs.created_at,
                d.result as decision_result, d.bet_type, d.spread
         FROM confidence_scores cs
         LEFT JOIN decisions d ON cs.prey_event_id = d.prey_event_id
         WHERE cs.was_correct IS NOT NULL
         ORDER BY cs.created_at DESC
         LIMIT ?`,
        [limit]
      );
      res.json({ backtest: rows, total: rows.length });
    } catch (err) {
      console.error("/api/strategies/backtest error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/games/recent — 最近比赛（来自 Turso 的 prey 表）
  app.get("/api/games/recent", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const rows = await tursoQuery(
        `SELECT id, event_id, team, opponent, game_date, emotion_tag,
                signal_level, created_at
         FROM prey
         ORDER BY game_date DESC
         LIMIT ?`,
        [limit]
      );
      res.json({ games: rows, total: rows.length });
    } catch (err) {
      console.error("/api/games/recent error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/weight-history — 权重调整历史
  app.get("/api/weight-history", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const rows = await tursoQuery(
        `SELECT id, weights_json, trigger_reason, created_at
         FROM weight_history
         ORDER BY created_at DESC
         LIMIT ?`,
        [limit]
      );
      res.json({ history: rows });
    } catch (err) {
      console.error("/api/weight-history error:", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // ========== Static Files ==========
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`Turso DB: ${TURSO_DB_URL}`);
  });
}

startServer().catch(console.error);
