import { invoke } from "@tauri-apps/api/core";

// 1 契約（JSON stdio）を Rust engine コマンド経由で呼ぶ
export async function callEngine(request: object, python: string): Promise<Record<string, unknown>> {
  return JSON.parse(await invoke("engine", { request: JSON.stringify(request), python, worker: "" })) as Record<string, unknown>;
}
