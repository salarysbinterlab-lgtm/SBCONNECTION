import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const appsScript = readFileSync(resolve(root, 'apps_script/SBConnect_Drive_Upload_API.gs'), 'utf8');
const workspace = readFileSync(resolve(root, 'src/components/QuotationWorkspace.tsx'), 'utf8');

function between(start: string, end: string): string {
  const startIndex = appsScript.indexOf(start);
  const endIndex = appsScript.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return appsScript.slice(startIndex, endIndex);
}

describe('quotation action contract', () => {
  it('keeps create and draft-save separate from report generation', () => {
    const createAction = between('function quotationCreate_', 'function quotationSave_');
    const saveAction = between('function quotationSave_', 'function quotationList_');
    const draftBranch = saveAction.indexOf('if (!reportOnly)');
    const reportGeneration = saveAction.indexOf('generateQuotationArtifacts_');

    expect(createAction).not.toContain('generateQuotationArtifacts_');
    expect(draftBranch).toBeGreaterThanOrEqual(0);
    expect(reportGeneration).toBeGreaterThan(draftBranch);
    expect(saveAction.slice(draftBranch, reportGeneration)).toContain('return quotationSuccessResponse_("quotation_save"');
  });

  it('routes PDF and product images to their dedicated Drive folders', () => {
    expect(appsScript).toContain('DEFAULT_QUOTATION_PDF_FOLDER_ID = "1wIpoEPrDYCl6kOhPRTQKN4IEF6xObqnk"');
    expect(appsScript).toContain('DEFAULT_QUOTATION_IMAGE_FOLDER_ID = "1WhQuee3dzCX63tvbqwYOIA8t67DeqhSc"');
    expect(appsScript).toContain('quotation_pdf: quotationPdfId');
    expect(appsScript).toContain('quotation_images: quotationImageId');
    expect(appsScript).toContain('pdfFile = pdfFolder.createFile(pdfBlob)');
  });

  it('wires the visible workspace actions to the quotation service', () => {
    expect(workspace).toContain('quotationApi.createQuotation({');
    expect(workspace).toContain('quotationApi.saveQuotation(payload)');
    expect(workspace).toContain('quotationApi.generateQuotationReport(payload)');
    expect(workspace).toContain("quotationApi.uploadQuotationFile(file, 'quotation_images'");
    expect(workspace).toContain("quotationApi.uploadQuotationFile(file, 'quotation_attachments'");
    expect(workspace).toContain('quotationApi.deleteQuotationFile(');
  });
});
