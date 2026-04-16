const { google } = require('googleapis');

function getGoogleAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents'
    ]
  });
}

async function createGrantDoc(submission) {
  const auth = getGoogleAuth();
  const drive = google.drive({ version: 'v3', auth });
  const docs = google.docs({ version: 'v1', auth });

  const folderName = `${submission.org_name} — ${submission.funder_name}`;
  const docTitle = `Grant Application — ${submission.org_name}`;

  // Create a subfolder inside 01_Active Clients
  const folderResponse = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
    }
  });

  const clientFolderId = folderResponse.data.id;

  // Create the Google Doc inside that folder
  const docResponse = await drive.files.create({
    requestBody: {
      name: docTitle,
      mimeType: 'application/vnd.google-apps.document',
      parents: [clientFolderId]
    }
  });

  const docId = docResponse.data.id;
  const docUrl = `https://docs.google.com/document/d/${docId}/edit`;

  // Format the date
  const preparedDate = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });

  const deadline = submission.grant_deadline
    ? new Date(submission.grant_deadline).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric'
      })
    : submission.grant_deadline;

  // Build document content as structured requests
  const headerText = `GRANT APPLICATION\n\nOrganization:      ${submission.org_name}\nFunder:            ${submission.funder_name}\nGrant Program:     ${submission.grant_program}\nAmount Requested:  $${Number(submission.amount_requested).toLocaleString()}\nDeadline:          ${deadline}\nPrepared by:       Wellspring Grants  |  hello@wellspringgrants.com\nPrepared for:      ${submission.contact_name}  |  ${submission.contact_email}\nDate:              ${preparedDate}\n\n`;

  const divider = `────────────────────────────────────────────────────\n\n`;

  // Parse the grant draft — split on ## headings
  const grantText = submission.grant_draft || '';
  const sections = grantText.split(/^## /m).filter(s => s.trim());

  // Build the full plain text first, then we'll style it
  let fullText = headerText + divider;
  const sectionPositions = [];

  sectionPositions.push({ type: 'header', start: 1, end: headerText.length });

  let currentIndex = fullText.length;

  for (const section of sections) {
    const lines = section.split('\n');
    const heading = lines[0].trim();
    const body = lines.slice(1).join('\n').trim();

    sectionPositions.push({
      type: 'heading',
      start: currentIndex + 1,
      end: currentIndex + heading.length + 1,
      text: heading
    });

    fullText += heading + '\n\n' + body + '\n\n';
    currentIndex = fullText.length;
  }

  // Insert all text into the document
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: fullText
          }
        }
      ]
    }
  });

  // Now apply styling
  const styleRequests = [];

  // Style the "GRANT APPLICATION" title
  styleRequests.push({
    updateParagraphStyle: {
      range: { startIndex: 1, endIndex: 18 },
      paragraphStyle: {
        namedStyleType: 'HEADING_1',
        spaceAbove: { magnitude: 0, unit: 'PT' },
        spaceBelow: { magnitude: 12, unit: 'PT' }
      },
      fields: 'namedStyleType,spaceAbove,spaceBelow'
    }
  }, {
    updateTextStyle: {
      range: { startIndex: 1, endIndex: 18 },
      textStyle: {
        foregroundColor: {
          color: { rgbColor: { red: 0.165, green: 0.376, blue: 0.286 } }
        },
        fontSize: { magnitude: 20, unit: 'PT' },
        bold: true
      },
      fields: 'foregroundColor,fontSize,bold'
    }
  });

  // Find and style each section heading
  let searchIndex = headerText.length + divider.length + 1;
  for (const section of sections) {
    const lines = section.split('\n');
    const heading = lines[0].trim();
    const body = lines.slice(1).join('\n').trim();

    const headingStart = searchIndex;
    const headingEnd = headingStart + heading.length;

    styleRequests.push({
      updateParagraphStyle: {
        range: { startIndex: headingStart, endIndex: headingEnd + 1 },
        paragraphStyle: {
          namedStyleType: 'HEADING_2',
          spaceAbove: { magnitude: 16, unit: 'PT' },
          spaceBelow: { magnitude: 6, unit: 'PT' }
        },
        fields: 'namedStyleType,spaceAbove,spaceBelow'
      }
    }, {
      updateTextStyle: {
        range: { startIndex: headingStart, endIndex: headingEnd },
        textStyle: {
          foregroundColor: {
            color: { rgbColor: { red: 0.165, green: 0.376, blue: 0.286 } }
          },
          fontSize: { magnitude: 13, unit: 'PT' },
          bold: true
        },
        fields: 'foregroundColor,fontSize,bold'
      }
    });

    searchIndex = headingEnd + 2 + body.length + 2;
  }

  if (styleRequests.length > 0) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests: styleRequests }
    });
  }

  return { docUrl, docId, clientFolderId };
}

module.exports = { createGrantDoc };
