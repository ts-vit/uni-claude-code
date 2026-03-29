use serde::Serialize;
use sqlx::Row;
use sqlx::SqlitePool;
use tauri::State;

type Pool = SqlitePool;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedMessage {
    pub id: String,
    pub project_id: String,
    pub user_prompt: String,
    pub assistant_response: String,
    pub model: Option<String>,
    pub session_tab_id: Option<String>,
    pub created_at: i64,
}

#[tauri::command]
pub async fn history_save(
    pool: State<'_, Pool>,
    project_id: String,
    user_prompt: String,
    assistant_response: String,
    model: Option<String>,
    session_tab_id: Option<String>,
) -> Result<SavedMessage, String> {
    let id = uni_common::generate_id();
    let now = uni_common::now_unix_secs();

    sqlx::query(
        "INSERT INTO saved_messages (id, project_id, user_prompt, assistant_response, model, session_tab_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&project_id)
    .bind(&user_prompt)
    .bind(&assistant_response)
    .bind(&model)
    .bind(&session_tab_id)
    .bind(now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(SavedMessage {
        id,
        project_id,
        user_prompt,
        assistant_response,
        model,
        session_tab_id,
        created_at: now,
    })
}

#[tauri::command]
pub async fn history_list(
    pool: State<'_, Pool>,
    project_id: String,
) -> Result<Vec<SavedMessage>, String> {
    let rows = sqlx::query(
        "SELECT id, project_id, user_prompt, assistant_response, model, session_tab_id, created_at FROM saved_messages WHERE project_id = ? ORDER BY created_at DESC",
    )
    .bind(&project_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .map(|row| SavedMessage {
            id: row.get("id"),
            project_id: row.get("project_id"),
            user_prompt: row.get("user_prompt"),
            assistant_response: row.get("assistant_response"),
            model: row.try_get("model").ok(),
            session_tab_id: row.try_get("session_tab_id").ok(),
            created_at: row.get("created_at"),
        })
        .collect())
}

#[tauri::command]
pub async fn history_delete(pool: State<'_, Pool>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM saved_messages WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

async fn history_export_markdown_impl(pool: &Pool, project_id: &str) -> Result<String, String> {
    let rows = sqlx::query(
        "SELECT user_prompt, assistant_response, model, created_at FROM saved_messages WHERE project_id = ? ORDER BY created_at ASC",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut md = String::from("# Saved Messages\n\n");

    for row in &rows {
        let prompt: String = row.get("user_prompt");
        let response: String = row.get("assistant_response");
        let model: Option<String> = row.try_get("model").ok();
        let created_at: i64 = row.get("created_at");

        let date = chrono::DateTime::from_timestamp(created_at, 0)
            .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
            .unwrap_or_else(|| created_at.to_string());

        md.push_str("---\n\n");
        if let Some(m) = &model {
            md.push_str(&format!("*{} | {}*\n\n", date, m));
        } else {
            md.push_str(&format!("*{}*\n\n", date));
        }
        md.push_str(&format!("**User:** {}\n\n", prompt));
        md.push_str(&format!("**Assistant:**\n\n{}\n\n", response));
    }

    Ok(md)
}

#[tauri::command]
pub async fn history_export_markdown(
    pool: State<'_, Pool>,
    project_id: String,
) -> Result<String, String> {
    history_export_markdown_impl(pool.inner(), &project_id).await
}

#[tauri::command]
pub async fn history_export_to_file(
    pool: State<'_, Pool>,
    project_id: String,
    file_path: String,
) -> Result<(), String> {
    let md = history_export_markdown_impl(pool.inner(), &project_id).await?;
    std::fs::write(&file_path, md).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_saved_message_serialize() {
        let msg = SavedMessage {
            id: "test".to_string(),
            project_id: "proj".to_string(),
            user_prompt: "hello".to_string(),
            assistant_response: "world".to_string(),
            model: Some("opus".to_string()),
            session_tab_id: None,
            created_at: 1700000000,
        };
        let json = serde_json::to_value(&msg).unwrap();
        assert_eq!(json["userPrompt"], "hello");
        assert_eq!(json["assistantResponse"], "world");
    }
}
