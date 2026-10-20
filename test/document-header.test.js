const {test}=require('node:test');
const assert=require('node:assert/strict');
const {addHeaderAndFooter}=require('../createDoc');
function paragraphs(text){let offset=0;return text.split(/(?<=\n)/).map(content=>{const startIndex=offset;offset+=content.length;return {startIndex,endIndex:offset,paragraph:{elements:[{textRun:{content}}]}};});}
function mockDocument(){
 const requests=[];let headerText,footerText;
 const docs={documents:{
  batchUpdate:async({requestBody})=>{
   requests.push(...requestBody.requests);
   if(requestBody.requests[0].createHeader)return {data:{replies:[{createHeader:{headerId:'header'}}]}};
   if(requestBody.requests[0].createFooter)return {data:{replies:[{createFooter:{footerId:'footer'}}]}};
   for(const r of requestBody.requests)if(r.insertText){if(r.insertText.location.segmentId==='header')headerText=r.insertText.text;else footerText=r.insertText.text;}
   return {data:{}};
  },
  get:async()=>({data:{documentStyle:{defaultFooterId:'footer'},headers:headerText?{header:{content:paragraphs(headerText+'\n')}}:{},footers:footerText?{footer:{content:paragraphs(footerText+'\n')}}:{}}}),
 }};
 return {docs,requests,getHeader:()=>headerText};
}
const graphemes=text=>Array.from(new Intl.Segmenter('en',{granularity:'grapheme'}).segment(text),p=>p.segment);
test('long header identifiers cannot run into the confidentiality paragraph; both paragraphs receive styling',async()=>{
 const mock=mockDocument();
 await addHeaderAndFooter(mock.docs,'document',{org_name:'W'.repeat(80),funder_name:'M'.repeat(80)});
 const header=mock.getHeader();const lines=header.trimEnd().split('\n');
 assert.equal(lines.length,2);assert.equal(lines[1],'CONFIDENTIAL DRAFT — Prepared by Wellspring Grants');assert.ok(!header.includes('\t'));
 for(const label of lines[0].split(' | ')){assert.equal(graphemes(label).length,24);assert.ok(label.endsWith('…'));}
 const boundary=lines[0].length+1;
 const headerRequests=mock.requests.filter(r=>(r.updateTextStyle||r.updateParagraphStyle)?.range.segmentId==='header');
 const font=headerRequests.find(r=>r.updateTextStyle)?.updateTextStyle;
 assert.equal(font.range.startIndex,0);assert.equal(font.range.endIndex,header.length);assert.equal(font.textStyle.fontSize.magnitude,9);
 const border=headerRequests.find(r=>r.updateParagraphStyle?.paragraphStyle.borderBottom)?.updateParagraphStyle;
 assert.equal(border.range.startIndex,boundary);assert.equal(border.range.endIndex,header.length);
 assert.ok(mock.requests.some(r=>r.insertText?.location.segmentId==='footer'&&r.insertText.text.includes('hello@wellspringgrants.com')));
 assert.ok(mock.requests.some(r=>r.updateTextStyle?.range.segmentId==='footer'));
});
test('header shortening respects grapheme boundaries and sanitizes whitespace without changing source names',async()=>{
 const family='👩‍👩‍👧‍👦',accent='e\u0301';
 const input={org_name:family.repeat(30),funder_name:accent.repeat(30)};const original={...input};const mock=mockDocument();
 await addHeaderAndFooter(mock.docs,'document',input);
 const labels=mock.getHeader().split('\n')[0].split(' | ');
 assert.equal(labels[0],family.repeat(23)+'…');assert.equal(labels[1],accent.repeat(23)+'…');assert.deepEqual(input,original);
 const plain=mockDocument();await addHeaderAndFooter(plain.docs,'document',{org_name:'  Small\nNonprofit\t ',funder_name:''});
 assert.equal(plain.getHeader().split('\n')[0],'Small Nonprofit | Funder');
});
