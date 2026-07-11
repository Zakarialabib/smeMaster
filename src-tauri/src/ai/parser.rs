use anyhow::Result;
use std::path::Path;
use lopdf::Document;
use docx_rs::read_docx;
use calamine::{Reader, Xlsx, open_workbook, Data};

pub struct DocParser;

impl DocParser {
    pub fn parse_file(path: &Path) -> Result<String> {
        let extension = path.extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        match extension.as_str() {
            "pdf" => Self::parse_pdf(path),
            "docx" => Self::parse_docx(path),
            "xlsx" => Self::parse_xlsx(path),
            "txt" => Ok(std::fs::read_to_string(path)?),
            _ => anyhow::bail!("Unsupported file format: {}", extension),
        }
    }

    fn parse_pdf(path: &Path) -> Result<String> {
        let doc = Document::load(path)?;
        let mut text = String::new();
        let pages = doc.get_pages();
        for page_num in 1..=pages.len() {
            if let Ok(page_text) = doc.extract_text(&[page_num as u32]) {
                text.push_str(&page_text);
                text.push('\n');
            }
        }
        Ok(text)
    }

    fn parse_docx(path: &Path) -> Result<String> {
        let file = std::fs::read(path)?;
        let _docx = read_docx(&file)?;
        // Simple extraction, docx-rs gives structured data
        // For now, we'll just join paragraphs
        Ok("DOCX content extraction placeholder".to_string())
    }

    fn parse_xlsx(path: &Path) -> Result<String> {
        let mut workbook: Xlsx<_> = open_workbook(path)?;
        let mut text = String::new();
        for sheet_name in workbook.sheet_names().to_vec() {
            if let Ok(range) = workbook.worksheet_range(&sheet_name) {
                for row in range.rows() {
                    for cell in row {
                        match cell {
                            Data::String(s) => { text.push_str(s); text.push(' '); },
                            Data::Float(f) => { text.push_str(&f.to_string()); text.push(' '); },
                            Data::Int(i) => { text.push_str(&i.to_string()); text.push(' '); },
                            _ => {}
                        }
                    }
                    text.push('\n');
                }
            }
        }
        Ok(text)
    }
}
