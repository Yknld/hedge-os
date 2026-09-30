use rusqlite::{params, Connection};
use serde_json::Value;
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join("vector-terminal.sqlite3"))
}

fn connect(app: &AppHandle) -> Result<Connection, String> {
    let connection = Connection::open(database_path(app)?).map_err(|error| error.to_string())?;
    connection.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS campaigns (id TEXT PRIMARY KEY, name TEXT NOT NULL, account_type_name TEXT NOT NULL, account_size REAL NOT NULL, status TEXT NOT NULL, current_phase INTEGER NOT NULL, current_balance REAL NOT NULL, best_day_profit REAL NOT NULL, program_price REAL NOT NULL, billing_type TEXT NOT NULL, estimated_hedge_balance REAL NOT NULL, campaign_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS campaign_phases (campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE, phase_index INTEGER NOT NULL, name TEXT NOT NULL, profit_target REAL NOT NULL, max_drawdown REAL NOT NULL, PRIMARY KEY(campaign_id, phase_index));
      CREATE TABLE IF NOT EXISTS evaluation_rules (campaign_id TEXT PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE, rules_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS performance_account_rules (campaign_id TEXT PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE, rules_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS financial_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE, entry_type TEXT NOT NULL CHECK(entry_type IN ('evaluation_spend','hedging_spend','pa_profit','payout_received','refund','reset_fee','activation_fee','adjustment')), amount REAL NOT NULL, notes TEXT, occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS idx_financial_ledger_campaign_date ON financial_ledger(campaign_id, occurred_at);
      CREATE TABLE IF NOT EXISTS trades (id TEXT PRIMARY KEY, campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL, instrument TEXT NOT NULL, side TEXT NOT NULL, quantity REAL NOT NULL, entry_price REAL, exit_price REAL, take_profit REAL, stop_loss REAL, status TEXT NOT NULL, realized_pnl REAL, opened_at TEXT, closed_at TEXT, metadata_json TEXT);
      CREATE TABLE IF NOT EXISTS payouts (id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE, gross_amount REAL NOT NULL, net_amount REAL NOT NULL, requested_at TEXT, received_at TEXT, status TEXT NOT NULL, notes TEXT);
      CREATE TABLE IF NOT EXISTS legal_acceptances (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, document_version TEXT NOT NULL, accepted_at TEXT NOT NULL, checkboxes_json TEXT NOT NULL, metadata_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE INDEX IF NOT EXISTS idx_legal_acceptances_document_date ON legal_acceptances(document_id, accepted_at);
      CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);"
    ).map_err(|error| error.to_string())?;
    Ok(connection)
}

fn number(value: &Value, key: &str) -> f64 { value.get(key).and_then(Value::as_f64).unwrap_or(0.0) }
fn text(value: &Value, key: &str) -> String { value.get(key).and_then(Value::as_str).unwrap_or("").to_owned() }

#[tauri::command]
fn load_campaigns(app: AppHandle) -> Result<Vec<Value>, String> {
    let connection = connect(&app)?;
    let mut statement = connection.prepare("SELECT campaign_json FROM campaigns ORDER BY created_at, id").map_err(|error| error.to_string())?;
    let rows = statement.query_map([], |row| row.get::<_, String>(0)).map_err(|error| error.to_string())?;
    rows.map(|row| serde_json::from_str(&row.map_err(|error| error.to_string())?).map_err(|error| error.to_string())).collect()
}

#[tauri::command]
fn upsert_campaign(app: AppHandle, campaign: Value) -> Result<(), String> {
    let mut connection = connect(&app)?;
    let transaction = connection.transaction().map_err(|error| error.to_string())?;
    let id = text(&campaign, "id");
    let json = serde_json::to_string(&campaign).map_err(|error| error.to_string())?;
    transaction.execute("INSERT INTO campaigns (id,name,account_type_name,account_size,status,current_phase,current_balance,best_day_profit,program_price,billing_type,estimated_hedge_balance,campaign_json) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12) ON CONFLICT(id) DO UPDATE SET name=excluded.name,account_type_name=excluded.account_type_name,account_size=excluded.account_size,status=excluded.status,current_phase=excluded.current_phase,current_balance=excluded.current_balance,best_day_profit=excluded.best_day_profit,program_price=excluded.program_price,billing_type=excluded.billing_type,estimated_hedge_balance=excluded.estimated_hedge_balance,campaign_json=excluded.campaign_json,updated_at=CURRENT_TIMESTAMP",
      params![id, text(&campaign,"name"), text(&campaign,"accountTypeName"), number(&campaign,"accountSize"), text(&campaign,"status"), number(&campaign,"currentPhase"), number(&campaign,"currentBalance"), number(&campaign,"bestDayProfit"), number(&campaign,"programPrice"), text(&campaign,"billingType"), number(&campaign,"estimatedHedgeBalance"), json]).map_err(|error| error.to_string())?;
    transaction.execute("DELETE FROM campaign_phases WHERE campaign_id=?1", [&id]).map_err(|error| error.to_string())?;
    if let Some(phases) = campaign.get("phases").and_then(Value::as_array) { for (index, phase) in phases.iter().enumerate() { transaction.execute("INSERT INTO campaign_phases (campaign_id,phase_index,name,profit_target,max_drawdown) VALUES (?1,?2,?3,?4,?5)", params![id,index,text(phase,"name"),number(phase,"profitTarget"),number(phase,"maxDrawdown")]).map_err(|error| error.to_string())?; } }
    for (table, key) in [("evaluation_rules","evaluationRules"),("performance_account_rules","performanceRules")] { if let Some(rules) = campaign.get(key) { let rules_json=serde_json::to_string(rules).map_err(|error| error.to_string())?; transaction.execute(&format!("INSERT INTO {table} (campaign_id,rules_json) VALUES (?1,?2) ON CONFLICT(campaign_id) DO UPDATE SET rules_json=excluded.rules_json"),params![id,rules_json]).map_err(|error| error.to_string())?; } }
    transaction.commit().map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_campaign(app: AppHandle, campaign_id: String) -> Result<(), String> { connect(&app)?.execute("DELETE FROM campaigns WHERE id=?1", [campaign_id]).map_err(|error| error.to_string())?; Ok(()) }

#[tauri::command]
fn append_financial_entry(app: AppHandle, campaign_id: String, entry_type: String, amount: f64, notes: Option<String>) -> Result<(), String> {
    connect(&app)?.execute("INSERT INTO financial_ledger (campaign_id,entry_type,amount,notes) VALUES (?1,?2,?3,?4)", params![campaign_id,entry_type,amount,notes]).map_err(|error| error.to_string())?; Ok(())
}

#[tauri::command]
fn load_active_campaign(app: AppHandle) -> Result<Option<String>, String> {
    let connection = connect(&app)?;
    match connection.query_row("SELECT value_json FROM app_settings WHERE key='active_campaign_id'", [], |row| row.get::<_, String>(0)) {
        Ok(value) => Ok(serde_json::from_str(&value).unwrap_or(None)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn save_active_campaign(app: AppHandle, campaign_id: String) -> Result<(), String> {
    let value = serde_json::to_string(&campaign_id).map_err(|error| error.to_string())?;
    connect(&app)?.execute("INSERT INTO app_settings (key,value_json) VALUES ('active_campaign_id',?1) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP", [value]).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn record_legal_acceptance(app: AppHandle, acceptance: Value) -> Result<(), String> {
    let id=text(&acceptance,"id");
    let document_id=text(&acceptance,"documentId");
    let version=text(&acceptance,"version");
    let accepted_at=text(&acceptance,"acceptedAt");
    if id.is_empty() || document_id.is_empty() || version.is_empty() || accepted_at.is_empty() {
        return Err("A legal acceptance requires an id, document id, version, and timestamp.".into());
    }
    connect(&app)?.execute("INSERT INTO legal_acceptances (id,document_id,document_version,accepted_at,checkboxes_json,metadata_json) VALUES (?1,?2,?3,?4,?5,?6)",params![id,document_id,version,accepted_at,acceptance.get("checkboxes").unwrap_or(&Value::Null).to_string(),acceptance.get("metadata").unwrap_or(&Value::Null).to_string()]).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn database_info(app: AppHandle) -> Result<Value, String> {
    let path = database_path(&app)?; let connection = connect(&app)?;
    let count: i64 = connection.query_row("SELECT COUNT(*) FROM campaigns", [], |row| row.get(0)).map_err(|error| error.to_string())?;
    Ok(serde_json::json!({"path": path, "campaignCount": count, "tables": ["campaigns","campaign_phases","evaluation_rules","performance_account_rules","financial_ledger","trades","payouts","legal_acceptances","app_settings"]}))
}

fn engine_schema(connection: &Connection) -> Result<(), String> {
    connection.execute_batch("CREATE TABLE IF NOT EXISTS campaign_engine_sessions (id TEXT PRIMARY KEY, session_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS campaign_state_transitions (id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, timestamp TEXT NOT NULL, previous_state_json TEXT NOT NULL, action_json TEXT NOT NULL, outcome TEXT NOT NULL, next_state_json TEXT NOT NULL, optimizer_version TEXT NOT NULL, rules_json TEXT NOT NULL, options_json TEXT NOT NULL);")
      .map_err(|e|e.to_string())
}

#[tauri::command]
fn load_engine_session(app: AppHandle) -> Result<Option<Value>, String> {
    let connection=connect(&app)?; engine_schema(&connection)?;
    match connection.query_row("SELECT session_json FROM campaign_engine_sessions WHERE id='workspace'",[],|row|row.get::<_,String>(0)) {
        Ok(json)=>serde_json::from_str(&json).map(Some).map_err(|e|e.to_string()),
        Err(rusqlite::Error::QueryReturnedNoRows)=>Ok(None), Err(e)=>Err(e.to_string())
    }
}

fn write_engine_session(connection: &mut Connection, session: &Value) -> Result<(), String> {
    engine_schema(connection)?;
    let transaction=connection.transaction().map_err(|e|e.to_string())?;
    transaction.execute("INSERT INTO campaign_engine_sessions(id,session_json) VALUES ('workspace',?1) ON CONFLICT(id) DO UPDATE SET session_json=excluded.session_json",[session.to_string()]).map_err(|e|e.to_string())?;
    if let Some(history)=session.get("history").and_then(Value::as_array) { for record in history {
        transaction.execute("INSERT OR IGNORE INTO campaign_state_transitions(id,campaign_id,timestamp,previous_state_json,action_json,outcome,next_state_json,optimizer_version,rules_json,options_json) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",params![text(record,"id"),text(record,"campaignId"),text(record,"timestamp"),record["previousState"].to_string(),record["action"].to_string(),text(record,"outcome"),record["nextState"].to_string(),text(record,"optimizerVersion"),record["rules"].to_string(),record["options"].to_string()]).map_err(|e|e.to_string())?;
    }}
    transaction.commit().map_err(|e|e.to_string())
}

#[tauri::command]
fn save_engine_session(app: AppHandle, session: Value) -> Result<(), String> {
    write_engine_session(&mut connect(&app)?, &session)
}

#[tauri::command]
fn list_engine_workspaces(app: AppHandle) -> Result<Vec<Value>, String> {
    let connection=connect(&app)?; engine_schema(&connection)?;
    let mut statement=connection.prepare("SELECT session_json FROM campaign_engine_sessions WHERE id LIKE 'saved:%' ORDER BY rowid DESC").map_err(|e|e.to_string())?;
    let rows=statement.query_map([],|row|row.get::<_,String>(0)).map_err(|e|e.to_string())?;
    rows.map(|row|row.map_err(|e|e.to_string()).and_then(|json|serde_json::from_str(&json).map_err(|e|e.to_string()))).collect()
}

#[tauri::command]
fn save_named_engine_workspace(app: AppHandle, workspace_id: String, session: Value) -> Result<(), String> {
    let connection=connect(&app)?; engine_schema(&connection)?;
    connection.execute("INSERT INTO campaign_engine_sessions(id,session_json) VALUES (?1,?2) ON CONFLICT(id) DO UPDATE SET session_json=excluded.session_json",params![format!("saved:{}",workspace_id),session.to_string()]).map_err(|e|e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod engine_tests {
    use super::*;
    #[test]
    fn sqlite_restores_engine_state_and_history_atomically() {
        let mut db=Connection::open_in_memory().unwrap();
        let session=serde_json::json!({"state":{"balance":49000,"unrecoveredRealBasis":108,"largestWinningDay":1200},"rules":{"id":"daily"},"history":[{"id":"t1","campaignId":"c1","timestamp":"now","previousState":{"balance":50000},"action":{"stopLoss":1000},"outcome":"SL","nextState":{"balance":49000},"optimizerVersion":"1.0.0"}]});
        write_engine_session(&mut db,&session).unwrap();
        write_engine_session(&mut db,&session).unwrap();
        let json:String=db.query_row("SELECT session_json FROM campaign_engine_sessions",[],|row|row.get(0)).unwrap();
        assert_eq!(serde_json::from_str::<Value>(&json).unwrap(),session);
        let count:i64=db.query_row("SELECT COUNT(*) FROM campaign_state_transitions",[],|row|row.get(0)).unwrap();
        assert_eq!(count,1);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default().invoke_handler(tauri::generate_handler![load_engine_session, save_engine_session, list_engine_workspaces, save_named_engine_workspace, load_campaigns, upsert_campaign, delete_campaign, append_financial_entry, load_active_campaign, save_active_campaign, record_legal_acceptance, database_info]).run(tauri::generate_context!()).expect("error while running the desktop application");
}
