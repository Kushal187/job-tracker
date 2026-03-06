import { google } from 'googleapis';
import { getSheetsEnv } from './env';
import type { ApplicationRecord } from './types';

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
  return [app.company, app.job_title, app.status, app.job_url];
}

async function getSheetsClient() {
  const { serviceAccount } = getSheetsEnv();

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return google.sheets({
    version: 'v4',
    auth
  });
}

export async function appendApplicationToSheet(app: ApplicationRecord): Promise<number> {
  const { sheetId, sheetTab } = getSheetsEnv();
  const sheets = await getSheetsClient();

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${sheetTab}!A:D`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [rowValues(app)]
    }
  });

  return parseRowNumberFromRange(response.data.updates?.updatedRange);
}

export async function updateApplicationOnSheet(app: ApplicationRecord): Promise<void> {
  const { sheetId, sheetTab } = getSheetsEnv();
  const sheets = await getSheetsClient();

  if (!app.sheet_row_number) {
    throw new Error(`Application ${app.id} does not have sheet_row_number`);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${sheetTab}!A${app.sheet_row_number}:G${app.sheet_row_number}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[...rowValues(app), '', '', '']]
    }
  });
}
