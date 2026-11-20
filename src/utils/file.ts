/**
 * Returns the file extension
 *
 * @param {string} filename - The filename
 * @return {string} - the file extension
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) return ''; // No extension
  return filename.slice(lastDot + 1).toLowerCase();
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
