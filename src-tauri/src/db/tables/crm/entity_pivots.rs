//! Entity-pivot query functions and the entity-relationship graph builder.
//!
//! This module manages the `entity_pivots` table (links between entities such
//! as contacts, deals, tasks, and their tags/labels/groups) and derives a
//! relationship graph for visualization. All functions are async and return
//! `Result<_, AppDbError>`.

// ── Entity Pivots query functions ─────────────────────────────────────────────

use sqlx::SqlitePool;
use serde::{Deserialize, Serialize};
use crate::db::error::AppDbError;
use crate::db::contacts::schema::EntityPivot;

/// Add a pivot association between an entity and a tag/label/group.
///
/// # Parameters
/// - `entity_type`: the kind of entity (e.g. `contact`, `deal`).
/// - `entity_id`: the entity's primary key.
/// - `pivot_type`: the kind of pivot (e.g. `label`, `group`, `category`).
/// - `pivot_id`: the target pivot's primary key.
///
/// # Returns
/// `Ok(())` on success. `id` is auto-generated (UUID v4) and `created_at` to `now`.
///
/// # Errors
/// Database failures (including duplicate
/// `(entity_type, entity_id, pivot_type, pivot_id)` rows) surface as
/// `AppDbError::Database`.
pub async fn add(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: &str,
    pivot_type: &str,
    pivot_id: &str,
) -> Result<(), AppDbError> {
    let now = chrono::Utc::now().timestamp();
    let id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO entity_pivots (id, entity_type, entity_id, pivot_type, pivot_id, created_at) \
         VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(&id)
    .bind(entity_type)
    .bind(entity_id)
    .bind(pivot_type)
    .bind(pivot_id)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;

    Ok(())
}

/// Remove a specific pivot association.
///
/// # Parameters
/// - `entity_type` / `entity_id`: identify the entity end of the pivot.
/// - `pivot_type` / `pivot_id`: identify the pivot end of the association.
///
/// # Returns
/// `Ok(())` on success. Removing a non-existent pivot is a no-op (not an error).
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn remove(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: &str,
    pivot_type: &str,
    pivot_id: &str,
) -> Result<(), AppDbError> {
    sqlx::query(
        "DELETE FROM entity_pivots \
         WHERE entity_type = ? AND entity_id = ? AND pivot_type = ? AND pivot_id = ?",
    )
    .bind(entity_type)
    .bind(entity_id)
    .bind(pivot_type)
    .bind(pivot_id)
    .execute(pool)
    .await
    .map_err(AppDbError::Database)?;

    Ok(())
}

/// Get all pivots for a given entity.
///
/// # Parameters
/// - `entity_type`: the kind of entity to look up.
/// - `entity_id`: the entity's primary key.
///
/// # Returns
/// A `Vec<EntityPivot>` ordered by `created_at DESC`, possibly empty.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
pub async fn get_for_entity(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: &str,
) -> Result<Vec<EntityPivot>, AppDbError> {
    sqlx::query_as::<_, EntityPivot>(
        "SELECT * FROM entity_pivots WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC",
    )
    .bind(entity_type)
    .bind(entity_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

/// Get all pivots for a given pivot target.
pub async fn get_by_pivot(
    pool: &SqlitePool,
    pivot_type: &str,
    pivot_id: &str,
) -> Result<Vec<EntityPivot>, AppDbError> {
    sqlx::query_as::<_, EntityPivot>(
        "SELECT * FROM entity_pivots WHERE pivot_type = ? AND pivot_id = ? ORDER BY created_at DESC",
    )
    .bind(pivot_type)
    .bind(pivot_id)
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)
}

// ── Entity Relationship Graph ───────────────────────────────────────────────

/// A node in the entity relationship graph.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphNode {
    /// Unique node identifier, formatted as `"{entity_type}:{entity_id}"`.
    pub id: String,
    /// The kind of entity (e.g. `contact`, `deal`, `task`, `campaign`, `company`).
    pub entity_type: String,
    /// Human-readable label, e.g. `"contact:c-1"`.
    pub label: String,
    /// Visual grouping/color key (see `label_to_group`).
    pub group: String,
}

/// An edge (relationship) between two nodes in the graph.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GraphEdge {
    /// Source node `id` (the `"{entity_type}:{entity_id}"` of one endpoint).
    pub source: String,
    /// Target node `id` of the other endpoint.
    pub target: String,
    /// Relationship type, e.g. `shared_label` / `shared_group`.
    pub relationship: String,
}

/// The full graph payload returned to the frontend.
#[derive(Debug, Serialize, Deserialize)]
pub struct GraphData {
    /// All nodes in the graph.
    pub nodes: Vec<GraphNode>,
    /// All edges (relationships) between the nodes.
    pub edges: Vec<GraphEdge>,
}

/// Build a graph of entity relationships from the `entity_pivots` table.
///
/// # Parameters
/// - `depth`: how many relationship hops to follow. Currently simplified — the
///   implementation returns all directly-connected relationships (entities that
///   share the same pivot are linked); `depth` is accepted but not yet used to
///   limit/extend traversal.
///
/// # Returns
/// A `GraphData` containing `nodes` (one per unique entity) and `edges` (one per
/// pair of entities sharing a pivot). Returns empty `nodes`/`edges` when there
/// are no pivots.
///
/// # Errors
/// Database failures surface as `AppDbError::Database`.
///
/// # Behavior
/// Entities sharing the same pivot (`label`/`group`/`category`) become linked
/// nodes. For example, if `contact-A` and `deal-B` both have pivot `label:vip`,
/// they are connected by an edge with relationship `shared_label`.
pub async fn get_entity_graph(
    pool: &SqlitePool,
    _depth: i64,
) -> Result<GraphData, AppDbError> {
    // 1. Fetch ALL entity pivot rows
    let pivots = sqlx::query_as::<_, EntityPivot>(
        "SELECT * FROM entity_pivots ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(AppDbError::Database)?;

    if pivots.is_empty() {
        return Ok(GraphData {
            nodes: vec![],
            edges: vec![],
        });
    }

    // 2. Build a reverse map: (pivot_type, pivot_id) -> list of (entity_type, entity_id)
    // Entities that share the same pivot become linked in the graph.
    use std::collections::HashMap;

    let mut pivot_to_entities: HashMap<(String, String), Vec<(String, String)>> = HashMap::new();

    for pivot in &pivots {
        let ent_key = (pivot.entity_type.clone(), pivot.entity_id.clone());
        let piv_key = (pivot.pivot_type.clone(), pivot.pivot_id.clone());

        pivot_to_entities
            .entry(piv_key)
            .or_default()
            .push(ent_key);
    }

    // 3. Build nodes — one per unique entity
    let mut nodes: Vec<GraphNode> = Vec::new();
    let mut seen_nodes: std::collections::HashSet<(String, String)> = std::collections::HashSet::new();

    for pivot in &pivots {
        let key = (pivot.entity_type.clone(), pivot.entity_id.clone());
        if seen_nodes.insert(key.clone()) {
            let label = format!("{}:{}", &pivot.entity_type, &pivot.entity_id);
            let group = label_to_group(&pivot.entity_type);
            nodes.push(GraphNode {
                id: label.clone(),
                entity_type: pivot.entity_type.clone(),
                label,
                group,
            });
        }
    }

    // 4. Build edges — entities that share the same pivot get connected
    let mut edges: Vec<GraphEdge> = Vec::new();
    let mut seen_edges: std::collections::HashSet<(String, String)> = std::collections::HashSet::new();

    for (_piv_key, entities) in &pivot_to_entities {
        // Connect every pair of entities that share this pivot
        for i in 0..entities.len() {
            for j in (i + 1)..entities.len() {
                let a = &entities[i];
                let b = &entities[j];
                let a_id = format!("{}:{}", a.0, a.1);
                let b_id = format!("{}:{}", b.0, b.1);

                // Canonical ordering to avoid duplicates
                let edge_key = if a_id < b_id {
                    (a_id.clone(), b_id.clone())
                } else {
                    (b_id.clone(), a_id.clone())
                };

                if seen_edges.insert(edge_key) {
                    edges.push(GraphEdge {
                        source: if a_id < b_id { a_id.clone() } else { b_id.clone() },
                        target: if a_id < b_id { b_id.clone() } else { a_id.clone() },
                        relationship: format!("shared_{}", _piv_key.0),
                    });
                }
            }
        }
    }

    Ok(GraphData { nodes, edges })
}

/// Map an entity type to a visual group/color key.
fn label_to_group(entity_type: &str) -> String {
    match entity_type {
        "contact" => "contact".to_string(),
        "deal" => "deal".to_string(),
        "task" => "task".to_string(),
        "campaign" => "campaign".to_string(),
        "company" => "company".to_string(),
        _ => "default".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::tables::test_helpers::helpers;

    #[tokio::test]
    async fn test_add_and_remove_pivot() {
        let pool = helpers::create_memory_pool().await;

        add(&pool, "contact", "c-1", "label", "l-1").await.unwrap();

        let pivots = get_for_entity(&pool, "contact", "c-1").await.unwrap();
        assert_eq!(pivots.len(), 1);
        assert_eq!(pivots[0].pivot_type, "label");
        assert_eq!(pivots[0].pivot_id, "l-1");

        // Remove
        remove(&pool, "contact", "c-1", "label", "l-1").await.unwrap();

        let pivots = get_for_entity(&pool, "contact", "c-1").await.unwrap();
        assert!(pivots.is_empty());

        // Remove non-existent entry does not error
        remove(&pool, "contact", "c-1", "label", "nonexistent").await.unwrap();
    }

    #[tokio::test]
    async fn test_get_for_entity() {
        let pool = helpers::create_memory_pool().await;

        add(&pool, "contact", "c-1", "label", "urgent").await.unwrap();
        add(&pool, "contact", "c-1", "label", "follow-up").await.unwrap();
        add(&pool, "contact", "c-1", "group", "vip").await.unwrap();
        // Different entity
        add(&pool, "contact", "c-2", "label", "other").await.unwrap();

        let pivots = get_for_entity(&pool, "contact", "c-1").await.unwrap();
        assert_eq!(pivots.len(), 3);

        let pivot_types: Vec<&str> = pivots.iter().map(|p| p.pivot_type.as_str()).collect();
        assert!(pivot_types.contains(&"label"));
        assert!(pivot_types.contains(&"group"));

        // Unknown entity returns empty
        let empty = get_for_entity(&pool, "contact", "nonexistent").await.unwrap();
        assert!(empty.is_empty());
    }

    #[tokio::test]
    async fn test_get_by_pivot() {
        let pool = helpers::create_memory_pool().await;

        add(&pool, "contact", "c-1", "label", "vip-label").await.unwrap();
        add(&pool, "contact", "c-2", "label", "vip-label").await.unwrap();
        add(&pool, "deal", "d-1", "label", "vip-label").await.unwrap();
        // Different label
        add(&pool, "contact", "c-3", "label", "other-label").await.unwrap();

        let pivots = get_by_pivot(&pool, "label", "vip-label").await.unwrap();
        assert_eq!(pivots.len(), 3);

        let entities: Vec<&str> = pivots.iter().map(|p| p.entity_id.as_str()).collect();
        assert!(entities.contains(&"c-1"));
        assert!(entities.contains(&"c-2"));
        assert!(entities.contains(&"d-1"));
    }

    #[tokio::test]
    async fn test_add_duplicate_pivot_errors() {
        let pool = helpers::create_memory_pool().await;

        add(&pool, "contact", "c-1", "label", "l-1").await.unwrap();

        // Adding the same UNIQUE combination should error
        let result = add(&pool, "contact", "c-1", "label", "l-1").await;
        assert!(result.is_err(), "duplicate UNIQUE constraint should fail");
    }
}
