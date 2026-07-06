import React from 'react';
import type { ReactNode } from 'react';

export type MockApiRequest = (options: {
  url: string;
  method?: string;
  params?: Record<string, unknown>;
  data?: Record<string, unknown>;
}) => Promise<{ data: { data: any } }>;

export interface MockApi {
  request: MockApiRequest;
}

export function createMockApi(
  handler?: (options: {
    url: string;
    method?: string;
    params?: Record<string, unknown>;
    data?: Record<string, unknown>;
  }) => any,
): MockApi & {
  calls: Array<{ url: string; method?: string; params?: Record<string, unknown>; data?: Record<string, unknown> }>;
} {
  const calls: Array<{
    url: string;
    method?: string;
    params?: Record<string, unknown>;
    data?: Record<string, unknown>;
  }> = [];
  const request: MockApiRequest = async (options) => {
    calls.push(options);
    const result = handler ? await handler(options) : {};
    return { data: { data: result } };
  };
  return { request, calls };
}

export function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <>{children}</>;
  };
}
