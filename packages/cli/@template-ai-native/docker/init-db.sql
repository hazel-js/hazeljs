-- Initialize database for HazelJS AI-Native application
-- This script runs when the PostgreSQL container starts for the first time

-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create vector index for similarity search (will be used by Prisma)
-- This ensures the vector extension is ready when Prisma creates indexes
