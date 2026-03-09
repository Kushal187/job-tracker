import { google } from 'googleapis';
import { getSheetsEnv } from './env';
import type { ApplicationRecord } from './types';

type SheetTarget = {
  sheetId: string;
  sheetTab: string;
};

const SHEET_HEADERS = [
  'company',
  'job_title',
  'status',
  'job_url'
];

function parseRowNumberFromRange(range: string | null | undefined): number {
  if (!range) {
    throw new Error('Missing updated range from Google Sheets append response');
  }

  const match = range.match(/!(?:[A-Z]+)(\d+):/);
  if (!match) {
    throw new Error(`Could not parse row number from range: ${range}`);
  }

  return Number(match[1]);
}

function rowValues(app: ApplicationRecord): string[] {
  return [
    app.company,
    app.job_title,
    app.status,
    app.job_url
  ];
}

async function getSheetsClient() {
  const sheetsEnv = getSheetsEnv();
  if (!sheetsEnv) {
    throw new Error('Google Sheets integration is not configured on the server');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: sheetsEnv.serviceAccount,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return google.sheets({
    version: 'v4',
    auth
  });
}

async function ensureSheetTab(
  spreadsheetId: string,
  sheetTab: string
) {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId
  });

  const existing = meta.data.sheets?.find(
    (sheet) => sheet.properties?.title === sheetTab
  );

  if (existing?.properties?.sheetId != null) {
    return {
      sheets,
      sheetId: existing.properties.sheetId
    };
  }

  const createResponse = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetTab
            }
          }
        }
      ]
    }
  });

  const createdSheetId =
    createResponse.data.replies?.[0]?.addSheet?.properties?.sheetId;

  if (createdSheetId == null) {
    throw new Error(`Failed to create sheet tab "${sheetTab}"`);
  }

  return {
    sheets,
    sheetId: createdSheetId
  };
}

async function ensureSheetHeader(target: SheetTarget) {
  const { sheets } = await ensureSheetTab(target.sheetId, target.sheetTab);

  await sheets.spreadsheets.values.update({
    spreadsheetId: target.sheetId,
    range: `${target.sheetTab}!A1:D1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [SHEET_HEADERS]
    }
  });
}

export async function appendApplicationToSheet(app: ApplicationRecord, target: SheetTarget): Promise<number> {
  const { sheets } = await ensureSheetTab(target.sheetId, target.sheetTab);
  await ensureSheetHeader(target);

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: target.sheetId,
    range: `${target.sheetTab}!A:D`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [rowValues(app)]
    }
  });

  return parseRowNumberFromRange(response.data.updates?.updatedRange);
}

export async function updateApplicationOnSheet(app: ApplicationRecord, target: SheetTarget): Promise<void> {
  if (!app.sheet_row_number) {
    throw new Error(`Application ${app.id} does not have sheet_row_number`);
  }

  const { sheets } = await ensureSheetTab(target.sheetId, target.sheetTab);
  await ensureSheetHeader(target);

  await sheets.spreadsheets.values.update({
    spreadsheetId: target.sheetId,
    range: `${target.sheetTab}!A${app.sheet_row_number}:D${app.sheet_row_number}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [rowValues(app)]
    }
  });
}

export async function deleteApplicationFromSheet(sheetRowNumber: number, target: SheetTarget): Promise<void> {
  const { sheets, sheetId } = await ensureSheetTab(target.sheetId, target.sheetTab);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: target.sheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: sheetRowNumber - 1,
              endIndex: sheetRowNumber
            }
          }
        }
      ]
    }
  });
}

export async function rewriteApplicationsSheet(
  applications: ApplicationRecord[],
  target: SheetTarget
) {
  const { sheets } = await ensureSheetTab(target.sheetId, target.sheetTab);

  await sheets.spreadsheets.values.clear({
    spreadsheetId: target.sheetId,
    range: `${target.sheetTab}!A:D`
  });

  const values = [SHEET_HEADERS, ...applications.map((app) => rowValues(app))];

  await sheets.spreadsheets.values.update({
    spreadsheetId: target.sheetId,
    range: `${target.sheetTab}!A1:D${Math.max(values.length, 1)}`,
    valueInputOption: 'RAW',
    requestBody: {
      values
    }
  });

  const rowMap = new Map<string, number>();
  applications.forEach((application, index) => {
    rowMap.set(application.id, index + 2);
  });

  return rowMap;
}
