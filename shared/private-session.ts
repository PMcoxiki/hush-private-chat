export type SessionOperationResult<T> =
  | { status: "fulfilled"; value: T; current: boolean }
  | { status: "rejected"; error: unknown; current: boolean };

export async function settleSessionOperation<T>(
  operation: Promise<T>,
  capturedSession: number,
  readCurrentSession: () => number,
): Promise<SessionOperationResult<T>> {
  try {
    const value = await operation;
    return {
      status: "fulfilled",
      value,
      current: capturedSession === readCurrentSession(),
    };
  } catch (error) {
    return {
      status: "rejected",
      error,
      current: capturedSession === readCurrentSession(),
    };
  }
}
