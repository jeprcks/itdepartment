/** Excel-friendly CSV: UTF-8 BOM, CRLF, quoted cells, formula-injection guard. */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const cell = (value: string | number) => {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return "\uFEFF" + [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
