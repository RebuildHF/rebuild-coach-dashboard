import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const NOTIFY_EMAIL = "fraserharrison13@gmail.com";

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
    const { coachName, sessionId, sessionTitle, phaseName, answers } = await req.json();

    if (!coachName || !sessionId) {
      return new Response(JSON.stringify({ error: "coachName and sessionId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const answersHtml = (answers || []).map((a: { question: string; answer: string }, i: number) => {
      const q = a.question;
      const ans = a.answer || "(no answer)";
      return `<div style="margin-bottom:16px;">
        <p style="font-weight:600;color:#374151;margin-bottom:4px;">Q${i + 1}: ${q}</p>
        <p style="color:#1f2937;background:#f9fafb;padding:10px;border-radius:6px;border-left:3px solid #3478EB;">${ans.replace(/\n/g, "<br>")}</p>
      </div>`;
    }).join("");

    const html = `
      <div style="font-family:Calibri,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#111827;padding:20px 24px;border-radius:10px 10px 0 0;">
          <span style="color:#fff;font-size:20px;font-weight:700;">Rebuild Coach Development</span>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
          <h2 style="font-size:18px;color:#111827;margin-bottom:6px;">New Reflection Submitted</h2>
          <p style="color:#6b7280;font-size:14px;margin-bottom:20px;">
            <strong>${coachName}</strong> has submitted their reflection for
            <strong>Session ${sessionId.toUpperCase()}: ${sessionTitle}</strong><br>
            Phase: ${phaseName}
          </p>
          <div style="border-top:1px solid #e5e7eb;padding-top:20px;">
            ${answersHtml}
          </div>
          <p style="margin-top:24px;font-size:12px;color:#9ca3af;">Log in to the dashboard to leave a mentor response.</p>
        </div>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Rebuild Coaching <coaching@contact.rebuildcoaching.education>",
        reply_to: "Fraserharrison13@hotmail.com",
        to: [NOTIFY_EMAIL],
        subject: `Reflection submitted: ${coachName} — Session ${sessionId.toUpperCase()}: ${sessionTitle}`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: errText }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "sent" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
