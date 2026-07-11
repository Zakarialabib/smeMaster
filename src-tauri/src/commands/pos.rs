use tauri::{AppHandle, command};
use crate::pos::{HardwareConfig, HardwareManager};

#[command]
pub async fn pos_get_hardware_configs(
    _app: AppHandle,
    _company_id: String,
) -> Result<Vec<HardwareConfig>, String> {
    // In a real app, this would query the SQLite DB
    Ok(vec![])
}

#[command]
pub async fn pos_test_printer(
    config: HardwareConfig,
) -> Result<(), String> {
    let manager = HardwareManager::new();
    manager.print_test_page(config).await
}

#[command]
pub async fn pos_print_receipt(
    config: HardwareConfig,
    html_content: String,
) -> Result<(), String> {
    let manager = HardwareManager::new();
    // In a full implementation, we'd convert HTML to ESC/POS or use a webview to print
    // For now, we'll strip tags and print as text for ESC/POS, or use the system driver
    let plain_text = html_content
        .replace("<h1>", "").replace("</h1>", "\n")
        .replace("<p>", "").replace("</p>", "\n")
        .replace("<br/>", "\n")
        .replace("<br>", "\n");

    manager.print_receipt(config, plain_text).await
}
