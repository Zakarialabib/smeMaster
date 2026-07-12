use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::pos::drivers::{PrinterDriver, escpos::EscPosDriver, system_printer::SystemPrinterDriver};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum DeviceType {
    Printer,
    Scanner,
    Scale,
    CashDrawer,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum ConnectionType {
    Usb,
    Network,
    Serial,
    Hid,
    System,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HardwareConfig {
    pub id: String,
    pub company_id: String,
    pub name: String,
    pub device_type: DeviceType,
    pub driver_type: String,
    pub connection_type: ConnectionType,
    pub connection_params: HashMap<String, String>,
    pub is_default: bool,
}

pub mod drivers;

pub struct HardwareManager;

impl HardwareManager {
    pub fn new() -> Self {
        Self
    }

    fn get_printer_driver(&self, config: &HardwareConfig) -> Result<Box<dyn PrinterDriver>, String> {
        match config.connection_type {
            ConnectionType::Network => {
                let ip = config.connection_params.get("ip")
                    .cloned()
                    .ok_or("Missing IP address in connection params")?;
                let port = config.connection_params.get("port")
                    .and_then(|p| p.parse::<u16>().ok())
                    .unwrap_or(9100);
                Ok(Box::new(EscPosDriver::new(ip, port)))
            }
            ConnectionType::System => {
                let printer_name = config.connection_params.get("printerName")
                    .cloned()
                    .ok_or("Missing printer name in connection params")?;
                Ok(Box::new(SystemPrinterDriver::new(printer_name)))
            }
            _ => Err(format!("Unsupported connection type {:?} for printer", config.connection_type)),
        }
    }

    pub async fn print_test_page(&self, config: HardwareConfig) -> Result<(), String> {
        match config.device_type {
            DeviceType::Printer => {
                let driver = self.get_printer_driver(&config)?;
                driver.print_text(&format!("*** TEST PAGE ***\nDevice: {}\nType: {:?}\nStatus: OK\n", config.name, config.connection_type))?;
                driver.cut_paper()?;
                Ok(())
            }
            _ => Err("Device is not a printer".into()),
        }
    }

    pub async fn print_receipt(&self, config: HardwareConfig, content: String) -> Result<(), String> {
        match config.device_type {
            DeviceType::Printer => {
                let driver = self.get_printer_driver(&config)?;
                driver.print_text(&content)?;
                driver.cut_paper()?;
                Ok(())
            }
            _ => Err("Device is not a printer".into()),
        }
    }

    pub async fn open_cash_drawer(&self, config: HardwareConfig) -> Result<(), String> {
        match config.device_type {
            DeviceType::Printer => {
                let driver = self.get_printer_driver(&config)?;
                driver.open_cash_drawer()
            }
            DeviceType::CashDrawer => {
                Err("Standalone cash drawer not supported yet. Connect the drawer to a printer and use the printer config.".into())
            }
            _ => Err("Device does not support cash drawer".into()),
        }
    }
}
