use tauri::Manager;

/// Check if clipboard contains an image, save it to temp dir, return the path
#[tauri::command]
pub async fn clipboard_save_image(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    tokio::task::spawn_blocking(move || {
        let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;

        match clipboard.get_image() {
            Ok(img_data) => {
                let attachments_dir = app_data_dir.join("attachments");
                std::fs::create_dir_all(&attachments_dir).map_err(|e| e.to_string())?;

                let filename = format!("clipboard_{}.png", uni_common::generate_id());
                let filepath = attachments_dir.join(&filename);

                let img_buf: image::RgbaImage = image::ImageBuffer::from_raw(
                    img_data.width as u32,
                    img_data.height as u32,
                    img_data.bytes.into_owned(),
                )
                .ok_or("Failed to create image buffer")?;

                img_buf
                    .save_with_format(&filepath, image::ImageFormat::Png)
                    .map_err(|e| e.to_string())?;

                Ok(Some(filepath.to_string_lossy().to_string()))
            }
            Err(_) => Ok(None),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_get_file_extension() {
        let path = "D:\\screenshots\\bug.png";
        let ext = path.split('.').last().unwrap_or("");
        assert_eq!(ext, "png");
    }
}
