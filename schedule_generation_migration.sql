-- ACEHUB Schedule Generation Migration Script
-- This script updates the generated_schedules table and related functions
-- to support curriculum-based generation and teacher availability overrides.

-- 1. ALTER TABLE generated_schedules
-- Add a new column to store the configuration used for generation
ALTER TABLE generated_schedules
ADD COLUMN IF NOT EXISTS generation_config JSONB DEFAULT '{}'::jsonb;

-- 2. UPDATE STORED FUNCTIONS

-- Update create_generated_schedule to accept generation_config
CREATE OR REPLACE FUNCTION create_generated_schedule(p_name TEXT, p_config JSONB)
RETURNS UUID AS $$
DECLARE
    new_schedule_id UUID;
BEGIN
    INSERT INTO generated_schedules (name, generation_config)
    VALUES (p_name, p_config)
    RETURNING id INTO new_schedule_id;
    RETURN new_schedule_id;
END;
$$ LANGUAGE plpgsql;

-- Update get_schedules_list to include generation_config
CREATE OR REPLACE FUNCTION get_schedules_list()
RETURNS TABLE(id UUID, name TEXT, generation_config JSONB, created_at TIMESTAMP) AS $$
BEGIN
    RETURN QUERY SELECT s.id, s.name, s.generation_config, s.created_at FROM generated_schedules s ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Add function to get all subjects (non-paginated)
CREATE OR REPLACE FUNCTION get_all_subjects()
RETURNS TABLE(
    curriculumn_version TEXT,
    course_code TEXT,
    course_name TEXT,
    field_of_specialization TEXT,
    lecture_units INT,
    lab_units INT,
    lab_type TEXT,
    year_term TEXT
) AS $$
BEGIN
    RETURN QUERY SELECT * FROM subjects ORDER BY course_name ASC;
END;
$$ LANGUAGE plpgsql;

-- Add function to get distinct curriculum versions
CREATE OR REPLACE FUNCTION get_distinct_curriculum_versions()
RETURNS TABLE(version TEXT) AS $$
BEGIN
    RETURN QUERY SELECT DISTINCT s.curriculumn_version FROM subjects s ORDER BY s.curriculumn_version ASC;
END;
$$ LANGUAGE plpgsql;
