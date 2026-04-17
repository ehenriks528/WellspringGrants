const { google } = require('googleapis');

// ── Colour helpers ────────────────────────────────────────────────────────────

function hex(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return {
    red:   ((n >> 16) & 255) / 255,
    green: ((n >>  8) & 255) / 255,
    blue:  ( n        & 255) / 255
  };
}

const C = {
  title:     hex('1B4332'),  // deep green — title, H1
  h2:        hex('2D6A4F'),  // mid-green — H2
  body:      hex('1A1A1A'),  // near-black — body text
  meta:      hex('333333'),  // dark grey — cover metadata
  border:    hex('D0E8D8'),  // light green — table borders
  rowAlt:    hex('F2FAF5'),  // very light green — alternating rows
  rowTotal:  hex('D8F3DC'),  // pale green — totals row
  hrBorder:  hex('CCCCCC'),  // light grey — header/footer rule
  white:     { red: 1, green: 1, blue: 1 }
};

// ── Google Auth ───────────────────────────────────────────────────────────────

function getGoogleAuth() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

// ── Inline markdown stripper ─────────────────────────────────────────────────
// Strips **bold** markers from text and returns the clean string plus the
// character ranges (relative to the start of the returned string) that should
// receive bold formatting via the Google Docs API.

function stripInlineMarkdown(text) {
  const boldRanges = [];
  let clean = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '*' && text[i + 1] === '*') {
      // **bold** — strip markers, record range for bold API styling
      const closeIdx = text.indexOf('**', i + 2);
      if (closeIdx !== -1) {
        const start = clean.length;
        clean += text.slice(i + 2, closeIdx);
        boldRanges.push({ start, end: clean.length });
        i = closeIdx + 2;
      } else {
        clean += text[i++];
      }
    } else if (text[i] === '*') {
      // *italic* — strip markers, keep text, no italic styling needed
      const lineEnd = text.indexOf('\n', i + 1);
      const searchEnd = lineEnd === -1 ? text.length : lineEnd;
      const closeIdx = text.indexOf('*', i + 1);
      if (closeIdx !== -1 && closeIdx <= searchEnd) {
        clean += text.slice(i + 1, closeIdx);
        i = closeIdx + 1;
      } else {
        clean += text[i++];
      }
    } else {
      clean += text[i++];
    }
  }
  return { text: clean, boldRanges };
}

// Remove markdown horizontal rules. Inline markers are handled by stripInlineMarkdown.
function cleanBodyText(text) {
  return text
    .split('\n')
    .filter(line => !/^[-*_]{3,}\s*$/.test(line.trim())) // strip --- / *** / ___
    .join('\n');
}

// ── Markdown table parser ─────────────────────────────────────────────────────

function parseMarkdownTable(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const dataLines = lines.filter(l => !/^\|[\s\-|:]+\|?\s*$/.test(l));
  return dataLines.map(line =>
    line.replace(/^\||\|$/g, '').split('|')
      .map(cell => cell.trim().replace(/\*\*/g, ''))
  );
}

function extractMarkdownTable(body) {
  // Match a markdown table: header row + separator + data rows
  const re = /(\|.+\|\n)([ \t]*\|[\s\-|:]+\|\n)((?:[ \t]*\|.+\|\n?)+)/m;
  const m = body.match(re);
  if (!m) return null;
  const full = m[0];
  const idx  = body.indexOf(full);
  return {
    before: body.slice(0, idx).trimEnd(),
    after:  body.slice(idx + full.length).trimStart(),
    data:   parseMarkdownTable(full)
  };
}

// ── Document text index finder ────────────────────────────────────────────────

function findTextInDoc(content, needle) {
  for (const el of content) {
    if (el.paragraph) {
      for (const pe of el.paragraph.elements || []) {
        if (pe.textRun && pe.textRun.content.includes(needle)) {
          return pe.startIndex + pe.textRun.content.indexOf(needle);
        }
      }
    } else if (el.table) {
      for (const row of el.table.tableRows || []) {
        for (const cell of row.tableCells || []) {
          const r = findTextInDoc(cell.content || [], needle);
          if (r !== -1) return r;
        }
      }
    }
  }
  return -1;
}

function findTableNearIndex(content, target) {
  let best = null, bestDist = Infinity;
  for (const el of content) {
    if (el.table) {
      const dist = Math.abs(el.startIndex - target);
      if (dist < bestDist) { bestDist = dist; best = el; }
    }
  }
  return bestDist < 30 ? best : null;
}

// ── Budget table insertion ────────────────────────────────────────────────────

const TABLE_PH = '[__BUDGET_TABLE__]';

async function insertBudgetTable(docs, docId, tableData) {
  // 1. Locate placeholder
  const snap = await docs.documents.get({ documentId: docId });
  const phIdx = findTextInDoc(snap.data.body.content, TABLE_PH);
  if (phIdx === -1) return;

  const rows = tableData.length;
  const cols = tableData[0] ? tableData[0].length : 3;

  // 2. Delete placeholder
  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: [{
    deleteContentRange: { range: { startIndex: phIdx, endIndex: phIdx + TABLE_PH.length } }
  }]}});

  // 3. Insert empty table
  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: [{
    insertTable: { rows, columns: cols, location: { index: phIdx } }
  }]}});

  // 4. Find table and fill cells (reversed so indices stay stable)
  const snap2 = await docs.documents.get({ documentId: docId });
  const tableEl = findTableNearIndex(snap2.data.body.content, phIdx);
  if (!tableEl) return;
  const table = tableEl.table;

  const insertReqs = [];
  for (let r = 0; r < table.tableRows.length; r++) {
    for (let c = 0; c < table.tableRows[r].tableCells.length; c++) {
      const cell = table.tableRows[r].tableCells[c];
      const txt  = (tableData[r] && tableData[r][c]) ? tableData[r][c] : '';
      if (txt && cell.content && cell.content[0]) {
        insertReqs.unshift({
          insertText: { location: { index: cell.content[0].startIndex }, text: txt }
        });
      }
    }
  }
  if (insertReqs.length) {
    await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: insertReqs } });
  }

  // 5. Style the table
  const snap3  = await docs.documents.get({ documentId: docId });
  const tEl    = findTableNearIndex(snap3.data.body.content, phIdx);
  if (!tEl) return;
  const t          = tEl.table;
  const tStartIndex = tEl.startIndex;

  const styleReqs = [];
  const totalRowIdx = t.tableRows.length - 1;

  for (let r = 0; r < t.tableRows.length; r++) {
    const isHeader = r === 0;
    const isTotal  = r === totalRowIdx && !isHeader;
    const isAlt    = !isHeader && !isTotal && r % 2 === 0;

    const bgColor = isHeader ? C.title : isTotal ? C.rowTotal : isAlt ? C.rowAlt : C.white;

    for (let c = 0; c < t.tableRows[r].tableCells.length; c++) {
      const cell      = t.tableRows[r].tableCells[c];
      const cellStart = cell.startIndex;
      const cellEnd   = cell.endIndex;

      // Cell background + padding + borders
      styleReqs.push({
        updateTableCellStyle: {
          tableRange: {
            tableCellLocation: {
              tableStartLocation: { index: tStartIndex },
              rowIndex: r,
              columnIndex: c
            },
            rowSpan: 1,
            columnSpan: 1
          },
          tableCellStyle: {
            backgroundColor: { color: { rgbColor: bgColor } },
            paddingTop:    { magnitude: 6, unit: 'PT' },
            paddingBottom: { magnitude: 6, unit: 'PT' },
            paddingLeft:   { magnitude: 8, unit: 'PT' },
            paddingRight:  { magnitude: 8, unit: 'PT' },
            borderTop:    { color: { color: { rgbColor: C.border } }, width: { magnitude: 0.5, unit: 'PT' }, dashStyle: 'SOLID' },
            borderBottom: { color: { color: { rgbColor: C.border } }, width: { magnitude: 0.5, unit: 'PT' }, dashStyle: 'SOLID' },
            borderLeft:   { color: { color: { rgbColor: C.border } }, width: { magnitude: 0.5, unit: 'PT' }, dashStyle: 'SOLID' },
            borderRight:  { color: { color: { rgbColor: C.border } }, width: { magnitude: 0.5, unit: 'PT' }, dashStyle: 'SOLID' }
          },
          fields: 'backgroundColor,paddingTop,paddingBottom,paddingLeft,paddingRight,borderTop,borderBottom,borderLeft,borderRight'
        }
      });

      // Text style: header = white bold Arial 10, total = bold, body = Georgia 10
      if (cell.content && cell.content[0]) {
        const paraStart = cell.content[0].startIndex;
        const paraEnd   = cellEnd - 1;
        if (paraEnd > paraStart) {
          styleReqs.push({
            updateTextStyle: {
              range: { startIndex: paraStart, endIndex: paraEnd },
              textStyle: {
                bold: isHeader || isTotal,
                foregroundColor: { color: { rgbColor: isHeader ? C.white : C.body } },
                weightedFontFamily: { fontFamily: isHeader ? 'Arial' : 'Georgia' },
                fontSize: { magnitude: 10, unit: 'PT' }
              },
              fields: 'bold,foregroundColor,weightedFontFamily,fontSize'
            }
          });

          // Right-align amount column (last column)
          if (c === cols - 1) {
            styleReqs.push({
              updateParagraphStyle: {
                range: { startIndex: paraStart, endIndex: paraEnd },
                paragraphStyle: { alignment: 'END' },
                fields: 'alignment'
              }
            });
          }
        }
      }
    }
  }

  if (styleReqs.length) {
    await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: styleReqs } });
  }
}

// ── Headers and footers ───────────────────────────────────────────────────────

async function addHeaderAndFooter(docs, docId, submission) {
  // Create header
  const hRes = await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: [{
    createHeader: { type: 'DEFAULT' }
  }]}});
  const headerId = hRes.data.replies[0].createHeader.headerId;

  // Create footer
  const fRes = await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: [{
    createFooter: { type: 'DEFAULT' }
  }]}});
  const footerId = fRes.data.replies[0].createFooter.headerId || fRes.data.replies[0].createFooter?.footerId;

  // Actually need to get footer ID from document style
  const docSnap = await docs.documents.get({ documentId: docId });
  const actualFooterId = docSnap.data.documentStyle.defaultFooterId;

  const orgLabel  = (submission.org_name || '').substring(0, 35);
  const funderLabel = (submission.funder_name || '').substring(0, 35);
  const headerText = `${orgLabel} | ${funderLabel}\tCONFIDENTIAL DRAFT — Prepared by Wellspring Grants\n`;

  const requests = [];

  // Insert header text
  requests.push({
    insertText: { location: { segmentId: headerId, index: 0 }, text: headerText }
  });

  // Insert footer text + page number
  if (actualFooterId) {
    requests.push({
      insertText: {
        location: { segmentId: actualFooterId, index: 0 },
        text: 'hello@wellspringgrants.com\tPage '
      }
    });
  }

  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests } });

  // Insert page number field into footer
  if (actualFooterId) {
    const footerSnap = await docs.documents.get({ documentId: docId });
    const footerContent = footerSnap.data.footers?.[actualFooterId]?.content || [];
    let pageNumIdx = 0;
    for (const el of footerContent) {
      if (el.paragraph) {
        for (const pe of el.paragraph.elements || []) {
          if (pe.textRun && pe.textRun.content.includes('Page ')) {
            pageNumIdx = pe.endIndex - 1; // insert after "Page "
          }
        }
      }
    }

    if (pageNumIdx > 0) {
      await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: [{
        insertPageNumber: { location: { segmentId: actualFooterId, index: pageNumIdx }, onFirstPage: false }
      }]}});
    }
  }

  // Style header: Arial 9pt, grey, tab stop at 6.5 inches (468pt) for right-align
  const hSnap = await docs.documents.get({ documentId: docId });
  const hContent = hSnap.data.headers?.[headerId]?.content || [];
  let hParaStart = 1, hParaEnd = 2;
  for (const el of hContent) {
    if (el.paragraph) { hParaStart = el.startIndex; hParaEnd = el.endIndex; break; }
  }

  const hStyleReqs = [
    {
      updateParagraphStyle: {
        range: { startIndex: hParaStart, endIndex: hParaEnd, segmentId: headerId },
        paragraphStyle: {
          tabStops: [{ offset: { magnitude: 468, unit: 'PT' }, alignment: 'END' }],
          borderBottom: {
            color: { color: { rgbColor: C.hrBorder } },
            width: { magnitude: 0.5, unit: 'PT' },
            dashStyle: 'SOLID',
            padding: { magnitude: 4, unit: 'PT' }
          },
          spaceBelow: { magnitude: 6, unit: 'PT' }
        },
        fields: 'tabStops,borderBottom,spaceBelow'
      }
    },
    {
      updateTextStyle: {
        range: { startIndex: hParaStart, endIndex: hParaEnd, segmentId: headerId },
        textStyle: {
          weightedFontFamily: { fontFamily: 'Arial' },
          fontSize: { magnitude: 9, unit: 'PT' },
          foregroundColor: { color: { rgbColor: C.meta } }
        },
        fields: 'weightedFontFamily,fontSize,foregroundColor'
      }
    }
  ];

  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: hStyleReqs } });

  // Style footer similarly
  if (actualFooterId) {
    const fSnap = await docs.documents.get({ documentId: docId });
    const fContent = fSnap.data.footers?.[actualFooterId]?.content || [];
    let fParaStart = 1, fParaEnd = 2;
    for (const el of fContent) {
      if (el.paragraph) { fParaStart = el.startIndex; fParaEnd = el.endIndex; break; }
    }

    await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: [
      {
        updateParagraphStyle: {
          range: { startIndex: fParaStart, endIndex: fParaEnd, segmentId: actualFooterId },
          paragraphStyle: {
            tabStops: [{ offset: { magnitude: 468, unit: 'PT' }, alignment: 'END' }],
            borderTop: {
              color: { color: { rgbColor: C.hrBorder } },
              width: { magnitude: 0.5, unit: 'PT' },
              dashStyle: 'SOLID',
              padding: { magnitude: 4, unit: 'PT' }
            },
            spaceAbove: { magnitude: 6, unit: 'PT' }
          },
          fields: 'tabStops,borderTop,spaceAbove'
        }
      },
      {
        updateTextStyle: {
          range: { startIndex: fParaStart, endIndex: fParaEnd, segmentId: actualFooterId },
          textStyle: {
            weightedFontFamily: { fontFamily: 'Arial' },
            fontSize: { magnitude: 9, unit: 'PT' },
            foregroundColor: { color: { rgbColor: C.meta } }
          },
          fields: 'weightedFontFamily,fontSize,foregroundColor'
        }
      }
    ]}});
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

async function createGrantDoc(submission) {
  const auth  = getGoogleAuth();
  const drive = google.drive({ version: 'v3', auth });
  const docs  = google.docs({ version: 'v1', auth });

  // ── Drive folder (reuse if exists) ────────────────────────────────────────

  const folderName = submission.org_name;
  let clientFolderId;
  const existingFolders = await drive.files.list({
    q: `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed=false`,
    fields: 'files(id, name)'
  });
  if (existingFolders.data.files.length > 0) {
    clientFolderId = existingFolders.data.files[0].id;
  } else {
    const f = await drive.files.create({
      requestBody: { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [process.env.GOOGLE_DRIVE_FOLDER_ID] }
    });
    clientFolderId = f.data.id;
  }

  // ── Create blank doc ──────────────────────────────────────────────────────

  const docRes = await drive.files.create({
    requestBody: {
      name: `Grant Application — ${submission.org_name}`,
      mimeType: 'application/vnd.google-apps.document',
      parents: [clientFolderId]
    }
  });
  const docId  = docRes.data.id;
  const docUrl = `https://docs.google.com/document/d/${docId}/edit`;

  // ── Page setup: US Letter, 1-inch margins ────────────────────────────────

  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: [{
    updateDocumentStyle: {
      documentStyle: {
        pageSize: {
          width:  { magnitude: 612, unit: 'PT' },   // 8.5 in
          height: { magnitude: 792, unit: 'PT' }    // 11 in
        },
        marginTop:    { magnitude: 72, unit: 'PT' },  // 1 in
        marginBottom: { magnitude: 72, unit: 'PT' },
        marginLeft:   { magnitude: 72, unit: 'PT' },
        marginRight:  { magnitude: 72, unit: 'PT' }
      },
      fields: 'pageSize,marginTop,marginBottom,marginLeft,marginRight'
    }
  }]}});

  // ── Build full document text ──────────────────────────────────────────────

  const preparedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const deadline = submission.grant_deadline
    ? new Date(submission.grant_deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—';
  const amount   = `$${Number(submission.amount_requested || 0).toLocaleString()}`;
  const budget   = submission.annual_budget ? `$${Number(submission.annual_budget).toLocaleString()}` : '—';

  // Cover page text segments
  const coverTitle    = 'GRANT APPLICATION\n';
  const coverFunder   = `${submission.funder_name || '—'}\n`;
  const coverRule     = '\n';                           // paragraph that gets a bottom border
  const coverMeta = [
    `Organization:         ${submission.org_name || '—'}`,
    `Location:             ${submission.org_city ? `${submission.org_city}, ${submission.org_state}` : (submission.org_location || '—')}`,
    `501(c)(3) Status:     ${submission.tax_exempt || '—'}`,
    `Amount Requested:     ${amount}`,
    `Deadline:             ${deadline}`,
    `Grant Program:        ${submission.grant_program || '—'}`,
    `Annual Operating Budget: ${budget}`,
    `EIN:                  ${submission.ein || '—'}`,
    `Prepared by:          Wellspring Grants | hello@wellspringgrants.com`,
    `Prepared for:         ${submission.contact_name || '—'} | ${submission.contact_email || '—'}`,
    `Date:                 ${preparedDate}`,
    '\n'   // blank line before page break paragraph
  ].join('\n') + '\n';

  const pageBreakPara = '\n'; // paragraph that will get pageBreakBefore:true

  // ── Parse grant body into sections ───────────────────────────────────────

  const grantText = submission.grant_body || submission.grant_draft || '';
  const rawSections = grantText.split(/^## /m).filter(s => s.trim());

  // Track text + styling metadata
  const styleJobs = [];

  let fullText = coverTitle + coverFunder + coverRule + coverMeta + pageBreakPara;

  // Calculate cover indices (1-based for Google Docs)
  let idx = 1; // Google Docs body starts at 1

  const coverTitleStart = idx;
  const coverTitleEnd   = idx + coverTitle.length - 1; // -1: don't include \n in char range
  idx += coverTitle.length;

  const coverFunderStart = idx;
  const coverFunderEnd   = idx + coverFunder.length - 1;
  idx += coverFunder.length;

  const coverRuleStart   = idx;
  const coverRuleEnd     = idx + coverRule.length;
  idx += coverRule.length;

  const coverMetaStart   = idx;
  idx += coverMeta.length;
  const coverMetaEnd     = idx;

  const pageBreakParaIdx = idx;
  idx += pageBreakPara.length;

  // Process grant body sections
  let extractedTable = null;

  for (const section of rawSections) {
    const lines   = section.split('\n');
    const heading = lines[0].trim().replace(/\*\*/g, '');  // strip ** from headings
    const rawBody = lines.slice(1).join('\n').trim();

    // Extract markdown table from this section if not yet found
    let body = rawBody;
    if (!extractedTable) {
      const parsed = extractMarkdownTable(rawBody);
      if (parsed) {
        extractedTable = parsed.data;
        body = `${parsed.before}\n\n${TABLE_PH}\n\n${parsed.after}`.trim();
      }
    }

    // Main heading → H1
    const hStart = idx;
    const hEnd   = idx + heading.length;
    styleJobs.push({ type: 'h1', start: hStart, end: hEnd });
    fullText += heading + '\n\n';
    idx += heading.length + 2;

    // Handle ### subsections within body
    const subParts = body.split(/^### /m);

    for (let i = 0; i < subParts.length; i++) {
      const part = subParts[i];
      if (!part.trim()) continue;

      if (i === 0) {
        // Plain body text — strip markdown artifacts and track bold ranges
        const cleaned = cleanBodyText(part.trim());
        if (cleaned) {
          const { text: cleanText, boldRanges } = stripInlineMarkdown(cleaned);
          const bodyStart = idx;
          for (const br of boldRanges) {
            styleJobs.push({ type: 'bold', start: bodyStart + br.start, end: bodyStart + br.end });
          }
          fullText += cleanText + '\n\n';
          idx += cleanText.length + 2;
        }
      } else {
        // Subsection
        const subLines   = part.split('\n');
        const subHeading = subLines[0].trim().replace(/\*\*/g, '').replace(/\*/g, '');  // strip ** and * from subheadings
        const subBodyRaw = subLines.slice(1).join('\n').trim();

        const shStart = idx;
        const shEnd   = idx + subHeading.length;
        styleJobs.push({ type: 'h2', start: shStart, end: shEnd });
        fullText += subHeading + '\n\n';
        idx += subHeading.length + 2;

        if (subBodyRaw) {
          const cleaned = cleanBodyText(subBodyRaw);
          const { text: cleanText, boldRanges } = stripInlineMarkdown(cleaned);
          const bodyStart = idx;
          for (const br of boldRanges) {
            styleJobs.push({ type: 'bold', start: bodyStart + br.start, end: bodyStart + br.end });
          }
          fullText += cleanText + '\n\n';
          idx += cleanText.length + 2;
        }
      }
    }
  }

  const totalTextLength = idx;

  // ── Insert all text ───────────────────────────────────────────────────────

  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests: [{
    insertText: { location: { index: 1 }, text: fullText }
  }]}});

  // ── Apply all styles in one batchUpdate ──────────────────────────────────

  const styleRequests = [];

  // 1. Base body text: Georgia 11pt #1A1A1A, justified, 1.15 line spacing
  //    Apply to entire document first, then override specific ranges
  styleRequests.push(
    {
      updateTextStyle: {
        range: { startIndex: 1, endIndex: totalTextLength },
        textStyle: {
          weightedFontFamily: { fontFamily: 'Georgia' },
          fontSize: { magnitude: 11, unit: 'PT' },
          foregroundColor: { color: { rgbColor: C.body } }
        },
        fields: 'weightedFontFamily,fontSize,foregroundColor'
      }
    },
    {
      updateParagraphStyle: {
        range: { startIndex: 1, endIndex: totalTextLength },
        paragraphStyle: {
          alignment: 'JUSTIFIED',
          lineSpacing: 115,
          spaceAbove: { magnitude: 0, unit: 'PT' },
          spaceBelow: { magnitude: 8, unit: 'PT' }
        },
        fields: 'alignment,lineSpacing,spaceAbove,spaceBelow'
      }
    }
  );

  // 2. Cover title: Arial 24pt bold #1B4332
  styleRequests.push(
    {
      updateTextStyle: {
        range: { startIndex: coverTitleStart, endIndex: coverTitleEnd },
        textStyle: {
          weightedFontFamily: { fontFamily: 'Arial' },
          fontSize: { magnitude: 24, unit: 'PT' },
          bold: true,
          foregroundColor: { color: { rgbColor: C.title } }
        },
        fields: 'weightedFontFamily,fontSize,bold,foregroundColor'
      }
    },
    {
      updateParagraphStyle: {
        range: { startIndex: coverTitleStart, endIndex: coverTitleEnd + 1 },
        paragraphStyle: {
          alignment: 'START',
          spaceBelow: { magnitude: 8, unit: 'PT' }
        },
        fields: 'alignment,spaceBelow'
      }
    }
  );

  // 3. Cover funder name: Arial 16pt #2D6A4F
  styleRequests.push(
    {
      updateTextStyle: {
        range: { startIndex: coverFunderStart, endIndex: coverFunderEnd },
        textStyle: {
          weightedFontFamily: { fontFamily: 'Arial' },
          fontSize: { magnitude: 16, unit: 'PT' },
          bold: false,
          foregroundColor: { color: { rgbColor: C.h2 } }
        },
        fields: 'weightedFontFamily,fontSize,bold,foregroundColor'
      }
    },
    {
      updateParagraphStyle: {
        range: { startIndex: coverFunderStart, endIndex: coverFunderEnd + 1 },
        paragraphStyle: {
          alignment: 'START',
          spaceBelow: { magnitude: 4, unit: 'PT' }
        },
        fields: 'alignment,spaceBelow'
      }
    }
  );

  // 4. Horizontal rule paragraph (bottom border)
  styleRequests.push({
    updateParagraphStyle: {
      range: { startIndex: coverRuleStart, endIndex: coverRuleEnd },
      paragraphStyle: {
        borderBottom: {
          color: { color: { rgbColor: C.title } },
          width: { magnitude: 1.5, unit: 'PT' },
          dashStyle: 'SOLID',
          padding: { magnitude: 4, unit: 'PT' }
        },
        spaceBelow: { magnitude: 12, unit: 'PT' }
      },
      fields: 'borderBottom,spaceBelow'
    }
  });

  // 5. Cover metadata: Arial 10pt #333333 left-aligned (bold labels handled by "bold" inline)
  styleRequests.push(
    {
      updateTextStyle: {
        range: { startIndex: coverMetaStart, endIndex: coverMetaEnd },
        textStyle: {
          weightedFontFamily: { fontFamily: 'Arial' },
          fontSize: { magnitude: 10, unit: 'PT' },
          foregroundColor: { color: { rgbColor: C.meta } }
        },
        fields: 'weightedFontFamily,fontSize,foregroundColor'
      }
    },
    {
      updateParagraphStyle: {
        range: { startIndex: coverMetaStart, endIndex: coverMetaEnd },
        paragraphStyle: { alignment: 'START', lineSpacing: 130 },
        fields: 'alignment,lineSpacing'
      }
    }
  );

  // 6. Page break before first grant section
  if (rawSections.length > 0) {
    styleRequests.push({
      updateParagraphStyle: {
        range: { startIndex: pageBreakParaIdx, endIndex: pageBreakParaIdx + pageBreakPara.length },
        paragraphStyle: { pageBreakBefore: true },
        fields: 'pageBreakBefore'
      }
    });
  }

  // 7. Section headings from styleJobs
  for (const job of styleJobs) {
    if (job.type === 'h1') {
      styleRequests.push(
        {
          updateParagraphStyle: {
            range: { startIndex: job.start, endIndex: job.end + 1 },
            paragraphStyle: {
              namedStyleType: 'HEADING_1',
              alignment: 'START',
              spaceAbove: { magnitude: 12, unit: 'PT' },
              spaceBelow: { magnitude: 6, unit: 'PT' },
              borderBottom: {
                color: { color: { rgbColor: C.title } },
                width: { magnitude: 0.75, unit: 'PT' },
                dashStyle: 'SOLID',
                padding: { magnitude: 3, unit: 'PT' }
              }
            },
            fields: 'namedStyleType,alignment,spaceAbove,spaceBelow,borderBottom'
          }
        },
        {
          updateTextStyle: {
            range: { startIndex: job.start, endIndex: job.end },
            textStyle: {
              weightedFontFamily: { fontFamily: 'Arial' },
              fontSize: { magnitude: 14, unit: 'PT' },
              bold: true,
              foregroundColor: { color: { rgbColor: C.title } }
            },
            fields: 'weightedFontFamily,fontSize,bold,foregroundColor'
          }
        }
      );
    } else if (job.type === 'h2') {
      styleRequests.push(
        {
          updateParagraphStyle: {
            range: { startIndex: job.start, endIndex: job.end + 1 },
            paragraphStyle: {
              namedStyleType: 'HEADING_2',
              alignment: 'START',
              spaceAbove: { magnitude: 8, unit: 'PT' },
              spaceBelow: { magnitude: 4, unit: 'PT' }
            },
            fields: 'namedStyleType,alignment,spaceAbove,spaceBelow'
          }
        },
        {
          updateTextStyle: {
            range: { startIndex: job.start, endIndex: job.end },
            textStyle: {
              weightedFontFamily: { fontFamily: 'Arial' },
              fontSize: { magnitude: 12, unit: 'PT' },
              bold: true,
              foregroundColor: { color: { rgbColor: C.h2 } }
            },
            fields: 'weightedFontFamily,fontSize,bold,foregroundColor'
          }
        }
      );
    } else if (job.type === 'bold') {
      styleRequests.push({
        updateTextStyle: {
          range: { startIndex: job.start, endIndex: job.end },
          textStyle: { bold: true },
          fields: 'bold'
        }
      });
    }
  }

  // Send all style requests
  if (styleRequests.length) {
    // Google Docs API limits batchUpdate to 300 requests — chunk if needed
    for (let i = 0; i < styleRequests.length; i += 200) {
      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: { requests: styleRequests.slice(i, i + 200) }
      });
    }
  }

  // ── Insert budget table ───────────────────────────────────────────────────

  if (extractedTable) {
    await insertBudgetTable(docs, docId, extractedTable);
  }

  // ── Headers and footers ───────────────────────────────────────────────────

  try {
    await addHeaderAndFooter(docs, docId, submission);
  } catch (hfErr) {
    console.warn('Header/footer setup failed (non-fatal):', hfErr.message);
  }

  // ── Share with client email ───────────────────────────────────────────────

  if (submission.contact_email) {
    try {
      await drive.permissions.create({
        fileId: docId,
        requestBody: {
          type: 'user',
          role: 'writer',
          emailAddress: submission.contact_email
        },
        sendNotificationEmail: false
      });
      console.log(`Shared Google Doc with ${submission.contact_email}`);
    } catch (shareErr) {
      console.warn('Could not share doc with client (non-fatal):', shareErr.message);
    }
  }

  return { docUrl, docId, clientFolderId };
}

async function exportDocAsDocx(docId) {
  const auth  = getGoogleAuth();
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.export(
    { fileId: docId, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data);
}

module.exports = { createGrantDoc, exportDocAsDocx };
