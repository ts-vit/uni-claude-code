use serde::Serialize;
use sqlx::Row;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub cwd: String,
    pub model: Option<String>,
    pub permission_mode: String,
    pub created_at: i64,
    pub updated_at: i64,
}

type Pool = SqlitePool;

#[tauri::command]
pub async fn project_list(pool: State<'_, Pool>) -> Result<Vec<Project>, String> {
    let rows = sqlx::query(
        "SELECT id, name, cwd, model, permission_mode, created_at, updated_at FROM projects ORDER BY updated_at DESC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .map(|row| Project {
            id: row.get("id"),
            name: row.get("name"),
            cwd: row.get("cwd"),
            model: row.try_get("model").ok(),
            permission_mode: row
                .try_get::<String, _>("permission_mode")
                .unwrap_or_else(|_| "bypass".to_string()),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
        .collect())
}

#[tauri::command]
pub async fn project_create(
    pool: State<'_, Pool>,
    name: String,
    cwd: String,
    model: Option<String>,
    permission_mode: Option<String>,
) -> Result<Project, String> {
    let id = uni_common::generate_id();
    let now = uni_common::now_unix_secs();
    let perm = permission_mode.unwrap_or_else(|| "bypass".to_string());

    sqlx::query(
        "INSERT INTO projects (id, name, cwd, model, permission_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(&name)
    .bind(&cwd)
    .bind(&model)
    .bind(&perm)
    .bind(now)
    .bind(now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(Project {
        id,
        name,
        cwd,
        model,
        permission_mode: perm,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn project_update(
    pool: State<'_, Pool>,
    id: String,
    name: String,
    cwd: String,
    model: Option<String>,
    permission_mode: Option<String>,
) -> Result<(), String> {
    let now = uni_common::now_unix_secs();
    let perm = permission_mode.unwrap_or_else(|| "bypass".to_string());
    sqlx::query(
        "UPDATE projects SET name = ?, cwd = ?, model = ?, permission_mode = ?, updated_at = ? WHERE id = ?",
    )
    .bind(&name)
    .bind(&cwd)
    .bind(&model)
    .bind(&perm)
    .bind(now)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn project_delete(pool: State<'_, Pool>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Touch updated_at to move project to top of recent list
#[tauri::command]
pub async fn project_touch(pool: State<'_, Pool>, id: String) -> Result<(), String> {
    let now = uni_common::now_unix_secs();
    sqlx::query("UPDATE projects SET updated_at = ? WHERE id = ?")
        .bind(now)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_project_serialize() {
        let project = Project {
            id: "test-id".to_string(),
            name: "My Project".to_string(),
            cwd: "D:\\work".to_string(),
            model: Some("opus".to_string()),
            permission_mode: "bypass".to_string(),
            created_at: 1700000000,
            updated_at: 1700000000,
        };
        let json = serde_json::to_value(&project).unwrap();
        assert_eq!(json["createdAt"], 1700000000);
        assert_eq!(json["name"], "My Project");
        assert_eq!(json["permissionMode"], "bypass");
        assert_eq!(json["model"], "opus");
    }
}
