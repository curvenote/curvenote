/*
  Manual migration steps:
  - insert service account user
*/
INSERT INTO "User" ("id", date_created, email, display_name, system_role)
VALUES
('018b9034-d660-7a20-9135-5794c1eb0bfb', '2023-02-01T00:00:00.000Z', 'submissions@curvenote.com', 'Curvenote Submissions', 'SERVICE');