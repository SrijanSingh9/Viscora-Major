CREATE USER vite_user WITH PASSWORD 'strongpassword';
ALTER ROLE vite_user SET client_encoding TO 'utf8';
ALTER ROLE vite_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE vite_user SET timezone TO 'UTC';

ALTER USER vite_user CREATEDB;

GRANT ALL PRIVILEGES ON DATABASE "VISCORA NEXUS" TO vite_user;

GRANT ALL ON SCHEMA public TO vite_user;
ALTER SCHEMA public OWNER TO vite_user;