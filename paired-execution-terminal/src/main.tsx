import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";
import { useAppStore } from "./store/useAppStore";

const savedTheme = localStorage.getItem('hedge-os:theme');
if (savedTheme === 'ivory') document.documentElement.dataset.theme = 'ivory';

class AppErrorBoundary extends React.Component<React.PropsWithChildren, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('Hedge OS render failed', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return <main style={{padding:24,color:'var(--app-danger)',background:'var(--app-canvas)',minHeight:'100vh',fontFamily:'ui-monospace,monospace'}}>
      <h1 style={{fontSize:16}}>Hedge OS could not render</h1>
      <pre style={{marginTop:16,whiteSpace:'pre-wrap'}}>{this.state.error.message}</pre>
    </main>;
  }
}

void useAppStore.getState().hydrateCampaigns();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
);
