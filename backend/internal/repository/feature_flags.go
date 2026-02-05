package repository

import (
	"context"
)

// ListFeatureFlags retrieves all feature flags from the database
func (r *Repository) ListFeatureFlags(ctx context.Context) (map[string]bool, error) {
	query := `SELECT key, is_enabled FROM feature_flags`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	flags := make(map[string]bool)
	for rows.Next() {
		var key string
		var isEnabled bool
		if err := rows.Scan(&key, &isEnabled); err != nil {
			return nil, err
		}
		flags[key] = isEnabled
	}
	return flags, nil
}

// GetFeatureFlag retrieves a specific feature flag
func (r *Repository) GetFeatureFlag(ctx context.Context, key string) (bool, error) {
	query := `SELECT is_enabled FROM feature_flags WHERE key = $1`
	var isEnabled bool
	err := r.db.QueryRow(ctx, query, key).Scan(&isEnabled)
	if err != nil {
		return false, err
	}
	return isEnabled, nil
}
