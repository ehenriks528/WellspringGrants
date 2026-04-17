const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendConfirmationEmail(submission) {
  const deliveryFormat = submission.delivery_format === 'word' ? 'Word Document (.docx)' : 'Google Doc';
  const deadline = submission.grant_deadline
    ? new Date(submission.grant_deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'as specified';

  try {
    await resend.emails.send({
      from: 'Wellspring Grants <hello@wellspringgrants.com>',
      to: submission.contact_email,
      subject: `We received your grant application — ${submission.funder_name}`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f1eb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1eb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#2a6049;padding:28px 36px;">
              <p style="margin:0;font-size:18px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">Wellspring Grants</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;">
              <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">We've got your submission, ${submission.contact_name.split(' ')[0]}.</h1>
              <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">
                Thank you for trusting Wellspring Grants with your application. We've received your intake form and payment, and we're getting to work.
              </p>

              <!-- Submission summary box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7f4;border-left:3px solid #2a6049;border-radius:4px;margin-bottom:24px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 10px;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;color:#2a6049;">Your Submission</p>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#666;padding-bottom:6px;padding-right:16px;">Organization</td>
                        <td style="font-size:13px;color:#2c2c2c;font-weight:bold;padding-bottom:6px;">${submission.org_name}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#666;padding-bottom:6px;padding-right:16px;">Funder</td>
                        <td style="font-size:13px;color:#2c2c2c;font-weight:bold;padding-bottom:6px;">${submission.funder_name}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#666;padding-bottom:6px;padding-right:16px;">Grant Program</td>
                        <td style="font-size:13px;color:#2c2c2c;font-weight:bold;padding-bottom:6px;">${submission.grant_program}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#666;padding-bottom:6px;padding-right:16px;">Grant Deadline</td>
                        <td style="font-size:13px;color:#2c2c2c;font-weight:bold;padding-bottom:6px;">${deadline}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#666;padding-right:16px;">Delivery Format</td>
                        <td style="font-size:13px;color:#2c2c2c;font-weight:bold;">${deliveryFormat}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <h2 style="margin:0 0 12px;font-size:16px;color:#1a1a1a;">What happens next</h2>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding-bottom:12px;padding-right:12px;vertical-align:top;">
                    <span style="background:#2a6049;color:white;border-radius:50%;width:22px;height:22px;display:inline-block;text-align:center;font-size:12px;line-height:22px;font-weight:bold;">1</span>
                  </td>
                  <td style="padding-bottom:12px;vertical-align:top;">
                    <p style="margin:0;font-size:14px;color:#444;line-height:1.6;"><strong>We write your grant application</strong> — a complete, funder-targeted draft across all required sections.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:12px;padding-right:12px;vertical-align:top;">
                    <span style="background:#2a6049;color:white;border-radius:50%;width:22px;height:22px;display:inline-block;text-align:center;font-size:12px;line-height:22px;font-weight:bold;">2</span>
                  </td>
                  <td style="padding-bottom:12px;vertical-align:top;">
                    <p style="margin:0;font-size:14px;color:#444;line-height:1.6;"><strong>We review and polish it</strong> — a human editor checks every section for accuracy, tone, and alignment with the funder's priorities.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-right:12px;vertical-align:top;">
                    <span style="background:#2a6049;color:white;border-radius:50%;width:22px;height:22px;display:inline-block;text-align:center;font-size:12px;line-height:22px;font-weight:bold;">3</span>
                  </td>
                  <td style="vertical-align:top;">
                    <p style="margin:0;font-size:14px;color:#444;line-height:1.6;"><strong>We deliver within 48 hours</strong> — your completed application arrives as a ${deliveryFormat}, ready to submit.</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:14px;color:#666;line-height:1.7;">
                If we have any questions about your project before we begin, we'll reach out to you at <strong>${submission.contact_email}</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px 28px;border-top:1px solid #f0ede6;">
              <p style="margin:0;font-size:13px;color:#999;line-height:1.6;">
                Questions? Reply to this email or reach us at <a href="mailto:hello@wellspringgrants.com" style="color:#2a6049;">hello@wellspringgrants.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    });

    console.log(`Confirmation email sent to ${submission.contact_email}`);
  } catch (err) {
    // Email failure should never block the main flow
    console.error(`Email failed for ${submission.contact_email}:`, err.message);
  }
}

async function sendDeliveryEmail(submission, docxBuffer = null) {
  const firstName = (submission.contact_name || '').split(' ')[0] || 'there';
  const deadline = submission.grant_deadline
    ? new Date(submission.grant_deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'as specified';
  const scoreDisplay = submission.quality_score != null
    ? `${parseFloat(submission.quality_score).toFixed(1)} / 10`
    : 'N/A';

  const isWord = submission.delivery_format === 'word';
  const filename = `${(submission.org_name || 'Grant Application').replace(/[^a-z0-9]/gi, '_')}_${(submission.funder_name || '').replace(/[^a-z0-9]/gi, '_')}.docx`;

  // Doc access block — attachment note for Word, button for Google Doc
  const docAccessBlock = isWord && docxBuffer
    ? `<p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.7;">Your completed grant application is attached to this email as a Word document (<strong>${filename}</strong>). You can also <a href="${submission.doc_url}" style="color:#2a6049;">open it in Google Docs</a> if you prefer to edit online.</p>`
    : `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="${submission.doc_url}" style="display:inline-block;background:#2a6049;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:5px;font-size:15px;font-weight:bold;letter-spacing:0.3px;">Open Your Grant Application &rarr;</a>
                  </td>
                </tr>
              </table>`;

  // Step 1 copy adapts to format
  const step1Copy = isWord && docxBuffer
    ? `<strong>Review the attached Word document</strong> — read through the full application and confirm it accurately represents your organization and project.`
    : `<strong>Review the document in Google Docs</strong> — read through the full application and confirm it accurately represents your organization and project.`;

  const step2Copy = isWord && docxBuffer
    ? `<strong>Make any edits directly in the Word file</strong> — open the attachment in Microsoft Word or Google Docs and make changes as needed.`
    : `<strong>Make any edits directly in the doc</strong> — it's shared with your email, so you can edit it immediately without requesting access.`;

  const emailOptions = {
    from: 'Wellspring Grants <hello@wellspringgrants.com>',
    to: submission.contact_email,
    subject: `Your Grant Application Is Ready — ${submission.org_name}`,
    attachments: isWord && docxBuffer
      ? [{ filename, content: docxBuffer }]
      : undefined,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f1eb;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1eb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#2a6049;padding:28px 36px;">
              <p style="margin:0;font-size:18px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">Wellspring Grants</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;">
              <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">Your grant application is ready, ${firstName}.</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.7;">
                Your grant application for <strong>${submission.grant_program || submission.funder_name}</strong> is ready for your review.
              </p>

              <!-- Doc access -->
              ${docAccessBlock}

              <!-- Summary box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7f4;border-left:3px solid #2a6049;border-radius:4px;margin-bottom:28px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 10px;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;color:#2a6049;">Application Summary</p>
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#666;padding-bottom:6px;padding-right:16px;">Organization</td>
                        <td style="font-size:13px;color:#2c2c2c;font-weight:bold;padding-bottom:6px;">${submission.org_name}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#666;padding-bottom:6px;padding-right:16px;">Funder</td>
                        <td style="font-size:13px;color:#2c2c2c;font-weight:bold;padding-bottom:6px;">${submission.funder_name}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#666;padding-bottom:6px;padding-right:16px;">Grant Program</td>
                        <td style="font-size:13px;color:#2c2c2c;font-weight:bold;padding-bottom:6px;">${submission.grant_program || '—'}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#666;padding-bottom:6px;padding-right:16px;">Deadline</td>
                        <td style="font-size:13px;color:#2c2c2c;font-weight:bold;padding-bottom:6px;">${deadline}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#666;padding-right:16px;">Quality Score</td>
                        <td style="font-size:13px;color:#2c2c2c;font-weight:bold;">${scoreDisplay}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Next steps -->
              <h2 style="margin:0 0 14px;font-size:16px;color:#1a1a1a;">Next steps</h2>
              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding-bottom:12px;padding-right:12px;vertical-align:top;">
                    <span style="background:#2a6049;color:white;border-radius:50%;width:22px;height:22px;display:inline-block;text-align:center;font-size:12px;line-height:22px;font-weight:bold;">1</span>
                  </td>
                  <td style="padding-bottom:12px;vertical-align:top;">
                    <p style="margin:0;font-size:14px;color:#444;line-height:1.6;">${step1Copy}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:12px;padding-right:12px;vertical-align:top;">
                    <span style="background:#2a6049;color:white;border-radius:50%;width:22px;height:22px;display:inline-block;text-align:center;font-size:12px;line-height:22px;font-weight:bold;">2</span>
                  </td>
                  <td style="padding-bottom:12px;vertical-align:top;">
                    <p style="margin:0;font-size:14px;color:#444;line-height:1.6;">${step2Copy}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-right:12px;vertical-align:top;">
                    <span style="background:#2a6049;color:white;border-radius:50%;width:22px;height:22px;display:inline-block;text-align:center;font-size:12px;line-height:22px;font-weight:bold;">3</span>
                  </td>
                  <td style="vertical-align:top;">
                    <p style="margin:0;font-size:14px;color:#444;line-height:1.6;"><strong>Submit to ${submission.funder_name} by ${deadline}</strong> — follow the funder's submission instructions and use this document as your application.</p>
                  </td>
                </tr>
              </table>

              <!-- Before you submit -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffef8;border:1px solid #e8e4dc;border-radius:4px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 10px;font-size:13px;font-weight:bold;color:#1a1a1a;">Before You Submit</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#444;line-height:1.6;">&#8226; Confirm your EIN appears correctly throughout the application</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#444;line-height:1.6;">&#8226; Attach your 501(c)(3) determination letter to your submission</p>
                    <p style="margin:0;font-size:13px;color:#444;line-height:1.6;">&#8226; Attach your most recent Form 990</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:#666;line-height:1.7;">
                Questions? Reply to this email and Emily will get back to you within 24 hours.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px 28px;border-top:1px solid #f0ede6;">
              <p style="margin:0;font-size:13px;color:#999;line-height:1.6;">
                <a href="mailto:hello@wellspringgrants.com" style="color:#2a6049;">hello@wellspringgrants.com</a>
                &nbsp;&nbsp;|&nbsp;&nbsp;
                <a href="https://wellspringgrants.com" style="color:#2a6049;">wellspringgrants.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `
  };

  try {
    await resend.emails.send(emailOptions);
    console.log(`Delivery email sent to ${submission.contact_email} (format: ${submission.delivery_format || 'google_doc'})`);
  } catch (err) {
    console.error(`Delivery email failed for ${submission.contact_email}:`, err.message);
    throw err;
  }
}

async function sendAdminNotificationEmail(submission) {
  const deadline = submission.grant_deadline
    ? new Date(submission.grant_deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—';
  const amount = submission.amount_requested
    ? `$${Number(submission.amount_requested).toLocaleString()}`
    : '—';
  const billing = submission.is_comp
    ? `Complimentary (promo: ${submission.promo_code_used || '—'})`
    : 'Paid via Stripe';
  const format = submission.delivery_format === 'word' ? 'Word Document (.docx)' : 'Google Doc';
  const appUrl = process.env.APP_URL || 'https://wellspringgrants.com';
  const dashboardUrl = `${appUrl}/admin/submission/${submission.id}`;

  try {
    await resend.emails.send({
      from: 'Wellspring Grants <hello@wellspringgrants.com>',
      to: 'hello@wellspringgrants.com',
      subject: `New submission: ${submission.org_name} — ${submission.funder_name}`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f1eb;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1eb;padding:32px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:560px;width:100%;">

          <tr>
            <td style="background:#1b4332;padding:20px 28px;">
              <p style="margin:0;font-size:15px;font-weight:bold;color:#ffffff;">Wellspring Grants — New Submission</p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 20px;font-size:15px;color:#1a1a1a;">A new grant application just came in. Grant generation is underway — check the dashboard to review when it's ready.</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:5px;margin-bottom:24px;">
                <tr style="background:#f8f8f8;">
                  <td style="padding:10px 14px;font-size:12px;font-weight:bold;color:#555;text-transform:uppercase;letter-spacing:0.4px;border-bottom:1px solid #e0e0e0;" colspan="2">Submission Details</td>
                </tr>
                <tr>
                  <td style="padding:9px 14px;font-size:13px;color:#666;border-bottom:1px solid #f0f0f0;width:140px;">Organization</td>
                  <td style="padding:9px 14px;font-size:13px;color:#1a1a1a;font-weight:bold;border-bottom:1px solid #f0f0f0;">${submission.org_name}</td>
                </tr>
                <tr>
                  <td style="padding:9px 14px;font-size:13px;color:#666;border-bottom:1px solid #f0f0f0;">Funder</td>
                  <td style="padding:9px 14px;font-size:13px;color:#1a1a1a;font-weight:bold;border-bottom:1px solid #f0f0f0;">${submission.funder_name}</td>
                </tr>
                <tr>
                  <td style="padding:9px 14px;font-size:13px;color:#666;border-bottom:1px solid #f0f0f0;">Grant Program</td>
                  <td style="padding:9px 14px;font-size:13px;color:#1a1a1a;border-bottom:1px solid #f0f0f0;">${submission.grant_program || '—'}</td>
                </tr>
                <tr>
                  <td style="padding:9px 14px;font-size:13px;color:#666;border-bottom:1px solid #f0f0f0;">Amount</td>
                  <td style="padding:9px 14px;font-size:13px;color:#1a1a1a;font-weight:bold;border-bottom:1px solid #f0f0f0;">${amount}</td>
                </tr>
                <tr>
                  <td style="padding:9px 14px;font-size:13px;color:#666;border-bottom:1px solid #f0f0f0;">Deadline</td>
                  <td style="padding:9px 14px;font-size:13px;color:#1a1a1a;border-bottom:1px solid #f0f0f0;">${deadline}</td>
                </tr>
                <tr>
                  <td style="padding:9px 14px;font-size:13px;color:#666;border-bottom:1px solid #f0f0f0;">Contact</td>
                  <td style="padding:9px 14px;font-size:13px;color:#1a1a1a;border-bottom:1px solid #f0f0f0;">${submission.contact_name} &lt;${submission.contact_email}&gt;</td>
                </tr>
                <tr>
                  <td style="padding:9px 14px;font-size:13px;color:#666;border-bottom:1px solid #f0f0f0;">Delivery Format</td>
                  <td style="padding:9px 14px;font-size:13px;color:#1a1a1a;border-bottom:1px solid #f0f0f0;">${format}</td>
                </tr>
                <tr>
                  <td style="padding:9px 14px;font-size:13px;color:#666;">Billing</td>
                  <td style="padding:9px 14px;font-size:13px;color:#1a1a1a;">${billing}</td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}" style="display:inline-block;background:#1b4332;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:5px;font-size:14px;font-weight:bold;">View in Dashboard &rarr;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    });
    console.log(`Admin notification sent for submission ${submission.id}`);
  } catch (err) {
    console.error(`Admin notification failed for submission ${submission.id}:`, err.message);
  }
}

module.exports = { sendConfirmationEmail, sendDeliveryEmail, sendAdminNotificationEmail };
