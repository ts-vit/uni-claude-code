use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileTreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub status: Option<String>,
    pub children: Vec<FileTreeNode>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchInfo {
    pub name: Option<String>,
    pub head_hash: String,
    pub is_detached: bool,
}

/// Parse `git status --porcelain` output into a map of relative path -> status letter
fn parse_git_status(cwd: &Path) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let output = Command::new("git")
        .args(["status", "--porcelain", "-u"])
        .current_dir(cwd)
        .output();
    if let Ok(out) = output {
        let text = String::from_utf8_lossy(&out.stdout);
        for line in text.lines() {
            if line.len() < 4 {
                continue;
            }
            let xy = &line[..2];
            let file_path = line[3..].trim_start_matches("\"").trim_end_matches("\"");
            // Normalize path separators
            let file_path = file_path.replace('\\', "/");

            let status = match xy.trim() {
                "M" | "MM" | "AM" => "modified",
                "A" => "added",
                "D" => "deleted",
                "R" => "renamed",
                "??" => "untracked",
                _ => "modified",
            };
            map.insert(file_path.to_string(), status.to_string());
        }
    }
    map
}

/// Check if a path is inside .git directory or matches common ignored patterns
fn is_ignored_entry(name: &str) -> bool {
    matches!(
        name,
        ".git" | "node_modules" | "target" | ".DS_Store" | "Thumbs.db"
    )
}

/// Propagate git status from files up to parent directories
fn propagate_status(node: &mut FileTreeNode) {
    if node.is_dir {
        for child in &mut node.children {
            propagate_status(child);
        }
        // A directory gets the "most important" status of its children
        let has_status = node.children.iter().any(|c| c.status.is_some());
        if has_status && node.status.is_none() {
            // Find the most prominent status
            for s in &["modified", "untracked", "added", "deleted", "renamed"] {
                if node
                    .children
                    .iter()
                    .any(|c| c.status.as_deref() == Some(s))
                {
                    node.status = Some(s.to_string());
                    break;
                }
            }
        }
    }
}

fn build_tree(
    dir: &Path,
    base: &Path,
    depth: usize,
    max_depth: usize,
    git_status: &HashMap<String, String>,
) -> Vec<FileTreeNode> {
    if depth >= max_depth {
        return vec![];
    }

    let mut entries: Vec<PathBuf> = match std::fs::read_dir(dir) {
        Ok(rd) => rd.filter_map(|e| e.ok().map(|e| e.path())).collect(),
        Err(_) => return vec![],
    };

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        let a_dir = a.is_dir();
        let b_dir = b.is_dir();
        b_dir.cmp(&a_dir).then_with(|| {
            a.file_name()
                .unwrap_or_default()
                .to_ascii_lowercase()
                .cmp(&b.file_name().unwrap_or_default().to_ascii_lowercase())
        })
    });

    let mut nodes = Vec::new();
    for entry in entries {
        let name = entry
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        if is_ignored_entry(&name) {
            continue;
        }

        let rel_path = entry
            .strip_prefix(base)
            .unwrap_or(&entry)
            .to_string_lossy()
            .replace('\\', "/");

        let is_dir = entry.is_dir();

        let status = if !is_dir {
            git_status.get(&rel_path).cloned()
        } else {
            None
        };

        let children = if is_dir {
            build_tree(&entry, base, depth + 1, max_depth, git_status)
        } else {
            vec![]
        };

        nodes.push(FileTreeNode {
            name,
            path: rel_path,
            is_dir,
            status,
            children,
        });
    }

    nodes
}

#[tauri::command]
pub async fn file_tree(cwd: String, max_depth: Option<usize>) -> Result<Vec<FileTreeNode>, String> {
    let path = Path::new(&cwd);
    if !path.is_dir() {
        return Err(format!("Directory not found: {}", cwd));
    }
    let depth = max_depth.unwrap_or(3);
    let git_status = parse_git_status(path);
    let mut tree = build_tree(path, path, 0, depth, &git_status);

    // Propagate git status to parent directories
    for node in &mut tree {
        propagate_status(node);
    }

    Ok(tree)
}

#[tauri::command]
pub async fn file_read(cwd: String, file_path: String) -> Result<String, String> {
    let full_path = Path::new(&cwd).join(&file_path);
    std::fs::read_to_string(&full_path).map_err(|e| format!("Failed to read {}: {}", file_path, e))
}

#[tauri::command]
pub async fn git_branch_info(cwd: String) -> Result<BranchInfo, String> {
    let path = Path::new(&cwd);

    // Try to get branch name
    let branch_output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    let branch_name = String::from_utf8_lossy(&branch_output.stdout)
        .trim()
        .to_string();

    let is_detached = branch_name == "HEAD";

    // Get HEAD hash
    let hash_output = Command::new("git")
        .args(["rev-parse", "--short", "HEAD"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    let head_hash = String::from_utf8_lossy(&hash_output.stdout)
        .trim()
        .to_string();

    Ok(BranchInfo {
        name: if is_detached {
            None
        } else {
            Some(branch_name)
        },
        head_hash,
        is_detached,
    })
}

// === CLAUDE.md support ===

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeMdInfo {
    pub exists: bool,
    pub content: String,
    pub toc: Vec<TocEntryDto>,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TocEntryDto {
    pub level: u8,
    pub text: String,
    pub indent: usize,
}

/// Extract markdown headings from content to build a table of contents
fn extract_toc(content: &str) -> Vec<TocEntryDto> {
    let mut entries = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with('#') {
            let level = trimmed.chars().take_while(|&c| c == '#').count();
            if level >= 1 && level <= 6 {
                let text = trimmed[level..].trim().trim_start_matches('#').trim();
                if !text.is_empty() {
                    entries.push(TocEntryDto {
                        level: level as u8,
                        text: text.to_string(),
                        indent: level.saturating_sub(1),
                    });
                }
            }
        }
    }
    entries
}

/// Read CLAUDE.md from project directory (checks CLAUDE.md, then claude.md)
#[tauri::command]
pub async fn claude_md_read(cwd: String) -> Result<ClaudeMdInfo, String> {
    let path = Path::new(&cwd);

    let candidates = ["CLAUDE.md", "claude.md"];
    for name in &candidates {
        let file_path = path.join(name);
        if file_path.exists() {
            let content = std::fs::read_to_string(&file_path)
                .map_err(|e| format!("Failed to read {}: {}", name, e))?;
            let toc = extract_toc(&content);
            return Ok(ClaudeMdInfo {
                exists: true,
                content,
                toc,
                path: file_path.to_string_lossy().to_string(),
            });
        }
    }

    Ok(ClaudeMdInfo {
        exists: false,
        content: String::new(),
        toc: vec![],
        path: path.join("CLAUDE.md").to_string_lossy().to_string(),
    })
}

/// Write content to CLAUDE.md
#[tauri::command]
pub async fn claude_md_write(cwd: String, content: String) -> Result<(), String> {
    let path = Path::new(&cwd);

    let file_path = if path.join("claude.md").exists() && !path.join("CLAUDE.md").exists() {
        path.join("claude.md")
    } else {
        path.join("CLAUDE.md")
    };

    std::fs::write(&file_path, &content)
        .map_err(|e| format!("Failed to write {}: {}", file_path.display(), e))
}

/// Write/update a file in the project directory
#[tauri::command]
pub async fn file_write(cwd: String, file_path: String, content: String) -> Result<(), String> {
    let full_path = Path::new(&cwd).join(&file_path);

    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    std::fs::write(&full_path, &content)
        .map_err(|e| format!("Failed to write {}: {}", file_path, e))
}

// === Diff support ===

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiffDto {
    pub path: String,
    pub hunks: Vec<DiffHunkDto>,
    pub is_binary: bool,
    pub additions: u32,
    pub deletions: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunkDto {
    pub header: String,
    pub lines: Vec<DiffLineDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLineDto {
    pub kind: String,
    pub content: String,
    pub old_line: Option<u32>,
    pub new_line: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFileDto {
    pub path: String,
    pub status: String,
}

/// Parse `git diff` output for a single file into structured hunks
fn parse_diff_output(file_path: &str, output: &str) -> FileDiffDto {
    let mut hunks: Vec<DiffHunkDto> = Vec::new();
    let mut additions: u32 = 0;
    let mut deletions: u32 = 0;
    let mut is_binary = false;

    let mut current_hunk: Option<DiffHunkDto> = None;
    let mut old_line: u32 = 0;
    let mut new_line: u32 = 0;

    for line in output.lines() {
        if line.starts_with("Binary files") {
            is_binary = true;
            continue;
        }

        if line.starts_with("@@") {
            // Save previous hunk
            if let Some(h) = current_hunk.take() {
                hunks.push(h);
            }

            // Parse hunk header: @@ -old_start,old_count +new_start,new_count @@
            let header = line.to_string();
            // Extract line numbers from header
            let parts: Vec<&str> = line.splitn(4, ' ').collect();
            if parts.len() >= 3 {
                if let Some(old_str) = parts[1].strip_prefix('-') {
                    old_line = old_str.split(',').next()
                        .and_then(|s| s.parse::<u32>().ok())
                        .unwrap_or(1);
                }
                if let Some(new_str) = parts[2].strip_prefix('+') {
                    new_line = new_str.split(',').next()
                        .and_then(|s| s.parse::<u32>().ok())
                        .unwrap_or(1);
                }
            }

            current_hunk = Some(DiffHunkDto {
                header,
                lines: Vec::new(),
            });
            continue;
        }

        if let Some(ref mut hunk) = current_hunk {
            if line.starts_with('+') {
                additions += 1;
                hunk.lines.push(DiffLineDto {
                    kind: "addition".to_string(),
                    content: line[1..].to_string(),
                    old_line: None,
                    new_line: Some(new_line),
                });
                new_line += 1;
            } else if line.starts_with('-') {
                deletions += 1;
                hunk.lines.push(DiffLineDto {
                    kind: "deletion".to_string(),
                    content: line[1..].to_string(),
                    old_line: Some(old_line),
                    new_line: None,
                });
                old_line += 1;
            } else if line.starts_with(' ') {
                hunk.lines.push(DiffLineDto {
                    kind: "context".to_string(),
                    content: line[1..].to_string(),
                    old_line: Some(old_line),
                    new_line: Some(new_line),
                });
                old_line += 1;
                new_line += 1;
            } else if line == "\\ No newline at end of file" {
                // skip
            }
        }
    }

    if let Some(h) = current_hunk {
        hunks.push(h);
    }

    FileDiffDto {
        path: file_path.to_string(),
        hunks,
        is_binary,
        additions,
        deletions,
    }
}

/// Get diff for a specific file (working tree vs HEAD)
#[tauri::command]
pub async fn file_diff(cwd: String, file_path: String) -> Result<FileDiffDto, String> {
    let path = Path::new(&cwd);

    // Try tracked file diff first
    let output = Command::new("git")
        .args(["diff", "HEAD", "--", &file_path])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;

    let text = String::from_utf8_lossy(&output.stdout);

    if text.trim().is_empty() {
        // Maybe untracked file — show entire file as additions
        let full_path = path.join(&file_path);
        if full_path.exists() {
            let content = std::fs::read_to_string(&full_path)
                .map_err(|e| format!("Failed to read {}: {}", file_path, e))?;
            let lines: Vec<DiffLineDto> = content
                .lines()
                .enumerate()
                .map(|(i, l)| DiffLineDto {
                    kind: "addition".to_string(),
                    content: l.to_string(),
                    old_line: None,
                    new_line: Some(i as u32 + 1),
                })
                .collect();
            let additions = lines.len() as u32;
            return Ok(FileDiffDto {
                path: file_path,
                hunks: if lines.is_empty() {
                    vec![]
                } else {
                    vec![DiffHunkDto {
                        header: format!("@@ -0,0 +1,{} @@ (new file)", additions),
                        lines,
                    }]
                },
                is_binary: false,
                additions,
                deletions: 0,
            });
        }
        return Ok(FileDiffDto {
            path: file_path,
            hunks: vec![],
            is_binary: false,
            additions: 0,
            deletions: 0,
        });
    }

    Ok(parse_diff_output(&file_path, &text))
}

/// Get list of all changed files (working tree vs HEAD)
#[tauri::command]
pub async fn git_changed_files(cwd: String) -> Result<Vec<ChangedFileDto>, String> {
    let path = Path::new(&cwd);
    let statuses = parse_git_status(path);

    Ok(statuses
        .into_iter()
        .map(|(file_path, status)| ChangedFileDto {
            path: file_path,
            status,
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_tree_node_serialize() {
        let node = FileTreeNode {
            name: "src".to_string(),
            path: "src".to_string(),
            is_dir: true,
            status: None,
            children: vec![FileTreeNode {
                name: "main.rs".to_string(),
                path: "src/main.rs".to_string(),
                is_dir: false,
                status: Some("modified".to_string()),
                children: vec![],
            }],
        };
        let json = serde_json::to_value(&node).unwrap();
        assert_eq!(json["isDir"], true);
        assert_eq!(json["children"][0]["status"], "modified");
    }

    #[test]
    fn test_branch_info_serialize() {
        let info = BranchInfo {
            name: Some("main".to_string()),
            head_hash: "abc123".to_string(),
            is_detached: false,
        };
        let json = serde_json::to_value(&info).unwrap();
        assert_eq!(json["headHash"], "abc123");
        assert_eq!(json["isDetached"], false);
    }

    #[test]
    fn test_is_ignored_entry() {
        assert!(is_ignored_entry(".git"));
        assert!(is_ignored_entry("node_modules"));
        assert!(is_ignored_entry("target"));
        assert!(!is_ignored_entry("src"));
        assert!(!is_ignored_entry("Cargo.toml"));
    }

    #[test]
    fn test_claude_md_info_serialize() {
        let info = ClaudeMdInfo {
            exists: true,
            content: "# Test".to_string(),
            toc: vec![TocEntryDto {
                level: 1,
                text: "Test".to_string(),
                indent: 0,
            }],
            path: "/tmp/CLAUDE.md".to_string(),
        };
        let json = serde_json::to_value(&info).unwrap();
        assert_eq!(json["exists"], true);
        assert_eq!(json["toc"][0]["text"], "Test");
        assert_eq!(json["toc"][0]["level"], 1);
    }

    #[test]
    fn test_extract_toc() {
        let content = "# Title\n\nSome text\n\n## Section A\n\nMore text\n\n### Sub-section\n\n## Section B\n";
        let toc = extract_toc(content);
        assert_eq!(toc.len(), 4);
        assert_eq!(toc[0].level, 1);
        assert_eq!(toc[0].text, "Title");
        assert_eq!(toc[0].indent, 0);
        assert_eq!(toc[1].level, 2);
        assert_eq!(toc[1].text, "Section A");
        assert_eq!(toc[1].indent, 1);
        assert_eq!(toc[2].level, 3);
        assert_eq!(toc[2].text, "Sub-section");
        assert_eq!(toc[2].indent, 2);
        assert_eq!(toc[3].text, "Section B");
    }

    #[test]
    fn test_extract_toc_empty() {
        let toc = extract_toc("No headings here\nJust plain text");
        assert!(toc.is_empty());
    }

    #[test]
    fn test_file_diff_dto_serialize() {
        let dto = FileDiffDto {
            path: "src/main.rs".to_string(),
            hunks: vec![DiffHunkDto {
                header: "@@ -1,3 +1,4 @@".to_string(),
                lines: vec![DiffLineDto {
                    kind: "addition".to_string(),
                    content: "new line".to_string(),
                    old_line: None,
                    new_line: Some(4),
                }],
            }],
            is_binary: false,
            additions: 1,
            deletions: 0,
        };
        let json = serde_json::to_value(&dto).unwrap();
        assert_eq!(json["isBinary"], false);
        assert_eq!(json["hunks"][0]["lines"][0]["kind"], "addition");
        assert_eq!(json["hunks"][0]["lines"][0]["newLine"], 4);
    }

    #[test]
    fn test_changed_file_dto_serialize() {
        let dto = ChangedFileDto {
            path: "src/lib.rs".to_string(),
            status: "modified".to_string(),
        };
        let json = serde_json::to_value(&dto).unwrap();
        assert_eq!(json["path"], "src/lib.rs");
        assert_eq!(json["status"], "modified");
    }

    #[test]
    fn test_parse_diff_output() {
        let diff_text = r#"diff --git a/src/main.rs b/src/main.rs
index abc..def 100644
--- a/src/main.rs
+++ b/src/main.rs
@@ -1,3 +1,4 @@
 fn main() {
-    println!("old");
+    println!("new");
+    println!("added");
 }
"#;
        let result = parse_diff_output("src/main.rs", diff_text);
        assert_eq!(result.path, "src/main.rs");
        assert_eq!(result.additions, 2);
        assert_eq!(result.deletions, 1);
        assert_eq!(result.hunks.len(), 1);
        // context "fn main() {", deletion "old", addition "new", addition "added", context "}"
        assert_eq!(result.hunks[0].lines.len(), 5);
    }

    #[test]
    fn test_parse_diff_output_binary() {
        let diff_text = "Binary files a/image.png and b/image.png differ\n";
        let result = parse_diff_output("image.png", diff_text);
        assert!(result.is_binary);
        assert_eq!(result.hunks.len(), 0);
    }

    #[test]
    fn test_propagate_status() {
        let mut node = FileTreeNode {
            name: "src".to_string(),
            path: "src".to_string(),
            is_dir: true,
            status: None,
            children: vec![
                FileTreeNode {
                    name: "main.rs".to_string(),
                    path: "src/main.rs".to_string(),
                    is_dir: false,
                    status: Some("modified".to_string()),
                    children: vec![],
                },
                FileTreeNode {
                    name: "lib.rs".to_string(),
                    path: "src/lib.rs".to_string(),
                    is_dir: false,
                    status: None,
                    children: vec![],
                },
            ],
        };
        propagate_status(&mut node);
        assert_eq!(node.status, Some("modified".to_string()));
    }
}
