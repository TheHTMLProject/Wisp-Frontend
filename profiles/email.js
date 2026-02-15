export function getLoginEmail(code) {
    const quotes = [
        "Privacy first, always. - Lightlink",
        "Your data, yours. - Lightlink",
        "Unsure? Undoubtably. - Lightlink",
        "What's yours, stays yours. - Lightlink"
    ];
    const quote = quotes[Math.floor(Math.random() * quotes.length)];

    return `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; background-color:#18181b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#ffffff;">
  <div style="max-width: 480px; margin: 40px auto; background-color: #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
    <div style="background-color: #000000; padding: 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1);">
       <h1 style="margin:0; font-size: 24px; font-weight: 800; letter-spacing: -1px; background: linear-gradient(to right, #fff, #aaa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: #ffffff;">Lightlink</h1>
    </div>
    <div style="padding: 32px 24px; text-align: center;">
      <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #ffffff;">Login Verification</h2>
      <p style="margin: 0 0 24px; color: #a1a1aa; font-size: 14px; line-height: 1.5;">Enter this code to complete your login. (Expires in 5 minutes)</p>

      <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.1);">
         <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #3b82f6; display:block;">${code}</span>
      </div>

      <p style="margin: 0; color: #71717a; font-size: 12px;">If you did not request this, you can safely ignore this email, or change your password if it persists.</p>
    </div>
    <div style="background-color: #000000; padding: 16px; text-align: center; border-top: 1px solid rgba(255,255,255,0.1);">
       <p style="margin: 0; color: #52525b; font-size: 12px; font-style: italic;">"${quote}"</p>
    </div>
  </div>
</body>
</html>
    `;
}
