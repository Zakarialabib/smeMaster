pub mod escpos;
pub mod system_printer;

pub trait PrinterDriver {
    fn print_text(&self, text: &str) -> Result<(), String>;
    fn cut_paper(&self) -> Result<(), String>;
    fn open_cash_drawer(&self) -> Result<(), String>;
}
