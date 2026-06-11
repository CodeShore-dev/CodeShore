export function calcLatency(
  start: Date,
  end: Date,
): number {
  return (end.getTime() - start.getTime()) / 1000;
}

export function stringifyObject(
  value: unknown,
): string | undefined {
  try {
    return value && Object.keys(value).length > 0
      ? JSON.stringify(value)
      : undefined;
  } catch {
    return undefined;
  }
}

export function stringifyBody(
  value: unknown,
): string | undefined {
  if (Buffer.isBuffer(value)) {
    return `a ${value.length} bytes binary`;
  } else if (typeof value === 'string') {
    return value;
  }
  return stringifyObject(value);
}

