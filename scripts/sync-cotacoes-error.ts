import { APIError } from "brapi";

export function isBrapiNotFoundError(error: unknown): boolean {
  return error instanceof APIError && error.status === 404;
}
