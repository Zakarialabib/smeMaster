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
        let docx = read_docx(&file).map_err(|e| anyhow::anyhow!("docx parse error: {e}"))?;
        let mut text = String::new();
        for child in docx.document.children {
            Self::extract_docx_text(&child, &mut text);
            text.push('\n');
        }
        Ok(text)
    }

    /// Recursively pull text out of a DOCX block element.
    ///
    /// Previously `parse_docx` returned the literal string
    /// `"DOCX content extraction placeholder"`, so every .docx attachment was
    /// indexed as that sentence. This mirrors the implementation in
    /// `crates/ml-sidecar/src/main.rs` so both parsers agree.
    fn extract_docx_text(child: &docx_rs::DocumentChild, text: &mut String) {
        use docx_rs::DocumentChild::*;
        match child {
            Paragraph(paragraph) => {
                for pchild in &paragraph.children {
                    if let docx_rs::ParagraphChild::Run(run) = pchild {
                        for rchild in &run.children {
                            if let docx_rs::RunChild::Text(t) = rchild {
                                text.push_str(&t.text);
                            }
                        }
                    }
                }
            }
            Table(table) => {
                for tchild in &table.rows {
                    // `TableChild` / `TableRowChild` each have a single variant
                    // in docx-rs 0.4, so these are plain bindings, not filters.
                    let docx_rs::TableChild::TableRow(row) = tchild;
                    for cell in &row.cells {
                        let docx_rs::TableRowChild::TableCell(tc) = cell;
                        for c in &tc.children {
                            if let docx_rs::TableCellContent::Paragraph(p) = c {
                                Self::extract_docx_text(
                                    &docx_rs::DocumentChild::Paragraph(p.clone()),
                                    text,
                                );
                            }
                        }
                        text.push_str(" | ");
                    }
                    text.push('\n');
                }
            }
            _ => {}
        }
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
