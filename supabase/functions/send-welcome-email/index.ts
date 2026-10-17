import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { coach_id } = await req.json();
    if (!coach_id) {
      return new Response(JSON.stringify({ error: "coach_id required" }), { status: 400 });
    }

    // Fetch coach details
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: coach, error } = await sb
      .from("users")
      .select("name, email")
      .eq("id", coach_id)
      .single();

    if (error || !coach) {
      return new Response(JSON.stringify({ error: "Coach not found" }), { status: 404 });
    }

    if (!coach.email) {
      return new Response(JSON.stringify({ status: "skipped", reason: "no email on file" }));
    }

    const firstName = coach.name?.split(" ")[0] || coach.name || "Coach";
    const html = buildWelcomeEmail(firstName);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Rebuild Coaching <onboarding@resend.dev>",
        to: coach.email,
        subject: "Welcome to the Rebuild Coaching Program 🎉",
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: errText }), { status: 500 });
    }

    return new Response(JSON.stringify({ status: "sent", to: coach.email }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

function buildWelcomeEmail(firstName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to Rebuild</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:Georgia,serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr>
    <td style="background:#1a1a1a;padding:32px 40px;text-align:center;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;color:#ffffff;font-family:Georgia,serif;font-size:28px;letter-spacing:2px;text-transform:uppercase;">REBUILD</h1>
      <p style="margin:6px 0 0;color:#c8a96e;font-family:Arial,sans-serif;font-size:13px;letter-spacing:3px;text-transform:uppercase;">Coaching Program</p>
    </td>
  </tr>

  <!-- Welcome body -->
  <tr>
    <td style="background:#ffffff;padding:40px 40px 32px;">
      <h2 style="margin:0 0 16px;color:#1a1a1a;font-family:Georgia,serif;font-size:22px;">Welcome, ${firstName}!</h2>
      <p style="margin:0 0 20px;color:#444;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;">
        You've been enrolled in the <strong>Rebuild Coaching Program</strong> — a structured 12-week journey designed to help you grow as a coach, sharpen your skills, and build lasting confidence in your craft.
      </p>
      <p style="margin:0 0 28px;color:#444;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;">
        Here's what to expect over the coming weeks.
      </p>
    </td>
  </tr>

  <!-- Program overview -->
  <tr>
    <td style="background:#f9f8f4;padding:0 40px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:24px 0 16px;">
            <h3 style="margin:0 0 20px;color:#1a1a1a;font-family:Georgia,serif;font-size:17px;border-bottom:2px solid #c8a96e;padding-bottom:10px;">The 6-Phase Program</h3>

            <!-- Phase 1 -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr>
                <td width="48" valign="top">
                  <div style="width:36px;height:36px;background:#1a1a1a;border-radius:50%;text-align:center;line-height:36px;color:#c8a96e;font-family:Arial,sans-serif;font-weight:bold;font-size:14px;">1</div>
                </td>
                <td valign="top" style="padding-left:12px;">
                  <p style="margin:0 0 2px;color:#1a1a1a;font-family:Arial,sans-serif;font-weight:bold;font-size:14px;">Foundations <span style="color:#888;font-weight:normal;">— Week 1–2</span></p>
                  <p style="margin:0;color:#555;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;">Build your coaching identity and understand the principles that underpin great coaching.</p>
                </td>
              </tr>
            </table>

            <!-- Phase 2 -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr>
                <td width="48" valign="top">
                  <div style="width:36px;height:36px;background:#1a1a1a;border-radius:50%;text-align:center;line-height:36px;color:#c8a96e;font-family:Arial,sans-serif;font-weight:bold;font-size:14px;">2</div>
                </td>
                <td valign="top" style="padding-left:12px;">
                  <p style="margin:0 0 2px;color:#1a1a1a;font-family:Arial,sans-serif;font-weight:bold;font-size:14px;">Communication & Connection <span style="color:#888;font-weight:normal;">— Week 3–4</span></p>
                  <p style="margin:0;color:#555;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;">Learn how to communicate clearly and build strong relationships with your members.</p>
                </td>
              </tr>
            </table>

            <!-- Phase 3 -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr>
                <td width="48" valign="top">
                  <div style="width:36px;height:36px;background:#1a1a1a;border-radius:50%;text-align:center;line-height:36px;color:#c8a96e;font-family:Arial,sans-serif;font-weight:bold;font-size:14px;">3</div>
                </td>
                <td valign="top" style="padding-left:12px;">
                  <p style="margin:0 0 2px;color:#1a1a1a;font-family:Arial,sans-serif;font-weight:bold;font-size:14px;">Programming & Delivery <span style="color:#888;font-weight:normal;">— Week 5–6</span></p>
                  <p style="margin:0;color:#555;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;">Deepen your understanding of class programming, cueing, and delivery techniques.</p>
                </td>
              </tr>
            </table>

            <!-- Phase 4 -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr>
                <td width="48" valign="top">
                  <div style="width:36px;height:36px;background:#1a1a1a;border-radius:50%;text-align:center;line-height:36px;color:#c8a96e;font-family:Arial,sans-serif;font-weight:bold;font-size:14px;">4</div>
                </td>
                <td valign="top" style="padding-left:12px;">
                  <p style="margin:0 0 2px;color:#1a1a1a;font-family:Arial,sans-serif;font-weight:bold;font-size:14px;">Member Experience <span style="color:#888;font-weight:normal;">— Week 7–8</span></p>
                  <p style="margin:0;color:#555;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;">Explore what creates an exceptional experience and how to retain and energise your community.</p>
                </td>
              </tr>
            </table>

            <!-- Phase 5 -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
              <tr>
                <td width="48" valign="top">
                  <div style="width:36px;height:36px;background:#1a1a1a;border-radius:50%;text-align:center;line-height:36px;color:#c8a96e;font-family:Arial,sans-serif;font-weight:bold;font-size:14px;">5</div>
                </td>
                <td valign="top" style="padding-left:12px;">
                  <p style="margin:0 0 2px;color:#1a1a1a;font-family:Arial,sans-serif;font-weight:bold;font-size:14px;">Leadership & Growth <span style="color:#888;font-weight:normal;">— Week 9–10</span></p>
                  <p style="margin:0;color:#555;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;">Develop your leadership presence and long-term growth mindset as a coach.</p>
                </td>
              </tr>
            </table>

            <!-- Phase 6 -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
              <tr>
                <td width="48" valign="top">
                  <div style="width:36px;height:36px;background:#c8a96e;border-radius:50%;text-align:center;line-height:36px;color:#1a1a1a;font-family:Arial,sans-serif;font-weight:bold;font-size:14px;">6</div>
                </td>
                <td valign="top" style="padding-left:12px;">
                  <p style="margin:0 0 2px;color:#1a1a1a;font-family:Arial,sans-serif;font-weight:bold;font-size:14px;">Mastery & Reflection <span style="color:#888;font-weight:normal;">— Week 11–12</span></p>
                  <p style="margin:0;color:#555;font-family:Arial,sans-serif;font-size:13px;line-height:1.6;">Bring it all together, reflect on your growth, and set your vision for what's next.</p>
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- How it works -->
  <tr>
    <td style="background:#ffffff;padding:32px 40px;">
      <h3 style="margin:0 0 16px;color:#1a1a1a;font-family:Georgia,serif;font-size:17px;">How the Program Works</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:0 0 12px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="28" valign="top" style="padding-top:2px;">
                  <div style="width:20px;height:20px;background:#c8a96e;border-radius:50%;text-align:center;line-height:20px;color:#1a1a1a;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;">✓</div>
                </td>
                <td style="padding-left:10px;color:#444;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">
                  <strong>New phases unlock every two weeks</strong> based on your start date — no rushing, no falling behind.
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 12px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="28" valign="top" style="padding-top:2px;">
                  <div style="width:20px;height:20px;background:#c8a96e;border-radius:50%;text-align:center;line-height:20px;color:#1a1a1a;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;">✓</div>
                </td>
                <td style="padding-left:10px;color:#444;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">
                  <strong>Each phase contains sessions</strong> with videos, tasks, and short reflections to complete at your own pace.
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 12px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="28" valign="top" style="padding-top:2px;">
                  <div style="width:20px;height:20px;background:#c8a96e;border-radius:50%;text-align:center;line-height:20px;color:#1a1a1a;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;">✓</div>
                </td>
                <td style="padding-left:10px;color:#444;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">
                  <strong>Your mentor will review your submissions</strong> and leave personalised feedback throughout the program.
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="28" valign="top" style="padding-top:2px;">
                  <div style="width:20px;height:20px;background:#c8a96e;border-radius:50%;text-align:center;line-height:20px;color:#1a1a1a;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;">✓</div>
                </td>
                <td style="padding-left:10px;color:#444;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">
                  <strong>You'll receive a weekly digest</strong> every Saturday morning summarising your progress and any upcoming unlocks.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- CTA -->
  <tr>
    <td style="background:#1a1a1a;padding:32px 40px;text-align:center;border-radius:0 0 8px 8px;">
      <p style="margin:0 0 20px;color:#c8a96e;font-family:Arial,sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;">Ready to get started?</p>
      <a href="https://rebuild-coach-dashboard.vercel.app" style="display:inline-block;background:#c8a96e;color:#1a1a1a;font-family:Arial,sans-serif;font-weight:bold;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:4px;letter-spacing:1px;">Open Your Dashboard →</a>
      <p style="margin:24px 0 0;color:#777;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;">
        Log in with your access code. If you don't have one yet, Fraser will send it to you shortly.<br>
        Questions? Reply to this email and we'll get back to you.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>

</body>
</html>`;
}
