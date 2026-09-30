import { invoke } from "@tauri-apps/api/core";
import type { Campaign } from "../store/useAppStore";

const STORAGE_KEY = "vector-terminal-campaigns-v1";
const isTauri = () => Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

export async function loadPersistedCampaigns(): Promise<Campaign[] | null> {
  if (isTauri()) {
    const campaigns = await invoke<Campaign[]>("load_campaigns");
    return campaigns.length ? campaigns : null;
  }
  const value = localStorage.getItem(STORAGE_KEY);
  return value ? JSON.parse(value) as Campaign[] : null;
}

export async function persistCampaign(campaign: Campaign, allCampaigns: Campaign[]) {
  if (isTauri()) await invoke("upsert_campaign", { campaign });
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(allCampaigns));
}

export async function removePersistedCampaign(campaignId: string, allCampaigns: Campaign[]) {
  if (isTauri()) await invoke("delete_campaign", { campaignId });
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(allCampaigns));
}

export type LedgerEntryType = "evaluation_spend" | "hedging_spend" | "pa_profit" | "payout_received";
export async function appendLedgerEntry(campaignId: string, entryType: LedgerEntryType, amount: number, notes: string) {
  if (isTauri() && amount !== 0) await invoke("append_financial_entry", { campaignId, entryType, amount, notes });
}

export async function seedPersistedCampaign(campaign: Campaign, allCampaigns: Campaign[]) {
  await persistCampaign(campaign, allCampaigns);
  await Promise.all([
    appendLedgerEntry(campaign.id, "evaluation_spend", campaign.evaluationSpend, "Initial campaign value"),
    appendLedgerEntry(campaign.id, "hedging_spend", campaign.hedgingSpend, "Initial campaign value"),
    appendLedgerEntry(campaign.id, "pa_profit", campaign.totalPaProfit, "Initial campaign value"),
    appendLedgerEntry(campaign.id, "payout_received", campaign.payoutsReceived, "Initial campaign value"),
  ]);
}

export async function loadPersistedActiveCampaign() {
  if (isTauri()) return invoke<string | null>("load_active_campaign");
  return localStorage.getItem("vector-terminal-active-campaign");
}

export async function persistActiveCampaign(campaignId: string) {
  if (isTauri()) await invoke("save_active_campaign", { campaignId });
  else localStorage.setItem("vector-terminal-active-campaign", campaignId);
}
