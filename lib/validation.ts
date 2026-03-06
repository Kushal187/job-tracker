import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
  type CreateApplicationInput,
  type UpdateApplicationInput
} from './types';

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateCreatePayload(payload: unknown): CreateApplicationInput {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be an object');
  }

  const raw = payload as Record<string, unknown>;
  const company = normalizeString(raw.company);
  const jobTitle = normalizeString(raw.jobTitle);
  const status = normalizeString(raw.status) as ApplicationStatus;
  const jobUrl = normalizeString(raw.jobUrl);

  if (!company || !jobTitle || !status || !jobUrl) {
    throw new Error('company, jobTitle, status, and jobUrl are required');
  }

  if (!APPLICATION_STATUSES.includes(status)) {
    throw new Error(`Invalid status. Allowed: ${APPLICATION_STATUSES.join(', ')}`);
  }

  try {
    new URL(jobUrl);
  } catch {
    throw new Error('jobUrl must be a valid URL');
  }

  return { company, jobTitle, status, jobUrl };
}

export function validateUpdatePayload(payload: unknown): UpdateApplicationInput {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be an object');
  }

  const raw = payload as Record<string, unknown>;
  const next: UpdateApplicationInput = {};

  if ('company' in raw) {
    const company = normalizeString(raw.company);
    if (!company) {
      throw new Error('company cannot be empty');
    }
    next.company = company;
  }

  if ('jobTitle' in raw) {
    const jobTitle = normalizeString(raw.jobTitle);
    if (!jobTitle) {
      throw new Error('jobTitle cannot be empty');
    }
    next.jobTitle = jobTitle;
  }

  if ('status' in raw) {
    const status = normalizeString(raw.status) as ApplicationStatus;
    if (!APPLICATION_STATUSES.includes(status)) {
      throw new Error(`Invalid status. Allowed: ${APPLICATION_STATUSES.join(', ')}`);
    }
    next.status = status;
  }

  if ('jobUrl' in raw) {
    const jobUrl = normalizeString(raw.jobUrl);
    if (!jobUrl) {
      throw new Error('jobUrl cannot be empty');
    }
    try {
      new URL(jobUrl);
    } catch {
      throw new Error('jobUrl must be a valid URL');
    }
    next.jobUrl = jobUrl;
  }

  if (Object.keys(next).length === 0) {
    throw new Error('At least one editable field is required');
  }

  return next;
}
