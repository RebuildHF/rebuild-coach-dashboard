import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Phase / session config (mirrors PHASES constant in index.html) ──
const PHASES = [
  { phase: 1, unlockDay: 0,  sessions: ["1a", "1b", "1c"] },
  { phase: 2, unlockDay: 14, sessions: ["2a", "2b"] },
  { phase: 3, unlockDay: 28, sessions: ["3a", "3b"] },
  { phase: 4, unlockDay: 42, sessions: ["4a", "4b"] },
  { phase: 5, unlockDay: 56, sessions: ["5a", "5b"] },
  { phase: 6, unlockDay: 70, sessions: ["6a", "6b", "6c"] },
];

const SESSION_LABELS: Record<string, string> = {
  "1a": "1A — Welcome to Rebuild",
  "1b": "1B — Your Coaching Philosophy",
  "1c": "1C — Individual Development Plan",
  "2a": "2A — Energy Systems",
  "2b": "2B — Movement Screening",
  "3a": "3A — Class Structure",
  "3b": "3B — Pre-Class Check-In",
  "4a": "4A — Scaling & Modifications",
  "4b": "4B — Injury Documentation",
  "5a": "5A — Member Relationships",
  "5b": "5B — Retention Strategies",
  "6a": "6A — Advanced Coaching",
  "6b": "6B — Peer Feedback",
  "6c": "6C — Final Reflection",
};

interface CoachRow {
  coach_id: string;
  name: string;
  email: string;
  enrolled_date: string | null;
  data: Record<string, unknown>;
}

function daysSince(dateStr: string): number {
  const enrolled = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - enrolled.getTime()) / (1000 * 60 * 60 * 24));
}

function isUnlockedNow(phase: typeof PHASES[0], daysSinceEnroll: number): boolean {
  return daysSinceEnroll >= phase.unlockDay;
}

// Returns true if the phase unlocks during next calendar week (Mon–Sun)
function isUnlockingNextWeek(phase: typeof PHASES[0], enrolledDate: string): boolean {
  const enrolled = new Date(enrolledDate);
  const now = new Date();

  // Next Monday (start of next calendar week)
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);

  // Next Sunday (end of next calendar week)
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);
  nextSunday.setHours(23, 59, 59, 999);

  // Date this phase unlocks
  const unlockDate = new Date(enrolled);
  unlockDate.setDate(enrolled.getDate() + phase.unlockDay);
  unlockDate.setHours(0, 0, 0, 0);

  return unlockDate >= nextMonday && unlockDate <= nextSunday;
}

function buildEmailHtml(coach: CoachRow): string {
  const data = coach.data;
  const firstName = coach.name.split(" ")[0];
  const days = coach.enrolled_date ? daysSince(coach.enrolled_date) : 0;
  const now = new Date();

  // ── Sessions completed in the last 7 days ──
  // We look for {sessionId}_submitted_at if it exists, otherwise check _submitted flag
  // Since we don't store submitted_at timestamps, we collect all submitted sessions
  // and present the full list (simple, reliable)
  const completedThisWeek: string[] = [];
  for (const p of PHASES) {
    for (const sid of p.sessions) {
      if (data[`${sid}_submitted`]) {
        // We don't have timestamps so we show ALL completed sessions as a summary
        completedThisWeek.push(sid);
      }
    }
  }

  // ── Mentor responses received ──
  const mentorResponses: string[] = [];
  for (const p of PHASES) {
    for (const sid of p.sessions) {
      if (data[`${sid}_mentor_response`]) {
        mentorResponses.push(sid);
      }
    }
  }

  // ── Sessions/phases unlocking next calendar week (Mon–Sun) ──
  const unlockingNextWeek: Array<{ label: string; unlockDate: Date }> = [];
  if (coach.enrolled_date) {
    const enrolled = new Date(coach.enrolled_date);
    for (const p of PHASES) {
      if (isUnlockingNextWeek(p, coach.enrolled_date)) {
        const unlockDate = new Date(enrolled);
        unlockDate.setDate(enrolled.getDate() + p.unlockDay);
        unlockingNextWeek.push({
          label: `Phase ${p.phase} — ${p.sessions.map(s => SESSION_LABELS[s] || s).join(", ")}`,
          unlockDate,
        });
      }
    }
  }

  // ── Current phase survey nudge ──
  let surveyNudge = "";
  if (coach.enrolled_date) {
    for (let i = PHASES.length - 1; i >= 0; i--) {
      const p = PHASES[i];
      if (isUnlockedNow(p, days)) {
        if (!data[`phase${p.phase}_survey_submitted`]) {
          surveyNudge = `Phase ${p.phase}`;
        }
        break;
      }
    }
  }

  // ── Progress bar ──
  const totalSessions = PHASES.flatMap(p => p.sessions).length;
  const completedCount = completedThisWeek.length;
  const progressPct = Math.round((completedCount / totalSessions) * 100);

  // ── Build HTML ──
  const BLUE = "#3478EB";
  const DARK = "#111827";
  const MUTED = "#6B7280";
  const LIGHT_BG = "#F9FAFB";
  const BORDER = "#E5E7EB";
  const GREEN = "#059669";
  const AMBER = "#D97706";

  const completedRows = completedThisWeek.length > 0
    ? completedThisWeek.map(sid => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};font-size:14px;color:${DARK};">
            ✅ ${SESSION_LABELS[sid] || sid}
          </td>
        </tr>`).join("")
    : `<tr><td style="padding:8px 12px;font-size:14px;color:${MUTED};font-style:italic;">No sessions completed yet — your journey is just beginning!</td></tr>`;

  const mentorRows = mentorResponses.length > 0
    ? mentorResponses.map(sid => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};font-size:14px;color:${DARK};">
            💬 ${SESSION_LABELS[sid] || sid}
          </td>
        </tr>`).join("")
    : `<tr><td style="padding:8px 12px;font-size:14px;color:${MUTED};font-style:italic;">No mentor feedback yet — check back soon.</td></tr>`;

  const unlockRows = unlockingNextWeek.length > 0
    ? unlockingNextWeek.map(u => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid ${BORDER};font-size:14px;color:${DARK};">
            🔓 ${u.label}
            <span style="margin-left:8px;font-size:12px;color:${AMBER};font-weight:600;">
              opens ${u.unlockDate.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" })}
            </span>
          </td>
        </tr>`).join("")
    : `<tr><td style="padding:8px 12px;font-size:14px;color:${MUTED};font-style:italic;">Nothing new unlocking next week — keep working through your current phase.</td></tr>`;

  const surveySection = surveyNudge
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border:2px solid ${AMBER};border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:#FFFBEB;padding:16px 20px;">
            <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:${AMBER};">📋 Phase ${surveyNudge.replace("Phase ", "")} Survey Pending</p>
            <p style="margin:0;font-size:14px;color:${DARK};">
              You haven't completed the ${surveyNudge} check-in survey yet.
              It only takes 2 minutes and helps your mentor support you better.
            </p>
            <a href="https://rebuild-coach-dashboard.vercel.app"
               style="display:inline-block;margin-top:12px;padding:8px 16px;background:${AMBER};color:white;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;">
              Complete Survey →
            </a>
          </td>
        </tr>
      </table>`
    : "";

  const weekOf = now.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly Coaching Digest</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:${BLUE};padding:28px 32px;border-radius:12px 12px 0 0;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase;">Rebuild Health &amp; Fitness</p>
              <h1 style="margin:0;font-size:26px;font-weight:800;color:white;">Your Weekly Digest</h1>
              <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.8);">Week of ${weekOf}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:white;padding:28px 32px;">

              <p style="margin:0 0 24px;font-size:16px;color:${DARK};">Hi ${firstName} 👋</p>
              <p style="margin:0 0 24px;font-size:15px;color:${MUTED};line-height:1.6;">
                Here's a quick look at your progress this week and what's coming up next in your 12-week coaching journey.
              </p>

              <!-- Progress bar -->
              <div style="margin-bottom:28px;padding:16px;background:${LIGHT_BG};border-radius:8px;border:1px solid ${BORDER};">
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${DARK};">Overall Progress — ${completedCount} of ${totalSessions} sessions completed</p>
                <div style="background:#E5E7EB;border-radius:99px;height:8px;overflow:hidden;">
                  <div style="background:${BLUE};height:8px;width:${progressPct}%;border-radius:99px;"></div>
                </div>
                <p style="margin:6px 0 0;font-size:12px;color:${MUTED};">${progressPct}% complete</p>
              </div>

              <!-- Sessions completed -->
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;color:${DARK};">Sessions Completed</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:8px;overflow:hidden;margin-bottom:24px;">
                ${completedRows}
              </table>

              <!-- Mentor feedback -->
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;color:${DARK};">Mentor Feedback Received</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:8px;overflow:hidden;margin-bottom:24px;">
                ${mentorRows}
              </table>

              <!-- Upcoming unlocks -->
              <h2 style="margin:0 0 12px;font-size:16px;font-weight:700;color:${DARK};">Opening Next Week</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BORDER};border-radius:8px;overflow:hidden;margin-bottom:24px;">
                ${unlockRows}
              </table>

              <!-- Survey nudge (conditional) -->
              ${surveySection}

              <!-- CTA -->
              <div style="margin-top:28px;text-align:center;">
                <a href="https://rebuild-coach-dashboard.vercel.app"
                   style="display:inline-block;padding:13px 28px;background:${BLUE};color:white;text-decoration:none;border-radius:8px;font-size:15px;font-weight:700;">
                  Open My Dashboard →
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:${LIGHT_BG};padding:20px 32px;border-radius:0 0 12px 12px;border:1px solid ${BORDER};border-top:none;text-align:center;">
              <p style="margin:0;font-size:12px;color:${MUTED};">
                Rebuild Health &amp; Fitness · 12-Week Coach Onboarding Program<br>
                You're receiving this because you're enrolled as a coach in training.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

serve(async (req) => {
  // Allow manual trigger via POST for testing
  const isManual = req.method === "POST";

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;

    // Fetch all coaches with their email from auth.users
    const { data: coaches, error } = await supabase.rpc("get_coaches_for_digest");

    if (error) {
      // Fallback: direct SQL approach
      const { data: rawCoaches, error: sqlError } = await supabase
        .from("users")
        .select("id, name")
        .eq("role", "coach");

      if (sqlError) throw sqlError;

      // This path is hit if the RPC doesn't exist yet — we handle gracefully
      return new Response(
        JSON.stringify({ error: "RPC get_coaches_for_digest not found. Run the migration first.", coaches: rawCoaches }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const results: Array<{ coach: string; status: string; error?: string }> = [];

    for (const coach of (coaches as CoachRow[]) ?? []) {
      if (!coach.email) {
        results.push({ coach: coach.name, status: "skipped — no email" });
        continue;
      }

      const html = buildEmailHtml(coach);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Rebuild Coaching <digest@rebuildcoaching.com.au>",
          to: coach.email,
          subject: `Your weekly coaching digest — ${new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long" })}`,
          html,
        }),
      });

      if (res.ok) {
        results.push({ coach: coach.name, status: "sent" });
      } else {
        const err = await res.text();
        results.push({ coach: coach.name, status: "failed", error: err });
      }
    }

    return new Response(
      JSON.stringify({ sent: results.filter(r => r.status === "sent").length, results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
