use crate::error::SerializedError;
use std::io::Write;
use std::path::Path;

#[tauri::command]
pub fn append_to_mbox(
    file_path: String,
    message_rfc2822: String,
    from_address: String,
    date_seconds: i64,
) -> Result<(), SerializedError> {
    let path = Path::new(&file_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)?;

    let date_str = chrono::DateTime::from_timestamp(date_seconds, 0)
        .map(|dt| dt.format("%a %b %d %H:%M:%S %Y").to_string())
        .unwrap_or_default();
    writeln!(file, "From {from_address} {date_str}")?;

    for line in message_rfc2822.lines() {
        if line.starts_with("From ") {
            writeln!(file, ">{line}")?;
        } else {
            writeln!(file, "{line}")?;
        }
    }

    writeln!(file)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_append_to_mbox_format() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("test.mbox");
        let path_str = path.to_str().unwrap().to_string();

        append_to_mbox(
            path_str.clone(),
            "Subject: Hello\n\nThis is the body.".to_string(),
            "alice@example.com".to_string(),
            1700000000,
        )
        .unwrap();

        append_to_mbox(
            path_str.clone(),
            "Subject: World\n\nFrom somewhere far away.".to_string(),
            "bob@example.com".to_string(),
            1700000001,
        )
        .unwrap();

        let content = fs::read_to_string(&path).unwrap();

        assert!(
            content.starts_with("From alice@example.com"),
            "Should start with From separator for first message"
        );
        assert!(
            content.contains("From bob@example.com"),
            "Should contain From separator for second message"
        );
        assert!(
            content.contains(">From somewhere far away."),
            "Should escape 'From ' in body to '>From '"
        );
    }
}
