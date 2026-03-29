use serde::Serialize;
use sqlx::{Row, SqlitePool};
use tauri::State;

type Pool = SqlitePool;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineTask {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub description: String,
    pub prompt: Option<String>,
    pub status: String,
    pub sort_order: i64,
    pub result_summary: Option<String>,
    pub error_message: Option<String>,
    pub started_at: Option<i64>,
    pub completed_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[tauri::command]
pub async fn pipeline_task_list(
    pool: State<'_, Pool>,
    project_id: String,
) -> Result<Vec<PipelineTask>, String> {
    let rows = sqlx::query(
        "SELECT id, project_id, title, description, prompt, status, sort_order, result_summary, error_message, started_at, completed_at, created_at, updated_at FROM pipeline_tasks WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC"
    )
    .bind(&project_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.iter().map(|row| PipelineTask {
        id: row.get("id"),
        project_id: row.get("project_id"),
        title: row.get("title"),
        description: row.get("description"),
        prompt: row.get("prompt"),
        status: row.get("status"),
        sort_order: row.get("sort_order"),
        result_summary: row.get("result_summary"),
        error_message: row.get("error_message"),
        started_at: row.get("started_at"),
        completed_at: row.get("completed_at"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }).collect())
}

#[tauri::command]
pub async fn pipeline_task_create(
    pool: State<'_, Pool>,
    project_id: String,
    title: String,
    description: String,
) -> Result<PipelineTask, String> {
    let id = uni_common::generate_id();
    let now = uni_common::now_unix_secs();

    let max_order: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(sort_order), -1) FROM pipeline_tasks WHERE project_id = ?"
    )
    .bind(&project_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let sort_order = max_order + 1;

    sqlx::query(
        "INSERT INTO pipeline_tasks (id, project_id, title, description, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)"
    )
    .bind(&id)
    .bind(&project_id)
    .bind(&title)
    .bind(&description)
    .bind(sort_order)
    .bind(now)
    .bind(now)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(PipelineTask {
        id,
        project_id,
        title,
        description,
        prompt: None,
        status: "draft".to_string(),
        sort_order,
        result_summary: None,
        error_message: None,
        started_at: None,
        completed_at: None,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub async fn pipeline_task_update(
    pool: State<'_, Pool>,
    id: String,
    title: String,
    description: String,
    prompt: Option<String>,
) -> Result<(), String> {
    let now = uni_common::now_unix_secs();
    sqlx::query(
        "UPDATE pipeline_tasks SET title = ?, description = ?, prompt = ?, updated_at = ? WHERE id = ?"
    )
    .bind(&title)
    .bind(&description)
    .bind(&prompt)
    .bind(now)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn pipeline_task_delete(
    pool: State<'_, Pool>,
    id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM pipeline_tasks WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn pipeline_task_reorder(
    pool: State<'_, Pool>,
    task_ids: Vec<String>,
) -> Result<(), String> {
    let now = uni_common::now_unix_secs();
    for (i, task_id) in task_ids.iter().enumerate() {
        sqlx::query("UPDATE pipeline_tasks SET sort_order = ?, updated_at = ? WHERE id = ?")
            .bind(i as i64)
            .bind(now)
            .bind(task_id)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn pipeline_task_set_status(
    pool: State<'_, Pool>,
    id: String,
    status: String,
) -> Result<(), String> {
    let now = uni_common::now_unix_secs();

    let (started, completed) = match status.as_str() {
        "discussing" | "executing" => (Some(now), None::<i64>),
        "done" | "failed" => (None, Some(now)),
        _ => (None, None),
    };

    if let Some(started_at) = started {
        sqlx::query("UPDATE pipeline_tasks SET status = ?, started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ?")
            .bind(&status).bind(started_at).bind(now).bind(&id)
            .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    } else if let Some(completed_at) = completed {
        sqlx::query("UPDATE pipeline_tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?")
            .bind(&status).bind(completed_at).bind(now).bind(&id)
            .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    } else {
        sqlx::query("UPDATE pipeline_tasks SET status = ?, updated_at = ? WHERE id = ?")
            .bind(&status).bind(now).bind(&id)
            .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn pipeline_task_set_result(
    pool: State<'_, Pool>,
    id: String,
    result_summary: Option<String>,
    error_message: Option<String>,
) -> Result<(), String> {
    let now = uni_common::now_unix_secs();
    sqlx::query("UPDATE pipeline_tasks SET result_summary = ?, error_message = ?, updated_at = ? WHERE id = ?")
        .bind(&result_summary).bind(&error_message).bind(now).bind(&id)
        .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn pipeline_task_set_prompt(
    pool: State<'_, Pool>,
    id: String,
    prompt: String,
) -> Result<(), String> {
    let now = uni_common::now_unix_secs();
    sqlx::query("UPDATE pipeline_tasks SET prompt = ?, status = 'prompt_ready', updated_at = ? WHERE id = ?")
        .bind(&prompt).bind(now).bind(&id)
        .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn pipeline_queue_all(
    pool: State<'_, Pool>,
    project_id: String,
) -> Result<(), String> {
    let now = uni_common::now_unix_secs();
    sqlx::query("UPDATE pipeline_tasks SET status = 'queued', updated_at = ? WHERE project_id = ? AND status = 'draft'")
        .bind(now).bind(&project_id)
        .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    Ok(())
}
