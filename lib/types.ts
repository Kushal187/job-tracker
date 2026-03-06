export const APPLICATION_STATUSES = [
  'Applied',
  'Interviewing',
  'Offer',
  'Rejected',
  'Withdrawn'
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type ApplicationRecord = {
  id: string;
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
