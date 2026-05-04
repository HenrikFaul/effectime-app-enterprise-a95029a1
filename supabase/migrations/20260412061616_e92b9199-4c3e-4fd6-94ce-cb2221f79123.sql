
-- Add new granular calendar and requests permission keys for all existing workspace/role combos
-- First, seed new calendar sub-keys based on existing calendar + calendar_sidebar permissions
INSERT INTO enterprise_role_permissions (workspace_id, role_key, feature_key, access_level)
SELECT DISTINCT rp.workspace_id, rp.role_key, new_key.feature_key,
  COALESCE(
    (SELECT rp2.access_level FROM enterprise_role_permissions rp2 
     WHERE rp2.workspace_id = rp.workspace_id AND rp2.role_key = rp.role_key 
     AND rp2.feature_key = CASE 
       WHEN new_key.feature_key IN ('calendar_leave_days','calendar_coverage','calendar_requests','calendar_conflicts') THEN 'calendar_sidebar'
       WHEN new_key.feature_key IN ('requests_own') THEN 'leave_requests_view'
       WHEN new_key.feature_key IN ('requests_team') THEN 'leave_requests_view'
       ELSE 'none'
     END
     LIMIT 1),
    'none'
  ) as access_level
FROM enterprise_role_permissions rp
CROSS JOIN (
  VALUES 
    ('calendar_leave_days'),
    ('calendar_coverage'),
    ('calendar_requests'),
    ('calendar_conflicts'),
    ('requests_own'),
    ('requests_team')
) AS new_key(feature_key)
WHERE NOT EXISTS (
  SELECT 1 FROM enterprise_role_permissions existing 
  WHERE existing.workspace_id = rp.workspace_id 
  AND existing.role_key = rp.role_key 
  AND existing.feature_key = new_key.feature_key
)
GROUP BY rp.workspace_id, rp.role_key, new_key.feature_key;

-- For requests_own: if leave_requests_view was set, copy that; also default to 'readonly' for member roles
UPDATE enterprise_role_permissions SET access_level = 'readonly'
WHERE feature_key = 'requests_own' AND access_level = 'none'
AND role_key IN (
  SELECT DISTINCT role_key FROM enterprise_role_permissions WHERE feature_key = 'leave_requests_submit' AND access_level = 'edit'
);

-- Delete old feature keys that are now replaced by granular sub-keys
DELETE FROM enterprise_role_permissions WHERE feature_key IN ('calendar_sidebar', 'leave_requests_view');
