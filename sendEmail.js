const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendConfirmationEmail(submission) {
  const deliveryFormat = submission.delivery_format === 'word' ? 'Word Document (.docx)' : 'Google Doc';
  const deadline = submission.grant_deadline
    ? new Date(submission.grant_deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'as specified';

  try {
    await resend.emails.send({
      from: 'Wellspring Grants <onboarding@resend.dev>',
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

module.exports = { sendConfirmationEmail };
