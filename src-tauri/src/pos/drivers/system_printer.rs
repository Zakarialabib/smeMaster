use crate::pos::drivers::PrinterDriver;

pub struct SystemPrinterDriver {
    pub printer_name: String,
}

impl SystemPrinterDriver {
    pub fn new(printer_name: String) -> Self {
        Self { printer_name }
    }
}

impl PrinterDriver for SystemPrinterDriver {
    fn print_text(&self, text: &str) -> Result<(), String> {
        println!("Printing to system printer {}: {}", self.printer_name, text);
        // On Windows/Linux/macOS this would use native APIs or CUPS/LP
        Ok(())
    }

    fn cut_paper(&self) -> Result<(), String> {
        // System printers usually handle cutting via driver settings
        Ok(())
    }

    fn open_cash_drawer(&self) -> Result<(), String> {
        Err("System printer driver doesn't support direct cash drawer opening".into())
    }
}
