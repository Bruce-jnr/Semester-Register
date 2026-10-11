export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event('session-expired'));
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

export const post = (path, body) =>
  api(path, { method: 'POST', body: JSON.stringify(body) });

export async function download(path) {
  const response = await fetch(`/api${path}`, { credentials: 'include' });
  if (!response.ok)
    throw new Error('Export failed. Please sign in and try again.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download =
    response.headers
      .get('Content-Disposition')
      ?.match(/filename="([^"]+)"/)?.[1] || 'Export.xlsx';
  link.click();
  URL.revokeObjectURL(url);
}
