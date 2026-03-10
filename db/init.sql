-- Enable pgcrypto for gen_random_uuid() on older Postgres versions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Separate database for Keycloak
CREATE DATABASE keycloak;
