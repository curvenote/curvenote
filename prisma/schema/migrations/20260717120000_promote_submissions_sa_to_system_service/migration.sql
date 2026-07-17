-- Platform submissions SA (seeded in 20231102145516) should use SYSTEM_SERVICE,
-- not the site-scoped SERVICE role.
UPDATE "User"
SET system_role = 'SYSTEM_SERVICE'
WHERE id = '018b9034-d660-7a20-9135-5794c1eb0bfb'
  AND system_role = 'SERVICE';
