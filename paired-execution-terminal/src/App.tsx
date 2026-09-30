import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { AccountPage } from "./pages/AccountPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TerminalPage } from "./pages/TerminalPage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { CampaignEnginePage } from "./pages/CampaignEnginePage";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<TerminalPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/campaign-engine" element={<CampaignEnginePage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
