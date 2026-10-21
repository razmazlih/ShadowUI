export type VerificationEmail = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

/** A self-contained email: no remote fonts, images, scripts, or tracking pixels. */
export function buildVerificationEmail(verificationUrl: string): VerificationEmail {
  const parsed = new URL(verificationUrl);
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Verification URL must be an HTTP(S) URL without credentials.');
  }
  const url = escapeHtml(verificationUrl);
  return {
    subject: 'אימות כתובת המייל שלך ב־ShadowUI',
    text: `ברוכים הבאים ל־ShadowUI\n\nכדי לאמת את כתובת המייל שלך, יש לפתוח את הקישור הבא:\n${verificationUrl}\n\nהאימות יתבצע אוטומטית עם פתיחת הקישור. אין צורך בלחיצה נוספת באתר.\n\nאם לא ביקשת לפתוח חשבון ב־ShadowUI, אפשר להתעלם מהמייל הזה.`,
    html: `<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>אימות כתובת המייל ב־ShadowUI</title></head>
<body style="margin:0;padding:0;background-color:#f3f5f9;color:#182239;font-family:Arial,Helvetica,sans-serif;direction:rtl;text-align:right;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">לחיצה אחת לאימות כתובת המייל ולהתחלה ב־ShadowUI.</div>
  <table role="presentation" dir="rtl" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background-color:#f3f5f9;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-collapse:separate;background-color:#ffffff;border:1px solid #e2e7ef;border-radius:20px;">
        <tr><td style="padding:32px 28px 24px;border-bottom:1px solid #edf0f5;"><span dir="ltr" style="display:inline-block;font-size:24px;font-weight:700;letter-spacing:-1px;color:#3449bb;">ShadowUI</span></td></tr>
        <tr><td style="padding:32px 28px;">
          <h1 style="margin:0 0 16px;font-size:26px;line-height:1.4;font-weight:700;color:#182239;">רק עוד צעד קטן, ואנחנו מתחילים</h1>
          <p style="margin:0 0 12px;font-size:17px;line-height:1.8;color:#42516a;">כדי להשלים את פתיחת החשבון, יש לאמת את כתובת המייל שלך.</p>
          <p style="margin:0 0 28px;font-size:16px;line-height:1.8;color:#42516a;">לחיצה על הכפתור תפתח את האתר ותאמת את המייל אוטומטית — בלי צורך באישור נוסף.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" bgcolor="#3449bb" style="border-radius:12px;background-color:#3449bb;"><a href="${url}" style="display:block;padding:17px 24px;border:1px solid #3449bb;border-radius:12px;color:#ffffff;text-decoration:none;text-align:center;font-size:18px;line-height:1.4;font-weight:700;">אימות כתובת המייל</a></td></tr></table>
          <p style="margin:28px 0 8px;font-size:13px;line-height:1.8;color:#66748a;">הכפתור לא נפתח? אפשר להעתיק את הקישור הזה לדפדפן:</p>
          <p dir="ltr" style="margin:0;text-align:left;word-break:break-all;overflow-wrap:anywhere;font-size:12px;line-height:1.8;"><a href="${url}" style="color:#3449bb;text-decoration:underline;">${url}</a></p>
        </td></tr>
        <tr><td style="padding:20px 28px;background-color:#f9fafc;border-top:1px solid #edf0f5;border-radius:0 0 20px 20px;"><p style="margin:0;font-size:13px;line-height:1.8;color:#66748a;">אם לא ביקשת לפתוח חשבון ב־ShadowUI, אפשר להתעלם מהמייל הזה.</p></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}
