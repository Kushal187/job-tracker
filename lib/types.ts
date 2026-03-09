export const APPLICATION_STATUSES = [
  'Applied',
  'Reject',
  'Accepted',
  'Interview',
  'OA'
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type ApplicationRecord = {
  id: string;
  user_id: string;
  company: string;
  job_title: string;
  status: ApplicationStatus;
  job_url: string;
  applied_at: string;
  updated_at: string;
  sheet_row_number: number | null;
};

export type CreateApplicationInput = {
  company: string;
  jobTitle: string;
  status: ApplicationStatus;
  jobUrl: string;
};

export type UpdateApplicationInput = Partial<CreateApplicationInput>;

export type UserSettingsRecord = {
  user_id: string;
  google_sheet_id: string | null;
  google_sheet_tab: string;
  google_sheet_sync_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type UpdateUserSettingsInput = {
  googleSheetId?: string | null;
  googleSheetTab?: string;
  googleSheetSyncEnabled?: boolean;
};
