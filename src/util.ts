
export function setError(params: {[key: string]: unknown}, message: string) {
  params.status = 'error';
  params.message = message;
  return params;
}
