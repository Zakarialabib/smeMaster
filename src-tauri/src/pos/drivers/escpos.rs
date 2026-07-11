use std::net::TcpStream;
use std::io::Write;
use crate::pos::drivers::PrinterDriver;

pub struct EscPosDriver {
    pub ip: String,
    pub port: u16,
}

impl EscPosDriver {
    pub fn new(ip: String, port: u16) -> Self {
        Self { ip, port }
    }

    fn send_command(&self, data: &[u8]) -> Result<(), String> {
        let mut stream = TcpStream::connect(format!("{}:{}", self.ip, self.port))
            .map_err(|e| e.to_string())?;
        stream.write_all(data).map_err(|e| e.to_string())?;
        Ok(())
    }
}

impl PrinterDriver for EscPosDriver {
    fn print_text(&self, text: &str) -> Result<(), String> {
        let mut data = Vec::new();
        // ESC/POS Initialization
        data.extend_from_slice(&[0x1B, 0x40]);
        // Text
        data.extend_from_slice(text.as_bytes());
        // Line feed
        data.extend_from_slice(&[0x0A]);
        self.send_command(&data)
    }

    fn cut_paper(&self) -> Result<(), String> {
        // ESC/POS Cut
        self.send_command(&[0x1D, 0x56, 0x01])
    }

    fn open_cash_drawer(&self) -> Result<(), String> {
        // ESC/POS Open Drawer
        self.send_command(&[0x1B, 0x70, 0x00, 0x32, 0xFA])
    }
}
