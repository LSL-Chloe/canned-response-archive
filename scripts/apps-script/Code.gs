/**
 * Canned Response Archive - Gmail OTP relay.
 *
 * Deploy as an Apps Script Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Set a >=32-character OTP_MAILER_SECRET in Project Settings > Script Properties.
 * The same secret must be set on the Cloudflare Worker, NOT in this source file.
 *
 * The script rejects unsigned, stale, malformed and replayed requests.
 * Never log OTP bodies or your secret. Never call this from browser JavaScript.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents ||
        e.postData.contents.length > 4000) return reply_({ ok: false });

    var incoming = JSON.parse(e.postData.contents);
    if (typeof incoming.payload !== 'string' ||
        incoming.payload.length > 2000 ||
        typeof incoming.signature !== 'string' ||
        !/^[0-9a-f]{64}$/.test(incoming.signature)) {
      return reply_({ ok: false });
    }

    var secret = PropertiesService.getScriptProperties().getProperty('OTP_MAILER_SECRET');
    if (!secret || secret.length < 32) return reply_({ ok: false });

    var signed = Utilities.computeHmacSha256Signature(incoming.payload, secret);
    var expected = signed.map(function (b) {
      return (b & 255).toString(16).padStart(2, '0');
    }).join('');

    if (!constantTimeEqual_(incoming.signature, expected)) return reply_({ ok: false });

    var body = JSON.parse(incoming.payload);
    if (typeof body !== 'object' || body === null ||
        typeof body.to !== 'string' || body.to.length > 254 ||
        !/^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(body.to) ||
        typeof body.code !== 'string' || !/^\d{6}$/.test(body.code) ||
        typeof body.nonce !== 'string' || !/^[a-f0-9]{64}$/.test(body.nonce) ||
        !['signup', 'recover_pin', 'add_email', 'change_email'].includes(body.purpose) ||
        typeof body.issuedAt !== 'number' ||
        Math.abs(Date.now() - body.issuedAt) > 120000) {
      return reply_({ ok: false });
    }

    // Basic replay defense; the Worker also rate-limits sending and OTP entry.
    var cache = CacheService.getScriptCache();
    var replayKey = 'otp:' + body.nonce;
    if (cache.get(replayKey)) return reply_({ ok: false });
    cache.put(replayKey, '1', 600);

    if (MailApp.getRemainingDailyQuota() < 1) return reply_({ ok: false });

    var purposeDescription = {
      signup: 'complete your signup',
      recover_pin: 'reset your account PIN',
      add_email: 'verify your email address',
      change_email: 'verify your new email address'
    }[body.purpose];
    MailApp.sendEmail({
      to: body.to,
      subject: 'Canned Response Archive - verification code',
      body: 'Your verification code is: ' + body.code +
        '\n\nUse this code to ' + purposeDescription +
        '. It expires in 10 minutes.' +
        '\n\nIf you did not request this, ignore this message.',
      name: 'Canned Response Archive'
    });
    return reply_({ ok: true });
  } catch (error) {
    // No OTP or secrets should ever be written to logs.
    console.error('A mail relay request could not be processed');
    return reply_({ ok: false });
  }
}
function constantTimeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var different = 0;
  for (var i = 0; i < a.length; i++) different |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return different === 0;
}
function reply_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
/** Run once in the editor, using your Gmail account, to grant MailApp access. */
function authorizeMailService() {
  console.log('Remaining recipients: ' + MailApp.getRemainingDailyQuota());
}
