// Helper functions for validation
export const isValidString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

export const isValidObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const isValidBoolean = (value: unknown): value is boolean => {
  return typeof value === 'boolean';
};
