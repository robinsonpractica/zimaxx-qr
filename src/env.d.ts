/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

declare namespace App {
  interface Locals {
    runtime?: { env: Env; ctx?: ExecutionContext };
    requestId?: string;
  }
}

interface Env {
  DB: D1Database;
  SESSION?: KVNamespace;
  PUBLIC_APP_ORIGIN?: string;
  ASSETS?: Fetcher;
}
