ALTER USER journals WITH ENCRYPTED PASSWORD 'curvenote';
GRANT ALL PRIVILEGES ON DATABASE journals_test TO journals;
GRANT ALL on SCHEMA public TO journals;
ALTER USER journals_test CREATEDB;